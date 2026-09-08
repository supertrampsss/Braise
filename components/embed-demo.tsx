"use client";
import { useEffect, useRef, useState } from "react";
import { EMBED_ORIGIN, EMBED_PROTOCOL, validEmbedMessage } from "@/lib/embed-contract";
export default function EmbedDemo() {
  const frame = useRef<HTMLIFrameElement>(null); const [height, setHeight] = useState(800);
  useEffect(() => { const receive = (event: MessageEvent) => { if (event.source !== frame.current?.contentWindow || !validEmbedMessage(event.origin, event.data, "resize")) return; setHeight(event.data.height); }; window.addEventListener("message", receive); return () => window.removeEventListener("message", receive); }, []);
  return <main className="main-shell"><h1>Intégration Braise</h1><p>Démonstrateur sur la même origine privée. Les origines partenaires sont refusées tant qu’une configuration et une qualification réelles ne sont pas effectuées. L’accès privé du Site continue de s’appliquer ; les cookies tiers ne sont pas supposés disponibles.</p><iframe ref={frame} title="Jeu Braise intégré" src="/embed" style={{ width: "100%", height, border: 0 }} onLoad={() => frame.current?.contentWindow?.postMessage({ protocol: EMBED_PROTOCOL, type: "hello" }, EMBED_ORIGIN)} /></main>;
}
