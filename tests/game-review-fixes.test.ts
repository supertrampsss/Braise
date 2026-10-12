import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { canWriteGameDocument, writeAdmittedGame, recordAdmittedGameProgress } from '../lib/game-write-admission';
import { restoreLegacyGame, validLegacyGame, EMPTY_GAME } from '../lib/legacy-storage';
import { tutorialFieldReducer, EMPTY_TUTORIAL_FIELD, admitTutorialReturnFocus, type TutorialFieldAction } from '../lib/tutorial-field';
import { failedPuzzleUrl, admittedPuzzleUrl, admitPuzzleLoad, requestedGameSurface, retryPuzzleLoad, surfaceUrl, type PuzzleLoad, type GameSurface } from '../lib/game-navigation';
import { ArchiveDateLayout } from '../components/game-parts/archive-calendar';
import { getLegacyPuzzle } from '../lib/legacy-puzzles';
import { readContexts, rememberPlayContext } from '../lib/play-hub';
import { resumeExpedition } from '../lib/expedition-resume';
import { EXPEDITIONS } from '../lib/expeditions';
import { COLLECTIONS, collectionProgress } from '../lib/collections';
import type { SavedGame } from '../lib/game-types';
class Store {
  data = new Map<string,string>();get length(){return this.data.size;}key(i:number){return [...this.data.keys()][i]??null;}getItem(key:string){return this.data.get(key)??null;}setItem(key:string,value:string){this.data.set(key,value);}
}
const deferred = <T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
const fixedGuard={started:{request:1,navigation:0},current:()=>({request:1,navigation:0})};
const puzzle=getLegacyPuzzle('free','042').publicPuzzle;
const accepted:SavedGame={...EMPTY_GAME,startedAt:1,profileV2StartIndex:0,guesses:[{word:'maison',temperature:20,rank:800,found:false,order:1,acceptedAt:'2026-10-12T12:00:00.000Z'}]};
test('I1 future raw bytes survive accepted guess, indirect profile projection and pin mutation',()=>{
  for(const declaration of [{version:99},{schemaVersion:99},{formatVersion:99}]) {
    const storage=new Store();const key=`braise.v1.game.${puzzle.id}`;
    const raw=' \n'+JSON.stringify({...EMPTY_GAME,startedAt:1,...declaration,profileV2StartIndex:0,futureState:{pending:true}},null,3)+'\n';storage.setItem(key,raw);
    assert.ok(validLegacyGame(JSON.parse(raw)),'historical reader remains intentionally compatible');
    const restored=restoreLegacyGame(puzzle.id,1,storage);assert.deepEqual(restored.guesses,[]);
    const next={...restored,...accepted};assert.equal(canWriteGameDocument(storage,puzzle.id),false);
    assert.equal(recordAdmittedGameProgress(puzzle,next,storage),null);assert.equal(storage.length,1,'no indirect profile/event/reward writes');
    assert.equal(writeAdmittedGame(storage,puzzle.id,next),false);assert.equal(storage.getItem(key),raw);
    assert.equal(writeAdmittedGame(storage,puzzle.id,{...next,pins:['maison']}),false);assert.equal(storage.getItem(key),raw);
  }
});
test('I1 compatible unversioned V1 writes and late future-format replacement are handled at mutation time',()=>{
  const storage=new Store(),key=`braise.v1.game.${puzzle.id}`;storage.setItem(key,JSON.stringify(EMPTY_GAME));assert.ok(canWriteGameDocument(storage,puzzle.id));
  assert.ok(writeAdmittedGame(storage,puzzle.id,accepted));assert.equal(JSON.parse(storage.getItem(key)!).guesses.length,1);
  assert.ok(recordAdmittedGameProgress(puzzle,accepted,storage));
  const future=JSON.stringify({...accepted,version:99});storage.setItem(key,future);
  assert.equal(writeAdmittedGame(storage,puzzle.id,{...accepted,pins:['maison']}),false);assert.equal(storage.getItem(key),future);
});
for(const response of ['Ce mot est absent du dictionnaire.','Choisissez une autre association pour comparer.','Connexion impossible.']) test(`I2 delayed input error cannot attach to a newer edit: ${response}`,async()=>{
  let field=tutorialFieldReducer(EMPTY_TUTORIAL_FIELD,{type:'edit',input:'mot-initial'});
  const submittedRevision=field.revision, result=deferred<string>();
  const pending=result.promise.then(message=>{field=tutorialFieldReducer(field,{type:'error',message,revision:submittedRevision});});
  field=tutorialFieldReducer(field,{type:'edit',input:'maison'});result.resolve(response);await pending;
  assert.equal(field.input,'maison');assert.equal(field.error,'');
  field=tutorialFieldReducer(field,{type:'error',message:response,revision:field.revision});assert.equal(field.error,response);
  field=tutorialFieldReducer(field,{type:'edit',input:'arbre'});assert.equal(field.error,'');assert.equal(field.input,'arbre');
});
test('I2 edit-back-to-original remains a newer revision; accepted old response also preserves it',()=>{
  let field=EMPTY_TUTORIAL_FIELD;const actions:TutorialFieldAction[]=[{type:'edit',input:'maison'},{type:'edit',input:'arbre'},{type:'edit',input:'maison'},{type:'error',message:'Ancienne erreur',revision:1},{type:'accepted',revision:1}];
  for(const action of actions) field=tutorialFieldReducer(field,action);assert.deepEqual(field,{input:'maison',error:'',revision:3});
});
test('I3 failed collection GET then retry keeps descriptor, banner identity, URL, stored context and next step',async()=>{
  const collection=COLLECTIONS[0], storage=new Store();const load:PuzzleLoad={mode:'challenge',locator:collection.seeds[0],collection:collection.id,sessionSave:accepted,destination:'game'};
  let last=load,url=new URL('https://braiz.test/?surface=explore'),banner:string|undefined,attempts=0;
  async function loader(mode:PuzzleLoad['mode'],locator:string,save?:SavedGame,expedition?:PuzzleLoad['expedition'],collectionId?:string,destination?:GameSurface) {
    const descriptor={mode,locator,sessionSave:save,expedition,collection:collectionId,destination};last=descriptor;
    return admitPuzzleLoad(descriptor,async()=>{attempts++;if(attempts===1) throw new Error('503');return getLegacyPuzzle('challenge',locator).publicPuzzle;},fixedGuard,(puzzle,admitted)=>{
      url=admittedPuzzleUrl(url,admitted,puzzle);banner=admitted.collection;rememberPlayContext(storage,puzzle.id,{mode:admitted.mode,collection:admitted.collection});
    });
  }
  await assert.rejects(()=>retryPuzzleLoad(last,loader),/503/);assert.equal(last.collection,collection.id);
  const result=await retryPuzzleLoad(last,loader);assert.ok(result);assert.equal(last.sessionSave,accepted);assert.equal(banner,collection.id);assert.equal(url.searchParams.get('collection'),collection.id);assert.equal(url.searchParams.get('surface'),null);assert.equal(readContexts(storage)?.[result.id].collection,collection.id);
  const progress=collectionProgress([{id:result.id,mode:'challenge',date:result.date,tries:1,hints:0}],collection);assert.equal(collection.seeds[progress.next],collection.seeds[1]);
});
test('I3 retry retains an expedition descriptor too, without consulting a changed current journey',async()=>{
  const expedition={id:'sous-bois-v1',completed:1,length:3,seed:'042'};
  const descriptor:PuzzleLoad={mode:'challenge',locator:'042',expedition,destination:'profile'};
  const result=await retryPuzzleLoad(descriptor,async(...args)=>args);assert.equal(result[3],expedition);assert.equal(result[5],'profile');
});
test('I4 admitted journey stage agrees with Back/Forward and a reload',async()=>{
  let url=surfaceUrl(new URL('https://braiz.test/'),'voyage'),screen:GameSurface='voyage';
  const stage=getLegacyPuzzle('challenge','042').publicPuzzle;
  const descriptor:PuzzleLoad={mode:'challenge',locator:'042',expedition:{id:'sous-bois-v1',completed:0,length:3,seed:'042'},destination:'game'};
  await admitPuzzleLoad(descriptor,async()=>stage,fixedGuard,(puzzle,load)=>{url=admittedPuzzleUrl(url,load,puzzle);screen=load.destination!;});
  assert.equal(screen,'game');assert.equal(url.searchParams.get('surface'),null);assert.equal(url.searchParams.get('voyage'),'sous-bois-v1');
  const history=[new URL(url),surfaceUrl(url,'profile')];screen=requestedGameSurface(history[1]);assert.equal(screen,'profile');screen=requestedGameSurface(history[0]);assert.equal(screen,'game');screen=requestedGameSurface(history[1]);assert.equal(screen,'profile');
  const reloadDescriptor={...descriptor,destination:requestedGameSurface(history[0])};const reloaded=admittedPuzzleUrl(new URL(history[0]),reloadDescriptor,stage);assert.equal(reloaded.href,history[0].href);
});
test('I4 slow deep-link journey preserves explicit Profile/Explorer destination',async()=>{
  for(const destination of ['profile','modes','voyage'] as const) {
    let url=surfaceUrl(new URL('https://braiz.test/?voyage=sous-bois-v1&defi=042'),destination),screen=requestedGameSurface(url);
    const pending=deferred<typeof puzzle>();const load:PuzzleLoad={mode:'challenge',locator:'042',expedition:{id:'sous-bois-v1',completed:0,length:3,seed:'042'},destination:screen};
    const job=admitPuzzleLoad(load,()=>pending.promise,fixedGuard,(puzzle,admitted)=>{url=admittedPuzzleUrl(url,admitted,puzzle);screen=admitted.destination!;});
    assert.equal(screen,destination);pending.resolve({...puzzle,mode:'challenge'});await job;assert.equal(screen,destination);assert.equal(requestedGameSurface(url),destination);
  }
});
test('I4 navigation during pending journey GET rejects every old game and route commit',async()=>{
  let epoch=0,url=new URL('https://braiz.test/?surface=voyage'),screen:GameSurface='voyage',commits=0;
  const pending=deferred<typeof puzzle>(),captured=epoch;
  const load:PuzzleLoad={mode:'challenge',locator:'042',expedition:{id:'sous-bois-v1',completed:0,length:3,seed:'042'},destination:'game'};
  const job=admitPuzzleLoad(load,()=>pending.promise,{started:{request:1,navigation:captured},current:()=>({request:1,navigation:epoch})},(puzzle,admitted)=>{commits++;url=admittedPuzzleUrl(url,admitted,puzzle);screen=admitted.destination!;});
  epoch++;screen='profile';url=surfaceUrl(url,screen);const expected=url.href;pending.resolve(puzzle);assert.equal(await job,null);assert.equal(commits,0);assert.equal(screen,'profile');assert.equal(url.href,expected);
});
test('M1 filtered archive layout is explicitly a list, without misleading weekday columns',()=>{
  const child=createElement('button',{'aria-label':'1 octobre 2026, Commencé'},'1 octobre 2026 · En cours');
  const filtered=renderToStaticMarkup(createElement(ArchiveDateLayout,{filtered:true,children:child}));assert.match(filtered,/Liste des dates filtrées/);assert.match(filtered,/1 octobre 2026/);assert.ok(!filtered.includes('calendar-weekdays'));assert.ok(!filtered.includes('>Lun<'));
  const calendar=renderToStaticMarkup(createElement(ArchiveDateLayout,{filtered:false,children:child}));assert.match(calendar,/calendar-weekdays/);assert.match(calendar,/>Jeu</);
});

test('explicit tutorial return owns close focus only while route, puzzle and focus ownership remain current',()=>{
  const intent={request:4,navigation:7},current={...intent,playing:true,modalClosed:true,focusUnmoved:true};
  assert.equal(admitTutorialReturnFocus(intent,current),true);
  assert.equal(admitTutorialReturnFocus(null,current),false,'Escape/restoration has no explicit return intent');
  for(const change of [{request:5},{navigation:8},{playing:false},{modalClosed:false},{focusUnmoved:false}]) assert.equal(admitTutorialReturnFocus(intent,{...current,...change}),false);
});

test('explicit Retry on the board supersedes a previous background surface without losing collection context',async()=>{
  const descriptor:PuzzleLoad={mode:'challenge',locator:'1000000046',collection:'nature-v1',sessionSave:accepted,destination:'profile'};
  const result=await retryPuzzleLoad(descriptor,async(...args)=>args,'game');assert.equal(result[4],'nature-v1');assert.equal(result[2],accepted);assert.equal(result[5],'game');assert.equal(descriptor.destination,'profile');
});

for(const context of [{mode:'daily' as const,locator:''},{mode:'challenge' as const,locator:COLLECTIONS[0].seeds[0],collection:COLLECTIONS[0].id}]) test(`F1 real retry admission preserves later Profile for ${context.mode}`,async()=>{
  let request=0,navigation=0,screen:GameSurface='game',url=new URL('https://braiz.test/'),commits=0;
  const pending=deferred<typeof puzzle>();
  const descriptor:PuzzleLoad={...context,sessionSave:accepted};
  const job=retryPuzzleLoad(descriptor,async(mode,locator,sessionSave,expedition,collection,destination)=>{
    const load={mode,locator,sessionSave,expedition,collection,destination};
    const started={request:++request,navigation};
    return admitPuzzleLoad(load,()=>pending.promise,{started,current:()=>({request,navigation})},(puzzle,admitted)=>{
      commits++;url=admittedPuzzleUrl(url,admitted,puzzle);screen=admitted.destination!;
    },()=>{throw new Error('A stale load must not own an error transition either.');});
  },'game');
  navigation++;screen='profile';url=surfaceUrl(url,screen);const expected=url.href;
  pending.resolve(puzzle);assert.equal(await job,null);assert.equal(commits,0);assert.equal(screen,'profile');assert.equal(url.href,expected);
});

test('F2 status 200 then stage 503 exposes the contextual error on Game and retries the same saved expedition',async()=>{
  let request=0,navigation=1,screen:GameSurface='voyage',url=surfaceUrl(new URL('https://braiz.test/'),'voyage'),error='',statusCalls=0,getCalls=0;
  const edition=EXPEDITIONS[0];
  const status={id:edition.id,completed:0,length:edition.length,seed:'042'};
  const resumed=await resumeExpedition(edition.id,{status:async()=>{statusCalls++;return status;},readGame:()=>accepted,isCurrent:()=>true});
  assert.ok(resumed);assert.equal(statusCalls,1);
  let last:PuzzleLoad={mode:'challenge',locator:resumed.status.seed!,sessionSave:resumed.saved,expedition:resumed.status,destination:'game'};
  async function load(mode:PuzzleLoad['mode'],locator:string,sessionSave?:SavedGame,expedition?:PuzzleLoad['expedition'],collection?:string,destination?:GameSurface) {
    last={mode,locator,sessionSave,expedition,collection,destination};error='';
    const started={request:++request,navigation};
    return admitPuzzleLoad(last,async()=>{getCalls++;return {ok:getCalls>1,status:getCalls>1?200:503,data:puzzle};},{started,current:()=>({request,navigation})},(response,descriptor)=>{
      if(!response.ok) throw new Error('Étape indisponible. Réessayez.');
      url=admittedPuzzleUrl(url,descriptor,response.data);screen=descriptor.destination!;
    },(cause,descriptor)=>{error=(cause as Error).message;url=failedPuzzleUrl(url,descriptor);screen=descriptor.destination!;});
  }
  assert.equal(await retryPuzzleLoad(last,load),false);
  assert.equal(screen,'game','the existing load-error and Retry are rendered on this surface');assert.match(error,/Étape indisponible/);
  assert.equal(requestedGameSurface(url),'game');assert.equal(url.searchParams.get('voyage'),edition.id);assert.equal(url.searchParams.get('defi'),'042');
  assert.equal(last.sessionSave,accepted);assert.equal(last.expedition,resumed.status);assert.equal(last.destination,'game');
  assert.ok(await retryPuzzleLoad(last,load,'game'));assert.equal(error,'');assert.equal(getCalls,2);assert.equal(statusCalls,1,'retry reuses the admitted status and save');assert.equal(screen,'game');assert.equal(last.sessionSave,accepted);assert.equal(url.searchParams.get('voyage'),edition.id);
});

for(const failure of ['503','network']) test(`F2 obsolete Voyage ${failure} cannot replace later Profile with its error surface`,async()=>{
  let request=1,navigation=1,screen:GameSurface='voyage',url=surfaceUrl(new URL('https://braiz.test/'),'voyage'),error='',commits=0;
  const pending=deferred<void>();const started={request,navigation};
  const descriptor:PuzzleLoad={mode:'challenge',locator:'042',sessionSave:accepted,expedition:{id:EXPEDITIONS[0].id,completed:0,length:3,seed:'042'},destination:'game'};
  const job=admitPuzzleLoad(descriptor,async()=>{await pending.promise;if(failure==='network') throw new TypeError('network');return {status:503};},{started,current:()=>({request,navigation})},()=>{commits++;throw new Error('503');},(cause,load)=>{error=String(cause);url=failedPuzzleUrl(url,load);screen=load.destination!;});
  navigation++;screen='profile';url=surfaceUrl(url,screen);const expected=url.href;pending.resolve();assert.equal(await job,null);assert.equal(error,'');assert.equal(commits,0);assert.equal(screen,'profile');assert.equal(url.href,expected);
});
