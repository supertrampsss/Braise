"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const fragmentShader = `
  precision highp float;
  varying vec2 v;
  uniform sampler2D image;
  uniform float time, heat, aspect;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
      mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
  }
  void main() {
    // Preserve the 2:3 artwork in every container, including the keyboard layout.
    vec2 p=v-.5;
    float sourceAspect=2./3.;
    p*=vec2(max(1.,aspect/sourceAspect),max(1.,sourceAspect/aspect));
    p+=.5;
    float tip=smoothstep(.15,.9,p.y);
    float flow=noise(vec2(p.x*5.,p.y*7.-time*.72))-.5;
    float filament=noise(vec2(p.x*13.+time*.13,p.y*17.-time*1.65))-.5;
    p.x+=(flow*.025+filament*.008)*tip;
    p.y+=flow*.007*tip;
    if(p.x<0.||p.x>1.||p.y<0.||p.y>1.) { gl_FragColor=vec4(0.); return; }
    vec3 c=texture2D(image,p).rgb;
    float breath=sin(time*1.4)*.018+filament*.018;
    c*=.96+heat*.10+breath;
    gl_FragColor=vec4(c,1.);
  }
`;

/** Decorative texture animation; only accepted game data determines its heat. */
export default function FlameScene({ temperature, celebrating, paused }: {
  temperature: number; celebrating: boolean; paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const values = useRef({ temperature, celebrating, paused });
  const wake = useRef<() => void>(() => {});
  const visibleState = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    values.current = { temperature, celebrating, paused };
    wake.current();
  }, [temperature, celebrating, paused]);

  useEffect(() => {
    const element = host.current?.parentElement;
    if (!element) return;
    let intersects = false;
    const update = () => {
      visibleState.current = intersects && !document.hidden;
      element.setAttribute("data-visible", String(visibleState.current));
      wake.current();
    };
    const observer = new IntersectionObserver(entries => {
      intersects = entries[0]?.isIntersecting ?? false;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void import("three").then(async T => {
      if (disposed || !host.current) return;
      let renderer: InstanceType<typeof T.WebGLRenderer>;
      try {
        renderer = new T.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
      } catch { return; }
      let texture: InstanceType<typeof T.Texture>;
      try { texture = await new T.TextureLoader().loadAsync("/art/flame.webp"); }
      catch { renderer.dispose(); return; }
      const element = host.current;
      if (disposed || !element) { texture.dispose(); renderer.dispose(); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      const scene = new T.Scene();
      const camera = new T.Camera();
      const geometry = new T.PlaneGeometry(2, 2);
      const uniforms = { image: { value: texture }, time: { value: 0 }, heat: { value: 0 }, aspect: { value: 2 / 3 } };
      const material = new T.ShaderMaterial({
        transparent: true, uniforms, fragmentShader,
        vertexShader: "varying vec2 v; void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}",
      });
      scene.add(new T.Mesh(geometry, material));
      element.appendChild(renderer.domElement);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      let frame = 0, last = 0, contextLost = false;
      const targetHeat = () => Math.min(1, Math.max(0, values.current.temperature) / 100) + (values.current.celebrating ? .2 : 0);
      const visible = () => !disposed && !contextLost && visibleState.current;
      const moving = () => visible() && !values.current.paused && !reduced.matches;
      const draw = (now: number) => {
        frame = 0;
        if (!moving()) return;
        if (now - last >= 1000 / 30) {
          const dt = last ? Math.min(.06, (now - last) / 1000) : 0;
          last = now;
          uniforms.time.value += dt;
          uniforms.heat.value += (targetHeat() - uniforms.heat.value) * (1 - Math.exp(-dt * 3));
          renderer.render(scene, camera);
        }
        frame = requestAnimationFrame(draw);
      };
      const sync = () => {
        cancelAnimationFrame(frame); frame = 0; last = 0;
        if (!visible()) return;
        if (!moving()) uniforms.heat.value = targetHeat();
        renderer.render(scene, camera);
        if (moving()) frame = requestAnimationFrame(draw);
      };
      wake.current = sync;
      const resize = () => {
        if (disposed || contextLost) return;
        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        uniforms.aspect.value = bounds.width / bounds.height;
        renderer.setSize(bounds.width, bounds.height);
        sync();
      };
      const observer = new ResizeObserver(resize);
      const lost = () => { contextLost = true; cancelAnimationFrame(frame); setReady(false); };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      reduced.addEventListener("change", sync);
      observer.observe(element);
      resize(); setReady(true);
      cleanup = () => {
        wake.current = () => {};
        cancelAnimationFrame(frame); observer.disconnect();
        reduced.removeEventListener("change", sync);
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose();
        renderer.domElement.remove();
      };
    }).catch(() => {});
    return () => { disposed = true; cleanup(); };
  }, []);

  return <div className="foyer-scene" aria-hidden="true" data-paused={paused}>
    <div className="flame-light"><span className="flame-halo"/><span className="flame-reflection"/></div>
    <img src="/art/flame.webp" alt="" className="foyer-fallback" style={{ opacity: ready ? 0 : 1 }}/>
    <div ref={host} className="foyer-canvas" style={{ opacity: ready ? 1 : 0 }}/>
    <div className="flame-embers">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{
      "--x": `${22 + (i * 37 % 59)}%`, "--drift": `${(i * 19 % 51) - 25}px`,
      "--duration": `${4 + i % 5}s`, "--delay": `${-i * 1.17}s`,
    } as CSSProperties}/>)}</div>
  </div>;
}
