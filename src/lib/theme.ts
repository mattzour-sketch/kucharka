/**
 * Motiv appky (UC025): světlý / tmavý / dle systému.
 *
 * VĚDOMÁ VÝJIMKA Z PRAVIDLA 6 (CLAUDE.md): předvolba motivu se ukládá do
 * `localStorage`, ne do Dexie. Zdůvodnění: je to per-zařízení UI předvolba, ne data
 * aplikace (nesynchronizuje se, není obsah), a hlavně — motiv se musí aplikovat
 * SYNCHRONNĚ před prvním vykreslením, aby nebliklo bílé (Dexie je async → FOUC).
 * Rozhodnuto s uživatelem 2026-09-08. Klíč a logika jsou zrcadlené v inline skriptu
 * v `index.html` (ten běží před Reactem); drž je v souladu.
 */

export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'kucharka-theme';
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#b45309', dark: '#1c1917' };

/** Výsledný motiv z předvolby a systémové preference. Čistá funkce. */
export function resolveTheme(pref: ThemePref, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemPrefersDark ? 'dark' : 'light';
}

export function readThemePref(): ThemePref {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* soukromý režim / blokované úložiště – padneme na výchozí */
  }
  return 'system';
}

function writeThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* nejde uložit – přinejhorším se volba nezapamatuje */
  }
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Aplikuje motiv na `<html>` (třída `dark`) a `theme-color` meta (mobilní lišta). */
function applyResolved(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);
}

/** Nastaví předvolbu, uloží ji a hned aplikuje. Používá přepínač v Nastavení. */
export function setThemePref(pref: ThemePref): void {
  writeThemePref(pref);
  applyResolved(resolveTheme(pref, systemPrefersDark()));
}

/**
 * Aplikuje aktuální motiv a naslouchá systémové změně (přepne živě, jen když je
 * předvolba „system"). Volá se jednou při startu appky. FOUC řeší inline skript
 * v `index.html`; tohle jen srovná stav a drží ho živý.
 */
export function initTheme(): void {
  applyResolved(resolveTheme(readThemePref(), systemPrefersDark()));
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (readThemePref() === 'system') applyResolved(event.matches ? 'dark' : 'light');
  });
}
