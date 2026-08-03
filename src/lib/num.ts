/** Parsování čísel z formuláře. Přijímá i českou desetinnou čárku („10,5"). */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Zaokrouhlení na daný počet desetinných míst (jen pro zobrazení, ne pro data). */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Číslo pro zobrazení: zaokrouhlené, česky s čárkou, bez zbytečných nul. */
export function formatNumber(value: number, decimals = 0): string {
  return round(value, decimals).toLocaleString('cs-CZ', { maximumFractionDigits: decimals });
}
