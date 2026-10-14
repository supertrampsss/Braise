"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { flameLevel } from "@/lib/flame-presentation";
import { formatScoreFr } from "@/lib/format-fr";

/** Exact approved artwork. No domain state, requests, rewards or corpus access. */
export default function FlameScene({ temperature, celebrating, paused, solved = false, revealMotion = false }: {
  temperature: number; celebrating: boolean; paused: boolean; solved?: boolean; revealMotion?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const turbulence = useRef<SVGFETurbulenceElement>(null);
  const filterId = `braiz-flow-${useId().replace(/:/g, "")}`;
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let inView = true;
    const sync = () => setVisible(inView && !document.hidden);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting; sync();
    });
    observer?.observe(element);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = 0;
    const draw = (now: number) => {
      if (paused || !visible || reduced.matches) return;
      if (now - last >= 1000 / 30) {
        last = now;
        const phase = now / 4200;
        turbulence.current?.setAttribute("baseFrequency", `${.015 + Math.sin(phase) * .0015} ${.035 + Math.cos(phase) * .003}`);
      }
      frame = requestAnimationFrame(draw);
    };
    const sync = () => { cancelAnimationFrame(frame); if (!paused && visible && !reduced.matches) frame = requestAnimationFrame(draw); };
    reduced.addEventListener("change", sync);
    sync();
    return () => { cancelAnimationFrame(frame); reduced.removeEventListener("change", sync); };
  }, [paused, visible]);
  const level = flameLevel(temperature, solved);
  const safe = Number.isFinite(temperature) ? Math.max(0, Math.min(100, temperature)) : 0;
  return <div ref={host} className="foyer-scene approved-flame" role="meter"
    aria-label="Chaleur de votre meilleure piste" aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={safe} aria-valuetext={`${formatScoreFr(safe)} degrés sur 100${solved ? ", mot trouvé" : ""}`}
    data-paused={paused} data-visible={visible} data-solved={solved} data-reveal-motion={revealMotion} data-celebrating={celebrating && solved}
    data-renderer="approved-art" style={{ "--reveal-top": `${(1 - level) * 100}%` } as CSSProperties}>
    <svg className="approved-flame-defs" aria-hidden="true"><defs><filter id={filterId} x="-5%" y="-5%" width="110%" height="110%"><feTurbulence ref={turbulence} type="fractalNoise" baseFrequency=".015 .035" numOctaves="2" seed="4" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>
    {/* eslint-disable-next-line @next/next/no-img-element -- Approved native artwork is layered with the same SVG filter; preserve its rendering and pause/performance contract. */}
    <img src="/art/braiz-approved-flame.png" alt="" className="approved-flame-cold" aria-hidden="true" />
    {/* eslint-disable-next-line @next/next/no-img-element -- Approved native artwork is layered with the same SVG filter; preserve its rendering and pause/performance contract. */}
    <img src="/art/braiz-approved-flame.png" alt="" className="approved-flame-hot" style={{ filter:`url(#${filterId})` }} aria-hidden="true" />
    <span className="approved-sparks" aria-hidden="true"><i/><i/><i/><i/><i/><i/></span>
  </div>;
}


