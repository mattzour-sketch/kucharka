/**
 * Originál vloženého textu jako poznámka k receptu (UC031, Rozhodnutí 2 a 14). Celý
 * vložený text se uloží beze změny do `recipeNotes` s pevnou hlavičkou na prvním řádku;
 * detail ho podle ní pozná a ukáže zvlášť (sbalený) od uživatelových poznámek.
 * Běžnou poznámku s hlavičkou uživatel nevytvoří – vstup poznámky je jednořádkový.
 */

/** NEMĚNIT – podle této hlavičky se poznávají i staré poznámky (a poznámky ze zálohy). */
export const ORIGINAL_NOTE_HEADER = 'Originál (vložený text):';

const PREFIX = `${ORIGINAL_NOTE_HEADER}\n`;

/** Tělo poznámky: hlavička + nový řádek + vložený text beze změny. */
export function buildOriginalNote(pasted: string): string {
  return `${PREFIX}${pasted}`;
}

/** Text originálu, nebo null = běžná poznámka. */
export function originalNoteText(body: string): string | null {
  return body.startsWith(PREFIX) ? body.slice(PREFIX.length) : null;
}

/** Rozdělí poznámky na vlastní a originály; pořadí v obou skupinách zůstává. */
export function partitionNotes<T extends { body: string }>(notes: T[]): { own: T[]; originals: T[] } {
  const own: T[] = [];
  const originals: T[] = [];
  for (const note of notes) {
    if (originalNoteText(note.body) === null) own.push(note);
    else originals.push(note);
  }
  return { own, originals };
}
