export const STUDIO_VISUALS = [{ id: "ember", label: "Braise" }, { id: "paper", label: "Papier" }, { id: "night", label: "Nuit" }] as const;
export type StudioVisual = typeof STUDIO_VISUALS[number]["id"];
export function validateStudioMetadata(title: unknown, description: unknown, visual: unknown): boolean {
  const plain = (s: unknown, min: number, max: number) => typeof s === "string" && s.trim().length >= min && s.length <= max && !/[<>\u0000-\u001f\u007f]/.test(s);
  return plain(title, 1, 80) && plain(description, 0, 320) && STUDIO_VISUALS.some(item => item.id === visual);
}
