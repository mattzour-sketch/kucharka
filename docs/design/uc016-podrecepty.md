# Návrh: UC016 — Podrecepty (recept jako surovina)

## Co řešíme

Spec: [`docs/specs/uc016-podrecepty.md`](../specs/uc016-podrecepty.md), závazná rozhodnutí 1–8 na konci
(sekce „Rozhodnutí (uzavřené otázky)").
Jednou větou: surovinu půjde napojit místo na potravinu na **jiný recept** (v gramech do stávajícího
`RecipeItem.amountG`), jehož kalorie protečou do součtu nadřazeného receptu — na Kaloriích i ve
vaření, jedním sjednoceným pickerem, bez migrace modelu a bez nové závislosti.

Model i nutriční jádro už podrecepty z větší části umí (`RecipeItem.subRecipeId`, `recipeTotals`
s rekurzí a `visited` detekcí cyklu). Náplň UC je: (1) datová/repo vrstva pro zápis napojení
a vzájemné vyloučení, (2) sjednocený picker potravina/recept, (3) narovnání `completeness()`
a odlišení rozbitého napojení od cyklu, (4) zobrazení příspěvku podreceptu na řádku i v souhrnu,
(5) protažení podreceptu do vaření (`CookReplacement`, `applyReplacements`).

## Rozpor se spec, který musím pojmenovat

Spec na konci uvádí „Beze změny: … nutriční jádro (`recipeTotals` už podrecepty i cykly umí)" a task
opakuje „co se NEmění: nutriční jádro `recipeTotals`". Zároveň ale **rozhodnutí 5, 7 a 8 vyžadují
změnu chování, které nejčistěji žije právě v `recipeTotals`**:

- rozhodnutí 7 (rozbité/neznámé/smazané napojení ≠ cyklus) znamená, že výpočet nesmí u chybějícího
  podreceptu **vyhodit chybu** (dnes to `source.recipe` dělá a `catch` to hlásí jako cyklus);
- rozhodnutí 8 (nulová finální hmotnost) znamená **guard proti dělení nulou** v místě, kde se
  podrecept normalizuje (`scale(sub.totals, 100 / sub.finalWeight)`);
- rozhodnutí 5 (narovnání úplnosti) znamená, že úplnost musí počítat s **reálným příspěvkem**
  podreceptu, což ví jen výpočetní smyčka.

Interpretuji „beze změny jádra" jako **„nepřepisuje se algoritmus normalizace na 100 g ani detekce
cyklu"** — ten zůstává. Rozhodnutí 5/7/8 řeším **aditivními, chirurgickými úpravami** `lib/nutrition.ts`
(tolerance chybějícího zdroje, guard nulové hmotnosti, návrat úplnosti odpovídající skutečnému
příspěvku). Vzorec normalizace ani `visited` logika se nemění. Zvažoval jsem alternativu „jádro
nechat bajt-identické a vše řešit v adaptéru" — je horší (viz Zvažované varianty B), proto ji
nevolím, ale rozhodnutí nechávám viditelné pro schválení.

## Zvažované varianty

### A) Sjednocený picker potravina/recept

| Varianta | Pro | Proti |
|---|---|---|
| **Nový `LinkPicker` + extrakce `FoodPickList` z dnešního `FoodPicker`** (zvoleno) | Poctivé API (vrací union `LinkTarget`), režim recept má vlastní vykreslení (kcal/100 g, self-exclude, bez zakládání); food-mód se nekopíruje (sdílený `FoodPickList` včetně `QuickFoodForm`) | Refactor `FoodPicker` na `FoodPickList` + migrace 3 volání; `FoodPicker` overlay zaniká |
| Rozšířit `FoodPicker` in-place o přepínač a union callback | Jeden soubor | `onSelect(foodId)` → union je breaking změna komponenty pojmenované „Food"; nacpání dvou módů + inline zakládání potraviny do jednoho overlaye ho nafoukne |
| `LinkPicker` duplikující food list | `FoodPicker` netknutý | Duplikace ~40 řádků včetně `QuickFoodForm` a prázdných stavů; dvě cesty k údržbě |

### B) Kam umístit narovnání úplnosti + odlišení rozbité napojení / cyklus (rozhodnutí 5, 7, 8)

| Varianta | Pro | Proti |
|---|---|---|
| **Chirurgické úpravy `lib/nutrition.ts`** (zvoleno): `NutritionSource` vrací `\| null`, guard nulové hmotnosti, `recipeTotals` vrací úplnost dle skutečného příspěvku | Jeden zdroj pravdy; správně i pro zanoření (pod-podrecept s nulovou hmotností); minimální diff; testovatelné před UI | Dotýká se „jádra" (rozpor s poznámkou spec, viz výše) |
| Jádro bajt-identické, vše v adaptéru `recipeNutrition.ts` | Splní literu „beze změny jádra" | Nulová hmotnost zanořeného podreceptu vyžaduje **sanitizaci celého grafu** předem (adaptér by musel dopředu spočítat computability každého receptu — v podstatě reimplementace výpočtu vč. cyklů); riziko rozjezdu „co adaptér myslí, že se počítá" vs „co jádro sečte" |
| `completeness()` dostane `source` a vlastní rekurzi | Úplnost oddělená od součtů | Duplikuje rekurzi i cyklus; `completeness` se volá i uvnitř `recipeTotals` → hrozí dvojí rekurze |

### C) Vzájemné vyloučení `foodId` × `subRecipeId`

| Varianta | Pro | Proti |
|---|---|---|
| **V repo** (`updateRecipeItemLink`, `addRecipeItem`) — napojení jednoho vynuluje druhé (zrcadlí SQL `at_most_one_target`) (zvoleno) | Invariant hlídaný centrálně bez ohledu na volajícího; UI se nemusí hlídat | Repo musí být „chytřejší" než dnešní prostý `update(patch)` |
| Jen v UI callerech | Repo zůstane hloupé | Invariant roztroušený po 3 obrazovkách; snadno se poruší |

## Zvolené řešení

Zdola nahoru: čistá výpočetní vrstva (s testy) → repo → sdílený picker → obrazovky. Pořadí drží
pravidlo CLAUDE.md „výpočetní logika má testy dřív než UI".

### 1. `lib/nutrition.ts` — tolerance chybějícího zdroje, guard nulové hmotnosti, poctivá úplnost

- **`NutritionSource` vrací `| null`:** `food(id): FoodValue | null`, `recipe(id): CalcRecipe | null`.
  `null` = neznámý/nedostupný cíl (rozbité napojení). Tím se **oddělí „chybí" (null, ošetřeno) od
  „cyklus" (výjimka)** — přesně rozhodnutí 7.
- **`recipeTotals`:**
  - u položky s `foodId`: `const v = source.food(id); if (v == null) continue;` (rozbitá potravina =
    nezapočítá se, nespadne). Dřív `throw` → mylně `hasCycle`.
  - u položky se `subRecipeId`: `const r = source.recipe(id); if (r == null) continue;`
    (rozbitý/smazaný podrecept = nezapočítá se), pak rekurze; `if (!sub.computable || sub.finalWeight <= 0) continue;`
    — **guard nulové finální hmotnosti** (rozhodnutí 8) i prázdného podreceptu (rozhodnutí 5).
  - cyklus (`visited.has`) zůstává **jediným** místem, kde funkce vyhodí chybu → jasně
    identifikovatelný „obsahuje sám sebe".
  - **úplnost počítaná ve stejné smyčce:** `connected` = počet položek, které do součtu **reálně
    přispěly** (potravina se zdrojem + `amountG`; nebo computable podrecept s `finalWeight > 0`
    + `amountG`); `countable` = počet nepřeskočených položek. Tuhle úplnost `recipeTotals` vrací
    v obou větvích (`computable: true` i `false`) místo dnešního volání naivní `completeness(recipe)`.
    Tím **částečnost podreceptu neprobublává nahoru** (nadřazený počítá podrecept jako 1 napojenou
    položku, ne jeho poměr) — rozhodnutí 5.
- **`completeness()` zůstává** (strukturální, bez zdroje) pro fallback v adaptéru u cyklu a pro
  přímé testy; pro recepty jen s potravinami je strukturální == skutečná, takže se nic neregreduje.
- Doporučuji zavést pojmenovanou chybu `RecipeCycleError` (throw v místě cyklu), ať adaptér nastaví
  `hasCycle` jen na ni a ne na jakoukoli budoucí výjimku. Malá pojistka, ne nutnost.

Vzorec normalizace na 100 g finální hmotnosti a `visited` detekce cyklu se **nemění**.

### 2. `features/nutrition/recipeNutrition.ts` — adaptér

- `source.food`: `foodMap.get(id) ? foodToValue(...) : null` (neznámá potravina → null; smazané
  potraviny řeší jiný UC, necháváme počítat jako dnes).
- `source.recipe`: `const r = recipeMap.get(id); return !r || r.deletedAt ? null : toCalc(id);`
  — **soft-smazaný podrecept = rozbité napojení** (rozhodnutí 7). `toCalc` už se volá jen pro
  existující id, přestane házet „Neznámý recept".
- `nutritionFromData` vrací **`result.completeness`** z `recipeTotals` (skutečný příspěvek), ne dnešní
  `completeness(calc)`. V `catch` (jen `RecipeCycleError`) fallback na strukturální `completeness(calc)`
  (kosmetika — u cyklu se stejně čísla neukazují).
- **`applyReplacements` protáhne `subRecipeId`:** syntetická položka dostane
  `foodId: replacement.foodId ?? null, subRecipeId: replacement.subRecipeId ?? null`. Tím je vaření
  hotové na jednom místě — `applyReplacements` je choke-point pro dokončení vaření, `backfillMissingNutrition`
  i `replayCookLog` (přes uložené `replacements`).

### 3. `db/index.ts` — jen vnořený typ

- `CookReplacement.subRecipeId?: string | null`. Žádný Dexie `stores()`/`version()` bump — `CookReplacement`
  žije jako JSON uvnitř `cookSessions`/`cookLogs`. Ty **nejsou v záloze** (`dbBackup.ts` zálohuje
  jen foods/portions/recipes/recipeItems/notes/logEntries/goals/weights/photos), takže se nemění ani
  formát zálohy. `RecipeItem.subRecipeId` už existuje a v `recipeItems` v záloze je.

### 4. `features/recipes/recipesRepo.ts` — zápis napojení + vzájemné vyloučení

- `updateRecipeItemLink(itemId, patch)` — patch rozšířit o `subRecipeId?: string | null`; před zápisem
  aplikovat pravidlo vyloučení (zrcadlí SQL `at_most_one_target`):
  - `patch.foodId` je neprázdný string → doplnit `subRecipeId: null`;
  - `patch.subRecipeId` je neprázdný string → doplnit `foodId: null, amountKs: null` (podrecept je
    jen v gramech, rozhodnutí 1).
  - `null` hodnoty (odpojení) projdou beze změny. Picker vrací vždy právě jeden druh, takže oba
    neprázdné najednou nenastanou.
- `addRecipeItem(recipeId, rawText, link?)` — `link` rozšířit o `subRecipeId`; stejné vyloučení
  (má-li `subRecipeId`, uloží `foodId: null, amountKs: null`).
- Repo I/O se dle konvence projektu neunit-testuje (potřebuje IndexedDB); pokryto typy a ručním AK.

### 5. `components` — sjednocený picker

- **`LinkPicker`** (nový, full-screen overlay):
  ```ts
  export type LinkTarget =
    | { kind: 'food'; foodId: string }
    | { kind: 'recipe'; subRecipeId: string };

  function LinkPicker(props: {
    currentRecipeId: string;                  // self-exclude (rozhodnutí 4)
    onSelect: (target: LinkTarget) => void;
    onClose: () => void;
    initialMode?: 'food' | 'recipe';
  }): JSX.Element
  ```
  Hlavička: sdílené hledací pole + `Segmented` přepínač „Potravina / Recept" + Zavřít. Tělo dle módu.
- **`FoodPickList`** (extrahováno z těla dnešního `FoodPicker`): hledání + `QuickFoodForm` + prázdné
  stavy, `query` řízené z hlavičky, `onSelect(foodId)`. Chování a vzhled food-módu **beze změny**.
- **`RecipePickList`** (nový): nesmazané recepty (`deletedAt == null`), **bez** aktuálního
  (`currentRecipeId`), řazení dle názvu (`localeCompare(cs)`); u každého `kcal / 100 g` z
  `nutritionFromData(recipe.id, data)`, u nespočitatelných/cyklických „bez kalorií" (rozhodnutí 6);
  bez inline zakládání receptu (prázdný stav jen „Žádný recept"). `onSelect(subRecipeId)`.
- **`FoodPicker.tsx` zaniká** (overlay chrome se přesune do `LinkPickeru`, tělo do `FoodPickList`);
  všechna 3 dnešní volání se přepnou na `LinkPicker`. Kdyby později byl potřeba jen food-mód,
  `LinkPicker` dostane `allowRecipes?: boolean`.

### 6. `RecipeNutritionScreen.tsx` — řádek podreceptu na Kaloriích

- Větvení řádku: `isSkipped` → (dnešek) · `item.foodId` → (dnešek) · **`item.subRecipeId` → nová
  větev** · jinak nenapojeno.
- Nová větev: „→ <název podreceptu>", `AmountPicker` s **jedinou volbou g** (`GRAMS_ONLY` konstanta),
  příspěvek v kcal, tlačítko odpojit. Množství se ukládá stávající cestou `commitValue` →
  `updateRecipeItemLink({ amountG, amountKs: null })` (žádná nová amount-logika; `resolveAmount`
  s jednou g-volbou vrací `amountG = n`).
- **Příspěvek podreceptu:** `per100g` podreceptu z `nutritionFromData(subRecipeId, data)`, memoizované
  v `Map<subRecipeId, Nutrients|null>` sestavené jednou za render; `contribution = per100g.kcal * amountG / 100`.
  `null` (nespočitatelný) → **„bez kalorií"** místo čísla (rozhodnutí 6, AK E).
- Rozbité napojení (subRecipeId ukazuje na neznámý/smazaný recept) → řádek „→ recept nedostupný" +
  „bez kalorií" + odpojit; položka se počítá jako nenapojená (plyne z bodu 1).
- Nenapojený řádek: tlačítko „napojit potravinu" → **„napojit"** (otevře `LinkPicker`), „přeskočit"
  zůstává; `suggestFood` (návrh potraviny z textu) beze změny (podrecept se z textu nenavrhuje —
  mimo rozsah).
- `linkSubRecipe(itemId, subRecipeId)`: `updateRecipeItemLink({ subRecipeId, isSkipped: false })`
  (repo vynuluje `foodId`/`amountKs`) + seed `values[itemId]` na `{unitId:'g', raw: gramáž z textu ?? ''}`.
- Seedovací efekt (řádky ~88–96): pro `item.subRecipeId` použít `GRAMS_ONLY` a `deriveInitialAmountValue`.
- `NutritionSummary` beze změny — podrecepty protečou přes `nutritionFromData`, „X z Y" nově odpovídá
  skutečnému příspěvku, „Orientační" naskočí i kvůli nespočitatelnému podreceptu (AK C).

### 7. `CookingModeScreen.tsx` — podrecept u náhrady a přidání (rozhodnutí 3)

- Náhrada i přidání dostanou paralelní stav `subRecipeId` vedle `foodId`
  (`replSubRecipeId`, `newItemSubRecipeId`); picker → `LinkPicker` s dispatchem dle `target.kind`.
  Množství podreceptu = `AmountPicker` s `GRAMS_ONLY`.
- `saveReplacement`: do `CookReplacement` uloží buď `foodId`, nebo `subRecipeId` (nikdy oba), gramáž
  přes `resolveAmount`.
- `handleAddItem`: `addRecipeItem(id, text, { subRecipeId, amountG })` když byl vybrán podrecept.
- Výpočet dokončení (`applyReplacements` + `nutritionFromData`) i snapshot `CookLog` už funguje po
  kroku 2/3 — snapshot se počítá v okamžiku dokončení a ukládá se jako číslo (pravidlo 5), pozdější
  změna podreceptu historii nezmění.
- Override „jiné množství pro dnešek" zůstává jen text (mimo kalorie), beze změny.

### 8. `RecipeDetailScreen.tsx` — beze změny kódu

Používá stejné `nutritionFromData`; podrecepty protečou do `NutritionSummary` automaticky (AK E).
Seznam surovin zobrazuje jen `raw_text` (žádné napojení na řádku), takže tam není co měnit.

## Dopad na kód

Nové soubory:
- `src/components/ui/LinkPicker.tsx` — sjednocený picker (přepínač + union `LinkTarget`).
- `src/components/ui/RecipePickList.tsx` — seznam receptů (kcal/100 g, self-exclude, nesmazané, dle názvu).
- `src/components/ui/FoodPickList.tsx` — tělo food-módu vyjmuté z `FoodPicker` (hledání + `QuickFoodForm`).
  Vzniká, aby se food-mód nekopíroval do `LinkPickeru`.

Měněné soubory:
- `src/lib/nutrition.ts` — `NutritionSource` (`| null`), `recipeTotals` (skip null, guard `finalWeight <= 0`,
  úplnost dle skutečného příspěvku), volitelně `RecipeCycleError`.
- `src/lib/nutrition.test.ts` — `makeSource` vrací `null` pro neznámé; nové testy (viz plán).
- `src/features/nutrition/recipeNutrition.ts` — null-tolerantní `source`, soft-delete podreceptu → null,
  `result.completeness`, `applyReplacements` protáhne `subRecipeId`.
- `src/features/nutrition/recipeNutrition.test.ts` — nové testy (viz plán).
- `src/db/index.ts` — `CookReplacement.subRecipeId?: string | null` (bez schema/version bumpu).
- `src/features/recipes/recipesRepo.ts` — `updateRecipeItemLink` + `addRecipeItem` o `subRecipeId`
  + pravidlo vyloučení.
- `src/features/recipes/RecipeNutritionScreen.tsx` — řádek podreceptu, `LinkPicker`, `linkSubRecipe`,
  memoizovaný `per100g` podreceptu, seed g-only.
- `src/features/recipes/CookingModeScreen.tsx` — subRecipeId u náhrady a přidání, `LinkPicker`.

Zaniká:
- `src/features/foods/FoodPicker.tsx` — nahrazeno `LinkPicker` + `FoodPickList` (3 volání se přepnou).

Vědomě beze změny:
- `recipeTotals` **vzorec** normalizace na 100 g a detekce cyklu; `Recipe`/`RecipeItem` schéma a index;
  `dbBackup.ts`/`backup.ts` (formát i sada tabulek); `AmountPicker`/`lib/amount.ts` (g-only volbu už umí);
  `RecipeDetailScreen.tsx`; `QuickFoodForm`; žádná nová závislost.

## Změny datového modelu

- `CookReplacement` získává `subRecipeId?: string | null` — vnořený typ v JSON `cookSessions`/`cookLogs`.
  **Bez migrace, bez `version()` bumpu, mimo zálohu.**
- `RecipeItem.subRecipeId` už v modelu, indexu i záloze **existuje** — jen se začne zapisovat.
- `NutritionSource.food/recipe` → návratový typ `| null` (typová změna kódu, ne dat).
- Žádná migrace existujících dat. Množství podreceptu = gramy do stávajícího `amountG` (rozhodnutí 1).

## Plán implementace

Po každém kroku appka běží (`npm run dev`) a projde `npm run lint` + `npm run test`.

1. **`lib/nutrition.ts` + testy.** `NutritionSource` → `| null`; `recipeTotals` skip null, guard
   `finalWeight <= 0`, úplnost dle skutečného příspěvku v obou větvích; (volitelně `RecipeCycleError`).
   Aktualizovat `makeSource` v testu na `?? null`.
   *Hotovo když:* zelené existující testy (a–h) beze změny čísel; nové testy prochází: (i) položka
   s neznámým `subRecipeId` → nespadne, nezapočítá se, `connected` nižší; (ii) prázdný podrecept →
   nezapočítá se a není `connected`; (iii) podrecept s nulovou finální hmotností → nezapočítá se;
   (iv) částečný podrecept (3/5) přispěje jen ze svých napojených a nahoru se propíše jako **1**
   napojená položka; (v) přímý i nepřímý cyklus dál `throw`.

2. **`recipeNutrition.ts` + testy.** Null-tolerantní `source`, soft-delete podreceptu → null,
   `result.completeness`, `applyReplacements` protáhne `subRecipeId`.
   *Hotovo když:* nové testy: podrecept se započítá a normalizuje (obdoba `lib` testu „f"); neznámý
   `subRecipeId` → `hasCycle == false`, `computable` dle zbytku, žádná výjimka; soft-smazaný podrecept
   → bere se jako rozbité napojení; reálný cyklus → `hasCycle == true`; `applyReplacements` se
   `subRecipeId` vloží syntetickou položku s podreceptem. Existující testy zelené (food-only = beze změny).

3. **`db/index.ts` + `recipesRepo.ts`.** `CookReplacement.subRecipeId`; `updateRecipeItemLink`/
   `addRecipeItem` o `subRecipeId` + vzájemné vyloučení.
   *Hotovo když:* `npm run lint` (tsc) projde; ručně: napojení podreceptu na řádek s potravinou
   vynuluje `foodId`/`amountKs`, odpojení vynuluje `subRecipeId`/`amountG`/`amountKs`, `raw_text` beze změny.

4. **`FoodPickList` (extrakce) → `RecipePickList` → `LinkPicker`; migrace 3 volání; smazat `FoodPicker`.**
   *Hotovo když:* food-mód se chová a vypadá jako dnes (hledání, `QuickFoodForm`, kcal/100); recept-mód
   nabízí nesmazané recepty dle názvu s kcal/100 g (nespočitatelné „bez kalorií"), aktuální recept
   chybí; přepínač funguje; zavření bez volby nic nemění.

5. **`RecipeNutritionScreen.tsx`.** Řádek podreceptu (název, g-only `AmountPicker`, příspěvek/„bez
   kalorií", odpojit), `LinkPicker`, `linkSubRecipe`, memoizovaný `per100g` podreceptu, seed g-only,
   rozbité napojení jako nedostupné.
   *Hotovo když:* AK A, B, C, E, F ručně: napojím „domácí bešamel", zadám 200 g → příspěvek v kcal
   v řádku i v souhrnu; prázdný podrecept → „bez kalorií" a „X z Y" klesne + „Orientační"; hluboké
   zanoření protéká; odpojení vše vynuluje a `raw_text` zůstává; recept jen s potravinami beze změny.

6. **`CookingModeScreen.tsx`.** `subRecipeId` u náhrady i přidání, `LinkPicker`, g-only množství.
   *Hotovo když:* AK (rozhodnutí 3) ručně: náhrada i přidání podreceptem dopočtou kalorie stejně jako
   Kalorie; dokončení uloží snapshot; „uvařit znovu takhle" náhradu s podreceptem obnoví; dnešní
   náhrada/přidání potravinou beze změny. Finální `npm run lint` + `npm run test`.

## Rizika a co může selhat

- **Regrese dnešního napojení potravin a g/ks/měr (UC017) — nejvyšší priorita.** Mitigace: food-mód
  je vyjmutý 1:1 do `FoodPickList` (žádná změna logiky); pro recepty jen s potravinami je skutečná
  úplnost == strukturální (ověřeno proti existujícím testům), takže „X z Y" ani součty se nehnou;
  krok 1/2 mají food-only testy jako pojistku, kroky 5/6 explicitně ověřují recept bez podreceptů.
- **Změna `NutritionSource` na `| null` je průřezová.** Mitigace: typová změna přinutí kompilátor
  najít všechna místa (`tsc --noEmit`); jediní konzumenti jsou `recipeNutrition.ts` a testový
  `makeSource`. `recipeTotals` skip null je aditivní.
- **`hasCycle` nesmí polykat rozbité napojení (rozhodnutí 7).** Po změně je cyklus jediná výjimka
  z `recipeTotals`; pojmenovaná `RecipeCycleError` to zpřísní (adaptér nastaví `hasCycle` jen na ni).
- **Dělení nulou (rozhodnutí 8).** Guard `finalWeight <= 0` u normalizace podreceptu; pokryto testem
  (i) v kroku 1. Platí i pro zanořený podrecept, protože guard je uvnitř rekurze.
- **Plná přesnost (pravidlo 9).** Množství podreceptu jde přes stejnou cestu jako gramy potraviny
  (`amountG` bez pre-roundingu), zaokrouhluje se až v `NutritionSummary`/řádku.
- **Snapshot historie (pravidlo 5).** Podrecept ve vaření teče přes `applyReplacements` →
  `nutritionFromData` → `CookLog.perPortion` (číslo uložené při dokončení). Pozdější úprava podreceptu
  snapshot nemění; ověřeno v kroku 6.
- **Výkon `RecipePickList`/příspěvků.** `nutritionFromData` se počítá per kandidát a per řádek
  s podreceptem. Pro osobní kuchařku (desítky receptů) zanedbatelné; kdyby vadilo, sestaví se jedna
  sdílená mapa `id → per100g` z jednoho průchodu dat.
- **Vzájemné vyloučení mimo repo.** `CookReplacement` hlídá jen UI (nese vždy jeden druh); calc dává
  `foodId` přednost, takže i kdyby prosákly oba, nespadne.

## Co tento návrh vědomě neřeší

- Jednotku „porce"/„celý recept" pro podrecept (rozhodnutí 1 — jen gramy; do budoucna rozšíření).
- Aktivní blokaci tranzitivních cyklů v pickeru (rozhodnutí 4 — jen self-exclude + síť `hasCycle`).
- Propagaci **částečné** úplnosti podreceptu do nadřazeného (rozhodnutí 5 — nadřazený bere podrecept
  jako 1 napojenou položku; jeho vlastní 3/5 je vidět v jeho souhrnu).
- Návrh napojení podreceptu z textu (obdoba `suggestFood`) — mimo rozsah spec.
- Inline zakládání nového receptu z pickeru — mimo rozsah (recepty se vybírají z existujících).
- Přepis `raw_text` názvem podreceptu (pravidlo 2).
- Deník / zápis snapshotu s podrecepty do deníku (fáze 3) — `recipeTotals` to umí, UI deníku sem nepatří.
- Chování smazané **potraviny** (ne podreceptu) — mimo rozsah; necháváme jako dnes.
