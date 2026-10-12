import type { StudioVisual } from "@/lib/studio-metadata";
export function StudioPreview({ title, description, visual, length, completed }: { title: string; description: string; visual: string; length: number; completed: number }) {
  const preset: StudioVisual = visual === "paper" || visual === "night" ? visual : "ember";
  return <div className={`studio-preview studio-preview-${preset}`}><span className="eyebrow">UNE CRÉATION BRAIZ</span><h2>{title || "Votre création"}</h2>{description && <p>{description}</p>}<p>{completed} / {length} étapes terminées</p><progress aria-label="Progression de la création" max={Math.max(1, length)} value={completed} /><p>{completed === length && length > 0 ? "Création terminée ✓" : "Une énigme à la fois, à votre rythme."}</p></div>;
}
