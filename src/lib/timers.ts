/**
 * Časovače vaření (§7) – čistá logika bez Dexie. Časovač doběhlý před víc než pár
 * hodinami je zapomenutý z minulého vaření: nemá zvonit, jen tiše zmizet.
 */

export const STALE_TIMER_MS = 3 * 60 * 60 * 1000;

/** Doběhl časovač před víc než `STALE_TIMER_MS`? Běžící časovač zastaralý není nikdy. */
export function isStaleTimer(endsAt: string, now: number): boolean {
  return now - Date.parse(endsAt) > STALE_TIMER_MS;
}

/** „+5 min" u doběhlého časovače – počítá se od ťuknutí, ne od původního konce. */
export const SNOOZE_MS = 5 * 60 * 1000;
/** Jak dlouho zůstane zastavený (ztlumený) časovač v liště, než sám zmizí. */
export const SILENCED_TIMER_MS = 2 * 60 * 1000;

/** Časové údaje časovače (podmnožina záznamu `Timer`, ať logika nezávisí na Dexie). */
export interface TimerTiming {
  endsAt: string;
  /** Kdy se doběhlý časovač zastavil (ztlumil); null/chybí = nezastavený. */
  silencedAt?: string | null;
}

/** running = odpočítává, ringing = doběhl a zvoní, silenced = doběhl a je zastavený (tichý). */
export type TimerState = 'running' | 'ringing' | 'silenced';

export function timerState(timer: TimerTiming, now: number): TimerState {
  if (Date.parse(timer.endsAt) > now) return 'running';
  return timer.silencedAt ? 'silenced' : 'ringing';
}

/** Má časovač zmizet? Zastaralý (z minulého vaření), nebo ztlumený déle než `SILENCED_TIMER_MS`. */
export function isTimerGone(timer: TimerTiming, now: number): boolean {
  if (isStaleTimer(timer.endsAt, now)) return true;
  if (timerState(timer, now) !== 'silenced' || !timer.silencedAt) return false;
  return now - Date.parse(timer.silencedAt) >= SILENCED_TIMER_MS;
}

/** Nový cílový čas po „+5 min": 5 minut od teď. */
export function snoozedEndsAt(now: number): string {
  return new Date(now + SNOOZE_MS).toISOString();
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
