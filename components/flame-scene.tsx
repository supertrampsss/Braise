"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { flameFragment, flameVertex } from "@/lib/flame-shaders";

/** Procedural three-dimensional emissive field, driven by real accepted heat. */
export default function FlameScene({ temperature, celebrating, paused }: {
  temperature: number; celebrating: boolean; paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const values = useRef({ temperature, celebrating, paused });
  const wake = useRef<() => void>(() => {});
  const visibleState = useRef(false);
  const pointer = useRef({ x: 0, y: 0 });
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
      const element = host.current;
      if (disposed || !element) { renderer.dispose(); return; }
      // Deterministic noise artwork, not synthetic game data. Adjacent channels
      // provide the two z slices for trilinear volume noise in one texture read.
      const random = new Uint8Array(128 * 128);
      let seed = 71483;
      for (let i = 0; i < random.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        random[i] = seed >>> 24;
      }
      const pixels = new Uint8Array(128 * 128 * 4);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const offset = (y * 128 + x) * 4;
        pixels[offset] = random[y * 128 + x];
        pixels[offset + 1] = random[((y + 17) % 128) * 128 + (x + 37) % 128];
        pixels[offset + 3] = 255;
      }
      const texture = new T.DataTexture(pixels, 128, 128, T.RGBAFormat);
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.minFilter = texture.magFilter = T.LinearFilter;
      texture.generateMipmaps = false; texture.needsUpdate = true;
      renderer.setPixelRatio(1);
      const scene = new T.Scene();
      const camera = new T.Camera();
      const geometry = new T.PlaneGeometry(2, 2);
      const uniforms = { noiseMap: { value: texture }, time: { value: 4 }, heat: { value: 0 }, celebration: { value: 0 }, gaze: { value: new T.Vector2() }, aspect: { value: 1 } };
      const material = new T.ShaderMaterial({
        transparent: true, uniforms, fragmentShader: flameFragment, vertexShader: flameVertex,
      });
      scene.add(new T.Mesh(geometry, material));
      element.appendChild(renderer.domElement);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      let frame = 0, last = 0, contextLost = false, shaderFailed = false, presented = false;
      renderer.debug.onShaderError = () => { shaderFailed = true; setReady(false); };
      const present = () => {
        try {
          renderer.render(scene, camera);
          if (!shaderFailed && !presented) { presented = true; setReady(true); }
        } catch {
          shaderFailed = true;
          cancelAnimationFrame(frame);
          setReady(false);
        }
      };
      const onPointer = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        pointer.current = { x: event.clientX / window.innerWidth * 2 - 1, y: 1 - event.clientY / window.innerHeight * 2 };
      };
      window.addEventListener("pointermove", onPointer, { passive: true });
      const targetHeat = () => Math.min(1, Math.max(0, values.current.temperature) / 100);
      const visible = () => !disposed && !contextLost && !shaderFailed && visibleState.current;
      const moving = () => visible() && !values.current.paused && !reduced.matches;
      const draw = (now: number) => {
        frame = 0;
        if (!moving()) return;
        if (now - last >= 1000 / 30) {
          const dt = last ? Math.min(.06, (now - last) / 1000) : 0;
          last = now;
          // Integrate energy so a warmer guess accelerates flow without a phase jump.
          uniforms.time.value += dt * (.65 + uniforms.heat.value * .95);
          uniforms.heat.value += (targetHeat() - uniforms.heat.value) * (1 - Math.exp(-dt * 3));
          uniforms.celebration.value += ((values.current.celebrating ? 1 : 0) - uniforms.celebration.value) * (1 - Math.exp(-dt * 2));
          uniforms.gaze.value.lerp(new T.Vector2(pointer.current.x, pointer.current.y), 1 - Math.exp(-dt * 2.5));
          present();
        }
        frame = requestAnimationFrame(draw);
      };
      const sync = () => {
        cancelAnimationFrame(frame); frame = 0; last = 0;
        if (!visible()) return;
        if (!moving()) { uniforms.heat.value = targetHeat(); uniforms.celebration.value = 0; uniforms.gaze.value.set(0, 0); }
        present();
        if (moving()) frame = requestAnimationFrame(draw);
      };
      wake.current = sync;
      const resize = () => {
        if (disposed || contextLost) return;
        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        uniforms.aspect.value = bounds.width / bounds.height;
        const resolution = Math.min(1, 440 / bounds.width, 480 / bounds.height);
        renderer.setSize(Math.round(bounds.width * resolution), Math.round(bounds.height * resolution), false);
        sync();
      };
      const observer = new ResizeObserver(resize);
      const lost = () => { contextLost = true; cancelAnimationFrame(frame); setReady(false); };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      reduced.addEventListener("change", sync);
      observer.observe(element);
      cleanup = () => {
        wake.current = () => {};
        cancelAnimationFrame(frame); observer.disconnect();
        reduced.removeEventListener("change", sync);
        window.removeEventListener("pointermove", onPointer);
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose();
        renderer.domElement.remove();
      };
      resize();
    }).catch(() => { cleanup(); });
    return () => { disposed = true; cleanup(); };
  }, []);

  return <div className="foyer-scene" aria-hidden="true" data-paused={paused} data-renderer={ready ? "volume" : "fallback"} style={{ "--flame-energy": Math.min(1, Math.max(0, temperature) / 100) } as CSSProperties}>
    <div className="flame-light"><span className="flame-halo"/><span className="flame-reflection"/></div>
    <img src="/art/flame.webp" alt="" className="foyer-fallback" style={{ opacity: ready ? 0 : 1 }}/>
    <div ref={host} className="foyer-canvas" style={{ opacity: ready ? 1 : 0 }}/>
    <div className="flame-embers">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{
      "--x": `${22 + (i * 37 % 59)}%`, "--drift": `${(i * 19 % 51) - 25}px`,
      "--duration": `${4 + i % 5}s`, "--delay": `${-i * 1.17}s`,
    } as CSSProperties}/>)}</div>
  </div>;
}
