// Conservative lexical policy for user-facing hints.
// It filters obvious noise without changing the semantic score or rank.

const FOLD_RE = /[\u0300-\u036f]/g;
const WORD_RE = /^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:[-'][a-zàâäçéèêëîïôöùûüÿœæ]+)*$/u;

// Function words and corpus artefacts are poor standalone hints. Keep this
// list intentionally small: a false exclusion is worse than a review item.
const STOPWORDS = new Set([
  "au", "aux", "ce", "cet", "cette", "ces", "comme", "dans", "de", "des", "du",
  "elle", "en", "et", "eux", "il", "ils", "je", "la", "le", "les", "leur", "leurs",
  "ma", "mais", "me", "mes", "mon", "ne", "nos", "notre", "nous", "on", "ou", "par",
  "pas", "pour", "qu", "que", "quel", "quelle", "quelles", "quels", "qui", "sa", "se",
  "ses", "son", "sur", "ta", "te", "tes", "toi", "ton", "tu", "un", "une", "vos", "votre",
  "vous", "y", "test"
]);

export function foldEditorialWord(word: string) {
  return word.normalize("NFD").replace(FOLD_RE, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
}

function singularForms(word: string) {
  const forms = new Set([word]);
  if (word.endsWith("aux") && word.length > 4) forms.add(`${word.slice(0, -3)}al`);
  if (word.endsWith("eaux") && word.length > 5) forms.add(word.slice(0, -1));
  if (word.endsWith("es") && word.length > 4) forms.add(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) forms.add(word.slice(0, -1));
  if (word.endsWith("x") && word.length > 3) forms.add(word.slice(0, -1));
  return forms;
}

export function isObviousEditorialVariant(candidate: string, target: string) {
  const left = foldEditorialWord(candidate);
  const right = foldEditorialWord(target);
  if (left === right) return true;
  const targetForms = singularForms(right);
  const candidateForms = singularForms(left);
  for (const form of candidateForms) if (targetForms.has(form) && form.length >= 4) return true;
  return false;
}

export type EditorialCandidateQuality = "preferred" | "fallback" | "excluded";

export function editorialCandidateQuality(candidate: string, target: string): EditorialCandidateQuality {
  const folded = foldEditorialWord(candidate);
  if (!WORD_RE.test(candidate) || folded.length < 3 || STOPWORDS.has(folded)) return "excluded";
  if (isObviousEditorialVariant(candidate, target)) return "excluded";
  // Very long compounds and punctuation-heavy entries are retained only as a
  // last resort, so normal hints remain readable without losing recall.
  if (folded.length > 24 || (candidate.match(/[-']/g)?.length ?? 0) > 1) return "fallback";
  return "preferred";
}

export function chooseEditorialHint<T extends { word: string }>(candidates: T[], target: string, preferredWords: readonly string[] = []) {
  const preferred = new Set(preferredWords.map(foldEditorialWord));
  const curated = candidates.find(candidate => preferred.has(foldEditorialWord(candidate.word)) && editorialCandidateQuality(candidate.word, target) === "preferred");
  if (curated) return curated;
  return candidates.find(candidate => editorialCandidateQuality(candidate.word, target) === "preferred") ??
    candidates.find(candidate => editorialCandidateQuality(candidate.word, target) === "fallback") ?? null;
}
