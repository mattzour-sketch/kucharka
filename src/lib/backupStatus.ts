/**
 * „Naposledy zálohováno" – kdy tohle zařízení naposledy vyexportovalo zálohu (UC030).
 *
 * VĚDOMÁ VÝJIMKA Z PRAVIDLA 6 (CLAUDE.md): ukládá se do `localStorage`, ne do Dexie.
 * Zdůvodnění: je to fakt o ZAŘÍZENÍ (kdy tenhle prohlížeč naposledy exportoval), ne
 * obsah kuchařky – do zálohy ani na jiné zařízení nepatří (jinak by „naposledy
 * zálohováno" cestovalo se zálohou a na druhém zařízení lhalo). Stejný typ výjimky
 * jako motiv (viz `theme.ts`). Rozhodnuto s uživatelem 2026-09-13.
 *
 * Nastavuje se dvakrát: úspěšný EXPORT ho posune na „teď"; úspěšná OBNOVA ho nastaví
 * na `exportedAt` obnovené zálohy (data jsou ke dni té zálohy – ne „teď"), ať po
 * přenosu na nový telefon nesvítí falešné „nezálohováno".
 */

import { STALE_BACKUP_DAYS, daysSince } from './date';

export const LAST_BACKUP_STORAGE_KEY = 'kucharka-last-backup';

/** Událost v tomhle okně – `storage` se v okně, které zapisuje, nespouští. */
const CHANGE_EVENT = 'kucharka-last-backup-change';

/** ISO timestamp poslední zálohy, nebo null (ještě se nezálohovalo / úložiště nejde číst). */
export function readLastBackupAt(): string | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_STORAGE_KEY);
    return raw && !Number.isNaN(Date.parse(raw)) ? raw : null;
  } catch {
    /* soukromý režim / blokované úložiště – tváříme se, že se nezálohovalo */
    return null;
  }
}

export function writeLastBackupAt(iso: string): void {
  try {
    localStorage.setItem(LAST_BACKUP_STORAGE_KEY, iso);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* nejde uložit – přinejhorším se datum nezapamatuje */
  }
}

/** Odběr změn (pro `useSyncExternalStore`): zápis v tomhle okně i v jiné záložce. */
export function subscribeLastBackup(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Připomenout zálohu (tečka u „Víc", UC030 rozhodnutí 6)? Ano, když je co ztratit
 * (aspoň jeden recept) a záloha chybí nebo je starší než `STALE_BACKUP_DAYS`.
 */
export function isBackupReminderDue(
  lastBackupAt: string | null,
  recipeCount: number,
  now: Date = new Date(),
): boolean {
  if (recipeCount === 0) return false;
  if (lastBackupAt === null) return true;
  return daysSince(lastBackupAt, now) > STALE_BACKUP_DAYS;
}
