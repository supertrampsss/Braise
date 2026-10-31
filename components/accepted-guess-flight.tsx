"use client";
import {useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {formatRankFr} from '@/lib/proximity-presentation';

export type GuessReceipt={id:string;word:string;rank:number;found:boolean};
type Flight=GuessReceipt & {x:number;y:number;dx:number;dy:number};

function FlyingChip({flight,onEnd}:{flight:Flight;onEnd:(id:string)=>void}) {
  const chip=useRef<HTMLSpanElement>(null);
  useLayoutEffect(()=>{
    const motion=chip.current!.animate([
      {opacity:0,transform:'translateY(-6px) scale(.94)',offset:0},
      {opacity:1,transform:'translate(0,0) scale(1)',offset:.15},
      {opacity:1,transform:'translate(0,0) scale(1)',offset:.44},
      {opacity:1,transform:`translate(${flight.dx}px,${flight.dy}px)`,offset:.8},
      {opacity:0,transform:`translate(${flight.dx}px,${flight.dy}px)`,offset:1},
    ],{duration:800,easing:'cubic-bezier(.2,.65,.3,1)'});
    motion.onfinish=()=>onEnd(flight.id);
    return()=>motion.cancel();
  },[flight,onEnd]);
  return <span ref={chip} className="accepted-guess-chip" style={{left:flight.x,top:flight.y} as CSSProperties}>{flight.word} · {flight.found?'Trouvé':formatRankFr(flight.rank)}</span>;
}

/** Local receipts only: no animation on restores, unknown words or duplicate responses. */
export function AcceptedGuessFlight({receipt,inputId,paused}:{receipt:GuessReceipt|null;inputId:string;paused:boolean}) {
  const host=useRef<HTMLDivElement>(null),seen=useRef<string|null>(null),origin=useRef<DOMRect|null>(null);
  const [flights,setFlights]=useState<Flight[]>([]);
  const remove=useRef((id:string)=>setFlights(current=>current.filter(f=>f.id!==id))).current;
  useLayoutEffect(()=>{
    const input=document.getElementById(inputId);
    if(input&&host.current) origin.current=input.parentElement!.querySelector('button')!.getBoundingClientRect();
    if(!receipt||seen.current===receipt.id)return;
    seen.current=receipt.id;
    if(paused||document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const root=host.current?.closest('.play-view');
    const row=Array.from(root?.querySelectorAll<HTMLElement>('[data-flight-word]')??[]).find(node=>node.dataset.flightWord===receipt.word);
    if(!origin.current||!row)return;
    const target=row.getBoundingClientRect();
    const x=Math.max(8,Math.min(origin.current.right-170,window.innerWidth-178)),y=origin.current.top-44;
    const endX=Math.max(8,target.right-180),endY=Math.min(window.innerHeight-40,target.top+(target.height-32)/2);
    setFlights(current=>{
      const retained=current.slice(-2);
      const occupied=new Set(retained.map(f=>Math.round((y-f.y)/36)));
      const lane=[0,1,2].find(value=>!occupied.has(value))??0;
      const startY=Math.max(8,y-lane*36);
      return [...retained,{...receipt,x,y:startY,dx:endX-x,dy:endY-startY}];
    });
  },[receipt,inputId,paused]);
  useLayoutEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)'),clear=()=>setFlights([]);
    if(paused||media.matches)clear();
    const hidden=()=>{if(document.hidden)clear();};
    media.addEventListener('change',clear);document.addEventListener('visibilitychange',hidden);
    return()=>{media.removeEventListener('change',clear);document.removeEventListener('visibilitychange',hidden);};
  },[paused]);
  return <div ref={host} className="accepted-guess-flights" aria-hidden="true">{flights.map(flight=><FlyingChip key={flight.id} flight={flight} onEnd={remove}/>)}</div>;
}
