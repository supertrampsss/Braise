import { Flame } from "lucide-react";
import { decideAd } from "@/lib/advertising";

export default function AdPlacement() {
  const decision = decideAd("game-display");
  return (
    <section
      className="ad-zone"
      aria-label="Emplacement publicitaire réservé"
      data-ad-result={decision.result}
      data-ad-reason={decision.reason}
    >
      <span className="ad-label">EMPLACEMENT PUBLICITAIRE RÉSERVÉ</span>
      <div>
        <span className="ad-badge" aria-hidden="true"><Flame size={18} /></span>
        <p>Une petite place pour la pub.<br /><strong>Tout le reste, pour le jeu.</strong></p>
        <span className="ad-status">Aucune publicité activée</span>
      </div>
    </section>
  );
}
