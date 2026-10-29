import { z } from 'zod';
import {
  SyncMemory, assertDeviceMemorySaved, commitDeviceStaging, contextSchema,
  deviceUploadRevision, parseSavedGame, prepareDeviceProfile, unionGame,
  validateDeviceProfile, validateGame, validId, type LiveDeviceGame,
} from './device-sync';
import {
  createLocalProfileExport, importLocalProfile, inspectLocalProfileImport,
  type ProfileSnapshot, type ProfileStorage,
} from './profile-storage';
import { PLAY_CONTEXT_KEY, readContexts } from './play-hub';
import { parisDate } from './calendar';
import { dailyV2Document } from './daily-v2-storage';
import { dailyV2Date as publishedV2Date } from './daily-v2-contract';
import { isWord2vecId, word2vecDate, WORD2VEC_START } from './word2vec-contract';
import { word2vecDocument } from './word2vec-storage';
import type { SavedGame } from './game-types';

export const LOCAL_BACKUP_MAX_BYTES = 8 * 1024 * 1024;
const GAME_PREFIX = 'braise.v1.game.';
const itemSchema = z.object({ id: z.string().max(40), raw: z.string(), context: contextSchema.optional() }).strict();
const backupSchema = z.object({
  format: z.literal('braiz-local-backup'), version: z.literal(1),
  scope: z.literal('classic-games-and-profile'), provenance: z.literal('personal-unverified'),
  createdAt: z.string().datetime(), profile: z.string(), games: z.array(itemSchema).max(1000),
}).strict();
type Backup = z.infer<typeof backupSchema>;
type BackupItem = Backup['games'][number];
export type BackupGamePreview = {
  id: string; mode: 'daily' | 'archive' | 'free' | 'challenge'; completed: boolean;
  incomingGuesses: number; localGuesses: number;
  status: 'add' | 'merge' | 'unchanged' | 'conflict'; reason?: string;
};
export type LocalBackupPreview = {
  revision: string; createdAt: string; games: BackupGamePreview[];
  activities: number; conflicts: string[]; changed: boolean; staged: SyncMemory;
};

function invalid(message: string): never { throw new Error(message); }
function errorText(cause: unknown) { return cause instanceof Error ? cause.message : 'Sauvegarde incompatible.'; }
function complete(game: SavedGame) { return game.guesses.some(guess => guess.found); }
function validateItem(item: BackupItem, now: Date): SavedGame {
  if (!validId(item.id, now)) invalid('Identité de partie inconnue ou future.');
  const game = parseSavedGame(item.raw, item.id);
  validateGame(game, now);
  const publication = publishedV2Date(item.id) ?? (isWord2vecId(item.id) ? word2vecDate(item.id) ?? WORD2VEC_START : null);
  if (publication && (parisDate(new Date(game.startedAt)) < publication || game.guesses.some(guess => guess.acceptedAt && parisDate(new Date(guess.acceptedAt)) < publication))) invalid('Une partie précède sa publication.');
  const found = game.guesses.filter(guess => guess.found);
  if (found.length > 1 || (game.solvedAt !== undefined && (!found.length || game.solvedAt < game.startedAt)) || found.some(guess => guess.rank !== 1 || guess.temperature !== 100 || guess.order !== Math.max(...game.guesses.map(value => value.order)))) invalid('Fin de partie incohérente.');
  if (item.context) {
    const context = new SyncMemory();
    context.setItem(PLAY_CONTEXT_KEY, JSON.stringify({ version: 1, items: { [item.id]: item.context } }));
    if (!readContexts(context) || item.id.startsWith('daily-') !== ['daily', 'archive'].includes(item.context.mode)) invalid('Contexte de partie incompatible.');
  }
  return game;
}
export function parseLocalBackup(text: string, now = new Date()): Backup {
  if (new TextEncoder().encode(text).length > LOCAL_BACKUP_MAX_BYTES) invalid('Le fichier dépasse 8 Mio. Aucune donnée ne sera tronquée.');
  let json: unknown;
  try { json = JSON.parse(text); } catch { invalid('Fichier JSON illisible.'); }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) invalid('Ce fichier n’est pas une sauvegarde de parties BRAIZ compatible. Pour un ancien fichier de profil, utilisez « Profil seul ».');
  const backup = parsed.data;
  if (Date.parse(backup.createdAt) > now.getTime() || new Set(backup.games.map(item => item.id)).size !== backup.games.length) invalid('La sauvegarde contient une date future ou une partie en double.');
  validateDeviceProfile(backup.profile, now);
  for (const item of backup.games) validateItem(item, now);
  return backup;
}

/** A separate local format includes complete classic histories. The server sync format is unchanged. */
export function createLocalBackup(storage: ProfileStorage, snapshot: ProfileSnapshot, now = new Date(), live?: LiveDeviceGame | null) {
  const prepared = prepareDeviceProfile(storage, snapshot, now, live);
  const profile = createLocalProfileExport(prepared.snapshot, now);
  if (!profile.ok) invalid(profile.reason);
  const contexts = readContexts(prepared.storage);
  if (!contexts) invalid('Les contextes des parties sont illisibles. Sauvegarde refusée.');
  const games: BackupItem[] = [];
  for (let index = 0; index < prepared.storage.length; index++) {
    const key = prepared.storage.key(index);
    if (!key?.startsWith(GAME_PREFIX)) continue;
    const id = key.slice(GAME_PREFIX.length), raw = prepared.storage.getItem(key);
    if (raw === null) invalid('Une partie a changé pendant la préparation. Réessayez.');
    games.push({ id, raw, ...(contexts[id] ? { context: contexts[id] } : {}) });
  }
  const backup: Backup = { format: 'braiz-local-backup', version: 1, scope: 'classic-games-and-profile', provenance: 'personal-unverified', createdAt: now.toISOString(), profile: profile.text, games };
  const text = JSON.stringify(backup);
  parseLocalBackup(text, now);
  return { text, filename: `braiz-sauvegarde-${parisDate(now)}.json`, games: games.length };
}

function serializeGame(id: string, game: SavedGame) {
  return JSON.stringify(isWord2vecId(id) ? word2vecDocument(id, game) : publishedV2Date(id) ? dailyV2Document(id, game) : game);
}

/** Preview runs exclusively in an in-memory staging copy, even when any conflict is found. */
export function inspectLocalBackup(text: string, storage: ProfileStorage, snapshot: ProfileSnapshot, now = new Date(), live?: LiveDeviceGame | null): LocalBackupPreview {
  assertDeviceMemorySaved(storage, snapshot, now, live);
  const backup = parseLocalBackup(text, now), staged = new SyncMemory(storage), contexts = readContexts(staged);
  if (!contexts) invalid('Les contextes locaux sont illisibles. Rien n’a été modifié.');
  const conflicts: string[] = [], games: BackupGamePreview[] = [];
  const profile = inspectLocalProfileImport(backup.profile, staged, now, snapshot);
  if (!profile.planId || !['ready', 'unchanged'].includes(profile.status)) conflicts.push(profile.reason);
  for (const item of backup.games) {
    const incoming = validateItem(item, now), key = GAME_PREFIX + item.id, raw = staged.getItem(key);
    const row: BackupGamePreview = { id: item.id, mode: item.context?.mode ?? (item.id.startsWith('daily-') ? 'daily' : 'free'), completed: complete(incoming), incomingGuesses: incoming.guesses.length, localGuesses: 0, status: raw === null ? 'add' : 'merge' };
    try {
      const local = raw === null ? null : validateItem({ id: item.id, raw, ...(contexts[item.id] ? { context: contexts[item.id] } : {}) }, now);
      row.localGuesses = local?.guesses.length ?? 0;
      if (contexts[item.id] && item.context && JSON.stringify(contexts[item.id]) !== JSON.stringify(item.context)) invalid('Les deux appareils attribuent des contextes différents à cette partie.');
      const merged = local ? unionGame(local, incoming, now) : incoming;
      const content = serializeGame(item.id, { ...merged, profileV2StartIndex: merged.guesses.length });
      if (raw === content) row.status = 'unchanged';
      staged.setItem(key, content);
      if (!contexts[item.id] && item.context) contexts[item.id] = item.context;
    } catch (cause) {
      row.status = 'conflict'; row.reason = errorText(cause); conflicts.push(`${item.id} : ${row.reason}`);
    }
    games.push(row);
  }
  if (!conflicts.length) {
    staged.setItem(PLAY_CONTEXT_KEY, JSON.stringify({ version: 1, items: contexts }));
    const imported = importLocalProfile(backup.profile, profile.planId!, staged, snapshot, now);
    if (!imported.persisted) invalid(imported.reason);
  }
  return { revision: deviceUploadRevision(storage, snapshot), createdAt: backup.createdAt, games, activities: profile.addedActivities, conflicts, changed: !conflicts.length && [...staged.values].some(([key, value]) => storage.getItem(key) !== value), staged };
}
export function importLocalBackup(text: string, expectedRevision: string, storage: Storage, snapshot: ProfileSnapshot, now = new Date(), beforeCommit?: () => boolean, live?: LiveDeviceGame | null) {
  if (deviceUploadRevision(storage, snapshot) !== expectedRevision) invalid('La progression locale a changé. Affichez un nouvel aperçu.');
  const plan = inspectLocalBackup(text, storage, snapshot, now, live);
  if (plan.conflicts.length) invalid('Import bloqué : les conflits doivent être résolus sur l’appareil source. Aucune donnée modifiée.');
  return commitDeviceStaging(plan.staged, storage, () => {
    if (deviceUploadRevision(storage, snapshot) !== expectedRevision) invalid('La progression locale a changé. Affichez un nouvel aperçu.');
    return beforeCommit ? beforeCommit() : true;
  });
}
