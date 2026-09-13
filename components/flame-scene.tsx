"use client";
import { useEffect, useRef, useState } from "react";

/** Decorative Three.js texture animation. Scores and storage stay in the game. */
export default function FlameScene({temperature,celebrating,paused}:{temperature:number;celebrating:boolean;paused:boolean}){
 const host=useRef<HTMLDivElement>(null);
 const values=useRef({temperature,celebrating,paused});
 useEffect(()=>{values.current={temperature,celebrating,paused};},[temperature,celebrating,paused]);
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  let disposed=false;let cleanup=()=>{};
  void import("three").then(async T=>{
   if(disposed||!host.current)return;
   let renderer:InstanceType<typeof T.WebGLRenderer>;
   try{renderer=new T.WebGLRenderer({alpha:true,antialias:false,powerPreference:"low-power"});}catch{return;}
   let texture:InstanceType<typeof T.Texture>;
   try{texture=await new T.TextureLoader().loadAsync('/art/flame.webp');}catch{renderer.dispose();return;}
   if(disposed){texture.dispose();renderer.dispose();return;}
   const element=host.current;if(!element){texture.dispose();renderer.dispose();return;}
   renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
   const scene=new T.Scene(),camera=new T.Camera(),geometry=new T.PlaneGeometry(2,2);
   const uniforms={image:{value:texture},time:{value:0},heat:{value:0}};
   const material=new T.ShaderMaterial({transparent:true,uniforms,vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;varying vec2 v;uniform sampler2D image;uniform float time,heat;void main(){vec2 p=v;p.x+=sin(p.y*11.-time*1.8)*.009*p.y;p.y+=sin(time*1.3+p.x*9.)*.004;vec3 c=texture2D(image,p).rgb*(.9+heat*.18);gl_FragColor=vec4(c,1.);}`});
   scene.add(new T.Mesh(geometry,material));element.appendChild(renderer.domElement);
   let frame=0,last=0,elapsed=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
   const resize=()=>{const r=element.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height));renderer.render(scene,camera);};
   const observer=new ResizeObserver(resize);observer.observe(element);resize();setReady(true);
   const draw=(now:number)=>{if(disposed)return;frame=requestAnimationFrame(draw);if(document.hidden||now-last<30)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(!values.current.paused&&!reduced.matches)elapsed+=dt;uniforms.time.value=elapsed;uniforms.heat.value=Math.max(0,values.current.temperature)/100+(values.current.celebrating?.2:0);renderer.render(scene,camera);};frame=requestAnimationFrame(draw);
   const lost=()=>{cancelAnimationFrame(frame);setReady(false);};renderer.domElement.addEventListener('webglcontextlost',lost);
   cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lost);geometry.dispose();material.dispose();texture.dispose();renderer.dispose();renderer.domElement.remove();};
  }).catch(()=>{});
  return()=>{disposed=true;cleanup();};
 },[]);
 return <div className="foyer-scene" aria-hidden="true"><div ref={host} className="foyer-canvas" style={{opacity:ready?1:0}}/>{!ready&&<img src="/art/flame.webp" alt="" className="foyer-fallback"/>}</div>;
}
