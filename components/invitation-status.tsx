'use client';
import {useEffect,useState} from 'react';
type Kind='circle'|'duel';
type Value={state:'ready'|'accepted'|'owner'|'expired'|'revoked'|'excluded'|'full'|'unknown';name?:string;expiresAt?:number;destination?:{kind:Kind;id:string}};
const labels:Record<string,string>={ready:'Invitation disponible : votre confirmation sera nécessaire.',accepted:'Vous avez déjà accepté cette invitation.',owner:'Vous êtes à l’origine de cette invitation.',expired:'Cette invitation a expiré. Demandez un nouveau lien à son auteur.',revoked:'Cette invitation a été révoquée. Demandez un nouveau lien à son auteur.',excluded:'Votre accès à ce cercle a été retiré. Contactez son propriétaire.',full:'Cette invitation ne peut plus accueillir de participant. Demandez une nouvelle invitation.',unknown:'Invitation introuvable. Vérifiez le lien reçu.',pending:'Vérification de l’invitation…',invalid:'Le code d’invitation doit comporter 64 caractères.',error:'Vérification indisponible. Réessayez avant de continuer.'};
/** Inspection belongs to the action owner; an old token/identity response is never actionable. */
export function useInvitation(kind:Kind,token:string,identity?:string){
 const [attempt,setAttempt]=useState(0),[result,setResult]=useState<{key:string;value?:Value;error?:string}|null>(null);
 const key=JSON.stringify([kind,token,identity,attempt]);
 const [seenKey,setSeenKey]=useState(key);
 // Reset during this render, before children can commit actions for a reselected token.
 if(seenKey!==key){setSeenKey(key);setResult(null);}
 useEffect(()=>{if(!/^[a-f0-9]{64}$/.test(token))return;const controller=new AbortController();void(async()=>{try{
   const response=await fetch('/api/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,token}),signal:controller.signal});
   const data=await response.json() as Value & {error?:string};if(!response.ok)throw new Error(data.error??'Vérification indisponible.');
   if(!['ready','accepted','owner','expired','revoked','excluded','full','unknown'].includes(data.state)||(data.state==='ready'&&(!Number.isFinite(data.expiresAt)||data.expiresAt!<=Date.now()))||(['accepted','owner'].includes(data.state)&&(!data.destination||data.destination.kind!==kind||typeof data.destination.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(data.destination.id))))throw new Error('Invitation à actualiser.');
   if(!controller.signal.aborted)setResult({key,value:data});
 }catch(cause){if(!controller.signal.aborted)setResult({key,error:cause instanceof Error?cause.message:'Vérification indisponible.'});}})();return()=>controller.abort();},[kind,token,identity,key]);
 const current=result?.key===key?result:null;
 const state=!token?'none':!/^[a-f0-9]{64}$/.test(token)?'invalid':current?.error?'error':current?.value?.state??'pending';
 return {state,value:current?.value,error:current?.error,canAccept:()=>state==='ready'&&(current?.value?.expiresAt??0)>Date.now(),retry:()=>setAttempt(n=>n+1)};
}
export function InvitationStatus({kind,invitation,identity,busy,onResume,onExit}:{kind:Kind;invitation:ReturnType<typeof useInvitation>;identity?:string;busy:boolean;onResume:(id:string)=>void;onExit:()=>void}){
 const {state,value,error}=invitation;if(state==='none')return null;
 return <section className="collection-picker laboratory-card" aria-label="Invitation reçue"><h2>{value?.name??(kind==='circle'?'Invitation à un cercle':'Invitation à un duel')}</h2><p role="status">{kind==='duel'&&state==='invalid'?'Lien d’invitation invalide.':labels[state]}</p>{state==='ready'&&value?.expiresAt&&<p>Valable jusqu’au {new Date(value.expiresAt).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} (Paris).</p>}{error&&<p role="alert">{error}</p>}
 {['accepted','owner'].includes(state)&&value?.destination&&<button className="primary-button" disabled={busy} onClick={()=>onResume(value.destination!.id)}>{kind==='circle'?'Reprendre mon cercle':'Reprendre mon duel'}</button>}
 {state==='error'&&<button className="text-action" disabled={busy} onClick={invitation.retry}>Réessayer la vérification</button>}
 {!identity&&<p><a href="/espace">Retrouver mon identité</a> conserve cette invitation dans cet onglet.</p>}
 <button className="text-action" disabled={busy} onClick={onExit}>Quitter cette invitation</button></section>;
}
