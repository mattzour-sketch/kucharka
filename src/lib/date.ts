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

/** ISO timestamp → „13. 9. 2026 14:30" v lokálním čase (datum zálohy ve shrnutí, UC030). */
export function formatCzechDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${time}`;
}

/** Práh, po kterém se záloha bere jako stará a jemně se připomene (UC030). */
export const STALE_BACKUP_DAYS = 30;

/** Počet celých dní mezi `iso` a `now` (kladné = v minulosti). Čistá funkce. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 0;
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

/**
 * Relativní čas zálohy: „dnes / včera / před 3 dny / před 2 týdny / před 2 měsíci /
 * před rokem". Čeština: instrumentál plurálu je pro >1 stejný (dny/týdny/měsíci/lety),
 * takže se větví jen jednotné číslo. Čistá funkce.
 */
export function formatRelativeDays(iso: string, now: Date = new Date()): string {
  const days = daysSince(iso, now);
  if (days <= 0) return 'dnes';
  if (days === 1) return 'včera';
  if (days < 7) return `před ${days} dny`;
  if (days < 28) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? 'před týdnem' : `před ${weeks} týdny`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? 'před měsícem' : `před ${months} měsíci`;
  }
  const years = Math.round(days / 365);
  return years === 1 ? 'před rokem' : `před ${years} lety`;
}
