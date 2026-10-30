'use client';
import { useEffect,useLayoutEffect,useRef,useState } from 'react';
import { applyDeviceMerge,deviceUploadRevision,prepareDeviceUpload,inspectDeviceMerge,type LiveDeviceGame } from '@/lib/device-sync';
import { type ProfileSnapshot } from '@/lib/profile-storage';
import { requestJson } from '@/lib/request-json';
type Remote={revision:number;payload:string|null};
type Session={guest:{name:string}|null;csrf?:string};
type PreparedUpload={text:string;revision:number;localRevision:string;boardRevision:string|null};
type Candidate={text:string;revision:number;localRevision:string;boardRevision:string|null;games:number;activities:number};
export type DeviceSyncGuard={revision:()=>string|null;admit:(revision:string|null)=>boolean;currentGame?:()=>LiveDeviceGame|null};
export function DeviceSync({snapshot,onSnapshot,disabled=false,mergeGuard}:{snapshot:ProfileSnapshot;onSnapshot:(s:ProfileSnapshot)=>void;disabled?:boolean;mergeGuard?:DeviceSyncGuard}){
  const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [session,setSession]=useState<Session|null>(null),[remote,setRemote]=useState<Remote|null>(null),[candidate,setCandidate]=useState<Candidate|null>(null),[upload,setUpload]=useState<PreparedUpload|null>(null);
  const uploadRef=useRef<PreparedUpload|null>(null);
  function replaceUpload(value:PreparedUpload|null){uploadRef.current=value;setUpload(value);}
  const latest=useRef({snapshot,onSnapshot,disabled,mergeGuard});useLayoutEffect(()=>{latest.current={snapshot,onSnapshot,disabled,mergeGuard};});
  const epoch=useRef(0),lock=useRef(false);useEffect(()=>()=>{epoch.current++;},[]);
  async function call(method='GET',body?:unknown){const {response,data}=await requestJson<Remote & {error?:string}>('/api/sync',{method,cache:'no-store',headers:{'Content-Type':'application/json','X-Braise-CSRF':session?.csrf??''},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw new Error(data.error??'Service indisponible.');return data;}
  async function run(action:(current:()=>boolean)=>Promise<void>){if(lock.current)return;lock.current=true;const revision=epoch.current;const current=()=>revision===epoch.current;setBusy(true);setError('');setMessage('');try{await action(current);}catch(cause){if(current())setError(cause instanceof Error?cause.message:'Service indisponible.');}finally{lock.current=false;if(current())setBusy(false);}}
  async function configure(current:()=>boolean){
    const {response,data}=await requestJson<Session>('/api/session',{cache:'no-store'});
    if(!response.ok)throw new Error('Identité indisponible.');
    if(!current())return;
    const copy=data.guest?await call():null;
    if(current()){setSession(data);setRemote(copy);setEnabled(true);}
  }
  return <section className="profile-transfer" aria-labelledby="sync-title"><h4 id="sync-title">Retrouver mes parties sur un autre appareil</h4><p>Facultatif. Une copie personnelle comprend profil, mots proposés, scores locaux, épingles et contextes des parties classiques en cours enregistrées localement. Aucun résultat compétitif n’est créé. Les secrets de connexion et de récupération ne sont pas copiés. Cette copie n’est pas chiffrée de bout en bout.</p>
    {!enabled?<button className="secondary-button" type="button" disabled={busy||disabled} onClick={()=>void run(configure)}>Configurer la synchronisation facultative</button>:<>
      <p>Aucun transfert automatique : chaque envoi ou fusion exige votre confirmation. Maximum : 1 000 parties, 3 000 essais par partie, 1 Mio ; dépassement refusé sans troncature.</p>
      {!session?.guest?<p>Créez ou récupérez votre identité dans <a href="/espace">Votre espace</a>, puis revenez ici. Un code de récupération retrouve la même identité et déconnecte les anciens appareils.</p>:<><p>Identité : {session.guest.name}. {remote?.payload?'Une copie personnelle distante existe.':'Aucune copie personnelle distante.'}</p>
      <div className="profile-transfer-actions"><button type="button" className="secondary-button" disabled={busy||disabled} onClick={()=>void run(async current=>{
        replaceUpload(null);setCandidate(null);
        const copy=await call();if(!current())return;setRemote(copy);
        const selected=latest.current,boardRevision=selected.mergeGuard?.revision()??null;
        if(selected.disabled||selected.mergeGuard&&boardRevision===null)throw new Error('Une partie charge ou évolue encore. Réessayez après son enregistrement.');
        const live=selected.mergeGuard?.currentGame?.();const text=prepareDeviceUpload(localStorage,selected.snapshot,new Date(),live);
        replaceUpload({text,revision:copy.revision,boardRevision,localRevision:deviceUploadRevision(localStorage,selected.snapshot,live)});
      })}>Préparer l’envoi de cet appareil</button>
      <button type="button" className="secondary-button" disabled={busy||disabled} onClick={()=>void run(async current=>{replaceUpload(null);setCandidate(null);const copy=await call();if(!current())return;setRemote(copy);if(!copy.payload){setMessage('Aucune copie à fusionner.');return;}const selected=latest.current;const plan=inspectDeviceMerge(copy.payload,localStorage,selected.snapshot,new Date(),selected.mergeGuard?.currentGame?.());setCandidate({text:copy.payload,revision:copy.revision,localRevision:plan.revision,boardRevision:selected.mergeGuard?.revision()??null,games:plan.games,activities:plan.activities});})}>Aperçu de la copie distante</button></div>
      {upload&&<div><p>Prêt à envoyer {(new TextEncoder().encode(upload.text).length/1024).toFixed(0)} Kio de données personnelles en clair. Une ancienne copie doit d’abord être fusionnée pour conserver ses faits.</p><button className="primary-button" disabled={busy||disabled} onClick={()=>void run(async current=>{
        if(uploadRef.current!==upload)throw new Error('Cette préparation n’est plus disponible. Préparez un nouvel envoi.');
        replaceUpload(null);
        const selected=latest.current,boardRevision=selected.mergeGuard?.revision()??null;
        if(selected.disabled||selected.mergeGuard&&(boardRevision===null||boardRevision!==upload.boardRevision))throw new Error('La partie a changé ou charge encore. Préparez un nouvel envoi.');
        const live=selected.mergeGuard?.currentGame?.();
        if(deviceUploadRevision(localStorage,selected.snapshot,live)!==upload.localRevision)throw new Error('La progression locale a changé. Préparez un nouvel envoi.');
        prepareDeviceUpload(localStorage,selected.snapshot,new Date(),live);
        if(deviceUploadRevision(localStorage,selected.snapshot,live)!==upload.localRevision)throw new Error('La progression locale a changé pendant la vérification. Préparez un nouvel envoi.');
        const result=await call('PUT',{revision:upload.revision,payload:upload.text});if(current()){setRemote(result);setMessage('Copie distante enregistrée.');}
      })}>Confirmer l’envoi</button><button className="text-action" disabled={busy||disabled} onClick={()=>replaceUpload(null)}>Annuler</button></div>}
      {candidate&&<div><p>{candidate.games} partie(s) à rapprocher, {candidate.activities} fait(s) de progression à ajouter. Les essais et épingles locaux sont conservés ; tout conflit bloque la fusion. Import personnel, sans valeur de classement.</p><button className="primary-button" disabled={busy||disabled} onClick={()=>void run(async current=>{const copy=await call();if(!current())return;if(copy.revision!==candidate.revision)throw new Error('La copie distante a changé. Relisez son aperçu.');const selected=latest.current;const merged=applyDeviceMerge(candidate.text,candidate.localRevision,localStorage,selected.snapshot,new Date(),()=>!latest.current.disabled&&(!latest.current.mergeGuard||latest.current.mergeGuard.admit(candidate.boardRevision)),selected.mergeGuard?.currentGame?.());selected.onSnapshot(merged);setCandidate(null);setMessage('Fusion enregistrée sur cet appareil.');})}>Confirmer la fusion locale</button><button className="text-action" disabled={busy||disabled} onClick={()=>setCandidate(null)}>Annuler</button></div>}
      <details><summary>Supprimer ma copie distante</summary><p>Efface uniquement la copie personnelle de cette identité. Les parties locales, les parties serveur et les autres joueurs restent conservés.</p><button className="text-action" disabled={busy||disabled||!remote} onClick={()=>void run(async current=>{const result=await call('DELETE',{revision:remote?.revision??-1});if(current()){setRemote(result);setCandidate(null);replaceUpload(null);setMessage('Votre copie personnelle distante est supprimée.');}})}>Confirmer la suppression distante</button></details>
      <p><a href="/espace">Reprendre mes parties vérifiées par le serveur ou révoquer l’accès de cet appareil</a></p></>}
      <button className="text-action" disabled={busy||disabled} onClick={()=>{epoch.current++;setEnabled(false);setCandidate(null);replaceUpload(null);setRemote(null);setSession(null);setMessage('Synchronisation désactivée ici. La copie distante reste conservée jusqu’à sa suppression explicite.');}}>Désactiver sur cet appareil</button>
    </>}{busy&&<p role="status">Vérification en cours…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
