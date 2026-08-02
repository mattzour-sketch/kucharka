/**
 * Práce s daty. Zachycené datum je lokální (E-07): večeře ve 23:50 nesmí skončit
 * v zítřku, proto se den NIKDY neodvozuje z toISOString() (to je UTC).
 */

/** Datum jako „YYYY-MM-DD" z lokálních složek. */
export function toLocalIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Dnešní datum v lokálním čase jako „YYYY-MM-DD". */
export function todayIso(): string {
  return toLocalIsoDate(new Date());
}

/** „2026-08-02" → „2. 8. 2026" pro zobrazení. */
export function formatCzechDate(iso: string): string {
  const parts = iso.split('-').map(Number);
  const [year, month, day] = parts;
  if (!year || !month || !day) return iso;
  return `${day}. ${month}. ${year}`;
}
