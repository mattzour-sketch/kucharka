# Prompt pro Claude Code — Fáze 0

## Než ho spustíš

1. Vytvoř prázdnou složku a v ní `git init`.
2. Zkopíruj do ní `CLAUDE.md` (do kořene) a `kaloricky-denik-dokumentace.md` jako `docs/SPEC.md`.
3. Spusť `claude` z kořene projektu.
4. Vlož prompt níže.

---

## Prompt

```
Zakládáme nový projekt. V kořeni je CLAUDE.md s pravidly a v docs/SPEC.md je plná
specifikace — přečti si obojí, než začneš.

Kontext, který je snadné přehlédnout: tohle NENÍ kalorická tabulka. Je to sbírka
receptů, ke které se počítání kalorií teprve někdy později přilepí. Hlavní úloha
je zachytit recept, který mi někdo diktuje, do 60 sekund a offline.

Dnes děláme jen Fázi 0 (SPEC sekce 9). Cílem není funkční aplikace, ale nasaditelný
základ. Postupuj v tomhle pořadí a po každém kroku mi řekni, co jsi udělal:

1) KOSTRA PROJEKTU
   - Vite + React 18 + TypeScript ve strict módu
   - Tailwind, ESLint, Prettier, Vitest
   - Skripty dev/build/test/lint podle CLAUDE.md
   - Struktura složek odpovídající fázím ze SPEC (src/features/recipes jako první)

2) DATABÁZE
   - supabase/migrations/0001_init.sql přesně podle schématu v SPEC 7.4,
     včetně indexů, check constraintů a soft delete
   - RLS zapnutá na všech tabulkách
   - src/db/index.ts — schéma Dexie zrcadlící stejné tabulky
   - Zatím žádná synchronizace, jen definice

   POZOR na dvě věci, které se snadno udělají špatně:
   - recipe_items.raw_text je NOT NULL, ale food_id, sub_recipe_id i amount_g
     jsou NULLABLE. Recept musí jít uložit bez jediné napojené potraviny.
   - recipes.servings je NULLABLE. Ne default 1, ne not null.

   Po dokončení migrace mi napiš seznam všech NOT NULL sloupců v tabulkách
   recipes a recipe_items, ať to můžu zkontrolovat.

3) MODUL ÚPLNOSTI A VÝPOČTU
   - src/lib/nutrition.ts:
     * completeness(recipe) podle SPEC 7.5 — poměr napojených k započitatelným
       položkám, přeskočené (is_skipped) se nepočítají do jmenovatele
     * recipeTotals(recipe) — součty jen přes napojené položky, plus finalWeight
     * logEntryFromRecipe() podle SPEC 7.5
   - src/lib/nutrition.test.ts, kde MUSÍ projít:

     a) Recept "Kuřecí rizoto", 4 porce, cooked_weight_g = 1500, všechny suroviny
        napojené:
          kuřecí prsa   400 g  @ 106 kcal/100 g
          rýže          200 g  @ 350
          cibule        100 g  @  40
          olej           20 g  @ 884
        → úplnost 1
        → celkem 1340,8 kcal
        → na porci 335,2 kcal
        → na 100 g 89,39 kcal (tolerance 0,01)

     b) Stejný recept bez cooked_weight_g → na 100 g 186,22 kcal
        (kontrola, že se použije součet surovin 720 g)

     c) Recept, kde jsou 3 z 5 položek napojené a jedna je is_skipped
        → úplnost 3/4, součty jen ze tří napojených

     d) Recept, kde není napojená ani jedna položka
        → úplnost 0, funkce nevrací nulové součty jako platný výsledek,
          ale rozlišitelný stav "nelze spočítat"

     e) Recept se servings = null → hodnota na porci není k dispozici,
        ale celkové hodnoty a hodnoty na 100 g ano

     f) Podrecept — hodnoty se normalizují na 100 g finální hmotnosti podreceptu

     g) Recept, který přímo i nepřímo obsahuje sám sebe → vyhodí chybu,
        nezacyklí se

     h) Zápis 340 g rizota do deníku vytvoří log entry s energy_kcal 303,91
        (tolerance 0,01) a s vyplněným display_name

   - Žádné zaokrouhlování uvnitř modulu

4) PWA A NASAZENÍ
   - vite-plugin-pwa: manifest (název, ikony 192 a 512 px, display standalone,
     theme_color), service worker cachující app shell
   - Placeholder ikony si vygeneruj sám, klidně jednobarevné
   - Jedna obrazovka: prázdný seznam receptů s tlačítkem "+ Nový recept",
     které zatím nic nedělá. Nic víc.
   - .env.example s VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY
   - README s postupem: instalace, spuštění, nasazení na Cloudflare Pages

Na konci:
- spusť npm run lint a npm run test a ukaž výstup
- napiš seznam kroků, které musím udělat ručně já (založení Supabase projektu,
  proměnné prostředí, propojení s hostingem)
- napiš, kde jsi musel něco domyslet, protože to SPEC neřešil

Nezakládej nic z Fáze 1. Když budeš na vážkách, zeptej se.
```

---

## Než to prohlásíš za hotové

- [ ] `npm run test` projde, včetně případu s cyklem a s nulovou úplností
- [ ] `npm run build` projde bez chyb TypeScriptu
- [ ] Aplikace nasazená na HTTPS jde na telefonu přidat na plochu a otevře se bez adresního řádku
- [ ] V `0001_init.sql` je `recipe_items.amount_g` **nullable** a `recipes.servings` **nullable**
- [ ] V `0001_init.sql` je `deleted_at` a `logged_on` je `date`, ne `timestamptz`
- [ ] Nikde v kódu není `localStorage`

## Fáze 1 — rozděl ji na tři session

Až Fáze 0 sedí, nepokračuj větou „udělej Fázi 1". Postupně:

1. **Zachycení a čtení** — obrazovka nového receptu (jedno velké pole), seznam, detail,
   editace, průběžné ukládání konceptu. Offline, bez synchronizace. (R-01 až R-05, R-10, R-13)
2. **Vaření a hledání** — režim vaření s wake lockem a odškrtáváním, fulltext přes
   název, suroviny, postup i autora, štítky. (R-16, R-20 až R-22)
3. **Fotky a synchronizace** — fotka kartičky do IndexedDB + outbox do Supabase Storage,
   přihlášení, export JSON. (R-04, N-01, N-05, E-16)

**Po první session přestaň programovat a jdi zapsat pět skutečných receptů.** Věci, které
tě u toho začnou štvát, jsou lepší zadání než cokoliv v dokumentu.
