// Public metadata only. Step references are resolved on the server.
export const EXPEDITION_VERSIONS = { corpus: "fr-fasttext-30000-v1", rules: "classic-v1", edition: 1 } as const;
export const EXPEDITIONS = [
  { id: "sous-bois-v1", title: "Sous les branches", length: 3 },
  { id: "fourneaux-v1", title: "Aux fourneaux", length: 3 },
  { id: "depart-v1", title: "Le grand départ", length: 3 },
  { id: "interieur-v1", title: "Voyage intérieur", length: 3 },
  { id: "scene-v1", title: "Entrée en scène", length: 3 },
  { id: "horizon-v1", title: "Vers l’horizon", length: 3 },
] as const;
export type ExpeditionStatus = { id: string; completed: number; length: number; seed?: string; reward?: string };
