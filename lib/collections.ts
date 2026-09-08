import type { Win } from "./game-types";

// Public edition: challenge references only, never answer words or target indexes.
// Immutable seeds preserve the frozen V1 scoring and existing personal saves.
export const NATURE_COLLECTION = {
  id: "nature-v1",
  title: "Nature",
  corpusVersion: "fr-fasttext-30000-v1",
  rulesVersion: "classic-v1",
  seeds: ["1000000046", "1000000038", "1000000032", "1000000279", "1000000010", "1000000049", "1000000036", "1000000168", "1000000066", "1000000043", "1000000090", "1000000054"],
} as const;

export type CollectionEdition = { id: string; title: string; description?: string; corpusVersion: string; rulesVersion: string; seeds: readonly string[] };

export const COLLECTIONS: readonly CollectionEdition[] = [NATURE_COLLECTION,
{"id":"cuisine-v1","title":"Cuisine","description":"Ingrédients, saveurs et gestes du quotidien.","seeds":["1000000051","1000000018","1000000119","1000000057","1000000045","1000000274","1000000192","1000000309","1000000065","1000000008","1000000108","1000000339"],"corpusVersion":"fr-fasttext-30000-v1","rulesVersion":"classic-v1"},
{"id":"voyage-v1","title":"Voyage","description":"Départs, transports et paysages.","seeds":["1000000308","1000000129","1000000047","1000000092","1000000178","1000000035","1000000012","1000000182","1000000048","1000000022","1000000061","1000000078"],"corpusVersion":"fr-fasttext-30000-v1","rulesVersion":"classic-v1"},
{"id":"emotions-v1","title":"Émotions","description":"Sentiments, réactions et états intérieurs.","seeds":["1000000050","1000000002","1000000546","1000000088","1000000025","1000000128","1000000241","1000000089","1000000060","1000000064","1000000197","1000000039"],"corpusVersion":"fr-fasttext-30000-v1","rulesVersion":"classic-v1"},
{"id":"cinema-v1","title":"Cinéma et scène","description":"Spectacle, images et émotions : un univers large, pas un quiz de films.","seeds":["1000000268","1000000169","1000000013","1000000031","1000000009","1000000014","1000000034","1000000196","1000000025","1000000050","1000000128","1000000039"],"corpusVersion":"fr-fasttext-30000-v1","rulesVersion":"classic-v1"}
];

export function collectionProgress(wins: readonly Win[], collection: CollectionEdition = NATURE_COLLECTION) {
  const won = new Set(wins.filter(win => win.mode === "challenge" || win.mode === "free").map(win => win.id));
  const completed = collection.seeds.map(seed => won.has(`free-${seed}`));
  return { completed, count: completed.filter(Boolean).length, next: completed.findIndex(value => !value) };
}
