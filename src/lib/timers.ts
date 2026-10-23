/**
 * Časovače vaření (§7) – čistá logika bez Dexie. Časovač doběhlý před víc než pár
 * hodinami je zapomenutý z minulého vaření: nemá zvonit, jen tiše zmizet.
 */

export const STALE_TIMER_MS = 3 * 60 * 60 * 1000;

/** Doběhl časovač před víc než `STALE_TIMER_MS`? Běžící časovač zastaralý není nikdy. */
export function isStaleTimer(endsAt: string, now: number): boolean {
  return now - Date.parse(endsAt) > STALE_TIMER_MS;
}

const SNIPPET_WORDS = 4;
const SNIPPET_CHARS = 28;

/**
 * Název časovače z kroku: „Krok 3 · Těstoviny vařit". Začátek kroku (pár slov),
 * ať jsou dva časovače vedle sebe k rozeznání. Krátká slova na konci („do", „a",
 * osamělé „25" bez minut) a interpunkce se uříznou, ať název nekončí v půlce věty.
 */
export function stepTimerLabel(stepIndex: number, stepText: string): string {
  const words = stepText.trim().split(/\s+/).filter(Boolean);
  const picked: string[] = [];
  for (const word of words) {
    if (picked.length >= SNIPPET_WORDS) break;
    if (picked.length > 0 && [...picked, word].join(' ').length > SNIPPET_CHARS) break;
    picked.push(word);
  }
  while (picked.length > 1 && picked[picked.length - 1].replace(/[^\p{L}\d]/gu, '').length <= 2) {
    picked.pop();
  }
  const snippet = picked.join(' ').replace(/[\s,.:;–-]+$/u, '');
  return snippet ? `Krok ${stepIndex + 1} · ${snippet}` : `Krok ${stepIndex + 1}`;
}
