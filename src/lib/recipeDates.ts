import { formatCzechDate, toLocalIsoDate } from './date';

/**
 * Řádek pod názvem receptu: „zapsáno 2. 8. 2026 · uvařeno 4×, naposledy 28. 10. 2026".
 * `cookedOn` = dny vaření z historie (lokální `IsoDate`), v libovolném pořadí.
 */
export function recipeDateLine(capturedOn: string, cookedOn: readonly string[]): string {
  const captured = `zapsáno ${formatCzechDate(capturedOn)}`;
  if (cookedOn.length === 0) return captured;
  const last = cookedOn.reduce((max, day) => (day > max ? day : max));
  const cooked =
    cookedOn.length === 1
      ? `uvařeno ${formatCzechDate(last)}`
      : `uvařeno ${cookedOn.length}×, naposledy ${formatCzechDate(last)}`;
  return `${captured} · ${cooked}`;
}

/** „upraveno 31. 10. 2026" z ISO timestampu (den v lokálním čase, ne v UTC). */
export function updatedLabel(updatedAt: string): string {
  return `upraveno ${formatCzechDate(toLocalIsoDate(new Date(updatedAt)))}`;
}
