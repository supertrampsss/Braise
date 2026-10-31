"use client";
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {flameLevel} from '@/lib/flame-presentation';
import {formatRankFr} from '@/lib/proximity-presentation';
import {DrawnFlame} from '@/components/drawn-flame';

/** La flamme du jeu : trois aplats dessinés au canvas. Seule la meilleure proximité acceptée change sa hauteur. */
export default function FlameScene({level:proximity,rank,celebrating,paused,solved=false,revealMotion=false,pulse=null}:{
  level:number;rank:number|null;celebrating:boolean;paused:boolean;solved?:boolean;revealMotion?:boolean;
  pulse?:string|number|null;pulsePower?:number;record?:boolean;
}) {
  const host=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(true);
  const [motionAllowed,setMotionAllowed]=useState(false);
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>setMotionAllowed(!preference.matches);sync();
    preference.addEventListener('change',sync);
    return()=>preference.removeEventListener('change',sync);
  },[]);
  useEffect(()=>{
    let inView=true;const sync=()=>setVisible(inView&&!document.hidden);
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();});
    if(host.current)observer?.observe(host.current);
    document.addEventListener('visibilitychange',sync);sync();
    return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',sync);};
  },[]);
  const level=flameLevel(proximity,solved);
  return <div ref={host} className="foyer-scene approved-flame proximity-flame" role="img" aria-label={solved?'Mot trouvé':rank===null?'Proximité : aucun essai':`Proximité : ${formatRankFr(rank)}`}
    data-paused={paused} data-visible={visible} data-solved={solved} data-reveal-motion={revealMotion} data-celebrating={celebrating&&solved} data-renderer="drawn" style={{'--flame-level':level} as CSSProperties}>
    <DrawnFlame level={level} pulse={pulse} animate={motionAllowed&&visible&&!paused}/>
  </div>;
}
