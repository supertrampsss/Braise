// Editorial content reviewed by the implementing agent, not by a human panel.
// Keep the answer positions and explanations on the server.
export const INTRUDER_EDITION = "intrus-v1";
const QUESTIONS = [
  { words: ["carotte", "navet", "radis", "pomme"], answer: 3, explanation: "Carotte, navet et radis sont des légumes-racines. La pomme est un fruit qui pousse sur un arbre." },
  { words: ["piano", "violon", "flûte", "pinceau"], answer: 3, explanation: "Les trois premiers sont des instruments de musique. Le pinceau est un outil de peinture." },
  { words: ["lundi", "mars", "jeudi", "samedi"], answer: 1, explanation: "Mars est un mois. Les trois autres sont des jours de la semaine." },
  { words: ["triangle", "carré", "cube", "cercle"], answer: 2, explanation: "Le cube est un solide en trois dimensions. Les autres sont des figures planes." },
  { words: ["saumon", "truite", "dauphin", "sardine"], answer: 2, explanation: "Le dauphin est un mammifère. Les trois autres sont des poissons." },
  { words: ["rouge", "bleu", "vert", "rond"], answer: 3, explanation: "Rond décrit une forme, tandis que les trois autres mots désignent des couleurs." },
  { words: ["kilogramme", "mètre", "centimètre", "kilomètre"], answer: 0, explanation: "Le kilogramme mesure une masse. Les autres unités mesurent une longueur." },
  { words: ["hiver", "printemps", "matin", "automne"], answer: 2, explanation: "Le matin est une partie de la journée. Les autres sont des saisons." },
  { words: ["abeille", "fourmi", "papillon", "araignée"], answer: 3, explanation: "L’araignée est un arachnide à huit pattes. Les trois autres sont des insectes à six pattes." },
  { words: ["Paris", "Madrid", "Italie", "Rome"], answer: 2, explanation: "L’Italie est un pays. Les autres noms désignent des capitales européennes." },
  { words: ["cuivre", "fer", "bois", "or"], answer: 2, explanation: "Le bois est une matière végétale. Les trois autres sont des métaux." },
  { words: ["lire", "écrire", "livre", "parler"], answer: 2, explanation: "Lire, écrire et parler sont des infinitifs ; livre n’en est pas un." },
  { words: ["chaton", "chiot", "poulain", "jument"], answer: 3, explanation: "La jument est une femelle adulte du cheval. Les autres mots désignent de jeunes animaux." },
  { words: ["boussole", "thermomètre", "baromètre", "pluie"], answer: 3, explanation: "La pluie est un phénomène météorologique. Les autres objets sont des instruments de mesure ou d’orientation." },
  { words: ["addition", "soustraction", "multiplication", "alphabet"], answer: 3, explanation: "L’alphabet est un ensemble ordonné de lettres. Les autres sont des opérations arithmétiques." },
  { words: ["chêne", "sapin", "rose", "bouleau"], answer: 2, explanation: "La rose est une fleur. Chêne, sapin et bouleau désignent des arbres." },
  { words: ["janvier", "février", "dimanche", "avril"], answer: 2, explanation: "Dimanche est un jour de la semaine. Les trois autres sont des mois." },
  { words: ["couteau", "fourchette", "cuillère", "oreiller"], answer: 3, explanation: "L’oreiller appartient à la literie. Les autres objets sont des couverts." },
  { words: ["aigle", "moineau", "renard", "hirondelle"], answer: 2, explanation: "Le renard est un mammifère. Les autres animaux sont des oiseaux." },
  { words: ["seconde", "minute", "heure", "litre"], answer: 3, explanation: "Le litre mesure un volume. Les autres unités mesurent une durée." },
] as const;
export function intruderQuestion(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= QUESTIONS.length) throw new Error("invalid-question");
  return { edition: INTRUDER_EDITION, index, total: QUESTIONS.length, words: [...QUESTIONS[index].words] };
}
export function answerIntruder(index: number, choice: number) {
  const question = intruderQuestion(index);
  if (!Number.isInteger(choice) || choice < 0 || choice >= question.words.length) throw new Error("invalid-choice");
  return { ...question, choice, correct: choice === QUESTIONS[index].answer, answer: QUESTIONS[index].answer, explanation: QUESTIONS[index].explanation };
}
