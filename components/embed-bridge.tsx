"use client";
import { useEffect } from "react";
import { EMBED_ORIGIN, EMBED_PROTOCOL, validEmbedMessage } from "@/lib/embed-contract";
export function EmbedBridge() {
  useEffect(() => {
    let connected = false;
    const send = () => { if (connected) parent.postMessage({ protocol: EMBED_PROTOCOL, type: "resize", height: Math.max(240, Math.min(10000, document.documentElement.scrollHeight)) }, EMBED_ORIGIN); };
    const receive = (event: MessageEvent) => { if (parent === window || event.source !== parent || !validEmbedMessage(event.origin, event.data, "hello")) return; connected = true; send(); };
    window.addEventListener("message", receive); const observer = new ResizeObserver(send); observer.observe(document.body);
    return () => { observer.disconnect(); window.removeEventListener("message", receive); };
  }, []);
  return <p>Braise · Jeu sémantique français. <a href="/" target="_blank" rel="noopener noreferrer">Ouvrir le site</a></p>;
}
