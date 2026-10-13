"use client";
import { useEffect, useRef, useState } from "react";
import { EMBED_ALLOWED_ORIGINS, EMBED_ORIGIN, EMBED_PROTOCOL, validEmbedEvent } from "@/lib/embed-contract";
import { AppNavigation } from "@/components/app-navigation";
import { EXTRA_MODES_ENABLED } from "@/lib/release";
import { DISTRIBUTION } from "@/lib/distribution";
export default function EmbedDemo() {
  const frame = useRef<HTMLIFrameElement>(null); const [height, setHeight] = useState(800); const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  useEffect(() => {
    const timer = setTimeout(() => setStatus(previous => previous === "ready" ? previous : "unavailable"), 5000);
    const receive = (event: MessageEvent) => { if (event.origin !== EMBED_ORIGIN || !validEmbedEvent(event, frame.current?.contentWindow ?? null, "resize")) return; setHeight(event.data.height); setStatus("ready"); clearTimeout(timer); };
    window.addEventListener("message", receive); return () => { clearTimeout(timer); window.removeEventListener("message", receive); };
  }, []);
  return <><AppNavigation active="explore" modeName="Intégration" /><main className="main-shell laboratory-shell"><h1>Intégration BRAIZ</h1><p>Cette intégration accepte uniquement les deux adresses contrôlées de BRAIZ : {EMBED_ALLOWED_ORIGINS.join(" et ")}. Les autres origines sont refusées. L’accès du Site continue de s’appliquer ; les cookies tiers ne sont pas supposés disponibles.</p><p>Adresse du jeu : <a href={DISTRIBUTION.gameUrl}>{DISTRIBUTION.gameUrl}</a>. {EXTRA_MODES_ENABLED ? "Ouvrez le jeu sur une adresse autorisée pour utiliser cet aperçu." : "Les modes avancés et cette intégration sont actuellement désactivés."}</p><p role="status">{status === "loading" ? "Chargement de l’aperçu…" : status === "ready" ? "Aperçu connecté." : <>L’aperçu n’a pas répondu. <a href={DISTRIBUTION.gameUrl}>Ouvrir BRAIZ</a> pour jouer.</>}</p><iframe ref={frame} title="Jeu BRAIZ intégré" src={DISTRIBUTION.embedUrl} style={{ width: "100%", height, border: 0 }} onError={() => setStatus("unavailable")} onLoad={() => frame.current?.contentWindow?.postMessage({ protocol: EMBED_PROTOCOL, type: "hello" }, EMBED_ORIGIN)} /></main></>;
}
