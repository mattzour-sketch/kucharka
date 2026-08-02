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
npm run test     # Vitest
npm run lint     # ESLint + tsc --noEmit
```

## Postup práce

- Pracuje se po fázích z `docs/SPEC.md`, sekce 9. Nedělej práci z pozdější fáze bez vyzvání.
  Fáze 1 je kuchařka, fáze 2 nutriční nadstavba, fáze 3 deník. Ve fázi 1 nevznikají
  tabulky ani obrazovky pro potraviny a deník — jen jejich schéma v migraci.
- Výpočetní logika má testy dřív, než se k ní napíše UI.
- Po dokončení úkolu spusť `npm run lint` a `npm run test` a nahlas výsledek.
- Když narazíš na rozhodnutí, které dokument neřeší, zeptej se místo hádání.
