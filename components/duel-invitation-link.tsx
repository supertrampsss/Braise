"use client";
import {useEffect,useRef,useState} from 'react';
import {Check,Copy,Share2} from 'lucide-react';

/** The invitation is only transmitted after the player's explicit choice. */
export function DuelInvitationLink({link,disabled=false}:{link:string;disabled?:boolean}) {
  const [feedback,setFeedback]=useState({link,copied:false,message:''});
  const copied=feedback.link===link&&feedback.copied,message=feedback.link===link?feedback.message:'';
  const revision=useRef({value:0});
  useEffect(()=>{
    const pending=revision.current;
    pending.value++;
    return ()=>{pending.value++;};
  },[link]);
  async function copyLink(){
    const request=++revision.current.value;setFeedback({link,copied:false,message:''});
    try{
      await navigator.clipboard.writeText(link);
      if(request===revision.current.value)setFeedback({link,copied:true,message:'Lien copié. Collez-le dans un message à votre ami.'});
    }catch{
      if(request===revision.current.value)setFeedback({link,copied:false,message:'Sélectionnez le lien ci-dessous pour le copier.'});
    }
  }
  async function invite(){
    if(!navigator.share){await copyLink();return;}
    const request=++revision.current.value;setFeedback({link,copied:false,message:''});
    try{
      await navigator.share({title:'BRAIZ · Duel',text:'Trois mots à trouver, chacun à son rythme. Rejoignez mon duel !',url:link});
    }catch(cause){
      if(request!==revision.current.value||cause instanceof Error&&cause.name==='AbortError')return;
      setFeedback({link,copied:false,message:'Le partage est indisponible. Vous pouvez copier le lien ci-dessous.'});
    }
  }
  return <div className="duel-invitation-link">
    <div className="duel-invitation-actions">
      <button type="button" className="primary-button" disabled={disabled} onClick={invite}><Share2 size={18} aria-hidden="true"/> Inviter un ami</button>
      <button type="button" className="secondary-button" disabled={disabled} onClick={copyLink}>{copied?<Check size={18} aria-hidden="true"/>:<Copy size={18} aria-hidden="true"/>} {copied?'Copié':'Copier le lien'}</button>
    </div>
    <label htmlFor="duel-link">Lien d’invitation</label>
    <input id="duel-link" readOnly value={link} onFocus={event=>event.target.select()}/>
    <p className="duel-invitation-feedback" role="status">{message}</p>
  </div>;
}
