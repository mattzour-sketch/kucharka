/**
 * Doba přípravy receptu (nepovinná). Ukládá se v minutách (číslo); formátování a
 * práh „rychlé" jsou čistá logika, testovatelná bez UI.
 */

/** Recept do tolika minut (včetně) je „rychlý". */
export const QUICK_MAX_MINUTES = 30;

/** Je recept rychlý? Bez zadané doby není (null = nevíme, nefiltrovat jako rychlý). */
export function isQuick(prepMinutes: number | null | undefined): boolean {
  return prepMinutes != null && prepMinutes > 0 && prepMinutes <= QUICK_MAX_MINUTES;
}

/** „25 min", „1 h", „1 h 30 min". Vrátí '' pro prázdné/nekladné. */
export function formatPrepTime(prepMinutes: number | null | undefined): string {
  if (prepMinutes == null || prepMinutes <= 0) return '';
  const total = Math.round(prepMinutes);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
