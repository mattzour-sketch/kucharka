# Osobní kuchařka — pravidla projektu

Osobní PWA na sbírku vlastních receptů. Počítání kalorií je nepovinná nadstavba,
která přijde až ve fázi 2. Jeden uživatel, web + mobil, local-first.

**Hlavní úloha aplikace:** zachytit recept, který mi někdo diktuje, do 60 sekund,
offline, bez jediné nutriční hodnoty. Když si nejsi jistý návrhem, rozhodni ve
prospěch rychlosti zachycení.

Plná specifikace je v `docs/SPEC.md`. Přečti si ji, když řešíš datový model, nutriční
výpočty nebo rozsah funkcí — ne preventivně na začátku každé session.

## Stack

TypeScript (strict) · React 18 · Vite · Tailwind + shadcn/ui · Dexie.js (IndexedDB) ·
Supabase (Postgres + Auth) · TanStack Query · React Router · vite-plugin-pwa · Vitest

Změnu kteréhokoliv bodu nejdřív navrhni a zdůvodni, neprováděj ji sám.

## Architektura

Kód je ve třech vrstvách kvůli testovatelnosti — logika se dá ověřit bez prohlížeče:

- **Čistá logika — `src/lib/`.** Výpočty bez Dexie i bez Reactu; sem patří testy a píší
  se dřív než UI: `nutrition.ts` (úplnost, hodnoty na 100 g / porci, rekurze podreceptů
  + detekce cyklů), `scale.ts`, `search.ts` (fulltext bez diakritiky + kmen skloňování),
  `backup.ts` (serializace zálohy + `computeRestoreImpact`), `ingredientParse.ts`,
  `date.ts`, `theme.ts`, `backupStatus.ts`.
- **Data — Dexie/IndexedDB.** `src/db/index.ts` je schéma (verzované `stores()`, camelCase
  zrcadlo SPEC 7.4). K datům se sahá přes „repo" moduly (`features/*/…Repo.ts`) a v
  komponentách přes `useLiveQuery` — zápis se hned promítne. Klient dnes běží bez serveru;
  SQL v `supabase/migrations/` i Supabase/TanStack Query ze stacku jsou zatím NEČINNÉ,
  připravené na pozdější dolepení serveru.
- **UI — `src/features/<oblast>/`** (recipes, foods, shopping, settings, backup, trash) nad
  sdílenými prvky ve `src/components/ui/` (`Button` s uzavřenou sadou rolí, `cardClass`,
  `ScreenHeader`, `FilterChip`, `Segmented`, `ConfirmDialog`, `cx`). Routing v `src/App.tsx`;
  obrazovky se spodní lištou jsou pod `TabLayout`, ostatní jsou samostatné routy.

Věci rozprostřené přes víc souborů, kde se snadno šlápne vedle:

- **Tmavý režim** (`darkMode: 'class'`): inline skript v `index.html` + `lib/theme.ts` nastaví
  třídu `dark` na `<html>` z localStorage synchronně PŘED Reactem (proti bliknutí). Barvy jsou
  aditivní `dark:` varianty, ne CSS proměnné.
- **Záloha je jediný most mezi zařízeními** — žádný server ani sync. JSON export/import
  (`features/backup/`) je pojistka i přenos; obnova je merge (upsert podle id, nemaže).
- **Výjimka z pravidla 6:** localStorage je JEN v `theme.ts` a `backupStatus.ts` (předvolby
  zařízení, ne data aplikace). Nikam jinam.
- **Dokumentace:** `docs/SPEC.md` (plná spec, fáze v sekci 9), `docs/specs/` + `docs/design/`
  (spec a návrh po jednotlivých UC, např. `uc030-…`), `docs/specs/use-cases-navrhy.md` (backlog).

## Neporušitelná pravidla

Tohle jsou invarianty, ne preference. Když si nejsi jistý, ptej se.

1. **Surovina receptu je volný text.**
   `recipe_items.raw_text` je jediné povinné pole položky. `food_id`, `sub_recipe_id`
   a `amount_g` jsou **nullable** a doplňují se až později, u většiny receptů nikdy.
   Nikdy nepřidávej `not null` na napojení potraviny a nikdy nedělej UI, které
   bez napojení nedovolí uložit. Tohle je nejsnáz porušitelné pravidlo v projektu,
   protože „surovina = cizí klíč" je přirozenější model — a je špatný.

2. **Původní zachycený text se nepřepisuje.**
   `recipes.raw_capture` a `recipe_items.raw_text` jsou zdroj pravdy. Strukturování
   ani napojení potraviny je nesmí přepsat názvem z databáze.

3. **Recept musí jít uložit jen s názvem.**
   Jediná povinná pole v celém stromu jsou `recipes.name` a `recipe_items.raw_text`.
   Každý další `not null` je důvod, proč se recept neuloží.

4. **Nutriční hodnoty se nikdy nepředstírají.**
   Když nejsou napojené všechny suroviny, vždy se zobrazí úplnost („3 z 5 surovin").
   Při nulové úplnosti se nezobrazí žádné číslo. Chybějící suroviny se nedohadují.

5. **Deník ukládá snapshot, ne odkaz.**
   `log_entries` má vlastní sloupce `energy_kcal`, `protein_g`, `carbs_g`, `fat_g`,
   `display_name`, spočítané v okamžiku zápisu. Denní součty i statistiky se počítají
   **výhradně z nich**. Nikdy nedopočítávej hodnoty z `recipes`/`foods` za běhu —
   úprava receptu nesmí změnit historii.

6. **Žádné `localStorage` ani `sessionStorage`** pro data aplikace. Všechno přes Dexie.

7. **Nikdy nemaž natvrdo.** Jen `deleted_at`. Všechny dotazy filtrují `deleted_at is null`.
   Tvrdé smazání by při synchronizaci vzkřísilo záznam z druhého zařízení.

8. **`logged_on` je `DATE` v lokálním čase**, ne timestamp v UTC. Na odvození dne nikdy
   nepoužívej `toISOString()` — večeře ve 23:50 by skončila v zítřku.

9. **Interně gramy a plná přesnost.** Zaokrouhluj až v komponentě při zobrazení, nikdy
   v datové vrstvě a nikdy před uložením.

10. **Hodnoty receptu na 100 g** se počítají z `cooked_weight_g ?? součet surovin`.
   Hodnoty na porci z `servings`. Podrobnosti a příklad: `docs/SPEC.md`, sekce 7.5.

11. **UI nikdy nečeká na síť.** Zápis jde do IndexedDB + outboxu, obrazovka se aktualizuje
   okamžitě, synchronizace běží na pozadí.

12. **V klientovi smí být jen `anon` klíč.** `service_role` nikdy. RLS zapnutá na všech
   tabulkách, i když je uživatel jeden.

## Konvence

- Bez `any`. Nutriční hodnoty mají pojmenovaný typ, ne čtyři volná `number` vedle sebe.
- Hmotnosti a energie jsou `number` v základní jednotce (g, kcal). Nikdy stringy.
- Migrace jsou verzované SQL soubory v `supabase/migrations/`. Žádné ruční klikání v konzoli.
- Identifikátory v kódu anglicky, UI texty a komentáře česky.
- Nová závislost = nejdřív se zeptej.

## Příkazy

```
npm run dev      # vývojový server
npm run build    # produkční build
npm run test     # Vitest (celá sada)
npm run lint     # ESLint + tsc --noEmit
```

Jeden soubor / filtr názvem: `npx vitest run src/lib/nutrition.test.ts`,
`npx vitest run -t "úplnost"`. Watch režim: `npx vitest`.

Testy běží v `environment: 'node'` a berou jen `src/**/*.test.ts` (ne `.tsx`) — testuje se
čistá logika, ne komponenty. Projekt NEMÁ `@testing-library/react`; komponentu jde v nouzi
ověřit přes `react-dom/server` (`renderToStaticMarkup`) v `.test.ts`.

## Postup práce

- Pracuje se po fázích z `docs/SPEC.md`, sekce 9. Nedělej práci z pozdější fáze bez vyzvání.
  Fáze 1 je kuchařka, fáze 2 nutriční nadstavba, fáze 3 deník. Ve fázi 1 nevznikají
  tabulky ani obrazovky pro potraviny a deník — jen jejich schéma v migraci.
- Výpočetní logika má testy dřív, než se k ní napíše UI.
- Po dokončení úkolu spusť `npm run lint` a `npm run test` a nahlas výsledek.
- Když narazíš na rozhodnutí, které dokument neřeší, zeptej se místo hádání.
