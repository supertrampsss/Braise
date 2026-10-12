"use client";
import { useEffect } from "react";
import { EMBED_ORIGIN, EMBED_PROTOCOL, validEmbedEvent } from "@/lib/embed-contract";
export function EmbedBridge() {
  useEffect(() => {
    let connectedOrigin: string | null = null;
    const send = () => { if (connectedOrigin) parent.postMessage({ protocol: EMBED_PROTOCOL, type: "resize", height: Math.max(240, Math.min(10000, document.documentElement.scrollHeight)) }, connectedOrigin); };
    const receive = (event: MessageEvent) => { if (parent === window || !validEmbedEvent(event, parent, "hello")) return; connectedOrigin = event.origin; send(); };
    window.addEventListener("message", receive); const observer = new ResizeObserver(send); observer.observe(document.body);
    return () => { observer.disconnect(); window.removeEventListener("message", receive); };
  }, []);
  return <p className="braiz-embed-caption">BRAIZ · Jeu sémantique français. <a href={EMBED_ORIGIN} target="_blank" rel="noopener noreferrer">Ouvrir BRAIZ dans un nouvel onglet</a></p>;
}
