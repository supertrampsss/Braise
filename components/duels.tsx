"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Copy,Check,RefreshCw,Swords} from 'lucide-react';
import {InvitationStatus,useInvitation} from './invitation-status';
import {AppNavigation} from './app-navigation';
import {DuelBoard} from './duel-board';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from './ui/dialog';
import {duelRound,duelOutcome,invitationToken,DUEL_ROUNDS,type DuelView} from '@/lib/duel-presentation';
import {formatRankFr} from '@/lib/proximity-presentation';
import {readLocal} from '@/lib/legacy-storage';

type Session={guest:{id:string;name:string}|null;csrf?:string};
type DuelList={id:string;hostName:string;opponentName:string|null;created_at?:number;state:string;abandoned?:number;deadline?:number|null;invite_expires?:number};
type Feedback={round:number;ordinal:number;improved:boolean;found:boolean;announcement:string};
function dateLabel(value:number) { return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}).format(value); }
const statuses:Record<string,string>={active:'En cours',pending:'Invitation envoyée',expired:'Invitation expirée',cancelled:'Invitation annulée',finished:'Terminé',forfeit:'Abandonné'};

export default function Duels() {
  const [joining,setJoining]=useState(false),[session,setSession]=useState<Session>({guest:null});
  const [view,setView]=useState<DuelView|null>(null),[duels,setDuels]=useState<DuelList[]>([]);
  const [token,setToken]=useState(''),[inviteInput,setInviteInput]=useState(''),[link,setLink]=useState(''),[copied,setCopied]=useState(false);
  const [round,setRound]=useState(0),[word,setWord]=useState(''),[guestName,setGuestName]=useState(''),[received,setReceived]=useState(false);
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[help,setHelp]=useState(false);
  const [now,setNow]=useState(0),[paused,setPaused]=useState(true),[feedback,setFeedback]=useState<Feedback|null>(null);
  const lock=useRef(false),inputRevision=useRef(0),navigationEpoch=useRef(0);
  const creation=useRef<{id:string;token:string}|null>(null);
  const pending=useRef<{id:string;round:number;revision:number;requestId:string;word:string}|null>(null);
  const feedbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null),helpReturnFocus=useRef<HTMLButtonElement|null>(null);
  const invitation=useInvitation('duel',token,session.guest?.id);
  function clearFeedback() { if(feedbackTimer.current)clearTimeout(feedbackTimer.current);feedbackTimer.current=null;setFeedback(null); }
  function clearInvitation() {setReceived(false);setToken('');setInviteInput('');try{sessionStorage.removeItem('braiz.invitation.duel');}catch{}}
  async function api(path:string,body?:unknown,csrf=session.csrf??'') {
    const epoch=navigationEpoch.current;
    const response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json','X-Braise-CSRF':csrf},body:JSON.stringify(body)}:{cache:'no-store'});
    const data=await response.json() as DuelView&Session&{duels:DuelList[];error?:string};
    if(epoch!==navigationEpoch.current)throw new Error('Vue quittée.');
    if(!response.ok)throw new Error(data.error??'Service indisponible.');
    return data;
  }
  function showView(data:DuelView) {setView(data);setDuels(items=>items.map(item=>item.id===data.id?{...item,state:data.state,hostName:data.hostName,opponentName:data.opponentName,deadline:data.deadline,abandoned:data.forfeiter?1:0}:item));}
  async function refreshCurrent() {if(view){showView(await api(`/api/duels?id=${view.id}`));pending.current=null;clearFeedback();await refresh();}}
  async function perform(action:()=>Promise<void>) {
    if(lock.current)return;const epoch=navigationEpoch.current;lock.current=true;setBusy(true);setError('');
    try{await action();}catch(cause){if(epoch===navigationEpoch.current)setError(cause instanceof Error?cause.message:'Service indisponible.');}
    finally{lock.current=false;if(epoch===navigationEpoch.current)setBusy(false);}
  }
  async function refresh() {setDuels((await api('/api/duels')).duels);}
  async function openDuel(id:string) {
    const data=await api(`/api/duels?id=${encodeURIComponent(id)}`);showView(data);clearFeedback();pending.current=null;let savedLink='';if(data.state==='pending')try{savedLink=sessionStorage.getItem('braiz.duel.link.'+data.id)??'';}catch{}setLink(savedLink);setRound(DUEL_ROUNDS.find(index=>!duelRound(data,index,Date.now()).closed)??0);setWord('');
  }
  async function create(csrf?:string) {
    creation.current??={id:crypto.randomUUID(),token:[...crypto.getRandomValues(new Uint8Array(32))].map(value=>value.toString(16).padStart(2,'0')).join('')};
    const data=await api('/api/duels',{action:'create',...creation.current},csrf);showView(data);const privateLink=`${location.origin}/duels#invitation=${creation.current.token}`;setLink(privateLink);try{sessionStorage.setItem('braiz.duel.link.'+data.id,privateLink);}catch{}setCopied(false);creation.current=null;pending.current=null;clearFeedback();setRound(0);setWord('');await refresh();
  }
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
      pending.current=request;const data=await api('/api/duels',{action:'guess',...request});showView(data);pending.current=null;
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
      <header className="duel-heading"><div><h1>Duel</h1>{view&&<p>{view.hostName}{view.opponentName&&<> <span>vs</span> {view.opponentName}</>}</p>}</div><div className="duel-header-actions">{view?.deadline&&<p className="duel-deadline">Fin le {dateLabel(view.deadline)}</p>}{playable&&<button className="secondary-button" disabled={busy} onClick={()=>void perform(refreshCurrent)}><RefreshCw size={16}/> Actualiser</button>}</div></header>
      {error&&<p className="duel-error" id="duel-error" role="alert">{error}</p>}
      {invitation.state!=='ready'&&<InvitationStatus kind="duel" invitation={invitation} identity={session.guest?.id} busy={busy} onExit={clearInvitation} onResume={id=>void perform(async()=>{await openDuel(id);clearInvitation();})}/>}
      {!session.guest&&!joining&&<section className="duel-card duel-start"><Swords aria-hidden="true" size={34}/><p>3 manches · 30 essais par manche · 48 h</p><button className="primary-button" disabled={busy} onClick={()=>setJoining(true)}>Créer un duel</button></section>}
      {!session.guest&&joining&&(!token||invitation.state==='ready')&&<section className="duel-card duel-identity"><h2>{token?'Rejoindre le duel':'Créer un duel'}</h2><form onSubmit={event=>{event.preventDefault();if(token&&!invitation.canAccept())return;void perform(async()=>{const data=await api('/api/session',{name:guestName});setSession(data);if(token)await refresh();else await create(data.csrf);});}}><label htmlFor="duel-guest">Pseudonyme</label><input id="duel-guest" maxLength={24} value={guestName} placeholder="Pseudonyme" disabled={busy} onChange={event=>setGuestName(event.target.value)}/><button className="primary-button" disabled={busy||!guestName.trim()}>{token?'Continuer':'Créer le duel'}</button></form><a className="duel-identity-link" href="/espace">Retrouver mon identité</a></section>}
      {session.guest&&<>
        {view?.state==='pending'&&<section className="duel-card duel-invite"><h2>Inviter un adversaire</h2>{link&&<><label htmlFor="duel-link">Lien d’invitation</label><div className="duel-link-row"><input id="duel-link" readOnly value={link} onFocus={event=>event.target.select()}/><button className="primary-button" disabled={busy} onClick={()=>void copyLink()}>{copied?<Check size={18}/>:<Copy size={18}/>} {copied?'Copié':'Copier'}</button></div></>}<p>En attente de l’adversaire.</p>{view.inviteExpires&&<small>Invitation valable jusqu’au {dateLabel(view.inviteExpires)}.</small>}<button className="secondary-button" disabled={busy} onClick={()=>void perform(async()=>{showView(await api(`/api/duels?id=${view.id}`));pending.current=null;})}><RefreshCw size={16}/> Actualiser</button></section>}
        {view&&(view.state==='expired'||view.state==='cancelled')&&<section className="duel-card"><h2>{view.state==='expired'?'Invitation expirée':'Invitation annulée'}</h2><button className="primary-button" disabled={busy} onClick={()=>void perform(create)}>Créer un duel</button></section>}
        {outcome&&<section className="duel-card duel-summary" aria-labelledby="duel-summary-title"><h2 id="duel-summary-title">{outcome.title}</h2><p className="duel-result-score">{outcome.note}</p>{!view!.forfeiter&&<ol>{view!.decisions!.map((decision,index)=><li key={index}><span>Manche {index+1}</span><strong>{decision===0?'Égalité':decision===(view!.role==='host'?-1:1)?'Remportée':'Perdue'}</strong></li>)}</ol>}<button className="primary-button" disabled={busy} onClick={()=>void perform(create)}>Revanche</button></section>}
        {playable&&<DuelBoard view={view} round={round} now={now} busy={busy} word={word} paused={paused} feedback={feedback} onWord={value=>{inputRevision.current++;setWord(value);setError('');}} onRound={changeRound} onSubmit={submit} onRefresh={()=>void perform(refreshCurrent)}/>}
        {view&&(view.state==='pending'||view.state==='active')&&<details className="duel-end"><summary>{view.state==='pending'?'Annuler l’invitation':'Abandonner le duel'}</summary><button className="secondary-button" disabled={busy} onClick={()=>void perform(async()=>{showView(await api('/api/duels',{action:view.state==='pending'?'cancel':'forfeit',id:view.id}));setLink('');clearFeedback();await refresh();})}>Confirmer</button></details>}
        {!received&&<section className="duel-card duel-dashboard"><div className="duel-dashboard-heading"><h2>Mes duels</h2><button className="primary-button" disabled={busy} onClick={()=>void perform(create)}>Créer un duel</button></div>{duels.length>0?<ul>{duels.map(duel=><li key={duel.id}><button className="duel-list-choice" data-duel-id={duel.id} aria-pressed={view?.id===duel.id} disabled={busy} onClick={()=>{if(view?.id!==duel.id)void perform(()=>openDuel(duel.id));}}><strong>{duel.hostName}{duel.opponentName?` vs ${duel.opponentName}`:" · invitation"}</strong><span>{duel.abandoned?'Abandonné':statuses[duel.state]}</span>{duel.deadline?<small>Fin le {dateLabel(duel.deadline)}</small>:duel.created_at?<small>Créé le {dateLabel(duel.created_at)}</small>:null}</button></li>)}</ul>:<p>Aucun duel pour le moment.</p>}
          <details className="duel-join"><summary>Rejoindre un duel</summary>{joinForm}</details>
        </section>}
        {received&&<section className="duel-card duel-received" hidden={["owner","accepted"].includes(invitation.state)}><h2>Rejoindre le duel</h2><p>3 manches · 30 essais par manche · 48 h</p>{joinForm}<button className="secondary-button" disabled={busy} onClick={clearInvitation}>Annuler</button></section>}
      </>}
      {busy&&<p className="duel-loading" role="status">Chargement…</p>}
    </main>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="braise-dialog duel-rules" onCloseAutoFocus={event=>{const target=helpReturnFocus.current;helpReturnFocus.current=null;if(target?.isConnected){event.preventDefault();target.focus();}}}><DialogHeader><DialogTitle>Règles du duel</DialogTitle><DialogDescription>Trois mots identiques pour vous deux.</DialogDescription></DialogHeader><ul><li>30 essais par manche, sans indice.</li><li>48 heures à partir de l’acceptation.</li><li>Chacun joue à son rythme. Les mots de l’adversaire restent masqués.</li><li>Le mot trouvé gagne la manche. Si vous trouvez tous les deux, le moins d’essais l’emporte. Sinon, le meilleur rang gagne.</li><li>Les égalités sont conservées.</li></ul></DialogContent></Dialog>
  </div>;
}
