import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { LocalBackupTransfer } from '../components/local-backup-transfer';
import { createLocalBackup } from '../lib/local-backup';
import { SyncMemory } from '../lib/device-sync';
import { loadLocalProfile } from '../lib/profile-storage';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
class Memory extends SyncMemory { removeItem(key: string) { this.values.delete(key); } clear() { this.values.clear(); } }
const saved = { guesses: [{ word: 'arbre', rank: 200, temperature: 12, found: false, order: 1 }], pins: [], hints: 0, startedAt: 1 };
function content(node: ReactTestInstance): string { return node.children.map(child => typeof child === 'string' ? child : content(child)).join(''); }
function buttons(tree: ReactTestRenderer, label: string) { return tree.root.findAll(node => node.type === 'button' && content(node) === label); }
async function click(tree: ReactTestRenderer, label: string) { const button = buttons(tree, label)[0]; assert.ok(button, label); await act(async () => button.props.onClick()); }
function fixture() { const storage = new Memory(); storage.setItem('braise.v1.game.free-0012', JSON.stringify(saved)); return createLocalBackup(storage, loadLocalProfile(storage), new Date('2026-10-01T12:00:00Z')).text; }
async function file(tree: ReactTestRenderer, text: string, filename = 'braiz-sauvegarde.json') { await act(async () => tree.root.findByProps({ type: 'file' }).props.onChange({ currentTarget: { value: 'selected', files: [{ name: filename, size: new TextEncoder().encode(text).length, text: async () => text }] } })); }
function browser(storage: Memory) { Object.assign(globalThis, { window: { localStorage: storage }, localStorage: storage }); }

test('selecting and cancelling a valid file never writes; only explicit confirmation imports and updates the board', async () => {
  const storage = new Memory(); browser(storage); const snapshot = loadLocalProfile(storage), before = [...storage.values]; let updates = 0, admissions = 0;
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(createElement(LocalBackupTransfer, { snapshot, onSnapshot: () => updates++, mergeGuard: { revision: () => 'board-1', admit: revision => { assert.equal(revision, 'board-1'); admissions++; return true; } } })); });
  try {
    await file(tree, fixture()); assert.deepEqual([...storage.values], before); assert.equal(updates, 0); assert.equal(admissions, 0);
    await click(tree, 'Annuler'); assert.deepEqual([...storage.values], before); assert.equal(buttons(tree, 'Confirmer l’import').length, 0);
    await file(tree, fixture()); await click(tree, 'Confirmer l’import');
    assert.equal(updates, 1); assert.equal(admissions, 1); assert.equal(JSON.parse(storage.getItem('braise.v1.game.free-0012')!).guesses[0].word, 'arbre');
    assert.equal(buttons(tree, 'Confirmer l’import').length, 0);
  } finally { await act(async () => tree.unmount()); }
});

test('conflicts show the unchanged local copy and never offer a confirmation button', async () => {
  const storage = new Memory(); storage.setItem('braise.v1.game.free-0012', JSON.stringify({ ...saved, guesses: [{ ...saved.guesses[0], rank: 22 }] })); browser(storage);
  const snapshot = loadLocalProfile(storage), before = [...storage.values]; let tree!: ReactTestRenderer;
  await act(async () => { tree = create(createElement(LocalBackupTransfer, { snapshot, onSnapshot: () => assert.fail('no import') })); });
  try { await file(tree, fixture()); assert.equal(buttons(tree, 'Confirmer l’import').length, 0); assert.match(content(tree.root.findByProps({ role: 'alert' })), /Import bloqué/); assert.deepEqual([...storage.values], before); }
  finally { await act(async () => tree.unmount()); }
});

test('a stale local revision or changed board requires a refreshed preview before import', async () => {
  for (const change of ['storage', 'board']) {
    const storage = new Memory(); browser(storage); const snapshot = loadLocalProfile(storage); let revision = 'initial', tree!: ReactTestRenderer;
    await act(async () => { tree = create(createElement(LocalBackupTransfer, { snapshot, onSnapshot: () => assert.fail('no import'), mergeGuard: { revision: () => revision, admit: () => assert.fail('must reject before admission') } })); });
    try {
      await file(tree, fixture());
      if (change === 'storage') storage.setItem('braise.v1.game.free-32', JSON.stringify(saved)); else revision = 'changed';
      const before = [...storage.values]; await click(tree, 'Confirmer l’import'); assert.match(content(tree.root.findByProps({ role: 'alert' })), /changé/); assert.deepEqual([...storage.values], before);
    } finally { await act(async () => tree.unmount()); }
  }
});

test('a slower earlier file cannot replace the newer preview and disabled state blocks a retained handler', async () => {
  const storage = new Memory(); browser(storage); const snapshot = loadLocalProfile(storage); let resolve!: (text: string) => void, tree!: ReactTestRenderer;
  const props = { snapshot, onSnapshot: () => assert.fail('no import') };
  await act(async () => { tree = create(createElement(LocalBackupTransfer, props)); });
  try {
    let pending!: Promise<void>;
    await act(async () => { pending = tree.root.findByProps({ type: 'file' }).props.onChange({ currentTarget: { value: 'old', files: [{ name: 'ancien.json', size: 100, text: () => new Promise<string>(done => { resolve = done; }) }] } }); });
    await file(tree, fixture(), 'recent.json'); await act(async () => { resolve(fixture()); await pending; });
    assert.match(content(tree.root), /recent.json/); assert.doesNotMatch(content(tree.root), /ancien.json/);
    const confirm = buttons(tree, 'Confirmer l’import')[0].props.onClick, before = [...storage.values];
    await act(async () => tree.update(createElement(LocalBackupTransfer, { ...props, disabled: true })));
    await act(async () => confirm()); assert.deepEqual([...storage.values], before); assert.match(content(tree.root.findByProps({ role: 'alert' })), /enregistrement/);
  } finally { await act(async () => tree.unmount()); }
});

test('an unsaved live guess blocks both preview and confirmation even when another game is imported', async () => {
  for (const phase of ['preview', 'confirmation']) {
    const storage = new Memory(); storage.setItem('braise.v1.game.free-0012', JSON.stringify(saved)); browser(storage);
    const source = new Memory(); source.setItem('braise.v1.game.free-99', JSON.stringify(saved));
    const incoming = createLocalBackup(source, loadLocalProfile(source)).text;
    const unsaved = { ...saved, guesses: [...saved.guesses, { word: 'jardin', rank: 42, temperature: 35, found: false, order: 2 }] };
    let live = phase === 'preview' ? unsaved : saved, reads = 0, tree!: ReactTestRenderer;
    const snapshot = loadLocalProfile(storage), before = [...storage.values];
    await act(async () => { tree = create(createElement(LocalBackupTransfer, { snapshot, onSnapshot: () => assert.fail('must not reload the disk board'), mergeGuard: { revision: () => 'unchanged-board', admit: () => assert.fail('must reject before admission'), currentGame: () => { reads++; return { id: 'free-0012', game: live }; } } })); });
    try {
      await file(tree, incoming);
      if (phase === 'confirmation') { live = unsaved; await click(tree, 'Confirmer l’import'); }
      else assert.equal(buttons(tree, 'Confirmer l’import').length, 0);
      assert.match(content(tree.root.findByProps({ role: 'alert' })), /partie en mémoire.*incomplète/);
      assert.deepEqual([...storage.values], before); assert.ok(reads >= (phase === 'preview' ? 1 : 2));
      assert.equal(live.guesses.length, 2);
    } finally { await act(async () => tree.unmount()); }
  }
});
