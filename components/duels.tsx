"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Copy,Check,Swords} from 'lucide-react';
import {InvitationStatus,useInvitation} from './invitation-status';
import {AppNavigation} from './app-navigation';
import {DuelBoard} from './duel-board';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from './ui/dialog';
import {duelRound,duelOutcome,duelShareText,invitationToken,DUEL_ROUNDS,type DuelView} from '@/lib/duel-presentation';
import {DuelMatchReview} from './duel-review';
import {useDuelSync} from './use-duel-sync';
import {formatRankFr} from '@/lib/proximity-presentation';
import {readLocal} from '@/lib/legacy-storage';

type Session={guest:{id:string;name:string}|null;csrf?:string};
type DuelList={id:string;hostName:string;opponentName:string|null;role?:string;result?:string|null;created_at?:number;state:string;abandoned?:number;deadline?:number|null;invite_expires?:number;score?:{won:number;lost:number;drawn:number};canAcceptRematch?:boolean;rematchOf?:string|null};
type Feedback={round:number;ordinal:number;improved:boolean;found:boolean;announcement:string};
function dateLabel(value:number) { return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}).format(value); }
const statuses:Record<string,string>={active:'En cours',pending:'Invitation envoyée',expired:'Invitation expirée',cancelled:'Invitation annulée',finished:'Terminé',forfeit:'Abandonné'};
function duelNames(duel:{hostName:string;opponentName:string|null;role?:string}){return duel.role==='opponent'?duel.opponentName+' vs '+duel.hostName:duel.hostName+(duel.opponentName?' vs '+duel.opponentName:' · invitation');}
class DuelApiError extends Error {constructor(message:string,readonly status:number){super(message);}}

export default function Duels() {
  const [joining,setJoining]=useState(false),[session,setSession]=useState<Session>({guest:null});
  const [view,setView]=useState<DuelView|null>(null),[duels,setDuels]=useState<DuelList[]>([]);
  const [token,setToken]=useState(''),[inviteInput,setInviteInput]=useState(''),[link,setLink]=useState(''),[copied,setCopied]=useState(false);
  const [round,setRound]=useState(0),[word,setWord]=useState(''),[guestName,setGuestName]=useState(''),[received,setReceived]=useState(false);
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[help,setHelp]=useState(false);
  const [syncError,setSyncError]=useState(''),[shared,setShared]=useState(false);
  const [now,setNow]=useState(0),[paused,setPaused]=useState(true),[feedback,setFeedback]=useState<Feedback|null>(null);
  const lock=useRef(false),inputRevision=useRef(0),navigationEpoch=useRef(0);
  const factsRevision=useRef(0);
  const creation=useRef<{id:string;token:string;parentId?:string}|null>(null);
  const pending=useRef<{id:string;round:number;revision:number;requestId:string;word:string}|null>(null);
  const feedbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null),helpReturnFocus=useRef<HTMLButtonElement|null>(null);
  const invitation=useInvitation('duel',token,session.guest?.id);
  function clearFeedback() { if(feedbackTimer.current)clearTimeout(feedbackTimer.current);feedbackTimer.current=null;setFeedback(null); }
  function clearInvitation() {setReceived(false);setToken('');setInviteInput('');try{sessionStorage.removeItem('braiz.invitation.duel');}catch{}}
  async function api(path:string,body?:unknown,csrf=session.csrf??'',signal?:AbortSignal) {
    const epoch=navigationEpoch.current;
    const response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json','X-Braise-CSRF':csrf},body:JSON.stringify(body),signal}:{cache:'no-store',signal});
    const data=await response.json() as DuelView&Session&{duels:DuelList[];error?:string};
    if(epoch!==navigationEpoch.current)throw new Error('Vue quittée.');
    if(!response.ok)throw new DuelApiError(data.error??'Service indisponible.',response.status);
    return data;
  }
  function showView(data:DuelView) {factsRevision.current++;setView(data);setDuels(items=>items.map(item=>item.id===data.id?{...item,state:data.state,hostName:data.hostName,opponentName:data.opponentName,role:data.role,result:duelOutcome(data)?.title,deadline:data.deadline,abandoned:data.forfeiter?1:0,score:data.score,canAcceptRematch:data.canAcceptRematch}:item));}
  const syncNow=useDuelSync<DuelList>({enabled:Boolean(session.guest),selectedId:view?.id??null,revision:()=>factsRevision.current,busy:()=>lock.current,
    loadList:async signal=>(await api('/api/duels',undefined,undefined,signal)).duels,
    loadView:(id,signal)=>api('/api/duels?id='+encodeURIComponent(id),undefined,undefined,signal),onList:setDuels,onView:showView,onError:setSyncError});
  async function perform(action:()=>Promise<void>) {
    if(lock.current)return;const epoch=navigationEpoch.current;factsRevision.current++;lock.current=true;setBusy(true);setError('');
    try{await action();}catch(cause){if(epoch===navigationEpoch.current)setError(cause instanceof Error?cause.message:'Service indisponible.');}
    finally{lock.current=false;if(epoch===navigationEpoch.current)setBusy(false);}
  }
  async function refresh() {setDuels((await api('/api/duels')).duels);}
  async function openDuel(id:string) {
    const data=await api(`/api/duels?id=${encodeURIComponent(id)}`);showView(data);clearFeedback();pending.current=null;setShared(false);let savedLink='';if(data.state==='pending')try{savedLink=sessionStorage.getItem('braiz.duel.link.'+data.id)??'';}catch{}setLink(savedLink);setRound(DUEL_ROUNDS.find(index=>!duelRound(data,index,Date.now()).closed)??0);setWord('');
  }
  async function create(csrf?:string,parentId?:string) {
    if(!creation.current||creation.current.parentId!==parentId)creation.current={id:crypto.randomUUID(),token:[...crypto.getRandomValues(new Uint8Array(32))].map(value=>value.toString(16).padStart(2,'0')).join(''),...(parentId?{parentId}:{})};
    const data=await api('/api/duels',{action:parentId?'rematch':'create',...creation.current},csrf);showView(data);const privateLink=`${location.origin}/duels#invitation=${creation.current.token}`;setLink(privateLink);try{sessionStorage.setItem('braiz.duel.link.'+data.id,privateLink);}catch{}setCopied(false);setShared(false);creation.current=null;pending.current=null;clearFeedback();setRound(0);setWord('');await refresh();
  }
  async function shareResult(){if(!view)return;try{const text=duelShareText(view);if(navigator.share)await navigator.share({title:'BRAIZ · Duel',text});else{await navigator.clipboard.writeText(text);setShared(true);}}catch(cause){if(!(cause instanceof Error&&cause.name==='AbortError'))setError('Le partage n’a pas abouti. Réessayez.');}}
  function reviewRound(index:number){changeRound(index);const board=document.getElementById('duel-round-board');board?.scrollIntoView({block:'start'});board?.focus({preventScroll:true});}
  function changeRound(index:number) {if(busy)return;setRound(index);setWord('');inputRevision.current++;pending.current=null;clearFeedback();}
  function updateInvitation(value:string) {
    setInviteInput(value);const next=invitationToken(value);setToken(next);
    try{if(/^[a-f0-9]{64}$/.test(next))sessionStorage.setItem('braiz.invitation.duel',next);else sessionStorage.removeItem('braiz.invitation.duel');}catch{}
  }
  async function copyLink() {
    try{await navigator.clipboard.writeText(link);setCopied(true);}catch{setError('Sélectionnez le lien pour le copier.');}
  }
  function submit(event:FormEvent) {
    event.preventDefault();if(!view||duelRound(view,round,Date.now()).closed||!word.trim()||lock.current)return;
    const revision=inputRevision.current,before=duelRound(view,round,Date.now());
    void perform(async()=>{
      const old=pending.current;
      const request=old&&old.id===view.id&&old.round===round&&old.word===word.trim()?old:{id:view.id,round,revision:before.guesses.length,requestId:crypto.randomUUID(),word:word.trim()};
      pending.current=request;let data:DuelView;
      try{data=await api('/api/duels',{action:'guess',...request});}
      catch(cause){if(cause instanceof DuelApiError&&cause.status===409)pending.current=null;throw cause;}
      showView(data);pending.current=null;
      const accepted=data.guesses.find(guess=>guess.round===request.round&&guess.ordinal===request.revision+1);
      if(accepted&&accepted.ordinal>before.guesses.length){
        clearFeedback();setFeedback({round:request.round,ordinal:accepted.ordinal,improved:!before.best||accepted.rank<before.best.rank,found:accepted.found===1,announcement:`${accepted.word}, ${accepted.found===1?'mot trouvé':formatRankFr(accepted.rank)}.`});
        feedbackTimer.current=setTimeout(()=>setFeedback(null),1800);
      }
      if(revision===inputRevision.current)setWord('');
    });
  }
  // Browser restoration reads facts and the invitation; it never accepts or plays.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{
    let active=true;
    setNow(Date.now());setPaused(readLocal<boolean>('animationsPaused',false));
    let value=new URLSearchParams(location.hash.slice(1)).get('invitation');
    try{value??=sessionStorage.getItem('braiz.invitation.duel');if(value&&/^[a-f0-9]{64}$/.test(value))sessionStorage.setItem('braiz.invitation.duel',value);}catch{}
    if(value){setReceived(true);setJoining(true);setToken(value);setInviteInput(`${location.origin}/duels#invitation=${value}`);history.replaceState(null,'',location.pathname);}
    queueMicrotask(()=>{if(active)void perform(async()=>{const data=await api('/api/session');setSession(data);if(data.guest)await refresh();});});
    const tick=setInterval(()=>setNow(Date.now()),1000);
    return()=>{active=false;navigationEpoch.current++;clearInterval(tick);if(feedbackTimer.current)clearTimeout(feedbackTimer.current);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const outcome=view?duelOutcome(view):null;
  const playable=view&&(view.state==='active'||view.state==='finished');
  const joinFields=<><label htmlFor="duel-token">Lien d’invitation</label><input id="duel-token" maxLength={512} value={inviteInput} disabled={busy} placeholder="Coller le lien" autoComplete="off" onChange={event=>updateInvitation(event.target.value)}/></>;
  const joinForm=<form onSubmit={event=>{event.preventDefault();if(!invitation.canAccept())return;void perform(async()=>{showView(await api('/api/duels',{action:'accept',token:token.trim()}));clearInvitation();setLink('');setRound(0);pending.current=null;clearFeedback();await refresh();});}}>{received?<details className="duel-change-link"><summary>Changer de lien</summary>{joinFields}</details>:joinFields}<button className="primary-button" disabled={busy||!invitation.canAccept()}>Rejoindre le duel</button></form>;
  return <div className={`app-shell approved-interface proximity-interface duel-interface ${paused?'motion-paused':''}`}>
    <a className="skip-link" href="#duel-main">Aller au contenu</a>
    <AppNavigation active="duel" onHelp={returnFocus=>{helpReturnFocus.current=returnFocus;setHelp(true);}}/>
    <main className="main-shell" id="duel-main" tabIndex={-1}>
      <header className="duel-heading"><div><h1>Duel</h1>{view&&<p>{duelNames(view)}</p>}</div><div className="duel-header-actions">{view?.score&&playable&&!view.forfeiter&&<strong className="duel-live-score" aria-label="Score des manches">{view.score.won} — {view.score.lost}</strong>}{view?.deadline&&view.state==='active'&&<p className="duel-deadline">Fin le {dateLabel(view.deadline)}</p>}</div></header>
      {error&&<p className="duel-error" id="duel-error" role="alert">{error}</p>}
      {syncError&&<p className="duel-sync-error" role="status">{syncError} <button type="button" onClick={()=>void syncNow()}>Réessayer</button></p>}
      {invitation.state!=='ready'&&<InvitationStatus kind="duel" invitation={invitation} identity={session.guest?.id} busy={busy} onExit={clearInvitation} onResume={id=>void perform(async()=>{await openDuel(id);clearInvitation();})}/>}
      {!session.guest&&!joining&&<section className="duel-card duel-start"><Swords aria-hidden="true" size={34}/><p>3 manches · 30 essais par manche · 48 h</p><button className="primary-button" disabled={busy} onClick={()=>setJoining(true)}>Créer un duel</button></section>}
      {!session.guest&&joining&&(!token||invitation.state==='ready')&&<section className="duel-card duel-identity"><h2>{token?'Rejoindre le duel':'Créer un duel'}</h2><form onSubmit={event=>{event.preventDefault();if(token&&!invitation.canAccept())return;void perform(async()=>{const data=await api('/api/session',{name:guestName});setSession(data);if(token)await refresh();else await create(data.csrf);});}}><label htmlFor="duel-guest">Pseudonyme</label><input id="duel-guest" maxLength={24} value={guestName} placeholder="Pseudonyme" disabled={busy} onChange={event=>setGuestName(event.target.value)}/><button className="primary-button" disabled={busy||!guestName.trim()}>{token?'Continuer':'Créer le duel'}</button></form><a className="duel-identity-link" href="/espace">Retrouver mon identité</a></section>}
      {session.guest&&<>
        {view?.state==='pending'&&view.canAcceptRematch&&<section className="duel-card duel-invite"><h2>Revanche proposée par {view.hostName}</h2><p>3 nouveaux mots · 30 essais par manche · 48 h après acceptation</p><button className="primary-button" disabled={busy} onClick={()=>void perform(async()=>{showView(await api('/api/duels',{action:'accept-rematch',id:view.id}));setRound(0);setWord('');pending.current=null;clearFeedback();await refresh();})}>Accepter la revanche</button></section>}
        {view?.state==='pending'&&!view.canAcceptRematch&&<section className="duel-card duel-invite"><h2>{view.rematchOf?'Revanche proposée à '+view.opponentName:'Inviter un adversaire'}</h2>{!view.rematchOf&&link&&<><label htmlFor="duel-link">Lien d’invitation</label><div className="duel-link-row"><input id="duel-link" readOnly value={link} onFocus={event=>event.target.select()}/><button className="primary-button" disabled={busy} onClick={()=>void copyLink()}>{copied?<Check size={18}/>:<Copy size={18}/>} {copied?'Copié':'Copier'}</button></div></>}<p>{view.rematchOf?'En attente de son acceptation.':'En attente de l’adversaire.'}</p>{view.inviteExpires&&<small>Invitation valable jusqu’au {dateLabel(view.inviteExpires)}.</small>}</section>}
        {view&&(view.state==='expired'||view.state==='cancelled')&&<section className="duel-card"><h2>{view.state==='expired'?'Invitation expirée':'Invitation annulée'}</h2><button className="primary-button" disabled={busy} onClick={()=>void perform(create)}>Créer un duel</button></section>}
        {outcome&&<section className="duel-card duel-summary" aria-labelledby="duel-summary-title"><h2 id="duel-summary-title">{outcome.title}</h2><p className="duel-result-score">{outcome.note}</p>{view!.rounds?<DuelMatchReview view={view!} onRound={reviewRound}/>:!view!.forfeiter&&<ol>{view!.decisions!.map((decision,index)=><li key={index}><span>Manche {index+1}</span><strong>{decision===0?'Égalité':decision===(view!.role==='host'?-1:1)?'Remportée':'Perdue'}</strong></li>)}</ol>}<div className="duel-summary-actions"><button className="primary-button" disabled={busy} onClick={()=>void perform(()=>create(undefined,view!.id))}>Revanche</button><button className="secondary-button" disabled={busy} onClick={()=>void shareResult()}>{shared?'Résultat copié':'Partager le résultat'}</button></div></section>}
        {playable&&<DuelBoard view={view} round={round} now={now} busy={busy} word={word} paused={paused} feedback={feedback} onWord={value=>{inputRevision.current++;setWord(value);setError('');}} onRound={changeRound} onSubmit={submit}/>}
        {view&&(view.state==='active'||view.state==='pending'&&view.role==='host')&&<details className="duel-end"><summary>{view.state==='pending'?'Annuler l’invitation':'Abandonner le duel'}</summary><button className="secondary-button" disabled={busy} onClick={()=>void perform(async()=>{showView(await api('/api/duels',{action:view.state==='pending'?'cancel':'forfeit',id:view.id}));setLink('');clearFeedback();await refresh();})}>Confirmer</button></details>}
        {!received&&<section className="duel-card duel-dashboard"><div className="duel-dashboard-heading"><h2>Mes duels</h2><button className="primary-button" disabled={busy} onClick={()=>void perform(create)}>Créer un duel</button></div>{duels.length>0?<ul>{duels.map(duel=><li key={duel.id}><button className="duel-list-choice" data-duel-id={duel.id} aria-pressed={view?.id===duel.id} disabled={busy} onClick={()=>{if(view?.id!==duel.id)void perform(()=>openDuel(duel.id));}}><strong>{duelNames(duel)}</strong><span>{duel.canAcceptRematch?'Revanche à accepter':duel.result??(duel.abandoned?'Abandonné':statuses[duel.state])}</span>{duel.score&&duel.state==='finished'&&!duel.abandoned&&<b>{duel.score.won} — {duel.score.lost}</b>}{duel.created_at&&<small>Créé le {dateLabel(duel.created_at)}</small>}{duel.deadline&&duel.state==='active'&&<small>Fin le {dateLabel(duel.deadline)}</small>}{duel.state==='finished'&&<span className="duel-review-link">Revoir</span>}</button></li>)}</ul>:<p>Aucun duel pour le moment.</p>}
          <details className="duel-join"><summary>Rejoindre un duel</summary>{joinForm}</details>
        </section>}
        {received&&<section className="duel-card duel-received" hidden={["owner","accepted"].includes(invitation.state)}><h2>Rejoindre le duel</h2><p>3 manches · 30 essais par manche · 48 h</p>{joinForm}<button className="secondary-button" disabled={busy} onClick={clearInvitation}>Annuler</button></section>}
      </>}
      {busy&&<p className="duel-loading" role="status">Chargement…</p>}
    </main>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="braise-dialog duel-rules" onCloseAutoFocus={event=>{const target=helpReturnFocus.current;helpReturnFocus.current=null;if(target?.isConnected){event.preventDefault();target.focus();}}}><DialogHeader><DialogTitle>Règles du duel</DialogTitle><DialogDescription>Trois mots identiques pour vous deux.</DialogDescription></DialogHeader><ul><li>30 essais par manche, sans indice.</li><li>48 heures à partir de l’acceptation.</li><li>Chacun joue à son rythme. Après la clôture des deux recherches d’une manche, sa solution et les essais des deux joueurs sont visibles.</li><li>Le mot trouvé gagne la manche. Si vous trouvez tous les deux, le moins d’essais l’emporte. Sinon, le meilleur rang gagne.</li><li>Les égalités sont conservées.</li></ul></DialogContent></Dialog>
  </div>;
}
