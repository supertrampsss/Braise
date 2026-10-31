"use client";
import { useEffect, useRef } from 'react';
import type { EmberBurst } from '@/components/live-flame';

/**
 * Le foyer de tout le site : des braises montent derrière le contenu. Leur nombre suit
 * `--braiz-heat` (fixée par la flamme) ; une gerbe part d'un point sur `braiz:burst`.
 * Aucun effet en mouvement réduit, onglet masqué ou appareil sans canvas.
 */
type Braise = { x: number; y: number; vx: number; vy: number; vie: number; duree: number; r: number; chaud: number };

export function EmberField() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current; const g = el?.getContext('2d');
    if (!el || !g) return;
    const reduit = matchMedia('(prefers-reduced-motion: reduce)');
    let W = 0, H = 0, raf = 0, last = performance.now(), ambiance = 0;
    const braises: Braise[] = [];
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    const taille = () => { W = innerWidth; H = innerHeight; el.width = W * dpr; el.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const chaleur = () => Number(document.documentElement.dataset.heat ?? 0) || 0;
    const naitre = (x: number, y: number, force: number, gerbe: boolean): Braise => {
      const a = gerbe ? -Math.PI / 2 + (Math.random() - .5) * 1.9 : -Math.PI / 2 + (Math.random() - .5) * .5;
      const v = gerbe ? 120 + Math.random() * 380 * force : 18 + Math.random() * 40;
      return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: 0, duree: gerbe ? .9 + Math.random() * 1.6 : 4 + Math.random() * 6, r: gerbe ? .8 + Math.random() * 2.2 : .6 + Math.random() * 1.6, chaud: Math.random() };
    };
    const image = (now: number) => {
      raf = 0;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const h = chaleur(); ambiance += (h - ambiance) * Math.min(1, dt * 2);
      // Braises ambiantes : quelques-unes à froid, une nuée quand le mot est proche.
      const voulues = 10 + ambiance * 110;
      const ambiantes = braises.filter(b => b.duree > 3).length;
      if (ambiantes < voulues && Math.random() < dt * (4 + ambiance * 40)) braises.push(naitre(Math.random() * W, H + 10, 0, false));
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      for (let i = braises.length - 1; i >= 0; i--) {
        const b = braises[i]; b.vie += dt;
        if (b.vie > b.duree || b.y < -20) { braises.splice(i, 1); continue; }
        b.vx += (Math.sin(now / 900 + b.chaud * 9) * 14 - b.vx * .6) * dt;
        b.vy += (b.duree > 3 ? -6 : 60) * dt; // les gerbes retombent, les braises flottent
        b.x += b.vx * dt; b.y += b.vy * dt;
        const p = b.vie / b.duree, alpha = Math.sin(Math.PI * Math.min(1, p)) * (b.duree > 3 ? .35 + ambiance * .45 : .95);
        const r = b.r * (1 + (1 - p) * .6);
        const c = b.chaud > .7 ? '255,224,160' : b.chaud > .3 ? '255,160,70' : '255,106,40';
        if (b.duree <= 3) {
          // Étincelle : une traînée le long de sa vitesse, un cœur blanc chaud.
          g.strokeStyle = `rgba(${c},${alpha * .8})`; g.lineWidth = r; g.lineCap = 'round';
          g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * .035, b.y - b.vy * .035); g.stroke();
          g.fillStyle = `rgba(255,246,220,${alpha})`; g.beginPath(); g.arc(b.x, b.y, r * .7, 0, Math.PI * 2); g.fill();
        } else {
          const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 3.5);
          grad.addColorStop(0, `rgba(${c},${alpha})`); grad.addColorStop(.3, `rgba(${c},${alpha * .4})`); grad.addColorStop(1, `rgba(${c},0)`);
          g.fillStyle = grad; g.beginPath(); g.arc(b.x, b.y, r * 3.5, 0, Math.PI * 2); g.fill();
        }
      }
      g.globalCompositeOperation = 'source-over';
      if (!document.hidden && !reduit.matches) raf = requestAnimationFrame(image);
    };
    const relancer = () => { if (reduit.matches || document.hidden) { cancelAnimationFrame(raf); raf = 0; g.clearRect(0, 0, W, H); braises.length = 0; return; } if (!raf) { last = performance.now(); raf = requestAnimationFrame(image); } };
    const gerbe = (e: Event) => {
      if (reduit.matches) return;
      const { x, y, power } = (e as CustomEvent<EmberBurst>).detail;
      const n = Math.round(18 + power * 70);
      for (let i = 0; i < n && braises.length < 600; i++) braises.push(naitre(x + (Math.random() - .5) * 40, y, power, true));
      relancer();
    };
    taille(); relancer();
    addEventListener('resize', taille); document.addEventListener('visibilitychange', relancer); reduit.addEventListener('change', relancer);
    addEventListener('braiz:burst', gerbe);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', taille); document.removeEventListener('visibilitychange', relancer); reduit.removeEventListener('change', relancer); removeEventListener('braiz:burst', gerbe); };
  }, []);
  return <canvas ref={canvas} className="ember-field" aria-hidden="true" />;
}
