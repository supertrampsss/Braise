"use client";

import { useEffect, useRef, useState } from "react";


// Decorative renderer only: it never reads or writes the game or its persistence.
export default function FlameScene({ temperature, celebrating, paused }: { temperature: number; celebrating: boolean; paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const values = useRef({ temperature, celebrating, paused });
  useEffect(() => { values.current = { temperature, celebrating, paused }; }, [temperature, celebrating, paused]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void import("three").then(THREE => {
      if (disposed || !host.current) return;
      const element = host.current;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" }); }
      catch { return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const geometry = new THREE.PlaneGeometry(2, 2);
      const uniforms = { time: { value: 0 }, heat: { value: 0.3 }, aspect: { value: 1 } };
      const material = new THREE.ShaderMaterial({
        transparent: true, depthTest: false, uniforms,
        vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
        fragmentShader: `
          precision highp float;
          varying vec2 vUv; uniform float time, heat, aspect;
          float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
          float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
          float fbm(vec3 p){return .58*noise(p)+.28*noise(p*2.03)+.14*noise(p*4.07);}
          void main(){
            vec2 uv=(vUv-.5)*vec2(aspect,1.); vec3 sum=vec3(0.);float opacity=0.;
            for(int i=0;i<36;i++){
              float z=-.42+float(i)*.024;
              vec3 p=vec3(uv.x,uv.y+.34,z);
              float y=p.y;
              float bend=sin(y*9.-time*1.5)*.065*y+sin(y*5.+time)*.05;
              p.x-=bend;
              float width=(.17+heat*.035)*pow(max(0.,1.-y/.76),1.35);
              float shape=length(vec2(p.x,p.z*.72))/max(.006,width);
              float n=fbm(p*vec3(15.,9.,12.)-vec3(0.,time*1.5,0.));
              float density=(1.-smoothstep(.25,1.12,shape+n*.65))*smoothstep(0.,.08,y)*(1.-smoothstep(.57,.82,y));
              float ribbon=pow(max(0.,1.-abs(shape-.62+n*.35)),6.);
              float a=density*.075;
              vec3 color=mix(vec3(1.,.18,.012),vec3(1.,.72,.26),ribbon);
              color=mix(color,vec3(1.,.94,.69),density*density*.8);
              sum+=(1.-opacity)*color*a*2.;opacity+=(1.-opacity)*a;
            }
            float glow=exp(-length(uv*vec2(3.,1.8))*7.)*.11;
            sum+=vec3(.9,.22,.018)*glow;
            gl_FragColor=vec4(sum,clamp(opacity+glow,0.,1.));
          }`
      });
      scene.add(new THREE.Mesh(geometry, material));
      element.appendChild(renderer.domElement);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      let frame = 0, last = 0, elapsed = 1.8;
      let visible = true;
      const resize = () => { const r=element.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height));uniforms.aspect.value=r.width/Math.max(1,r.height); };
      const observer=new ResizeObserver(resize);observer.observe(element);resize();
      const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});intersection.observe(element);
      const draw=(now:number)=>{
        if(disposed)return;
        frame=requestAnimationFrame(draw);
        if(document.hidden || !visible || now-last<16)return;
        const dt=Math.min((now-last)/1000,.05);last=now;
        const moving=!reduced.matches&&!values.current.paused;
        if(moving) elapsed+=dt;
        uniforms.time.value=elapsed;
        const target=.25+Math.max(0,Math.min(100,values.current.temperature))/150+(values.current.celebrating ? .18 : 0);
        uniforms.heat.value+=(target-uniforms.heat.value)*.06;
        renderer.render(scene,camera);
      };
      const lost=()=>{cancelAnimationFrame(frame);setReady(false);};
      renderer.domElement.addEventListener("webglcontextlost",lost);
      renderer.render(scene,camera);setReady(true);frame=requestAnimationFrame(draw);
      cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();renderer.domElement.removeEventListener("webglcontextlost",lost);geometry.dispose();material.dispose();renderer.dispose();renderer.domElement.remove();};
    }).catch(()=>{ /* The form stays usable if the optional renderer cannot load. */ });
    return()=>{disposed=true;cleanup();};
  },[]);
  return <div className="foyer-scene" aria-hidden="true"><div ref={host} className="foyer-canvas" />{!ready&&<svg className="foyer-fallback" viewBox="0 0 200 260" focusable="false"><defs><linearGradient id="fire-outer" x1="0" y1="1" x2=".7" y2="0"><stop stopColor="#ff631c"/><stop offset=".5" stopColor="#ffc46b"/><stop offset="1" stopColor="#fff1cb"/></linearGradient><linearGradient id="fire-core" x1="0" y1="1" x2=".5" y2="0"><stop stopColor="#fff4d7"/><stop offset="1" stopColor="#ffac42"/></linearGradient><filter id="fire-glow"><feGaussianBlur stdDeviation="12"/></filter></defs><path d="M103 17C118 65 164 84 151 133C170 116 164 104 160 95C210 160 168 236 102 241C34 245 2 170 48 113C42 154 68 153 70 126C72 79 110 67 103 17Z" fill="#ed872b" opacity=".3" filter="url(#fire-glow)"/><path d="M103 17C118 65 164 84 151 133C170 116 164 104 160 95C210 160 168 236 102 241C34 245 2 170 48 113C42 154 68 153 70 126C72 79 110 67 103 17Z" fill="url(#fire-outer)"/><path d="M105 102C100 143 142 157 134 193C131 218 115 232 101 235C62 233 58 193 77 172C74 197 99 194 94 170C89 146 103 131 105 102Z" fill="url(#fire-core)"/></svg>}</div>;
}
