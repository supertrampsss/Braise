"use client";
import { useEffect, useRef } from 'react';

/**
 * La flamme dessinée (choix du 31 octobre 2026) : trois aplats nets, rouge, orange et or,
 * qui ondulent lentement. Pas de lueur, pas d'étincelles. Sa hauteur suit la meilleure
 * proximité ; chaque essai accepté la redresse un court instant. Mouvement réduit, onglet
 * masqué ou partie en pause : la flamme est dessinée immobile.
 */
const COULEURS = ['#e2441c', '#ff8a2e', '#ffd58a'] as const;

export function dessinerFlamme(g: CanvasRenderingContext2D, w: number, h: number, t: number, niveau: number, souffle: number) {
  const c = Math.max(0, Math.min(1, niveau));
  const cx = w / 2, base = h * .96, H = h * (.4 + c * .55) * (1 + souffle * .1), L = Math.min(w * .42, h * (.2 + c * .1));
  const forme = (k: number, couleur: string, dec: number) => {
    const hh = H * k, ll = L * k, o = Math.sin(t * 1.2 + dec) * ll * .18, o2 = Math.sin(t * 1.7 + dec + 1) * ll * .14;
    g.beginPath(); g.moveTo(cx - ll, base - hh * .18);
    g.bezierCurveTo(cx - ll * 1.05, base - hh * .55, cx - ll * .2 + o, base - hh * .62, cx + o2 * .6, base - hh);
    g.bezierCurveTo(cx + ll * .15 + o, base - hh * .7, cx + ll * .9 + o2, base - hh * .62, cx + ll * .55, base - hh * .42);
    g.bezierCurveTo(cx + ll * 1.15, base - hh * .3, cx + ll * .9, base, cx, base);
    g.bezierCurveTo(cx - ll * .75, base, cx - ll * 1.02, base - hh * .06, cx - ll, base - hh * .18);
    g.fillStyle = couleur; g.fill();
  };
  forme(1, COULEURS[0], 0); forme(.7, COULEURS[1], 1.3); forme(.42, COULEURS[2], 2.4);
}

export function DrawnFlame({ level, pulse, animate }: { level: number; pulse?: string | number | null; animate: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const etat = useRef({ niveau: level, cible: level, souffle: 0, animate });
  useEffect(() => { etat.current.cible = level; etat.current.animate = animate; });
  const dernier = useRef(pulse);
  useEffect(() => {
    if (pulse == null || pulse === dernier.current) return;
    dernier.current = pulse; etat.current.souffle = 1;
  }, [pulse]);

  useEffect(() => {
    const el = canvas.current, g = el?.getContext('2d');
    if (!el || !g) return;
    let raf = 0, last = performance.now(), temps = Math.random() * 10;
    const taille = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = Math.max(1, Math.round(el.clientWidth * dpr)), h = Math.max(1, Math.round(el.clientHeight * dpr));
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const dessiner = () => { g.clearRect(0, 0, el.clientWidth, el.clientHeight); dessinerFlamme(g, el.clientWidth, el.clientHeight, temps, etat.current.niveau, etat.current.souffle); };
    const image = (now: number) => {
      raf = 0;
      const s = etat.current, dt = Math.min(.05, (now - last) / 1000); last = now;
      s.niveau += (s.cible - s.niveau) * Math.min(1, dt * 3);
      s.souffle = Math.max(0, s.souffle - dt * 1.8);
      temps += dt;
      dessiner();
      if (s.animate) raf = requestAnimationFrame(image);
    };
    const relancer = () => {
      taille();
      if (!etat.current.animate) { cancelAnimationFrame(raf); raf = 0; etat.current.niveau = etat.current.cible; etat.current.souffle = 0; dessiner(); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(image); }
    };
    const ro = new ResizeObserver(relancer); ro.observe(el);
    relancer();
    // Rattrape une reprise d'animation ou un nouveau niveau pendant une pause.
    const veille = setInterval(() => { const e = etat.current; if (e.animate ? !raf : e.niveau !== e.cible) relancer(); }, 400);
    return () => { cancelAnimationFrame(raf); clearInterval(veille); ro.disconnect(); };
  }, []);

  return <canvas ref={canvas} className="drawn-flame" aria-hidden="true" />;
}
