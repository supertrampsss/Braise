"use client";
import { useEffect, useLayoutEffect, useRef } from 'react';
import { liveFlameFragment, liveFlameVertex } from '@/lib/live-flame-shader';

/** Événement global : une gerbe d'étincelles partant d'un point de l'écran (EmberField). */
export type EmberBurst = { x: number; y: number; power: number };
export function emitEmberBurst(detail: EmberBurst) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<EmberBurst>('braiz:burst', { detail }));
}
/** Chaleur ambiante de tout le site, 0..1, lue par EmberField et le fond. */
export function setAmbientHeat(heat: number) {
  if (typeof document === 'undefined') return;
  const h = Math.max(0, Math.min(1, heat));
  document.documentElement.style.setProperty('--braiz-heat', h.toFixed(3));
  document.documentElement.dataset.heat = h.toFixed(3);
}

/**
 * Flamme vivante en WebGL. `level` suit la meilleure proximité acceptée ; chaque nouveau
 * `pulse` (identifiant d'un essai accepté) provoque une poussée proportionnelle à `pulsePower`.
 * Renvoie false via `onUnsupported` quand WebGL manque : l'appelant garde son repli.
 */
export function LiveFlame({ level, pulse, pulsePower = .3, record = false, glory = false, paused, onUnsupported }: {
  level: number; pulse?: string | number | null; pulsePower?: number; record?: boolean; glory?: boolean;
  paused: boolean; onUnsupported?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const indisponible = useRef(onUnsupported);
  const state = useRef({ heat: level, target: level, surge: 0, glory: glory ? 1 : 0, gloryTarget: glory ? 1 : 0, paused });
  useLayoutEffect(() => {
    indisponible.current = onUnsupported;
    const s = state.current; s.target = level; s.gloryTarget = glory ? 1 : 0; s.paused = paused;
  });

  // Poussée à chaque essai accepté ; un record lance aussi une gerbe d'étincelles.
  const dernierPulse = useRef(pulse);
  useEffect(() => {
    if (pulse == null || pulse === dernierPulse.current) return;
    dernierPulse.current = pulse;
    const s = state.current;
    s.surge = Math.min(1, Math.max(s.surge, .25 + pulsePower * .75 + (record ? .25 : 0)));
    const rect = canvas.current?.getBoundingClientRect();
    if (rect && (record || pulsePower > .55)) emitEmberBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height * .62, power: record ? .6 + pulsePower * .4 : pulsePower * .5 });
  }, [pulse, pulsePower, record]);
  useEffect(() => {
    if (!glory) return;
    const rect = canvas.current?.getBoundingClientRect();
    if (rect) emitEmberBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height * .55, power: 1.4 });
  }, [glory]);

  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const gl = el.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) { indisponible.current?.(); return; }
    const compile = (type: number, src: string) => { const sh = gl.createShader(type)!; gl.shaderSource(sh, src); gl.compileShader(sh); return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null; };
    const vs = compile(gl.VERTEX_SHADER, liveFlameVertex), fs = compile(gl.FRAGMENT_SHADER, liveFlameFragment);
    const prog = gl.createProgram()!;
    if (!vs || !fs) { indisponible.current?.(); return; }
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { indisponible.current?.(); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'position'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u('res'), uT = u('t'), uHeat = u('heat'), uSurge = u('surge'), uGlory = u('glory');
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const reduit = matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0, visible = true, last = performance.now(), temps = Math.random() * 100;
    const taille = () => {
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      const w = Math.max(1, Math.round(el.clientWidth * dpr)), h = Math.max(1, Math.round(el.clientHeight * dpr));
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      gl.viewport(0, 0, el.width, el.height);
    };
    const dessiner = () => {
      const s = state.current;
      gl.uniform2f(uRes, el.width, el.height); gl.uniform1f(uT, temps);
      gl.uniform1f(uHeat, s.heat); gl.uniform1f(uSurge, s.surge); gl.uniform1f(uGlory, s.glory);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const image = (now: number) => {
      raf = 0;
      const s = state.current, dt = Math.min(.05, (now - last) / 1000); last = now;
      // Les niveaux rejoignent leur cible en douceur ; la poussée retombe.
      s.heat += (s.target - s.heat) * Math.min(1, dt * 2.2);
      s.glory += (s.gloryTarget - s.glory) * Math.min(1, dt * 1.5);
      s.surge = Math.max(0, s.surge - dt * .9);
      setAmbientHeat(Math.max(s.heat, s.glory) * .85 + s.surge * .25);
      if (!s.paused) temps += dt;
      dessiner();
      if (visible && !document.hidden && !reduit.matches && !s.paused) raf = requestAnimationFrame(image);
    };
    const relancer = () => { taille(); if (reduit.matches || state.current.paused) { const s = state.current; s.heat = s.target; s.glory = s.gloryTarget; s.surge = 0; setAmbientHeat(Math.max(s.heat, s.glory) * .85); dessiner(); return; } if (!raf) { last = performance.now(); raf = requestAnimationFrame(image); } };
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([e]) => { visible = e.isIntersecting; relancer(); });
    io?.observe(el);
    const ro = new ResizeObserver(relancer); ro.observe(el);
    document.addEventListener('visibilitychange', relancer); reduit.addEventListener('change', relancer);
    relancer();
    const relance = setInterval(() => { if (!raf) relancer(); }, 500);
    return () => { cancelAnimationFrame(raf); clearInterval(relance); io?.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', relancer); reduit.removeEventListener('change', relancer); gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, []);

  return <canvas ref={canvas} className="live-flame" aria-hidden="true" />;
}
