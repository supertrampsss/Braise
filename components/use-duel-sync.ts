'use client';
import {useEffect,useRef} from 'react';
import type {DuelView} from '@/lib/duel-presentation';
type Config<T>={enabled:boolean;selectedId:string|null;revision:()=>number;busy:()=>boolean;loadList:(signal:AbortSignal)=>Promise<T>;loadView:(id:string,signal:AbortSignal)=>Promise<DuelView>;onList:(rows:T)=>void;onView:(view:DuelView)=>void;onError:(message:string)=>void};

/** Refresh accepted facts only. It never writes a word, accepts an invitation or emits play effects. */
export function useDuelSync<T>(config:Config<T>){
 const latest=useRef(config);latest.current=config;
 const refresh=useRef<()=>Promise<void>>(async()=>{});
 useEffect(()=>{
  if(!config.enabled)return;
  let active=true,inFlight=false,controller:AbortController|null=null;
  async function poll(){
   if(!active||document.hidden||inFlight||latest.current.busy())return;
   const started=latest.current,id=started.selectedId,revision=started.revision();inFlight=true;
   controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
   try{
    const [rows,view]=await Promise.all([started.loadList(controller.signal),id?started.loadView(id,controller.signal):null]);
    const current=latest.current;
    if(active&&!document.hidden&&!current.busy()&&current.selectedId===id&&current.revision()===revision){current.onList(rows);if(view)current.onView(view);current.onError('');}
   }catch(error){if(active&&!document.hidden&&latest.current.revision()===revision)latest.current.onError(error instanceof Error&&error.name==='AbortError'?'Actualisation interrompue.':'Actualisation indisponible.');}
   finally{clearTimeout(timeout);inFlight=false;controller=null;}
  }
  refresh.current=poll;
  const resume=()=>{if(!document.hidden)void poll();};
  const timer=setInterval(()=>void poll(),8000);
  document.addEventListener('visibilitychange',resume);window.addEventListener?.('focus',resume);
  return()=>{active=false;clearInterval(timer);controller?.abort();document.removeEventListener('visibilitychange',resume);window.removeEventListener?.('focus',resume);refresh.current=async()=>{};};
 },[config.enabled,config.selectedId]);
 return ()=>refresh.current();
}
