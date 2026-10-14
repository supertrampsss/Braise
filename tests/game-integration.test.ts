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
import { loadLocalProfile, createLocalProfileExport, recordLocalGameProgress } from '../lib/profile-storage';
import { discoverFree } from '../lib/free-discovery.server';
import { dailyV2Ref } from '../lib/daily-v2-contract';
import { getLegacyArchivePuzzle } from '../lib/legacy-puzzles';
import futureRuntime from '../data/editorial-v2-runtime.json';
import legacyManifest from '../data/legacy-v1.json';
import type { Puzzle, SavedGame } from '../lib/game-types';
import { word2vecRef } from '../lib/word2vec-contract';
import { word2vecDocument } from '../lib/word2vec-storage';
import { setWord2vecObjectLoaderForTests } from '../lib/word2vec.server';
import { readFile } from 'node:fs/promises';
import { rememberPlayContext, type LocalPlay } from '../lib/play-hub';

// Real Game hooks and handlers. Only DOM presentation primitives are replaced;
// this is component evidence, never a browser/accessibility certification.
let Game: ComponentType, bundleDirectory: string;
before(async () => {
  setWord2vecObjectLoaderForTests(async key=>{const bytes=await readFile('public/'+key);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);});
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

test('P1 keeps exact ranks visible before top5000 and orders equal rounded temperatures by rank',async()=>{
  const b=browser(); let guesses=0;
  globalThis.fetch=async(_url,options)=>{
    if(options?.method==='POST')return Response.json({word:++guesses===1?'maison':'arbre',temperature:20,rank:guesses===1?20000:8000,found:false,puzzleRef:puzzle.ref});
    return Response.json(puzzle);
  };
  const tree=await mount();try{
    for(const word of ['maison','arbre']){
      await act(async()=>tree.root.findByProps({id:'guess'}).props.onChange({target:{value:word}}));
      await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){},currentTarget:{contains(){return false;}}}));
    }
    const words=tree.root.findAllByProps({className:'guess-word'});
    assert.match(text(words[0]),/^arbre/);assert.match(text(words[1]),/^maison/);
    assert.match(text(tree.root),/8\u202f000e/);assert.match(text(tree.root),/20\u202f000e/);
    assert.doesNotMatch(text(tree.root).replaceAll('N°',''),/°|‰|Meilleure piste :|places/);
    const fill=parseFloat(tree.root.findByProps({className:'proximity-meter'}).props.style['--proximity-position']);
    assert.ok(fill>0&&fill<20);
    const saved=JSON.parse(b.storage.getItem('braise.v1.game.'+puzzle.id)!);
    assert.deepEqual(saved.guesses.map((g: {rank:number})=>g.rank),[20000,8000]);
  }finally{await act(async()=>tree.unmount());}
});
const puzzle = { ...getLegacyPuzzle('free', '042').publicPuzzle, resetAt: '2099-01-01T00:00:00Z' };
function text(node: ReactTestInstance): string { return node.children.map(child => typeof child === 'string' ? child : text(child)).join(''); }
function button(tree: ReactTestRenderer, label: string) { const match = tree.root.findAll(node => node.type === 'button' && text(node) === label)[0]; assert.ok(match, label); return match; }
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function browser(storage = new SyncMemory(), href = 'https://braiz.test/?libre=042') {
  const listeners = new Map<string, () => void>(), frames: Array<() => void> = []; let audioCalls = 0;
  const doc = { activeElement: null as unknown, body: {}, visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById() { return null; } };
  const win = { localStorage: storage, setTimeout, clearTimeout, requestAnimationFrame: (fn: () => void) => frames.push(fn), cancelAnimationFrame() {}, location: new URL(href), scrollTo() {}, addEventListener(key: string, callback: () => void) { listeners.set(key, callback); }, removeEventListener(key: string) { listeners.delete(key); }, history: { replaceState(_state: unknown, _title: unknown, url: string | URL) { win.location = new URL(url); Object.assign(globalThis, { location: win.location }); }, pushState(_state: unknown, _title: unknown, url: string | URL) { this.replaceState(_state, _title, url); } } };
  Object.assign(globalThis, { window: win, document: doc, location: win.location, localStorage: storage, requestAnimationFrame: (fn: () => void) => frames.push(fn), cancelAnimationFrame() {}, AudioContext: class { constructor() { audioCalls++; } } });
  return { storage, listeners, frames, doc, win, audioCalls: () => audioCalls };
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
  b.storage.setItem('braise.v1.profile', JSON.stringify({wins:[],guesses:0,sound:true}));
  b.storage.setItem(`braise.v1.game.${puzzle.id}`, JSON.stringify({ startedAt: 1, hints: 0, pins: [], guesses: [{ word: 'secret-answer', order: 1, rank: 1, temperature: 100, found: true }] }));
  globalThis.fetch = async () => Response.json(puzzle);
  const tree = await mount();
  try {
    assert.match(text(tree.root), /1 essai, aucun indice/);
    assert.doesNotMatch(text(tree.root), /Indice après 5 essais/);
    assert.equal(tree.root.findAllByProps({ className: 'hint-progress' }).length, 0);
    assert.equal(b.storage.getItem(PRODUCT_EVENTS_KEY), null);
    assert.match(tree.root.find(node => node.type==='div' && String(node.props.className).startsWith('app-shell')).props.className, /motion-paused/);
    assert.equal(b.audioCalls(), 0, 'restored win with sound enabled must not create AudioContext');
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
    const navigation = tree.root.findByProps({ 'aria-label': 'Navigation principale' });
    await act(async () => navigation.findAllByType('a')[2].props.onClick({ button: 0, preventDefault() {} }));
    const profile = tree.root.findAll(node => typeof node.type === 'function' && node.props.snapshot && node.props.onDeviceSync)[0];
    assert.equal(profile.props.snapshot.profile.sound, true, 'fixture explicitly enables sound');
    const imported = JSON.parse(b.storage.getItem(`braise.v1.game.${puzzle.id}`)!); imported.pins=['secret-answer'];
    b.storage.setItem(`braise.v1.game.${puzzle.id}`, JSON.stringify(imported));
    const diagnosticBeforeImport = b.storage.getItem(PRODUCT_EVENTS_KEY);
    await act(async () => profile.props.onDeviceSync(loadLocalProfile(b.storage)));
    assert.equal(b.audioCalls(), 0, 'device import callback restores won board without audio');
    assert.equal(b.storage.getItem(PRODUCT_EVENTS_KEY), diagnosticBeforeImport);
  } finally { await act(async () => tree.unmount()); }
});

test('Game restores a Word2Vec victory silently and rejects a mismatched edition before save admission',async()=>{
  const id='free-w2v-042',target:Puzzle={...puzzle,id,vocabularySize:155562,ref:word2vecRef(id,'free')};
  const storage=new SyncMemory(),won:SavedGame={startedAt:Date.parse('2026-10-13T12:00:00Z'),pins:[],hints:0,guesses:[{word:'maison',temperature:100,rank:1,found:true,order:1}]};
  const raw=JSON.stringify(word2vecDocument(id,won));storage.setItem('braise.v1.game.'+id,raw);
  let b=browser(storage,'https://braiz.test/?libre=042&edition=word2vec-v1');globalThis.fetch=async()=>Response.json(target);
  let tree=await mount();try{assert.match(text(tree.root),/1 essai, aucun indice/);assert.equal(b.audioCalls(),0);assert.equal(storage.getItem(PRODUCT_EVENTS_KEY),null);assert.equal(storage.getItem('braise.v1.game.'+id),raw);}finally{await act(async()=>tree.unmount());}
  b=browser(storage,'https://braiz.test/?libre=042&edition=classic-v1');globalThis.fetch=async()=>Response.json(target);tree=await mount();
  try{assert.match(text(tree.root),/version de cette partie/);assert.equal(tree.root.findAllByProps({id:'guess'}).length,0);assert.equal(storage.getItem('braise.v1.game.'+id),raw);}finally{await act(async()=>tree.unmount());}
});

test('selecting the historical Voyage in Explorer resumes its V1 trials when Word2Vec trials coexist',async()=>{
  const seed='1700000049',oldTarget={...getLegacyPuzzle('challenge',seed).publicPuzzle,resetAt:'2099-01-01T00:00:00Z'},id=`free-w2v-${seed}`;
  const modernTarget={...oldTarget,id,vocabularySize:155562,ref:word2vecRef(id,'challenge')};
  const old:SavedGame={startedAt:1,pins:[],hints:0,guesses:[{word:'jardin',temperature:20,rank:42,found:false,order:1}]};
  const modern:SavedGame={startedAt:Date.parse('2026-10-13T12:00:00Z'),pins:[],hints:0,guesses:[{word:'maison',temperature:12.34,rank:150000,found:false,order:1}]};
  const b=browser(undefined,'https://braiz.test/?voyage=sous-bois-v1'),oldRaw=JSON.stringify(old),newRaw=JSON.stringify(word2vecDocument(id,modern));
  b.storage.setItem('braise.v1.game.'+oldTarget.id,oldRaw);b.storage.setItem('braise.v1.game.'+id,newRaw);
  for(const key of [oldTarget.id,id])rememberPlayContext(b.storage,key,{mode:'challenge',expedition:'sous-bois-v1',expeditionStep:1});
  const gets:string[]=[];
  globalThis.fetch=async(url)=>{
    if(String(url)==='/api/expeditions')return Response.json({id:'sous-bois-v1',completed:0,length:3,seed});
    gets.push(String(url));const edition=new URL(String(url),'https://braiz.test').searchParams.get('edition');return Response.json(edition==='classic-v1'?oldTarget:modernTarget);
  };
  const tree=await mount();try{
    assert.match(text(tree.root.findAllByProps({className:'guess-word'})[0]),/^maison/);
    await act(async()=>tree.root.findByProps({'aria-label':'Navigation principale'}).findAllByType('a')[1].props.onClick({button:0,preventDefault(){}}));
    const hub=tree.root.findAll(node=>typeof node.type==='function'&&node.props.onResume&&Array.isArray(node.props.plays))[0];
    const selected=(hub.props.plays as LocalPlay[]).find(play=>play.id===oldTarget.id)!;assert.equal(selected.edition,'classic-v1');
    await act(async()=>hub.props.onResume(selected));
    assert.match(text(tree.root.findAllByProps({className:'guess-word'})[0]),/^jardin/);assert.equal(b.win.location.searchParams.get('edition'),'classic-v1');assert.match(gets.at(-1)!,/edition=classic-v1/);
    assert.equal(b.storage.getItem('braise.v1.game.'+oldTarget.id),oldRaw);assert.equal(b.storage.getItem('braise.v1.game.'+id),newRaw);assert.equal(b.audioCalls(),0);
  }finally{await act(async()=>tree.unmount());}
});

test('Game accepts only matching puzzle facts and preserves input edited during POST without extra restoration feedback', async () => {
  const b = browser(); const pending = deferred<Response>();
  globalThis.fetch = async (_url, options) => options?.method === 'POST' ? pending.promise : Response.json(puzzle);
  const tree = await mount();
  try {
    assert.equal(tree.root.findByProps({ 'aria-label': 'Envoyer' }).children[0], 'Envoyer');
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
  try { assert.match(text(tree.root),new RegExp(expedition.title)); assert.equal(tree.root.findByProps({'aria-label':'Progression du chapitre'}).props.value,1); assert.match(text(tree.root),/1 épreuve sur/); assert.doesNotMatch(text(tree.root),/1 épreuves/); }
  finally { await act(async () => tree.unmount()); }
});


test('audio counter is observable on a real accepted action with sound enabled', async () => {
  const b=browser();b.storage.setItem('braise.v1.profile',JSON.stringify({wins:[],guesses:0,sound:true}));
  globalThis.fetch=async(_url,opts)=>opts?.method==='POST'?Response.json({word:'maison',temperature:100,rank:1,found:true,puzzleRef:puzzle.ref}):Response.json(puzzle);
  const tree=await mount();
  try {
    assert.equal(b.audioCalls(),0);
    await act(async()=>tree.root.findByProps({id:'guess'}).props.onChange({target:{value:'maison'}}));
    await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){},currentTarget:{contains(){return false;}}}));
    assert.equal(b.audioCalls(),1,'the constructor counter records an audio attempt even if optional audio APIs are absent in this test DOM');
  }finally{await act(async()=>tree.unmount());}
});

for(const kind of ['voyage','collection'] as const) test(`solo ${kind} names its tab and board without social copy or changing its reference`,async()=>{
  const expedition=EXPEDITIONS[0], collection=COLLECTIONS[0],seed=kind==='voyage'?'042':collection.seeds[0];
  browser(undefined,kind==='voyage'?`https://braiz.test/?voyage=${expedition.id}`:`https://braiz.test/?defi=${seed}&collection=${collection.id}`);
  const target={...getLegacyPuzzle('challenge',seed).publicPuzzle,resetAt:'2099-01-01T00:00:00Z'};
  if(kind==='voyage'){target.id=`free-w2v-${seed}`;target.ref=word2vecRef(target.id,'challenge');target.vocabularySize=155562;}
  const calls:string[]=[];
  globalThis.fetch=async(url)=>{calls.push(String(url));return String(url)==='/api/expeditions'?Response.json({id:expedition.id,completed:0,length:expedition.length,seed}):Response.json(target);};
  const tree=await mount();
  try{
    const trigger=tree.root.findAll(n=>n.type==='button'&&n.props.value==='challenge')[0];
    assert.equal(text(trigger),kind==='voyage'?'Voyage':'Collection');
    assert.match(text(tree.root.findByProps({className:'game-topline'})),kind==='voyage'?/VOTRE VOYAGE.*Parcours personnel/:/VOTRE COLLECTION.*Collection personnelle/);
    assert.doesNotMatch(text(tree.root.findByProps({className:'game-topline'})),/Même mot, même défi/);
    assert.ok(calls.some(path=>path.includes(`mode=challenge&seed=${seed}`)));
  }finally{await act(async()=>tree.unmount());}
});

test('a terminal win suggests another actual unfinished save and clearly identifies it',async()=>{
  const b=browser();
  b.storage.setItem(`braise.v1.game.${puzzle.id}`,JSON.stringify({startedAt:1,hints:0,pins:[],guesses:[{word:'secret-answer',order:1,rank:1,temperature:100,found:true}]}));
  b.storage.setItem('braise.v1.game.free-043',JSON.stringify({startedAt:2,hints:0,pins:['maison'],guesses:[{word:'maison',order:1,rank:20,temperature:12,found:false}]}));
  globalThis.fetch=async()=>Response.json(puzzle);
  const tree=await mount();
  try{assert.match(text(tree.root),/Une autre partie commencée vous attend : Partie libre/);assert.doesNotMatch(text(tree.root),/Cette partie commencée attend votre prochain mot/);assert.ok(button(tree,'Continuer à jouer'));}
  finally{await act(async()=>tree.unmount());}
});


test('a completed chapter keeps its terminal badge after Jouer and Accueil without replaying facts on reload', async () => {
  const expedition = EXPEDITIONS[0], seeds = ['1700000049', '1700000121', '1700000029'], answers = ['arbre', 'fleur', 'abeille'];
  const b = browser(undefined, `https://braiz.test/?voyage=${expedition.id}`);
  b.storage.setItem('braise.v1.profile', JSON.stringify({wins: [], guesses: 0, sound: true}));
  for (let i = 0; i < 2; i++) b.storage.setItem(`braise.v1.game.free-${seeds[i]}`, JSON.stringify({startedAt: 1, hints: 0, pins: [], guesses: [{word: answers[i], order: 1, rank: 1, temperature: 100, found: true}]}));
  const target = {...getLegacyPuzzle('challenge', seeds[2]).publicPuzzle,id:`free-w2v-${seeds[2]}`,vocabularySize:155562,ref:word2vecRef(`free-w2v-${seeds[2]}`,'challenge'), resetAt: '2099-01-01T00:00:00Z'};
  const puzzleRequests: string[] = [], submittedRefs: unknown[] = [];
  globalThis.fetch = async (url, options) => {
    if (String(url) === '/api/expeditions') {
      const {proofs} = JSON.parse(String(options?.body)) as {proofs: string[]};
      assert.deepEqual(proofs, answers.slice(0, proofs.length));
      return Response.json({id: expedition.id, completed: proofs.length, length: expedition.length, ...(proofs.length === expedition.length ? {reward: `expedition:${expedition.id}:completed`} : {seed: seeds[proofs.length]})});
    }
    if (options?.method === 'POST') {
      submittedRefs.push(JSON.parse(String(options.body)).puzzleRef);
      return Response.json({word: answers[2], temperature: 100, rank: 1, found: true, puzzleRef: target.ref});
    }
    puzzleRequests.push(String(url)); return Response.json(target);
  };
  let tree = await mount();
  try {
    assert.match(text(tree.root.findByProps({className: 'daily-pill'})), /étape 3\/3/);
    await act(async () => tree.root.findByProps({id: 'guess'}).props.onChange({target: {value: answers[2]}}));
    await act(async () => tree.root.findByProps({className: 'guess-form'}).props.onSubmit({preventDefault() {}, currentTarget: {contains() {return false;}}}));
    assert.deepEqual(submittedRefs, [target.ref]);
    await click(tree, 'Terminer le chapitre');
    const saved = b.storage.getItem(`braise.v1.game.${target.id}`), profile = loadLocalProfile(b.storage).profile;
    assert.deepEqual(JSON.parse(saved!).game.guesses.map((guess: {word: string; temperature: number; rank: number; found: boolean}) => ({word: guess.word, temperature: guess.temperature, rank: guess.rank, found: guess.found})), [{word: answers[2], temperature: 100, rank: 1, found: true}]);
    const audio = b.audioCalls(), requestCount = puzzleRequests.length;
    assert.equal(audio, 1, 'one newly accepted win, never replayed by terminal navigation');
    const navigation = () => tree.root.findByProps({'aria-label': 'Navigation principale'});
    await act(async () => navigation().findAllByType('a')[0].props.onClick({button: 0, preventDefault() {}}));
    assert.equal(tree.root.findByProps({className: 'play-view voyage-play'}).props.hidden, false);
    assert.equal(text(tree.root.findByProps({className: 'daily-pill'})), 'Chapitre terminé');
    await act(async () => navigation().findAllByType('a')[1].props.onClick({button: 0, preventDefault() {}}));
    await act(async () => tree.root.findByProps({'aria-label': 'Accueil', className: 'brand'}).props.onClick());
    assert.equal(text(tree.root.findByProps({className: 'daily-pill'})), 'Chapitre terminé');
    assert.equal(text(tree.root.findByProps({className: 'game-kicker'})), 'VOTRE VOYAGE');
    assert.equal(b.win.location.searchParams.get('voyage'), expedition.id);
    assert.equal(puzzleRequests.length, requestCount, 'return paths retain the exact final puzzle');
    assert.equal(b.storage.getItem(`braise.v1.game.${target.id}`), saved);
    assert.deepEqual(loadLocalProfile(b.storage).profile, profile);
    assert.equal(b.audioCalls(), audio);
    await act(async () => tree.unmount());
    const restored = browser(b.storage, b.win.location.href); tree = await mount();
    assert.match(text(tree.root), /Chapitre terminé/); assert.doesNotMatch(text(tree.root), /étape 4\/3/);
    assert.equal(restored.audioCalls(), 0, 'completed chapter reload is silent');
    assert.equal(restored.storage.getItem(`braise.v1.game.${target.id}`), saved);
    assert.deepEqual(loadLocalProfile(restored.storage).profile, profile);
  } finally { await act(async () => tree.unmount()); }
});


const importInstant = new Date('2026-10-13T10:00:00Z');
async function importThroughGame(tree: ReactTestRenderer, file: string) {
  const navigation = tree.root.findByProps({'aria-label': 'Navigation principale'});
  await act(async () => navigation.findAllByType('a')[2].props.onClick({button: 0, preventDefault() {}}));
  const input = tree.root.findByProps({type: 'file'});
  await act(async () => input.props.onChange({currentTarget: {files: [{name: 'profil.json', size: Buffer.byteLength(file), text: async () => file}], value: ''}}));
  assert.ok(tree.root.findAll(n => n.type === 'button' && text(n) === 'Confirmer l’import').length, tree.root.findAll(n => n.type === 'section' && n.props.className === 'profile-transfer').map(text).join(' '));
  await click(tree, 'Confirmer l’import');
}
function legacyProfileFile(ids: string[]) {
  const source = new SyncMemory();
  source.setItem('braise.v1.profile', JSON.stringify({wins: ids.map(id => ({id, date: '2026-10-13', mode: 'free', tries: 1, hints: 0})), guesses: ids.length, sound: false}));
  const result = createLocalProfileExport(loadLocalProfile(source), importInstant); assert.ok(result.ok); return result.text;
}
function discoveryFetch(bodies: Array<{encountered: string[]; excluded: string[]; replay: boolean}>, now = importInstant, resolved?: (result: Awaited<ReturnType<typeof discoverFree>>) => void) {
  return async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    if (options?.method === 'POST') {
      const body = JSON.parse(String(options.body)); assert.equal(body.action, 'discover'); bodies.push(body);
      const result = await discoverFree(body, now); resolved?.(result); return Response.json(result);
    }
    const seed = new URL(String(url), 'https://braiz.test').searchParams.get('seed') || '042';
    return Response.json({...getLegacyPuzzle('free', seed, now).publicPuzzle, resetAt: '2099-01-01T00:00:00Z'});
  };
}
for (const complete of [true, false]) test(`real profile-only import reaches discovery with ${complete ? 'all120 targets exhausted' : 'one known target excluded'}`, async () => {
  const seeds = new Map<number, string>();
  for (let seed = 0; seeds.size < 120; seed++) {const index = getLegacyPuzzle('free', String(seed), importInstant).legacyIndex; if (!seeds.has(index)) seeds.set(index, String(seed));}
  const ids = [...seeds.values()].map(seed => `free-${seed}`), imported = complete ? ids : [ids[0]];
  const b = browser(), bodies: Array<{encountered: string[]; excluded: string[]; replay: boolean}> = [];
  const replyReady = deferred<void>(); globalThis.fetch = discoveryFetch(bodies, importInstant, () => replyReady.resolve()); const tree = await mount();
  try {
    await importThroughGame(tree, legacyProfileFile(imported));
    const snapshot = loadLocalProfile(b.storage); assert.equal(snapshot.profile.wins.length, imported.length);
    assert.ok(imported.every(id => b.storage.getItem(`braise.v1.game.${id}`) === null), 'profile import never creates their full saves');
    await act(async () => tree.root.findByProps({'aria-label': 'Navigation principale'}).findAllByType('a')[1].props.onClick({button: 0, preventDefault() {}}));
    const diagnosticBefore = b.storage.getItem(PRODUCT_EVENTS_KEY);
    await click(tree, 'Découvrir un mot en libre');
    await act(async () => replyReady.promise);
    assert.ok(imported.every(id => bodies[0].encountered.includes(id)), 'Game submits identities from the actual imported snapshot');
    if (complete) {assert.match(text(tree.root), /Vous avez rencontré tous les mots disponibles en libre/);assert.doesNotMatch(text(tree.root), /Cible non rencontrée/);assert.equal(b.storage.getItem(PRODUCT_EVENTS_KEY), diagnosticBefore);}
    else {const selected = b.win.location.searchParams.get('libre');assert.ok(selected);assert.notEqual(getLegacyPuzzle('free', selected, importInstant).legacyIndex, getLegacyPuzzle('free', imported[0].slice(5), importInstant).legacyIndex);}
    assert.deepEqual(loadLocalProfile(b.storage).profile, snapshot.profile, 'discovery gives no extra profile credit');
    assert.equal(b.audioCalls(), 0);
  } finally {await act(async () => tree.unmount());}
});

for (const version of ['V1','V2'] as const) test(`lexical refusal ${version} keeps the input and exposes no reporting or corpus controls`, async () => {
  const target: Puzzle = version === 'V1' ? puzzle : {id: 'daily-v2-2027-01-05', mode: 'archive', seed: '2027-01-05', date: '2027-01-05', number: 121, vocabularySize: 1013881, resetAt: '2099-01-01T00:00:00Z', ref: dailyV2Ref('2027-01-05','archive')};
  const b = browser(undefined, version === 'V1' ? 'https://braiz.test/?libre=042' : 'https://braiz.test/?archive=2027-01-05');
  let status = 422, posts = 0;
  globalThis.fetch = async (_url, options) => {if (options?.method === 'POST') {posts++;return Response.json({error: status === 422 ? 'Mot inconnu.' : 'Stockage indisponible.'}, {status});} return Response.json(target);};
  const tree = await mount();
  try {
    await act(async () => tree.root.findByProps({id: 'guess'}).props.onChange({target: {value: 'zzabsentqa'}}));
    await act(async () => tree.root.findByProps({className: 'guess-form'}).props.onSubmit({preventDefault() {}, currentTarget: {contains() {return false;}}}));
    assert.equal(tree.root.findByProps({id: 'guess'}).props.value, 'zzabsentqa');assert.equal(posts, 1);
    assert.match(text(tree.root), /Mot inconnu/);assert.doesNotMatch(text(tree.root), /Télécharger le signalement|lexique de cette partie|fr-fasttext/);
    assert.equal(tree.root.findAllByProps({className: 'refused-word-report'}).length, 0);
    assert.deepEqual(JSON.parse(b.storage.getItem(PRODUCT_EVENTS_KEY)!).events.map((event: {type: string}) => event.type), ['guessRejected']);
    status = 503;await act(async () => tree.root.findByProps({id: 'guess'}).props.onChange({target: {value: 'zzautreaq'}}));
    await act(async () => tree.root.findByProps({className: 'guess-form'}).props.onSubmit({preventDefault() {}, currentTarget: {contains() {return false;}}}));
    assert.equal(tree.root.findByProps({id: 'guess'}).props.value, 'zzautreaq');assert.equal(posts, 2);
    const ledger = b.storage.getItem(PRODUCT_EVENTS_KEY)!;assert.deepEqual(JSON.parse(ledger).events.map((event: {type: string}) => event.type), ['guessRejected','networkFailed']);assert.doesNotMatch(ledger,/zzabsentqa|zzautreaq|puzzleRef|corpusVersion/);for(const event of JSON.parse(ledger).events) assert.deepEqual(Object.keys(event).sort(), ['context','occurredAt','type']);
  } finally {await act(async () => tree.unmount());}
});

const nonterminalGame = (instant: string): SavedGame => ({guesses:[{word:'arbre',temperature:12.25,rank:1234,found:false,order:1,acceptedAt:instant}],hints:0,pins:[],startedAt:Date.parse(instant),profileV2StartIndex:0});
test('real nonterminal profile import and transferred evidence retain leading zeroes and admissible daily V1 identities', async () => {
  const source = new SyncMemory(), leading = getLegacyPuzzle('free','00042',importInstant).publicPuzzle, daily = getLegacyArchivePuzzle('2026-10-12',importInstant).publicPuzzle;
  let snapshot = recordLocalGameProgress(leading,nonterminalGame(importInstant.toISOString()),source);
  snapshot = recordLocalGameProgress(daily,nonterminalGame(importInstant.toISOString()),source,snapshot);
  const exported = createLocalProfileExport(snapshot,importInstant);assert.ok(exported.ok);
  // Retain an earlier witness of a genuine nonterminal fact as transfer evidence.
  // The full import validator checks its identity; it adds no extra counter.
  const file = JSON.parse(exported.text);file.evidence.push({...file.activities[0],occurredAt:'2026-10-13T09:00:00.000Z'});
  const b = browser(), bodies: Array<{encountered: string[]; excluded: string[]; replay: boolean}> = [], ready = deferred<void>();
  globalThis.fetch = discoveryFetch(bodies,importInstant,()=>ready.resolve());const tree = await mount();
  try {await importThroughGame(tree,JSON.stringify(file));const actual = loadLocalProfile(b.storage);assert.ok(actual.activities.length);assert.ok(actual.transferEvidence.length);assert.equal(actual.profile.wins.length,0);
    await act(async()=>tree.root.findByProps({'aria-label':'Navigation principale'}).findAllByType('a')[1].props.onClick({button:0,preventDefault(){}}));await click(tree,'Découvrir un mot en libre');await act(async()=>ready.promise);
    assert.ok(bodies[0].encountered.includes('free-00042'));assert.ok(bodies[0].encountered.includes('daily-2026-10-12'));assert.equal(bodies[0].encountered.filter(id=>id==='free-00042').length,1);assert.equal(b.storage.getItem('braise.v1.game.free-00042'),null);assert.equal(b.storage.getItem('braise.v1.game.daily-2026-10-12'),null);assert.deepEqual(loadLocalProfile(b.storage).profile,actual.profile);
  }finally{await act(async()=>tree.unmount());}
});

test('an accepted memory-only fact reaches actual Game discovery even when no game or profile write succeeded', async () => {
  class Unwritable extends SyncMemory {refuse=true;override setItem(key:string,value:string){if(this.refuse)throw new Error('quota');super.setItem(key,value);}}
  const storage = new Unwritable(), b = browser(storage,'https://braiz.test/?libre=00042'), target = getLegacyPuzzle('free','00042',importInstant).publicPuzzle;
  const bodies: Array<{encountered: string[]; excluded: string[]; replay: boolean}> = [], ready = deferred<void>(); const discover = discoveryFetch(bodies,importInstant,()=>ready.resolve());
  globalThis.fetch = async(url,options)=>options?.method==='POST'&&JSON.parse(String(options.body)).action==='guess'?Response.json({word:'arbre',temperature:12.25,rank:1234,found:false,puzzleRef:target.ref}):discover(url,options);
  const tree = await mount();try{
    await act(async()=>tree.root.findByProps({id:'guess'}).props.onChange({target:{value:'arbre'}}));await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){},currentTarget:{contains(){return false;}}}));
    assert.equal(storage.getItem('braise.v1.game.free-00042'),null);assert.equal(loadLocalProfile(storage).profile.guesses,0);
    await act(async()=>tree.root.findByProps({'aria-label':'Navigation principale'}).findAllByType('a')[2].props.onClick({button:0,preventDefault(){}}));const panel=tree.root.findAll(n=>typeof n.type==='function'&&n.props.snapshot&&n.props.onDeviceSync)[0];assert.equal(panel.props.snapshot.profile.guesses,1);assert.ok(panel.props.snapshot.pendingActivities.some((fact:{type:string;puzzleRef?:{id:string}})=>fact.type==='guessAccepted'&&fact.puzzleRef?.id==='free-00042'));
    const pendingFacts=panel.props.snapshot.pendingActivities;
    storage.refuse=false;await act(async()=>tree.root.findByProps({'aria-label':'Navigation principale'}).findAllByType('a')[1].props.onClick({button:0,preventDefault(){}}));await click(tree,'Découvrir un mot en libre');await act(async()=>ready.promise);
    assert.ok(bodies[0].encountered.includes('free-00042'));assert.equal(loadLocalProfile(storage).profile.guesses,0,'reading pending identities never persists or repeats credit');
    await act(async()=>tree.root.findByProps({'aria-label':'Navigation principale'}).findAllByType('a')[2].props.onClick({button:0,preventDefault(){}}));const retained=tree.root.findAll(n=>typeof n.type==='function'&&n.props.snapshot&&n.props.onDeviceSync)[0].props.snapshot;assert.equal(retained.profile.guesses,1);assert.deepEqual(retained.pendingActivities,pendingFacts);assert.equal(b.audioCalls(),0);
  }finally{await act(async()=>tree.unmount());}
});

for (const common of [true,false]) test(`real mixed profile import leaves ${common?'common':'non-common'} dailyV2 reference on its canonical server discovery path`,async()=>{
  const now = new Date('2028-01-04T12:00:00Z'), OriginalDate=Date;
  class FutureClock extends OriginalDate {constructor(value?:string|number|Date){super(value===undefined?now.getTime():value instanceof OriginalDate?value.getTime():value);}static now(){return now.getTime();}}
  Object.assign(globalThis,{Date:FutureClock});
  const currentIndex=getLegacyPuzzle('free','042',now).legacyIndex;
  const assignment=futureRuntime.calendar.assignments.find(row=>{const word=futureRuntime.entries.find(entry=>entry.targetId===row.targetId)!.word;const index=legacyManifest.targets.indexOf(word);return common?index>=0&&index!==currentIndex:index<0;});assert.ok(assignment);
  const target: Puzzle={id:`daily-v2-${assignment.date}`,mode:'archive',seed:assignment.date,date:assignment.date,number:121,vocabularySize:1013881,resetAt:now.toISOString(),ref:dailyV2Ref(assignment.date,'archive')};
  const source=new SyncMemory(), snapshot=recordLocalGameProgress(target,nonterminalGame(now.toISOString()),source), exported=createLocalProfileExport(snapshot,now);assert.ok(exported.ok);
  const b=browser(), bodies:Array<{encountered:string[];excluded:string[];replay:boolean}>=[], ready=deferred<Awaited<ReturnType<typeof discoverFree>>>();globalThis.fetch=discoveryFetch(bodies,now,value=>ready.resolve(value));const tree=await mount();
  try {await importThroughGame(tree,exported.text);assert.equal(b.storage.getItem(`braise.v1.game.${target.id}`),null);const before=loadLocalProfile(b.storage).profile;
    await act(async()=>tree.root.findByProps({'aria-label':'Navigation principale'}).findAllByType('a')[1].props.onClick({button:0,preventDefault(){}}));await click(tree,'Découvrir un mot en libre');let result!:Awaited<ReturnType<typeof discoverFree>>;await act(async()=>{result=await ready.promise;});
    assert.ok(bodies[0].encountered.includes(target.id));assert.ok(!bodies[0].encountered.includes(`free-${assignment.targetId}`));assert.equal(result.remaining,common?119:120,'only a canonically common V2 word excludes an additional V1 target');assert.deepEqual(loadLocalProfile(b.storage).profile,before);assert.equal(b.audioCalls(),0);
  }finally{await act(async()=>tree.unmount());Object.assign(globalThis,{Date:OriginalDate});}
});


test('the classic board exposes no automatic hint control or request even after five guesses',async()=>{
 const b=browser();b.storage.setItem(`braise.v1.game.${puzzle.id}`,JSON.stringify({startedAt:1,hints:0,pins:[],guesses:Array.from({length:5},(_,i)=>({word:'piste'+i,order:i+1,temperature:10+i,rank:2000+i,found:false}))}));
 let posts=0;globalThis.fetch=async(_url,options)=>{if(options?.method==='POST')posts++;return Response.json(puzzle);};
 const tree=await mount();try{assert.equal(tree.root.findAllByProps({className:'hint-button'}).length,0);assert.equal(posts,0);assert.equal(tree.root.findAllByProps({className:'refused-word-report'}).length,0);}finally{await act(async()=>tree.unmount());}
});
