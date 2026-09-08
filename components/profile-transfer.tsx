"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, FileCheck2, Upload } from "lucide-react";
import {
  PROFILE_TRANSFER_MAX_BYTES,
  createLocalProfileExport,
  importLocalProfile,
  inspectLocalProfileImport,
  type ProfileImportPreview,
  type ProfileSnapshot,
} from "@/lib/profile-storage";

type Candidate = { filename: string; text: string; preview: ProfileImportPreview };

export function ProfileTransfer({ snapshot, onSnapshot }: { snapshot: ProfileSnapshot; onSnapshot: (snapshot: ProfileSnapshot) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const selectionRef = useRef(0);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function download() {
    setError("");
    const result = createLocalProfileExport(snapshot, new Date());
    if (!result.ok) { setMessage(""); setError(result.reason); return; }
    const url = URL.createObjectURL(new Blob([result.text], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = result.filename; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage("Téléchargement lancé. Le fichier contient votre progression personnelle en clair.");
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selection = ++selectionRef.current;
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setMessage(""); setError(""); setCandidate(null);
    if (!file) return;
    if (file.size > PROFILE_TRANSFER_MAX_BYTES) { setError("Ce fichier dépasse la taille maximale de 8 Mio. Rien n’a été modifié."); return; }
    let text: string;
    try { text = await file.text(); }
    catch { setError("Ce fichier n’a pas pu être lu. Rien n’a été modifié."); return; }
    if (selection !== selectionRef.current) return;
    const preview = inspectLocalProfileImport(text, undefined, new Date(), snapshot);
    setCandidate({ filename: file.name, text, preview });
    if (["invalid", "unsupported", "conflict", "unavailable"].includes(preview.status)) setError(`${preview.reason} Rien n’a été modifié.`);
  }

  function confirmImport() {
    if (!candidate?.preview.planId || candidate.preview.status !== "ready") return;
    setMessage(""); setError("");
    const result = importLocalProfile(candidate.text, candidate.preview.planId, undefined, snapshot, new Date());
    if (result.status === "stale") {
      const refreshed = inspectLocalProfileImport(candidate.text, undefined, new Date(), snapshot);
      setCandidate(current => current ? { ...current, preview: refreshed } : current);
      setError(result.reason);
      return;
    }
    if (!result.persisted || !result.snapshot) {
      setCandidate(null);
      setError(result.reason);
      window.requestAnimationFrame(() => importButtonRef.current?.focus({ preventScroll: true }));
      return;
    }
    onSnapshot(result.snapshot);
    setCandidate(null);
    setMessage(result.reason);
    window.requestAnimationFrame(() => importButtonRef.current?.focus({ preventScroll: true }));
  }

  function cancelImport() {
    selectionRef.current += 1;
    setCandidate(null);
    setError("");
    window.requestAnimationFrame(() => importButtonRef.current?.focus({ preventScroll: true }));
  }

  const ready = candidate?.preview.status === "ready";
  return <section className="profile-transfer" aria-labelledby="profile-transfer-title">
    <div className="profile-transfer-heading"><FileCheck2 size={18} aria-hidden="true" /><div><h4 id="profile-transfer-title">Copier votre progression</h4><p>Le profil, les récompenses et préférences uniquement. Les parties en cours et les épingles restent sur cet appareil.</p></div></div>
    <div className="profile-transfer-actions">
      <button type="button" className="secondary-button" onClick={download}><Download size={16} aria-hidden="true" />Télécharger mon profil</button>
      <button ref={importButtonRef} type="button" className="secondary-button" onClick={() => inputRef.current?.click()}><Upload size={16} aria-hidden="true" />Importer un fichier JSON</button>
      <input ref={inputRef} className="profile-file-input" type="file" accept="application/json,.json" onChange={chooseFile} tabIndex={-1} aria-hidden="true" />
    </div>
    {candidate && <div className="import-preview" role="status" aria-live="polite" aria-atomic="true">
      <strong>{candidate.filename}</strong>
      {ready && <><p>{candidate.preview.addedActivities} élément(s) à ajouter, {candidate.preview.existingActivities} déjà présent(s){candidate.preview.reconciledActivities ? `, ${candidate.preview.reconciledActivities} variante(s) à réconcilier` : ""}. Le solde historique éventuel sera repris sans écraser le vôtre.</p><p>Rien n’a encore été modifié.</p><div className="import-confirm"><button type="button" className="primary-button" onClick={confirmImport}>Confirmer l’import</button><button type="button" className="text-action compact-action" onClick={cancelImport}>Annuler</button></div></>}
      {candidate.preview.status === "unchanged" && <p>Cette progression est déjà présente. Aucun changement nécessaire.</p>}
    </div>}
    {message && <p className="transfer-message" role="status" aria-live="polite">{message}</p>}
    {error && <p className="transfer-error" role="alert">{error}</p>}
  </section>;
}
