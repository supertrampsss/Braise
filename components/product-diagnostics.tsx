"use client";
import { useState } from "react";
import { clearProductDiagnostics, exportProductDiagnostics } from "@/lib/product-events";

export function ProductDiagnostics() {
  const [message, setMessage] = useState("");
  function download() {
    try {
      const json = exportProductDiagnostics(window.localStorage);
      if (!json) { setMessage("Diagnostic indisponible : les données existantes sont conservées."); return; }
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "braiz-diagnostic-local.json";
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Diagnostic téléchargé sur votre appareil. Aucun envoi automatique.");
    } catch { setMessage("Le stockage local est indisponible."); }
  }
  return <section aria-labelledby="product-diagnostics-title" className="braiz-diagnostics">
    <h2 id="product-diagnostics-title">Diagnostic local</h2>
    <p>Les 100 dernières actions observées sur cet appareil, sans mots, scores, pseudonyme ni identifiant. Aucun envoi automatique. Vous choisissez de partager le fichier avec le support.</p>
    <button type="button" onClick={download}>Télécharger mon diagnostic</button>{" "}
    <button type="button" onClick={() => { try { setMessage(clearProductDiagnostics(window.localStorage) ? "Diagnostic local effacé." : "Le stockage local est indisponible."); } catch { setMessage("Le stockage local est indisponible."); } }}>Effacer le diagnostic local</button>
    <p role="status">{message}</p>
  </section>;
}
