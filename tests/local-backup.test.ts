import test from 'node:test';
import assert from 'node:assert/strict';
import { SyncMemory, parseDeviceEnvelope, createDeviceEnvelope } from '../lib/device-sync';
import { createLocalBackup, inspectLocalBackup, importLocalBackup, parseLocalBackup } from '../lib/local-backup';
import { createLocalProfileExport, loadLocalProfile, recordLocalGameProgress, PROFILE_V1_BACKUP_PREFIX } from '../lib/profile-storage';
import { PLAY_CONTEXT_KEY } from '../lib/play-hub';
import { word2vecDocument } from '../lib/word2vec-storage';
import { dailyV2Document } from '../lib/daily-v2-storage';
import type { SavedGame } from '../lib/game-types';

const now = new Date('2026-10-29T12:00:00Z');
class Memory extends SyncMemory {
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
const key = (id: string) => `braise.v1.game.${id}`;
function game(word = 'arbre'): SavedGame { return { guesses: [{ word, rank: 200, temperature: 20, found: false, order: 1 }], pins: [], hints: 0, startedAt: Date.parse('2026-10-12T12:00:00Z') }; }
function closed(): SavedGame { return { ...game(), guesses: [...game().guesses, { word: 'forêt', rank: 1, temperature: 100, found: true, order: 2 }], solvedAt: Date.parse('2026-10-13T12:00:00Z'), completedMode: 'free' }; }
function source() { const storage = new Memory(); storage.setItem(key('free-0012'), JSON.stringify(game())); return storage; }
function backup(storage: Memory) { return createLocalBackup(storage, loadLocalProfile(storage), now).text; }
function apply(text: string, destination: Memory) { const snapshot = loadLocalProfile(destination), plan = inspectLocalBackup(text, destination, snapshot, now); assert.equal(plan.conflicts.length, 0); return importLocalBackup(text, plan.revision, destination as unknown as Storage, snapshot, now); }

test('portable backup includes open and closed classic saves; keeps raw source and excludes secrets', () => {
  const storage = source(); storage.setItem(key('free-13'), JSON.stringify(closed()));
  storage.setItem('braiz.session', 'private-session'); storage.setItem('braiz.training.something', 'not-a-classic-game');
  const snapshot = loadLocalProfile(storage), before = [...storage.values];
  const result = createLocalBackup(storage, snapshot, now), payload = parseLocalBackup(result.text, now);
  assert.equal(payload.games.length, 2); assert.equal(payload.games[0].id, 'free-0012');
  assert.equal(payload.games[1].raw, storage.getItem(key('free-13')));
  assert.equal(JSON.parse(payload.profile).scope, 'profile-only');
  assert.ok(!result.text.includes('private-session')); assert.ok(!result.text.includes('not-a-classic-game'));
  assert.deepEqual([...storage.values], before);
  assert.throws(() => parseDeviceEnvelope(result.text, now));
  const remote = parseDeviceEnvelope(createDeviceEnvelope(storage, snapshot, now), now);
  assert.equal(remote.games.length, 1, 'server copy still excludes completed games');
});

test('mixed V1, daily V2 and Word2Vec identities, scores and contexts survive the round trip', () => {
  const mixedNow = new Date('2027-01-06T12:00:00Z');
  const storage = source(), modern = { ...game('jardin'), guesses: [{ ...game('jardin').guesses[0], rank: 100000 }], startedAt: now.getTime() - 1000 };
  storage.setItem(key('daily-w2v-2026-10-29'), JSON.stringify(word2vecDocument('daily-w2v-2026-10-29', modern)));
  storage.setItem(key('daily-v2-2027-01-05'), JSON.stringify(dailyV2Document('daily-v2-2027-01-05', { ...game(), startedAt: Date.parse('2027-01-05T12:00:00Z') })));
  storage.setItem(PLAY_CONTEXT_KEY, JSON.stringify({ version: 1, items: { 'free-0012': { mode: 'challenge' }, 'daily-w2v-2026-10-29': { mode: 'daily' }, 'daily-v2-2027-01-05': { mode: 'archive' } } }));
  const destination = new Memory(), profile = loadLocalProfile(destination), text = createLocalBackup(storage, loadLocalProfile(storage), mixedNow).text;
  const preview = inspectLocalBackup(text, destination, profile, mixedNow); assert.equal(preview.conflicts.length, 0);
  importLocalBackup(text, preview.revision, destination as unknown as Storage, profile, mixedNow);
  assert.equal(JSON.parse(destination.getItem(key('daily-w2v-2026-10-29'))!).game.guesses[0].rank, 100000);
  assert.equal(JSON.parse(destination.getItem(key('daily-v2-2027-01-05'))!).schemaVersion, 2);
  assert.equal(JSON.parse(destination.getItem(key('free-0012'))!).guesses[0].temperature, 20);
  assert.equal(JSON.parse(destination.getItem(PLAY_CONTEXT_KEY)!).items['free-0012'].mode, 'challenge');
});

test('preview lists conflicts and additions without writes, and one conflict blocks the whole import', () => {
  const storage = source(); storage.setItem(key('free-13'), JSON.stringify(game('bois')));
  const destination = source(); destination.setItem(key('free-0012'), JSON.stringify({ ...game(), guesses: [{ ...game().guesses[0], rank: 9 }] }));
  const snapshot = loadLocalProfile(destination), before = [...destination.values], text = backup(storage);
  const preview = inspectLocalBackup(text, destination, snapshot, now);
  assert.equal(preview.games[0].status, 'conflict'); assert.equal(preview.games[1].status, 'add');
  assert.equal(preview.conflicts.length, 1); assert.deepEqual([...destination.values], before);
  assert.throws(() => importLocalBackup(text, preview.revision, destination as unknown as Storage, snapshot, now), /conflits/);
  assert.deepEqual([...destination.values], before);
});

test('compatible open games merge every guess and consumed hint, then repeat import is neutral', () => {
  const storage = source(), destination = source();
  storage.setItem(key('free-0012'), JSON.stringify({ ...game(), guesses: [{ ...game().guesses[0], hint: true }], hints: 1 }));
  destination.setItem(key('free-0012'), JSON.stringify(game('bois')));
  const text = backup(storage), profile = apply(text, destination), merged = JSON.parse(destination.getItem(key('free-0012'))!);
  assert.deepEqual(merged.guesses.map((guess: { word: string }) => guess.word), ['bois', 'arbre']);
  assert.equal(merged.hints, 1); assert.equal(merged.profileV2StartIndex, 2); assert.equal(profile.profile.guesses, 0);
  const before = [...destination.values], preview = inspectLocalBackup(text, destination, profile, now);
  assert.equal(preview.changed, false); apply(text, destination); assert.deepEqual([...destination.values], before);
});

test('completion can extend its own unfinished prefix but cannot swallow another branch', () => {
  const storage = source(); storage.setItem(key('free-0012'), JSON.stringify(closed()));
  const text = backup(storage), destination = source(); apply(text, destination);
  const saved = JSON.parse(destination.getItem(key('free-0012'))!); assert.equal(saved.solvedAt, closed().solvedAt); assert.equal(saved.guesses.length, 2);
  const branched = source(); branched.setItem(key('free-0012'), JSON.stringify(game('rivière')));
  const snapshot = loadLocalProfile(branched), before = [...branched.values], plan = inspectLocalBackup(text, branched, snapshot, now);
  assert.equal(plan.games[0].status, 'conflict'); assert.deepEqual([...branched.values], before);
});

test('two differently dated completed games cannot silently overwrite a result', () => {
  const storage = source(), destination = source();
  storage.setItem(key('free-0012'), JSON.stringify(closed())); destination.setItem(key('free-0012'), JSON.stringify({ ...closed(), solvedAt: closed().solvedAt! + 1000 }));
  const profile = loadLocalProfile(destination), before = [...destination.values];
  const plan = inspectLocalBackup(backup(storage), destination, profile, now); assert.equal(plan.conflicts.length, 1); assert.match(plan.conflicts[0], /fins différentes/); assert.deepEqual([...destination.values], before);
});

test('legacy baseline is preserved byte for byte and different baselines block before writes', () => {
  const storage = source(), legacy = '{"wins":[],"guesses":12,"sound":false}'; storage.setItem('braise.v1.profile', legacy);
  const text = backup(storage), destination = new Memory(); apply(text, destination);
  assert.equal(loadLocalProfile(destination).transferLegacyRaw, legacy);
  assert.ok([...storage.values].some(([name, raw]) => name.startsWith(PROFILE_V1_BACKUP_PREFIX) && raw === legacy));
  assert.equal(destination.getItem('braise.v1.profile'), null, 'import does not invent a native V1 profile');
  assert.equal(storage.getItem('braise.v1.profile'), legacy);
  const other = source(); other.setItem('braise.v1.profile', '{"wins":[],"guesses":13,"sound":false}');
  const profile = loadLocalProfile(other), before = [...other.values], plan = inspectLocalBackup(text, other, profile, now);
  assert.ok(plan.conflicts.length); assert.deepEqual([...other.values], before);
});

test('corrupt, unknown, future and identity-mismatched backup entries reject without local writes', () => {
  const text = backup(source()), payload = JSON.parse(text);
  const variants = [
    { ...payload, version: 9 }, { ...payload, token: 'secret' }, { ...payload, createdAt: '2030-01-01T00:00:00.000Z' },
    { ...payload, games: [...payload.games, payload.games[0]] },
    { ...payload, games: [{ ...payload.games[0], id: 'daily-2030-01-01' }] },
    { ...payload, games: [{ ...payload.games[0], raw: JSON.stringify({ ...game(), secret: 'unknown' }) }] },
    { ...payload, games: [{ ...payload.games[0], id: 'daily-w2v-2026-10-29', raw: JSON.stringify(word2vecDocument('free-w2v-12', { ...game(), startedAt: now.getTime() })) }] },
  ];
  for (const variant of variants) { const destination = new Memory(), profile = loadLocalProfile(destination), before = [...destination.values]; assert.throws(() => inspectLocalBackup(JSON.stringify(variant), destination, profile, now)); assert.deepEqual([...destination.values], before); }
  const badSource = source(); badSource.setItem(key('free-unknown'), '{}'); assert.throws(() => backup(badSource));
});

test('changed local facts and board admission refuse the previously prepared import', () => {
  const text = backup(source()), destination = new Memory(), snapshot = loadLocalProfile(destination);
  const plan = inspectLocalBackup(text, destination, snapshot, now);
  destination.setItem(key('free-19'), JSON.stringify(game()));
  assert.throws(() => importLocalBackup(text, plan.revision, destination as unknown as Storage, snapshot, now), /changé/);
  const fresh = inspectLocalBackup(text, destination, snapshot, now), before = [...destination.values];
  assert.throws(() => importLocalBackup(text, fresh.revision, destination as unknown as Storage, snapshot, now, () => false), /partie a évolué/);
  assert.deepEqual([...destination.values], before);
});

test('quota failure rolls back completed and active saves and profile writes', () => {
  class QuotaMemory extends Memory {
    failAt = 0; writes = 0;
    setItem(name: string, value: string) { if (this.failAt && ++this.writes === this.failAt) throw new Error('quota'); super.setItem(name, value); }
  }
  const storage = source(); storage.setItem(key('free-13'), JSON.stringify(closed()));
  const destination = new QuotaMemory(), snapshot = loadLocalProfile(destination), text = backup(storage), plan = inspectLocalBackup(text, destination, snapshot, now), before = [...destination.values];
  destination.failAt = 2;
  assert.throws(() => importLocalBackup(text, plan.revision, destination as unknown as Storage, snapshot, now), /Stockage insuffisant/);
  assert.deepEqual([...destination.values], before);
});

test('closed games import without awarding a second win and old profile exports remain profile-only', () => {
  const storage = source(), puzzle = { id: 'free-0012', mode: 'free' as const, seed: '0012', date: '2026-10-12', number: 12, vocabularySize: 30000, resetAt: '2026-10-13T00:00:00.000Z', ref: { contractVersion: 1 as const, id: 'free-0012', corpusVersion: 'fr-fasttext-30000-v1', rulesVersion: 'classic-v1', context: 'free' as const, variant: 'classic' as const, calendar: null } };
  const saved = { ...closed(), profileV2StartIndex: 0, guesses: closed().guesses.map(guess => ({ ...guess, acceptedAt: '2026-10-13T12:00:00.000Z' })) };
  storage.setItem(key(puzzle.id), JSON.stringify(saved)); const initial = recordLocalGameProgress(puzzle, saved, storage);
  assert.equal(initial.profile.wins.length, 1);
  const text = createLocalBackup(storage, initial, now).text, destination = new Memory(), imported = apply(text, destination);
  const replay = recordLocalGameProgress(puzzle, JSON.parse(destination.getItem(key(puzzle.id))!), destination, imported);
  assert.equal(replay.profile.wins.length, 1); assert.equal(replay.profile.guesses, initial.profile.guesses);
  const profileOnly = createLocalProfileExport(replay, now); assert.ok(profileOnly.ok); if (profileOnly.ok) { const profile = JSON.parse(profileOnly.text); assert.equal(profile.scope, 'profile-only'); assert.equal(profile.games, undefined); }
});

test('export refuses an unsaved live board rather than producing an incomplete file', () => {
  const storage = source(), snapshot = loadLocalProfile(storage), before = [...storage.values];
  assert.throws(() => createLocalBackup(storage, snapshot, now, { id: 'free-0012', game: game('absent') }), /incomplète/);
  assert.deepEqual([...storage.values], before);
});
