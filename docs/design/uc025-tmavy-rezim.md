# Návrh: UC025 — Tmavý režim

Spec: [`docs/specs/uc025-tmavy-rezim.md`](../specs/uc025-tmavy-rezim.md). Architekta psal parťák
(agent padl na limit uprostřed) na základě jeho průzkumu: Tailwind 3.4.17, plain + `brand`
extension (`#b45309`/`#92400e`), **241 výskytů barev ve 42 souborech, těžiště ve sdílených
`src/components/ui/`**, Dexie v6 (žádná settings tabulka), `index.css` má `body { @apply bg-stone-50
text-stone-900 }`. Zohledněny must-fixy Zákazníka (žádný FOUC; čitelná trust-varování; tři stavy;
všude včetně lišty a psaní receptu).

## Zvolená strategie: `darkMode: 'class'` + `dark:` varianty (ne CSS-var refaktor)

Zvažoval jsem CSS proměnné (tokeny) vs. Tailwind `dark:` varianty. **Volím `dark:` varianty**:
- App používá **literální** třídy (`stone-*`, `bg-white`, `amber-*`, `text-red-*`, `brand`) — přechod
  na tokeny by vyžadoval přepsat **stejných 241 míst** na sémantické tokeny (žádná úspora) + refaktor
  configu (vyšší riziko). `dark:` varianty jsou **aditivní** (světlá třída zůstává), takže **riziko
  regrese světlého motivu je minimální** — nic se neubírá, jen se přidává `dark:…`.
- Těžiště barev je ve sdílených `ui/` (Button, Card, ScreenHeader, IconButton, FilterChip, Segmented,
  EmptyState, Loading, `cardClass`, Tag, AmountPicker, AddPortionInline) → velká část plochy se
  přepne v ~12 souborech; zbytek jsou plošné `bg-white`/`bg-stone-*`/`text-stone-*`/borders po
  obrazovkách.
- `darkMode: 'class'` (ne `'media'`), aby šel ruční přepínač (třístav) i override systému.

## Bez bliknutí (FOUC) — must-fix Zákazníka

Inline `<script>` v `index.html` **před** `main.tsx`: synchronně přečte uloženou předvolbu (nebo
`prefers-color-scheme`), nastaví `document.documentElement.classList.toggle('dark', …)` a
`<meta name="theme-color">`. Tím je motiv aplikován **před prvním vykreslením** → žádné bílé bliknutí.

## Úložiště předvolby — ⚠ ROZHODNUTÍ MIMO MŮJ MANDÁT (pravidlo 6)

No-FOUC vyžaduje **synchronní** čtení před vykreslením. Dexie je async → bliklo by (Zákazník: no-go).
Varianty:
- **A) `localStorage['kucharka-theme']`** (`'system'|'light'|'dark'`) — synchronní, žádný FOUC.
  Poruší *literu* pravidla 6, ale předvolba vzhledu je **per-zařízení UI, ne data appky**
  (nesynchronizuje se, není obsah). Doporučuji. **Vyžaduje výslovné OK uživatele.**
- B) Dexie + fallback na `prefers-color-scheme` do načtení → krátký FOUC u ruční volby (Zákazník odmítá).
- C) Jen následovat systém, bez uložení → nulová perzistence, žádný ruční override (Zákazník chce tři stavy).

Pravidlo 6 je invariant → rozhoduje uživatel. Návrh staví na A.

## Tři stavy + přepínač

- Předvolba `Systém | Světlý | Tmavý`, **výchozí `Systém`** (Zákazník: telefon ráno světlý/večer tmavý,
  appka se sama přepne). Při `Systém` se poslouchá `matchMedia('(prefers-color-scheme: dark)')` a motiv
  se přepíná **živě**.
- Přepínač: `Segmented` **nahoře** v `SettingsScreen` („Víc"), nad Zálohou dat.

## Trust-varování v tmavém (must-fix 2) — explicitní `dark:` + ověření kontrastu

- `NutritionSummary` amber „Orientační" · „bez kalorií" (stone-400) · destructive **červená** · oblíbená
  **hvězda** (plná amber-500 vs. prázdný obrys viditelný na tmavé) · hlavní **brand** CTA (na tmavé
  případně světlejší akcent, ať zůstane „hlavní akce"). Ověří se naživo (dark) — nesmí splynout.
- `theme-color`: světlá `#b45309`, tmavá `#1c1917` (stone-900) → i mobilní lišta ztmavne (Zákazník).
- **Všude** incl. `RecipeEditScreen` (psaní/diktování) a overlaye (LinkPicker, FoodPicker, fotka).

## Pořadí implementace (čistá logika s testem dřív než UI)

1. `src/lib/theme.ts`: typ `ThemePref`, čistá `resolveTheme(pref, systemPrefersDark): 'light'|'dark'`
   (+ test), `readThemePref`/`writeThemePref` (localStorage, try/catch), `applyTheme(resolved)` (třída
   `dark` na `<html>` + theme-color meta).
2. Inline no-FOUC skript v `index.html`.
3. `tailwind.config.js`: `darkMode: 'class'`. `index.css`: `body` dark varianta.
4. `dark:` varianty ve sdílených `ui/` (těžiště).
5. `dark:` varianty po obrazovkách (plochy/text/borders/inputy) + trust-varování.
6. Přepínač v `SettingsScreen` (nahoře) + hook na živou změnu systému při `Systém`.
7. Ověření: světlý beze změny (regrese), tmavý všude vč. psaní a lišty, trust-varování čitelná, žádný FOUC.

## Co se NEmění / rizika
- Žádná nová závislost, žádná migrace Dexie (localStorage je mimo Dexie). Světlé třídy zůstávají →
  malá regrese světlého. Riziko: rozsah (42 souborů) — mitigace: aditivní `dark:`, těžiště v `ui/`,
  a ověření světlého i tmavého naživo.
