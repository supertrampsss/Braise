"use client";
import {useEffect,useId,useRef,useState,useSyncExternalStore,type CSSProperties} from 'react';
import {preload} from 'react-dom';
import {flameLevel} from '@/lib/flame-presentation';
import {formatRankFr} from '@/lib/proximity-presentation';
import {LiveFlame} from '@/components/live-flame';

const flameArt='/art/braiz-natural-flame-768.webp';
const sansAbonnement=()=>()=>{};
let webglConnu:boolean|undefined;
function webglDisponible(){
  if(webglConnu===undefined){try{webglConnu=Boolean(document.createElement('canvas').getContext('webgl'));}catch{webglConnu=false;}}
  return webglConnu;
}

/** Shared fillable flame. Only accepted best proximity changes its level. */
export default function FlameScene({level:proximity,rank,celebrating,paused,solved=false,revealMotion=false,pulse=null,pulsePower=.3,record=false}:{
  level:number;rank:number|null;celebrating:boolean;paused:boolean;solved?:boolean;revealMotion?:boolean;
  pulse?:string|number|null;pulsePower?:number;record?:boolean;
}) {
  // Le rendu serveur et le premier affichage gardent l'affiche SVG ; la flamme vivante la
  // remplace dès que le navigateur confirme WebGL, et la rend si le contexte échoue.
  const webgl=useSyncExternalStore(sansAbonnement,webglDisponible,()=>false);
  const [echec,setEchec]=useState(false);
  const vivante=webgl&&!echec;
  preload(flameArt,{as:'image',type:'image/webp',fetchPriority:'high'});
  const host=useRef<HTMLDivElement>(null),id='braiz-fill-'+useId().replace(/:/g,'');
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
  const animate=motionAllowed&&visible&&!paused;
  return <div ref={host} className="foyer-scene approved-flame proximity-flame" role="img" aria-label={solved?'Mot trouvé':rank===null?'Proximité : aucun essai':`Proximité : ${formatRankFr(rank)}`}
    data-paused={paused} data-visible={visible} data-solved={solved} data-reveal-motion={revealMotion} data-celebrating={celebrating&&solved} data-renderer={vivante?'live-webgl':'fillable-svg'} style={{'--flame-level':level} as CSSProperties}>
    {vivante&&<LiveFlame level={level} pulse={pulse} pulsePower={pulsePower} record={record} glory={solved} celebrate={celebrating&&solved} paused={paused} onUnsupported={()=>setEchec(true)}/>}
    {!vivante&&<svg className="fillable-flame" viewBox="0 0 180 240" aria-hidden="true">
      <defs>
        <filter id={id+'-heat'} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".018 .045" numOctaves="1" seed="8" result="heat">
            {animate&&<animate attributeName="baseFrequency" values=".018 .045;.022 .055;.016 .05;.018 .045" dur="5s" repeatCount="indefinite"/>}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="heat" scale="3" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <linearGradient id={id+'-surface'} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="14"><stop stopColor="white" stopOpacity="0"/><stop offset="1" stopColor="white"/></linearGradient>
        <mask id={id+'-level'} maskUnits="userSpaceOnUse" x="-20" y="-20" width="220" height="280">
          <g className="flame-fill-mask" style={{transform:`translateY(${(1-level)*240}px)`}}><path className="flame-surface" d="M-100 0Q-80-7-60 0T-20 0T20 0T60 0T100 0T140 0T180 0T220 0T260 0T300 0V260H-100Z" fill={'url(#'+id+'-surface)'}/></g>
        </mask>
      </defs>
      <image className="flame-ghost" href={flameArt} x="-34" y="-6" width="246" height="255" preserveAspectRatio="none"/>
      <g mask={solved?undefined:'url(#'+id+'-level)'}>
        <image className="flame-core" href={flameArt} filter={animate?'url(#'+id+'-heat)':undefined} x="-34" y="-6" width="246" height="255" preserveAspectRatio="none"/>
      </g>
    </svg>}
  </div>;
}
