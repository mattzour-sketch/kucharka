# Návrh: Jednotný vyhledávací výběr potraviny (FoodPicker) + rychlé založení

## Co řešíme

Spec: `docs/specs/food-picker-vyber.md`. Sjednotit výběr potraviny přes stávající
overlay `FoodPicker` a doplnit ho tam, kde chybí (přidání suroviny při vaření), plus
umožnit rychlé založení potraviny přímo z výběru bez ztráty rozdělaného receptu/vaření.

Rozhodnutí orchestrátora beru jako daná: forma zůstává celoobrazovkový `FoodPicker`
(žádný inline dropdown), přidání suroviny ve vaření dostane výběr potraviny s předvyplněním
`raw_text`, a nová potravina se zakládá přímo z pickeru.

## Zvažované varianty

### Rychlé založení potraviny (klíčové rozhodnutí)

| Varianta | Pro | Proti |
|---|---|---|
| **A. Inline formulář uvnitř FoodPickeru** (zvoleno) | Nenaviguje se → volající obrazovka zůstává namontovaná → **kontext (kterou položku napojujeme) se neztratí**. Po založení rovnou `onSelect(newId)` → nová potravina projde stejnou cestou jako vybraná. Veřejné API pickeru beze změny. | FoodPicker roste o „zakládací" režim; drobná duplicita validace s `FoodEditScreen`. |
| B. Navigace na `FoodEditScreen` s návratem | Znovupoužije hotový plný formulář. | **Navigace odmontuje volající obrazovku a zahodí React stav** (`pickingItemId`, `replacingItemId`, rozepsaný `newItem`). Musel by se kontext persistovat (Dexie/URL) + plumbing návratové cesty. Přesně problém, na který spec upozorňuje. |
| C. Nechat dnešní `Link` na `/potraviny/nova` | Nulová práce. | Nesplňuje požadavek – ztrácí kontext. |

### Přidání suroviny ve vaření

| Varianta | Pro | Proti |
|---|---|---|
| **Rozšířit `addRecipeItem` o volitelné napojení + druhý picker** (zvoleno) | Minimální zásah, stejný `FoodPicker`, zpětně kompatibilní signatura. | Přidá do editMode řádku stavy navíc. |
| Nová repo funkce `addLinkedRecipeItem` | Čistší jméno. | Zbytečná duplicita se `syncRawCapture` a řazením `sortOrder`. |

## Zvolené řešení

**Rychlé založení = inline formulář uvnitř `FoodPicker`, který končí zavoláním
existujícího `onSelect(newFoodId)`.** Tím se řeší úplně všechno najednou:

- FoodPicker se vykresluje jako **podmíněný overlay uvnitř** každé volající obrazovky
  (`{pickingItemId ? <FoodPicker/> : null}` apod.). Dokud se nenaviguje, volající
  komponenta zůstává namontovaná a její React stav (kterou položku napojuji, rozepsaná
  náhrada, koncept nové suroviny) je netknutý. Inline formulář **nenaviguje**, jen zapíše
  potravinu přes `createFood` do Dexie a hned zavolá `onSelect(newId)`.
- Protože zakládání končí přes `onSelect`, dostanou **všechna tři místa** „založ a rovnou
  použij" zadarmo, beze změny jejich `onSelect` handlerů (Kalorie napojí `foodId`, náhrada
  předvyplní text a nastaví ks, přidání suroviny předvyplní `newItemText`).
- **Veřejné API `FoodPicker` (`{ onSelect, onClose }`) se nemění.** Zakládání je čistě
  interní stav pickeru. `RecipeNutritionScreen` tak získá rychlé založení bez jediné úpravy.

## Dopad na kód

### `src/features/foods/QuickFoodForm.tsx` — nový soubor
Malý formulář pro rychlé založení. Props:
```ts
{ initialName: string; onCreated: (foodId: string) => void; onCancel: () => void }
```
- Pole: název (předvyplněný `initialName`), přepínač `basis` g/ml, **kcal (povinné)**,
  bílkoviny/sacharidy/tuky (nepovinné → `0`), hmotnost 1 kusu (nepovinné → `pieceGrams`).
- Validace shodná s `FoodEditScreen.handleSave`: název neprázdný, `parseDecimal(kcal) !== null && >= 0`
  (invariant: `Food.energyKcal` je povinné). Při chybě věcná hláška, žádný zápis.
- Uložení: složí `FoodDraft`, zavolá `createFood(draft)` z `foodsRepo`, pak `onCreated(id)`.
- Znovupoužívá `createFood` a `parseDecimal` — žádná nová logika ani závislost.

### `src/features/foods/FoodPicker.tsx` — úprava
- Přidat interní stav `creating: boolean`.
- Empty-state (`results.length === 0`): nahradit dnešní `<Link to="/potraviny/nova">`
  tlačítkem **„+ Založit potravinu «query»"**, které nastaví `creating = true`. Rozlišit text:
  prázdná DB („Zatím žádné potraviny.") vs. „Nic nenalezeno." (jako `FoodsScreen`).
- Přidat trvalou drobnou nabídku „+ Založit potravinu" i **pod neprázdným** seznamem
  (pokrývá edge „duplicitní názvy / hledanou položku seznam neobsahuje").
- Když `creating`, vykreslit `<QuickFoodForm initialName={query} onCancel={()=>setCreating(false)}
  onCreated={(id)=>onSelect(id)} />` místo seznamu. `onCreated → onSelect` = žádná navigace.
- `onClose`/`onSelect` beze změny. (Volitelně: v prázdné DB nabídnout i „Přidat základní
  potraviny" přes `seedBasicFoods`, jako na `FoodsScreen` — nice-to-have, ne nutnost.)

### `src/features/recipes/recipesRepo.ts` — úprava `addRecipeItem`
Rozšířit signaturu o volitelné napojení (zpětně kompatibilní):
```ts
export async function addRecipeItem(
  recipeId: string,
  rawText: string,
  link?: { foodId?: string | null; amountG?: number | null; amountKs?: number | null },
): Promise<void>
```
- Guard `if (!text) return` zůstává — `raw_text` je i nadále jediné povinné pole (pravidlo 1, 3).
- Nový záznam dostane `foodId/amountG/amountKs` z `link` (default `null`), zbytek beze změny
  (`sortOrder`, `syncRawCapture`). Repo nic nedopočítává — `amountG` z `ks` je věc volajícího
  (shodně s dnešním `persistAmount`). Oba stávající call-sites `addRecipeItem(id, text)` zůstanou
  platné (3. parametr nepovinný).

### `src/features/recipes/CookingModeScreen.tsx` — úprava (přidání suroviny, pravidlo 2 zadání)
- Nové stavy: `addPickerOpen: boolean`, `newItemFoodId: string | null` (vedle `newItemText`).
- V editMode „přidat surovinu…" řádku doplnit:
  - tlačítko **„vybrat potravinu"** → `setAddPickerOpen(true)`;
  - když je `newItemFoodId` napojené, chip „→ název potraviny" s × pro odpojení (jako u náhrady).
- Handler „Přidat":
  `const text = newItemText.trim() || foodMap.get(newItemFoodId)?.name || '';`
  pak `addRecipeItem(id, text, newItemFoodId ? { foodId: newItemFoodId } : undefined)`,
  následně reset `newItemText` i `newItemFoodId`.
- Druhá instance `FoodPicker` pro `addPickerOpen` (analogicky k `replPickerOpen`). Její `onSelect`:
  - `if (!newItemText.trim()) setNewItemText(food.name)` — **předvyplní text jen když je prázdný**,
    nikdy nepřepíše, co uživatel napsal (pravidlo 2);
  - `setNewItemFoodId(foodId)`; `setAddPickerOpen(false)`.
- **Množství (g/ks) se v přidávacím řádku neřeší** — doplní se na obrazovce Kalorie (stejný model
  jako dnes: text je zdroj pravdy, gramáž zvlášť). Repo to ale umí přijmout, až to bude potřeba.

### `src/features/recipes/RecipeNutritionScreen.tsx` — beze změny
Rychlé založení získá „zdarma" díky nezměněnému `onSelect` (nová potravina se napojí stejně
jako vybraná). Uvádím explicitně, že se soubor nedotýká.

## Změny datového modelu

- **Schéma Dexie beze změny.** Žádná migrace, žádná nová tabulka, žádná nová závislost.
- Jediná změna chování dat: položka receptu může nově vzniknout rovnou s `foodId` (dřív
  `addRecipeItem` zakládal vždy `foodId: null`). Pole zůstává nullable, `raw_text` povinné →
  pravidla 1–3 platí.

## Plán implementace
(kroky v pořadí; po každém jde appka spustit)

1. **Repo:** rozšířit `addRecipeItem` o volitelný `link`. Hotovo, když `npm run lint`
   (tsc) projde a stávající přidání suroviny funguje beze změny (žádný caller zatím `link` neposílá).
2. **QuickFoodForm.tsx:** izolovaná komponenta, zatím nezapojená. Hotovo, když prochází tsc/lint
   a jde vyrenderovat samostatně (název + kcal validace, `createFood` volání).
3. **FoodPicker:** zapojit `creating` režim, nahradit `Link` tlačítkem, vykreslit `QuickFoodForm`,
   `onCreated → onSelect`. Hotovo, když na obrazovce Kalorie i u náhrady: prázdné hledání → „Založit"
   → vyplnit → uloží se a potravina se **rovnou napojí bez opuštění obrazovky**.
4. **CookingModeScreen:** `addPickerOpen` + `newItemFoodId` + rozšířený „Přidat" + `onSelect`
   předvyplnění. Hotovo, když: přidání s vybranou potravinou napojí `foodId` a předvyplní text;
   přidání bez výběru uloží čistý volný text; text napsaný ručně se výběrem nepřepíše.
5. **Kontrola:** `npm run lint` + `npm run test` zelené; projít akceptační kritéria ze spec ručně.

## Rizika a co může selhat

- **Míchání odpovědností v FoodPickeru** (výběr + zakládání). Mitigace: zakládací UI je vytažené
  do `QuickFoodForm`; FoodPicker jen přepíná režim.
- **Duplicita validace** name+kcal mezi `FoodEditScreen` a `QuickFoodForm`. Vědomě přijímám (pár
  řádků). Volitelný budoucí refaktor: sdílený `buildFoodDraft(...)` helper — mimo rozsah.
- **Přepsání textu suroviny** při přidání (porušení pravidla 2). Mitigace: předvyplňuje se **jen
  když je pole prázdné**; napojení na existující položku (Kalorie, náhrada) se `raw_text` nikdy nedotýká.
- **Prázdné kcal** by rozbilo výpočet. Mitigace: `QuickFoodForm` validuje kcal stejně jako editor,
  bez kcal neuloží.
- **Ztráta konceptu nové suroviny** (`newItemText`/`newItemFoodId`) není v `cookSession` — přežije jen
  dokud se nenaviguje. Díky inline zakládání se ale při zakládání potraviny nenaviguje, takže se to
  nestane; jde o transientní draft záměrně mimo sezení.
- **Signatura `addRecipeItem`**: ověřeno, že existují jen 2 call-sites (oba 2-argumentové) — volitelný
  parametr je nerozbije.

## Co tento návrh vědomě neřeší

- Inline rozbalovací dropdown místo overlaye (rozhodnutí 1 — zůstává overlay).
- Výběr/napojení potraviny v `RecipeEditScreen` (velké pole surovin) — mimo rozsah (zachycení = volný text).
- Zadávání gramáže/ks přímo v přidávacím řádku při vaření (řeší obrazovka Kalorie).
- Sdílený `NumberField`/`buildFoodDraft` refaktor napříč `FoodEditScreen` a `QuickFoodForm`
  (možný pozdější úklid, ne součást této featury).
- Řazení „naposledy použité", slučování duplicit, sken čárového kódu (spec: mimo rozsah / fáze 3).
