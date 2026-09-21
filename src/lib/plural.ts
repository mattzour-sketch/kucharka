/**
 * Český plurál podle počtu: 1 → one, 2–4 → few, jinak (0, 5+) → many.
 * Vrací jen tvar slova (bez čísla). Čistá funkce — jedno místo pro pravidlo,
 * volající dodá tři tvary.
 */
export function czechPlural(n: number, [one, few, many]: [string, string, string]): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  if (abs >= 2 && abs <= 4) return few;
  return many;
}
