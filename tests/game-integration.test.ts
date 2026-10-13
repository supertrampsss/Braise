import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement, StrictMode, type ComponentType } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { getLegacyPuzzle } from '../lib/legacy-puzzles';
import { SyncMemory } from '../lib/device-sync';
import { PRODUCT_EVENTS_KEY } from '../lib/product-events';
import { countLabel } from '../lib/game-copy';

// Real Game hooks and handlers. Only DOM presentation primitives are replaced;
// this is component evidence, never a browser/accessibility certification.
let Game: ComponentType, bundleDirectory: string;
before(async () => {
  const moduleName = 'esbuild';
  const { build } = await import(moduleName);
  bundleDirectory = await mkdtemp('work/t8ui-');
  await build({ entryPoints: ['components/game.tsx'], outfile: bundleDirectory + '/game.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', loader: { '.css': 'empty' }, plugins: [{ name: 'presentation-only', setup(builder: { onResolve: (options: object, callback: (args: { path: string }) => object) => void; onLoad: (options: object, callback: (args: { path: string }) => object) => void }) {
    builder.onResolve({ filter: /^(@\/components\/ui\/|@\/components\/flame-scene$|sonner$)/ }, args => ({ path: args.path, namespace: 'test-presentation' }));
    builder.onLoad({ filter: /.*/, namespace: 'test-presentation' }, args => {
      if (args.path === 'sonner') return { contents: 'export const toast=Object.assign(()=>{}, {success:()=>{}});', loader: 'js' };
      if (args.path.endsWith('flame-scene')) return { contents: 'export default function FlameScene(){return null;}', loader: 'js' };
      return { contents: `import {createElement as h} from 'react';
        const Box=({children})=>h('div',null,children);
        export const Tabs=Box,TabsList=Box,TabsContent=Box,TabsTrigger=({children,...p})=>h('button',p,children);
        export const Dialog=({open,children})=>open?h('div',null,children):null,DialogContent=Box,DialogHeader=Box,DialogDescription=Box,DialogTitle=Box;
        export const DropdownMenu=Box,DropdownMenuTrigger=Box,DropdownMenuContent=Box,DropdownMenuLabel=Box,DropdownMenuGroup=Box,DropdownMenuItem=Box,DropdownMenuSeparator=Box;
        export const Progress=Box; export function Toaster(){return null;}`, loader: 'js', resolveDir: resolve('.') };
    });
  } }] });
  Game = (await import(pathToFileURL(resolve(bundleDirectory, 'game.mjs')).href)).default;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
after(async () => { if (bundleDirectory) await rm(bundleDirectory, { recursive: true, force: true }); });
const puzzle = { ...getLegacyPuzzle('free', '042').publicPuzzle, resetAt: '2099-01-01T00:00:00Z' };
function text(node: ReactTestInstance): string { return node.children.map(child => typeof child === 'string' ? child : text(child)).join(''); }
function button(tree: ReactTestRenderer, label: string) { const match = tree.root.findAll(node => node.type === 'button' && text(node) === label)[0]; assert.ok(match, label); return match; }
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function browser(storage = new SyncMemory(), href = 'https://braiz.test/?libre=042') {
  const listeners = new Map<string, () => void>(), frames: Array<() => void> = [];
  const doc = { activeElement: null as unknown, body: {}, visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById() { return null; } };
  const win = { localStorage: storage, setTimeout, clearTimeout, location: new URL(href), scrollTo() {}, addEventListener(key: string, callback: () => void) { listeners.set(key, callback); }, removeEventListener(key: string) { listeners.delete(key); }, history: { replaceState(_state: unknown, _title: unknown, url: string | URL) { win.location = new URL(url); Object.assign(globalThis, { location: win.location }); }, pushState(_state: unknown, _title: unknown, url: string | URL) { this.replaceState(_state, _title, url); } } };
  Object.assign(globalThis, { window: win, document: doc, location: win.location, localStorage: storage, requestAnimationFrame: (fn: () => void) => frames.push(fn), cancelAnimationFrame() {}, AudioContext: class { constructor() { assert.fail('restoration/import must stay silent'); } } });
  return { storage, listeners, frames, doc, win };
}
async function mount(strict = false) { let tree!: ReactTestRenderer; await act(async () => { tree = create(strict ? createElement(StrictMode, null, createElement(Game)) : createElement(Game), { createNodeMock: () => ({ focus() {}, select() {}, isConnected: true }) }); }); return tree; }
async function click(tree: ReactTestRenderer, label: string) { await act(async () => button(tree, label).props.onClick({ currentTarget: {} })); }


test('Game Strict Mode admits one browser restoration and current popstate handlers retain navigation epochs', async () => {
  const b = browser(); let requests = 0; const delayed = deferred<Response>();
  globalThis.fetch = async () => { requests++; return requests === 1 ? Response.json(puzzle) : delayed.promise; };
  const tree = await mount(true);
  try {
    assert.equal(requests, 1);
    await act(async () => tree.root.findByProps({ className: 'archive-reveal' }).props.onClick());
    await act(async () => tree.root.findByProps({ id: 'archive-date' }).props.onChange({ target: { value: '2026-10-11' } }));
    await act(async () => { void tree.root.findByProps({ className: 'archive-form' }).props.onSubmit({ preventDefault() {} }); });
    const navigation = tree.root.findByProps({ 'aria-label': 'Navigation principale' });
    await act(async () => navigation.findAllByType('a')[2].props.onClick({ button: 0, preventDefault() {} }));
    await act(async () => delayed.resolve(Response.json({ ...puzzle, id: 'daily-2026-10-11', mode: 'archive', date: '2026-10-11' })));
    assert.equal(b.win.location.searchParams.get('surface'), 'profile');
    assert.equal(b.win.location.searchParams.get('archive'), null);
    b.win.location = new URL('https://braiz.test/?libre=042'); Object.assign(globalThis, { location: b.win.location });
    await act(async () => b.listeners.get('popstate')!());
    assert.equal(tree.root.findByProps({ className: 'main-shell surface-game' }).props.id, 'braise-main');
  } finally { await act(async () => tree.unmount()); assert.equal(b.listeners.size, 0); }
});

test('Game restores wins silently, removes terminal hint lock copy, and exposes honest clipboard/manual sharing without answer or guesses', async () => {
  const b = browser();
  b.storage.setItem('braise.v1.animationsPaused', 'true');
  b.storage.setItem(`braise.v1.game.${puzzle.id}`, JSON.stringify({ startedAt: 1, hints: 0, pins: [], guesses: [{ word: 'secret-answer', order: 1, rank: 1, temperature: 100, found: true }] }));
  globalThis.fetch = async () => Response.json(puzzle);
  const tree = await mount();
  try {
    assert.match(text(tree.root), /1 essai, aucun indice/);
    assert.doesNotMatch(text(tree.root), /Indice après 5 essais/);
    assert.equal(tree.root.findAllByProps({ className: 'hint-progress' }).length, 0);
    assert.equal(b.storage.getItem(PRODUCT_EVENTS_KEY), null);
    assert.match(text(tree.root), /Animer la flamme/);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async () => { throw new Error('Clipboard denied'); } } } });
    await click(tree, 'Copier mon résultat');
    const payload = tree.root.findByProps({ 'aria-label': 'Texte à copier' }).props.value;
    assert.match(text(tree.root), /copie automatique n’a pas abouti/);
    assert.match(payload, /Trouvé en 1 essai · sans indice/);
    assert.ok(!payload.includes('secret-answer'));
    assert.equal(b.storage.getItem(PRODUCT_EVENTS_KEY), null);
    await click(tree, 'Fermer');
    let copied = '';
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (value: string) => { copied = value; } } } });
    await click(tree, 'Copier mon résultat');
    assert.equal(copied, payload);
    assert.equal(JSON.parse(b.storage.getItem(PRODUCT_EVENTS_KEY)!).events[0].type, 'shareCopied');
    assert.equal(tree.root.findAllByProps({ 'aria-label': 'Texte à copier' }).length, 0);
  } finally { await act(async () => tree.unmount()); }
});

test('Game accepts only matching puzzle facts and preserves input edited during POST without extra restoration feedback', async () => {
  const b = browser(); const pending = deferred<Response>();
  globalThis.fetch = async (_url, options) => options?.method === 'POST' ? pending.promise : Response.json(puzzle);
  const tree = await mount();
  try {
    assert.equal(tree.root.findByProps({ 'aria-label': 'Proposer ce mot' }).children[0], 'Proposer');
    await act(async () => tree.root.findByProps({ id: 'guess' }).props.onChange({ target: { value: 'maison' } }));
    await act(async () => { void tree.root.findByProps({ className: 'guess-form' }).props.onSubmit({ preventDefault() {}, currentTarget: { contains() { return false; } } }); });
    assert.equal(tree.root.findByProps({ 'aria-label': 'Analyse en cours' }).props.disabled, true);
    await act(async () => tree.root.findByProps({ id: 'guess' }).props.onChange({ target: { value: 'arbre' } }));
    await act(async () => pending.resolve(Response.json({ word: 'maison', temperature: 12.25, rank: 2500, found: false, puzzleRef: puzzle.ref })));
    assert.equal(tree.root.findByProps({ id: 'guess' }).props.value, 'arbre');
    assert.equal(JSON.parse(b.storage.getItem(`braise.v1.game.${puzzle.id}`)!).guesses.length, 1);
    assert.equal(JSON.parse(b.storage.getItem(PRODUCT_EVENTS_KEY)!).events.filter((e: { type: string }) => e.type === 'guessAccepted').length, 1);
    // Cross-tab restoration updates the board without gameplay announcements.
    const before = b.storage.getItem(PRODUCT_EVENTS_KEY);
    await act(async () => (b.listeners.get('storage') as (event: object) => void)({ key: `braise.v1.game.${puzzle.id}` }));
    assert.equal(b.storage.getItem(PRODUCT_EVENTS_KEY), before);
  } finally { await act(async () => tree.unmount()); }
});

test('missing historical counts remain unavailable; singular counters do not fabricate zero', () => {
  assert.equal(countLabel(1, 'réussite renseignée', 'réussites renseignées'), '1 réussite renseignée');
  assert.equal(countLabel(0, 'indice'), '0 indices');
  assert.equal(countLabel(null, 'essai'), 'Non disponible essais');
});
import { ArchiveCalendar } from '../components/game-parts/archive-calendar';
import { ExpeditionPicker } from '../components/expedition-picker';
import { CollectionPicker } from '../components/collection-picker';
import { ServerGameLinks } from '../components/server-game-links';
import { EXPEDITIONS } from '../lib/expeditions';
import { COLLECTIONS } from '../lib/collections';

test('archive and expedition selections track new parent destinations while user navigation remains usable', async () => {
  browser();
  let calendar!: ReactTestRenderer;
  const props = { max: '2026-10-12', selected: '2026-10-01', plays: [], disabled: false, onOpen() {} };
  await act(async () => { calendar = create(createElement(ArchiveCalendar, props)); });
  try {
    await act(async () => calendar.root.findByProps({ 'aria-label': 'Mois précédent' }).props.onClick());
    assert.match(text(calendar.root), /septembre 2026/);
    await act(async () => calendar.update(createElement(ArchiveCalendar, { ...props, selected: '2026-10-10' })));
    assert.match(text(calendar.root), /octobre 2026/);
    assert.equal(calendar.root.findByProps({ 'data-date': '2026-10-10' }).props.tabIndex, 0);
  } finally { await act(async () => calendar.unmount()); }
  let chapters!: ReactTestRenderer;
  const expeditionProps = { disabled: false, journey: null, currentStageSolved: false, error: '', onContinue() {} };
  await act(async () => { chapters = create(createElement(ExpeditionPicker, expeditionProps)); });
  try {
    await click(chapters, 'Tous les chapitres');
    await act(async () => chapters.root.findAllByType('button')[1].props.onClick());
    assert.match(text(chapters.root), new RegExp(EXPEDITIONS[1].title));
    await act(async () => chapters.update(createElement(ExpeditionPicker, { ...expeditionProps, journey: { id: EXPEDITIONS[0].id, completed: 1, length: EXPEDITIONS[0].length, seed: '042' } })));
    assert.match(text(chapters.root), new RegExp(EXPEDITIONS[0].title));
    assert.equal(chapters.root.findByProps({ 'aria-label': 'Progression du chapitre' }).props.value, 1);
  } finally { await act(async () => chapters.unmount()); }
});

test('collection and shared links restore browser facts, update on external changes and clean subscriptions', async () => {
  const b = browser(); let tree!: ReactTestRenderer;
  await act(async () => { tree = create(createElement(CollectionPicker, { wins: [], disabled: false, onSelect() {} })); });
  try {
    const seed = COLLECTIONS[0].seeds[0];
    b.storage.setItem(`braise.v1.game.free-${seed}`, JSON.stringify({ guesses: [{ word: 'maison', order: 1, rank: 10, temperature: 12, found: false }], hints: 0, pins: [], startedAt: 1 }));
    await act(async () => b.listeners.get('storage')!());
    assert.match(text(tree.root), /Reprendre l’énigme 1/);
  } finally { await act(async () => tree.unmount()); }
  b.win.location = new URL('https://braiz.test/espace?edition=11111111-1111-1111-1111-111111111111'); Object.assign(globalThis, { location: b.win.location });
  await act(async () => { tree = create(createElement(ServerGameLinks, { game: 'owned' })); });
  try {
    assert.equal(tree.root.findAllByType('a')[0].props.href, '/studio?edition=11111111-1111-1111-1111-111111111111');
    b.win.location = new URL('https://braiz.test/espace'); Object.assign(globalThis, { location: b.win.location });
    await act(async () => b.listeners.get('popstate')!());
    assert.ok(!text(tree.root).includes('Revenir à la création'));
  } finally { await act(async () => tree.unmount()); assert.equal(b.listeners.size, 0); }
});

test('advanced candidate has concrete reachable entries without creating accounts on Explorer visit', async () => {
  const b = browser(undefined, 'https://braiz.test/?surface=explore'); const calls: string[] = [];
  globalThis.fetch = async url => { calls.push(String(url)); return Response.json(puzzle); };
  const tree = await mount();
  try {
    const entries = tree.root.findByProps({ 'aria-label': 'Parcours avancés' }).findAllByType('a').map(node => node.props.href);
    assert.deepEqual(entries, ['/espace', '/cercles', '/studio', '/laboratoire', '/integration']);
    assert.ok(calls.every(path => path.startsWith('/api/game?')));
    assert.equal(b.storage.getItem(PRODUCT_EVENTS_KEY), null);
  } finally { await act(async () => tree.unmount()); }
});

test('weekly projection admits fresh same-day facts after noon and between clock ticks', async () => {
  const OriginalDate = Date; let clock = OriginalDate.parse('2026-10-13T18:00:00.000Z');
  class ClockDate extends OriginalDate {
    constructor(value?: string | number | Date) { super(value === undefined ? clock : value instanceof OriginalDate ? value.getTime() : value); }
    static now() { return clock; }
  }
  Object.assign(globalThis, { Date: ClockDate });
  browser();
  globalThis.fetch = async (_url, options) => options?.method === 'POST' ? Response.json({ word: 'maison', temperature: 12.25, rank: 2500, found: false, puzzleRef: puzzle.ref }) : Response.json(puzzle);
  const tree = await mount();
  try {
    clock += 400;
    await act(async () => tree.root.findByProps({ id: 'guess' }).props.onChange({ target: { value: 'maison' } }));
    await act(async () => tree.root.findByProps({ className: 'guess-form' }).props.onSubmit({ preventDefault() {}, currentTarget: { contains() { return false; } } }));
    const navigation = tree.root.findByProps({ 'aria-label': 'Navigation principale' });
    await act(async () => navigation.findAllByType('a')[2].props.onClick({ button: 0, preventDefault() {} }));
    const profile = tree.root.findAll(node => typeof node.type === 'function' && node.props.snapshot && node.props.ritual)[0];
    assert.equal(profile.props.ritual.objectives.find((objective: { id: string }) => objective.id === 'explore-15').value, 1);
  } finally { await act(async () => tree.unmount()); Object.assign(globalThis, { Date: OriginalDate }); }
});


test('expedition first mount starts at an already restored chapter', async () => {
  browser(); let tree!: ReactTestRenderer;
  const expedition=EXPEDITIONS[1];
  await act(async () => { tree=create(createElement(ExpeditionPicker,{disabled:false,journey:{id:expedition.id,completed:1,length:expedition.length,seed:'042'},currentStageSolved:false,error:'',onContinue(){}})); });
  try { assert.match(text(tree.root),new RegExp(expedition.title)); assert.equal(tree.root.findByProps({'aria-label':'Progression du chapitre'}).props.value,1); }
  finally { await act(async () => tree.unmount()); }
});
