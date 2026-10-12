import { lstat, mkdir, readFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { canonicalDirectoryWithoutLinks } from './semantic-paths.mjs';
import { installImmutable, sha256, stableJson } from './semantic-target-v2-common.mjs';

const HASH = /^[0-9a-f]{64}$/;
async function regularBytes(path, maximum) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) throw new Error('Unsafe runtime archive object');
  return readFile(path);
}

// A saved inventory is an integrity record, never a numerical verification receipt.
export async function checkRuntimeArchive({ archiveDir, corpus, targetId }) {
  const root = join(resolve(archiveDir), corpus.manifest.corpusId, 'targets', String(targetId).padStart(10, '0'));
  await canonicalDirectoryWithoutLinks(root);
  await canonicalDirectoryWithoutLinks(join(root, "pages"));
  const pointer = JSON.parse(await regularBytes(join(root, 'archive.json'), 1024));
  if (!HASH.test(pointer.sha256) || pointer.file !== `inventory-${pointer.sha256}.json`) throw new Error('Invalid runtime archive pointer');
  const bytes = await regularBytes(join(root, pointer.file), 128 * 1024);
  if (sha256(bytes) !== pointer.sha256) throw new Error('Runtime archive inventory hash mismatch');
  const inventory = JSON.parse(bytes);
  if (inventory.schemaVersion !== 1 || inventory.corpusId !== corpus.manifest.corpusId || inventory.corpusManifestSha256 !== corpus.manifestSha256 || inventory.targetId !== targetId || !HASH.test(inventory.targetManifestSha256) || !HASH.test(inventory.evidenceSha256) || !Array.isArray(inventory.objects) || inventory.objects.length > 10000) throw new Error('Runtime archive identity mismatch');
  const seen = new Set();
  for (const object of inventory.objects) {
    if (!/^(active\.json|manifest-[a-f0-9]{16}-[a-f0-9]{16}\.json|pages\/(values|order)-\d{10}-[a-f0-9]{16}\.brt\.gz|evidence\.json)$/.test(object.path) || seen.has(object.path) || !HASH.test(object.sha256) || !Number.isSafeInteger(object.bytes) || object.bytes < 1 || object.bytes > 2 * 1024 * 1024) throw new Error('Invalid runtime archive object inventory');
    seen.add(object.path);
    const content = await regularBytes(join(root, object.path), object.bytes);
    if (content.length !== object.bytes || sha256(content) !== object.sha256) throw new Error(`Runtime archive object mismatch: ${object.path}`);
  }
  const active = JSON.parse(await regularBytes(join(root, 'active.json'), 4096));
  if (basename(active.manifest) !== active.manifest || active.manifestSha256 !== inventory.targetManifestSha256) throw new Error('Runtime archive manifest mismatch');
  const manifestBytes = await regularBytes(join(root, active.manifest), 2 * 1024 * 1024);
  if (sha256(manifestBytes) !== active.manifestSha256) throw new Error('Runtime archive manifest hash mismatch');
  const manifest = JSON.parse(manifestBytes);
  const expected = ['active.json', active.manifest, 'evidence.json', ...manifest.valuePages.map(p => `pages/${p.file}`), ...manifest.orderPages.map(p => `pages/${p.file}`)].sort();
  if (stableJson([...seen].sort()) !== stableJson(expected)) throw new Error('Runtime archive is not the complete canonical target inventory');
  const evidence = JSON.parse(await regularBytes(join(root, 'evidence.json'), 2 * 1024 * 1024));
  if (sha256(Buffer.from(stableJson(evidence))) !== inventory.evidenceSha256 || evidence.target.id !== targetId || evidence.targetManifest.sha256 !== inventory.targetManifestSha256 || evidence.targetManifest.utf8 !== manifestBytes.toString('utf8')) throw new Error('Runtime archive evidence binding mismatch');
  return { root, inventorySha256: pointer.sha256, ...inventory };
}

// Only called by capture while its independent numerical verifier's guard is held.
// Consumers MUST independently verify before activating/restoring runtime data.
export async function archiveVerifiedRuntime({ targetsDir, archiveDir, corpus, verified, evidenceBytes, evidenceSha256 }) {
  const source = join(resolve(targetsDir), corpus.manifest.corpusId, 'targets', String(verified.targetId).padStart(10, '0'));
  await canonicalDirectoryWithoutLinks(source);
  await mkdir(archiveDir, { recursive: true });
  const canonicalArchive = await canonicalDirectoryWithoutLinks(archiveDir);
  const canonicalTargets = await canonicalDirectoryWithoutLinks(join(resolve(targetsDir), corpus.manifest.corpusId, 'targets'));
  if (canonicalArchive === canonicalTargets || canonicalArchive.startsWith(`${canonicalTargets}${sep}`) || canonicalTargets.startsWith(`${canonicalArchive}${sep}`)) throw new Error('Runtime archive must be separate from target staging');
  const root = join(canonicalArchive, corpus.manifest.corpusId, 'targets', String(verified.targetId).padStart(10, '0'));
  await mkdir(join(root, 'pages'), { recursive: true });
  await canonicalDirectoryWithoutLinks(join(root, 'pages'));
  const activeBytes = await regularBytes(join(source, 'active.json'), 4096);
  const active = JSON.parse(activeBytes);
  if (basename(active.manifest) !== active.manifest || active.manifestSha256 !== verified.manifestSha256) throw new Error('Active target changed before runtime archive');
  const manifestBytes = Buffer.from(verified.manifestUtf8);
  if (sha256(manifestBytes) !== verified.manifestSha256) throw new Error('Verified manifest changed before runtime archive');
  const manifest = JSON.parse(verified.manifestUtf8); const objects = [];
  async function install(path, bytes) {
    // No archive symlink may redirect immutable installs, even on restart.
    try { const info = await lstat(join(root, path)); if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe runtime archive destination'); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
    await installImmutable(join(root, path), bytes);
    objects.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
  }
  await install('active.json', activeBytes); await install(active.manifest, manifestBytes);
  for (const page of [...manifest.valuePages, ...manifest.orderPages]) {
    const bytes = await regularBytes(join(source, 'pages', page.file), page.compressedBytes);
    if (bytes.length !== page.compressedBytes || sha256(bytes) !== page.objectSha256) throw new Error(`Target page changed before runtime archive: ${page.file}`);
    await install(`pages/${page.file}`, bytes);
  }
  await install('evidence.json', evidenceBytes);
  const inventory = { schemaVersion: 1, corpusId: corpus.manifest.corpusId, corpusManifestSha256: corpus.manifestSha256, targetId: verified.targetId, targetManifestSha256: verified.manifestSha256, evidenceSha256, objects: objects.sort((a, b) => a.path.localeCompare(b.path)) };
  const bytes = Buffer.from(`${JSON.stringify(inventory, null, 2)}\n`); const digest = sha256(bytes);
  await installImmutable(join(root, `inventory-${digest}.json`), bytes);
  await installImmutable(join(root, 'archive.json'), `${JSON.stringify({ file: `inventory-${digest}.json`, sha256: digest })}\n`);
  const checked = await checkRuntimeArchive({ archiveDir: canonicalArchive, corpus, targetId: verified.targetId });
  return { inventorySha256: checked.inventorySha256, targetManifestSha256: verified.manifestSha256, evidenceSha256, objects: objects.length, bytes: objects.reduce((n, o) => n + o.bytes, 0) };
}
