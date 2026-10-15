"use client";
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {flameLevel} from '@/lib/flame-presentation';
import {formatRankFr} from '@/lib/proximity-presentation';

const flameArt='/art/braiz-natural-flame-v1.webp';

/** Shared fillable flame. Only accepted best proximity changes its level. */
export default function FlameScene({level:proximity,rank,celebrating,paused,solved=false,revealMotion=false}:{
  level:number;rank:number|null;celebrating:boolean;paused:boolean;solved?:boolean;revealMotion?:boolean;
}) {
  const host=useRef<HTMLDivElement>(null),id='braiz-fill-'+useId().replace(/:/g,'');
  const [visible,setVisible]=useState(true);
  useEffect(()=>{
    let inView=true;const sync=()=>setVisible(inView&&!document.hidden);
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();});
    if(host.current)observer?.observe(host.current);
    document.addEventListener('visibilitychange',sync);sync();
    return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',sync);};
  },[]);
  const level=flameLevel(proximity,solved);
  return <div ref={host} className="foyer-scene approved-flame proximity-flame" role="img" aria-label={solved?'Mot trouvé':rank===null?'Proximité : aucun essai':`Proximité : ${formatRankFr(rank)}`}
    data-paused={paused} data-visible={visible} data-solved={solved} data-reveal-motion={revealMotion} data-celebrating={celebrating&&solved} data-renderer="fillable-svg" style={{'--flame-level':level} as CSSProperties}>
    <svg className="fillable-flame" viewBox="0 0 180 240" aria-hidden="true">
      <defs>
        <linearGradient id={id+'-surface'} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="14"><stop stopColor="white" stopOpacity="0"/><stop offset="1" stopColor="white"/></linearGradient>
        <mask id={id+'-level'} maskUnits="userSpaceOnUse" x="-20" y="-20" width="220" height="280">
          <g className="flame-fill-mask" style={{transform:`translateY(${(1-level)*240}px)`}}><path className="flame-surface" d="M-100 0Q-80-7-60 0T-20 0T20 0T60 0T100 0T140 0T180 0T220 0T260 0T300 0V260H-100Z" fill={'url(#'+id+'-surface)'}/></g>
        </mask>
      </defs>
      <image className="flame-ghost" href={flameArt} x="-34" y="-6" width="246" height="255" preserveAspectRatio="none"/>
      <g mask={solved?undefined:'url(#'+id+'-level)'}>
        <image className="flame-core" href={flameArt} x="-34" y="-6" width="246" height="255" preserveAspectRatio="none"/>
      </g>
    </svg>
  </div>;
}
