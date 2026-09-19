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

export const LAST_BACKUP_STORAGE_KEY = 'kucharka-last-backup';

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
  } catch {
    /* nejde uložit – přinejhorším se datum nezapamatuje */
  }
}
