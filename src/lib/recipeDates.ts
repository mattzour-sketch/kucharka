import { formatRecentDate, todayIso, toLocalIsoDate } from './date';

/**
 * Řádek pod názvem receptu: „zapsáno 2. 8. 2026 · uvařeno 4×, naposledy včera".
 * `cookedOn` = dny vaření z historie (lokální `IsoDate`), v libovolném pořadí.
 * Čerstvá data jsou „dnes / včera / před 3 dny" (`formatRecentDate`).
 */
export function recipeDateLine(
  capturedOn: string,
  cookedOn: readonly string[],
  today: string = todayIso(),
): string {
  const captured = `zapsáno ${formatRecentDate(capturedOn, today)}`;
  if (cookedOn.length === 0) return captured;
  const last = cookedOn.reduce((max, day) => (day > max ? day : max));
  const cooked =
    cookedOn.length === 1
      ? `uvařeno ${formatRecentDate(last, today)}`
      : `uvařeno ${cookedOn.length}×, naposledy ${formatRecentDate(last, today)}`;
  return `${captured} · ${cooked}`;
}

/** „upraveno včera" z ISO timestampu (den v lokálním čase, ne v UTC). */
export function updatedLabel(updatedAt: string, today: string = todayIso()): string {
  return `upraveno ${formatRecentDate(toLocalIsoDate(new Date(updatedAt)), today)}`;
}
