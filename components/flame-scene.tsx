"use client";
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {flameLevel} from '@/lib/flame-presentation';
import {formatRankFr} from '@/lib/proximity-presentation';

const silhouette='M91 8C115 42 128 61 124 89C134 82 140 67 142 58C166 89 175 122 172 153C169 198 145 230 92 233C44 236 13 211 9 169C4 131 22 107 37 88C35 115 42 128 49 132C52 112 45 91 58 68C73 44 93 32 91 8Z';

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
        <clipPath id={id+'-shape'}><path d={silhouette}/></clipPath>
        <linearGradient id={id+'-heat'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ff7049"/><stop offset=".66" stopColor="#ff8c4b"/><stop offset="1" stopColor="#ffdb63"/></linearGradient>
        <linearGradient id={id+'-edge'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ef7046"/><stop offset="1" stopColor="#ffb668"/></linearGradient>
        <mask id={id+'-level'} maskUnits="userSpaceOnUse" x="-20" y="-20" width="220" height="280">
          <g className="flame-fill-mask" style={{transform:`translateY(${(1-level)*240}px)`}}><path d="M-20 0Q0-8 20 0T60 0T100 0T140 0T180 0T220 0V260H-20Z" fill="white"/></g>
        </mask>
      </defs>
      <path d={silhouette} fill="#211b19" stroke={'url(#'+id+'-edge)'} strokeWidth="1.5" opacity=".8"/>
      <g clipPath={'url(#'+id+'-shape)'} mask={'url(#'+id+'-level)'}>
        <rect width="180" height="240" fill={'url(#'+id+'-heat)'}/>
        <path className="flame-core" d="M93 101C99 133 130 141 133 171C137 204 119 230 92 235C57 229 41 209 49 179C51 166 65 153 66 139C69 160 83 166 81 186C96 166 93 139 93 101Z" fill="#ffdf77" opacity=".42"/>
      </g>
    </svg>
  </div>;
}
