/** An explicit spelling proposal only. Never use this to normalize or score a guess. */
export function lexicalAlternative(word: string): string | null {
  const entered = word.trim().normalize('NFC').toLocaleLowerCase('fr');
  if (!entered.includes('œ')) return null;
  return entered.replaceAll('œ', 'oe');
}
