# Návrh: UC017 — Domácí míry → gramy

## Co řešíme

Spec: [`docs/specs/uc017-domaci-miry.md`](../specs/uc017-domaci-miry.md), závazná rozhodnutí OO1–OO7 na konci.
Jednou větou: u potraviny půjde nadefinovat pojmenované míry (`1 lžíce = 15 g`) a u suroviny pak
vybrat míru + počet, z čehož se dopočte gramáž do stávajícího `RecipeItem.amountG` — bez migrace
modelu, bez nové závislosti, se sdílenou komponentou výběru množství použitou na 4 místech.

Klíčový důsledek rozhodnutí OO2: **míra je jen pomůcka při zadávání.** Do dat nikdy neteče „vybraná
míra + počet", jen výsledná gramáž (`amountG`). Tím se celý feature obejde bez jakékoli změny
`RecipeItem`, `CookReplacement`, `CookLog` i nutričního výpočtu — ty už dnes pracují výhradně
s `amountG`. Jediný dotyk datové vrstvy je nepovinné `deletedAt` na `FoodPortion` (viz níže, bod
delete), a i to je volitelné rozhodnutí, které explicitně otevírám.

## Zvažované varianty

### A) Persistence vybrané míry na surovině

| Varianta | Pro | Proti |
|---|---|---|
| **Jen gramáž do `amountG`** (zvoleno, = OO2) | Žádná změna modelu; výpočet, záloha i snapshot beze změny; míra je čistě UI pomůcka | Po znovuotevření se „2 lžíce" ukáže jako „30 g" (ne jako míra) |
| Nové pole `selectedPortionId + count` na `RecipeItem` | Míra přežije reload | Porušuje OO2; migrace schématu; živá vazba (kolize s OO3); nutný přepočet při změně míry |

OO2 rozhodl za nás — beru variantu 1. Asymetrie vůči „ks" (které si přes `amountKs` počet pamatuje)
je záměrná: „ks" je trvalý atribut potraviny (`pieceGrams`), míra je jednorázová pomůcka.

### B) Sdílená komponenta výběru množství

| Varianta | Pro | Proti |
|---|---|---|
| **Controlled `<AmountPicker>` + čistý `lib/amount.ts`** (zvoleno) | Konverze/zaokrouhlení/persistence logika na jednom místě a otestovaná dřív než UI; stav si drží každé místo po svém (živý zápis na Kalorie vs. draft ve vaření) | Každé místo si dál drží `AmountValue` (unit+raw) ve svém stavu |
| Plně samostatná komponenta s vnitřním stavem + vlastní zápis | Volající nedrží nic | Nesedí na dva různé režimy zápisu (Kalorie zapisuje živě, vaření commituje draft); jeden z nich by regredoval |
| Nechat 4× inline (jen přidat míry) | Nejmenší diff teď | Logika g/ks je už dnes 3× zkopírovaná; přidání měr by trojnásobilo i tu novou větev |

### C) Řízení jednotky v pickeru (g / ks / míry)

| Varianta | Pro | Proti |
|---|---|---|
| **1 volba → statické „g"; 2 → `Segmented`; ≥3 → `<select>`** (zvoleno) | Škáluje na N měr bez lámání layoutu; `Segmented` je už projektový standard pro g/ml | „ks" přestane být cyklické tlačítko a bude `Segmented` pill (vizuální, ne funkční změna) |
| Zachovat dnešní cyklické tlačítko pro g/ks, `<select>` jen když jsou míry | Nulová vizuální změna na horké g/ks cestě | Dvě větve UI ve stejné komponentě; cyklické tlačítko mezi ≥3 volbami je slepé |

## Zvolené řešení

Tři čisté (testovatelné) moduly + jedna komponenta + lehká repo vrstva, zapojené na 4 místech:

1. **`lib/amount.ts`** — čistá logika jednotek: sestavení nabídky jednotek z potraviny + měr,
   převod „počet ↔ gramy" a normalizace na `{ amountG, amountKs }` k uložení. Sem se stáhne
   `round2`/dělení/násobení `pieceGrams`, co je dnes 3× inline.
2. **`lib/portionMatch.ts`** — čistý matcher „počet + název míry této potraviny" pro auto-návrh
   z textu (OO5). Read-only, `raw_text` nikdy nesahá.
3. **`features/foods/foodPortionsRepo.ts`** — CRUD nad `foodPortions` + čistý `planPortionChanges`
   (diff draftů proti DB) pro commit editoru potraviny.
4. **`components/ui/AmountPicker.tsx`** — controlled UI: pole na číslo + řízení jednotky. Vrací
   `AmountValue`; gramáž/kcal si dopočítá a zobrazí volající (liší se místo od místa).
5. Zapojení: **editor potraviny** (definice měr), **Kalorie** a **vaření** (náhrada + přidání).

Proč právě takhle: rozhodnutí OO2 zbavuje feature jakékoli datové stopy na surovině, takže těžiště
je v UI a v převodní logice. Tu je jediné rozumné vytáhnout do čisté funkce (CLAUDE.md: „výpočetní
logika má testy dřív než UI") a UI kolem ní zúžit na jednu komponentu, aby se g/ks + míry
nepsaly 4×. Obětoval jsem to, že si surovina míru nepamatuje (OO2) a že „ks" dostane jiný ovládací
prvek (Segmented místo cyklického tlačítka) — obojí je vědomé.

### `lib/amount.ts` — API a pravidla

```ts
export interface AmountUnitOption { id: string; kind: 'g' | 'ks' | 'portion'; label: string; gramsPerUnit: number }
export interface AmountValue { unitId: string; raw: string }          // raw = uživatelem psané číslo (smí být '' i s čárkou)
export interface AmountResult { amountG: number | null; amountKs: number | null }

export function unitOptionsForFood(food: Pick<Food,'pieceGrams'> | undefined, portions: FoodPortion[]): AmountUnitOption[]
export function resolveAmount(value: AmountValue, options: AmountUnitOption[]): AmountResult
export function convertAmountUnit(value: AmountValue, options: AmountUnitOption[], toUnitId: string): AmountValue
```

- `unitOptionsForFood`: vždy `g` (`gramsPerUnit 1`); je-li `pieceGrams`, přidá `ks`
  (`gramsPerUnit = pieceGrams`); za každou (nesmazanou) míru `{ kind:'portion', id: portion.id,
  label: portion.label, gramsPerUnit: portion.grams }`. Pořadí: g, ks, míry v pořadí uložení.
- `resolveAmount` (zdroj pravdy pro zápis; `n = parseDecimal(raw)`):
  - `g`: `amountG = n` (`0 → 0`, `'' → null`), `amountKs = null` — **byte-identické s dneškem**.
  - `ks`: `amountKs = n`; `amountG = (n != null && gramsPerUnit) ? n * gramsPerUnit : null` — **beze změny**.
  - `portion`: `amountG = (n != null && n > 0) ? n * gramsPerUnit : null`, `amountKs = null`.
    Nepočítá se pre-rounding → plná přesnost (pravidlo 9). `n <= 0 || '' → null` (AC C: počet 0/prázdno
    = nezapočítá se, „analogie prázdného množství").
- `convertAmountUnit` (zobecnění dnešního `toggleUnit`): spočte fyzické gramy z aktuální hodnoty a
  přepočte je do nové jednotky; `round2` **jen pro zobrazovaný počet**, ne pro `amountG`. Drift při
  ručním přepnutí předvyplněné hodnoty je stejný jako dnes u g↔ks.

**Proč `portion` nevrací `amountKs`:** tím se OO2 splní samo. Surovina zadaná přes míru má
`amountKs = null` → při znovuotevření se v pickeru odvodí jednotka `g` a ukáže gramáž (ne míra).
Žádná další logika není potřeba.

### `lib/portionMatch.ts` — auto-návrh z textu (OO5)

```ts
export interface PortionMatch { portionId: string; count: number }
export function matchPortionInText(rawText: string, portions: Pick<FoodPortion,'id'|'label'>[]): PortionMatch | null
```

- `parseLeadingQuantity(rawText)` (už existuje v `lib/scale.ts`, umí desetinné i zlomek „1/2") →
  `{ amount, rest }`; bez čísla → `null`.
- První slovo z `rest` normalizuje přes `normalizeForSearch` (z `lib/search.ts`) a porovná s
  normalizovanými `portion.label`: shoda = rovnost nebo prefix (kvůli skloňování „lžíce/lžíci/lžic").
  První shoda → `{ portionId, count: amount }`, jinak `null`.
- Čisté, read-only. Matching je **omezený na míry té konkrétní potraviny**, takže falešné shody
  nemůžou sáhnout mimo její vlastní názvy měr. Degradace: bez čísla / beze shody → `null` → volající
  spadne na dnešní gramový prefill nebo ruční výběr.

### `features/foods/foodPortionsRepo.ts`

```ts
export function listPortions(foodId: string): Promise<FoodPortion[]>          // filtruje deletedAt == null, řadí dle uložení
export function addPortion(foodId: string, label: string, grams: number): Promise<void>
export function updatePortion(id: string, patch: { label?: string; grams?: number }): Promise<void>
export function removePortion(id: string): Promise<void>                       // viz rozhodnutí delete níže

export interface PortionDraft { id?: string; label: string; grams: number | null }
export interface PortionPlan { add: { label: string; grams: number }[]; update: { id: string; label: string; grams: number }[]; remove: string[] }
export function planPortionChanges(existing: FoodPortion[], drafts: PortionDraft[]): PortionPlan   // ČISTÁ, testuje se
export function reconcilePortions(foodId: string, drafts: PortionDraft[]): Promise<void>           // spočte plán a zapíše v transakci
```

- `planPortionChanges` (čistá, otestovaná před UI):
  - validní draft = `label.trim() !== '' && grams != null && grams > 0` (OO7).
  - dedup po `normalizeForSearch(label)` — **první výskyt vyhrává**, další stejný název se zahodí
    (OO7, „poslední/existující vyhrává, nová se nepřidá"; stejný vzor jako dedup seedu v
    `seedFoods.ts`).
  - `add` = validní bez `id`; `update` = validní s `id`, kde se `label`/`grams` liší od `existing`;
    `remove` = `existing.id`, které mezi validními drafty s `id` nejsou (sem spadne i řádek, u
    kterého uživatel smazal název — tj. zneplatnil ho).
- `reconcilePortions` je jediný commit z editoru (viz níže). Píše v `db.transaction('rw', db.foodPortions, …)`.

**Rozhodnutí delete — soft vs. hard (explicitně otevírám, viz Rizika):**
Doporučuji **soft delete**: přidat na `FoodPortion` nepovinné `deletedAt?: IsoTimestamp | null`,
`remove`/`plan.remove` nastaví `deletedAt`, `listPortions` filtruje `deletedAt == null`.
Zdůvodnění: pravidlo 7 CLAUDE.md („nikdy nemaž natvrdo") je invariant kvůli vzkříšení při obnově;
`foodPortions` už dnes jsou v záloze a import je čistě aditivní `bulkPut` (viz `dbBackup.ts`), takže
natvrdo smazaná míra by se ze staršího exportu **vzkřísila** — přesně scénář, který pravidlo 7 řeší.
Soft delete drží konzistenci se všemi ostatními tabulkami (foods/recipes/logEntries).
Důležité: `deletedAt` je **neindexované pole → NEvyžaduje bump Dexie `version()`** (index
`foodPortions: 'id, foodId'` zůstává), filtruje se v paměti jako u `foods`. Záloha ho nese
transparentně (`asArray` cast v `backup.ts`), formát zálohy se nemění.

Napětí, které nechci skrýt: rozhodnutí OO2 říká „žádné nové pole v modelu" — to je ale mířeno na
`RecipeItem` (persistence vybrané míry), ne na lifecycle `FoodPortion`. Přesto jde o dotyk modelu.
Alternativa **hard delete** = nulová změna modelu, ale výše popsané vzkříšení přes obnovu zálohy a
první tabulka v appce, která maže natvrdo. **Tohle je jediné rozhodnutí, které bych si nechal
potvrdit** (viz Rizika). Zbytek návrhu je na volbě nezávislý (repo API stejné).

### `components/ui/AmountPicker.tsx`

```ts
export default function AmountPicker(props: {
  options: AmountUnitOption[];
  value: AmountValue;
  onChange: (next: AmountValue) => void;
  size?: 'sm' | 'md';
}): JSX.Element
```

- Vykreslí číselné pole (`inputMode="decimal"`, `value.raw`) + řízení jednotky:
  1 volba → statický text `g`; 2 volby → `Segmented`; ≥3 → kompaktní `<select>`.
- Změna čísla → `onChange({ ...value, raw })`. Změna jednotky → `onChange(convertAmountUnit(value, options, toId))`.
- **Nedrží** stav ani nezapisuje do DB a **nezobrazuje** kcal/gramy — dopočet a readout (kcal na
  Kalorie, „X g" štítek ve vaření) si dělá volající přes `resolveAmount(value, options)`, protože se
  místo od místa liší. Komponenta je čistě controlled prvek.

## Dopad na kód

Nové soubory:
- `src/lib/amount.ts` — jednotky + převod + `resolveAmount` (viz výše). Vzniká, aby se převodní
  logika (dnes inline v `RecipeNutritionScreen` a 2× v `CookingModeScreen`) sjednotila a otestovala.
- `src/lib/amount.test.ts` — g/ks/míra, prázdné, 0/záporné, desetinné, převod jednotky, přesnost.
- `src/lib/portionMatch.ts` — matcher pro OO5.
- `src/lib/portionMatch.test.ts` — shoda/skloňování/žádná shoda/bez čísla/žádné míry.
- `src/features/foods/foodPortionsRepo.ts` — CRUD + `planPortionChanges` + `reconcilePortions`.
- `src/features/foods/foodPortionsRepo.test.ts` — jen čistý `planPortionChanges` (add/update/remove,
  dedup, zahození nevalidních). Repo I/O se dle konvence projektu neunit-testuje (potřebuje IndexedDB).
- `src/components/ui/AmountPicker.tsx` — sdílený výběr množství.

Měněné soubory:
- `src/db/index.ts` — **jen při soft delete:** `FoodPortion.deletedAt?: IsoTimestamp | null`
  (bez bumpu `version()`).
- `src/features/foods/FoodEditScreen.tsx` — nová sekce „Domácí míry": seznam řádků `{label, grams}`
  s přidat/upravit/smazat, drží se v draft stavu (seed z `listPortions` při načtení existující
  potraviny), commit přes `reconcilePortions(foodId, drafts)` v `handleSave` **po** uložení
  potraviny. Nevalidní řádek uložení potraviny nezablokuje (AC A) — jen se v plánu zahodí.
- `src/features/recipes/RecipeNutritionScreen.tsx` — do liveQuery přidat `db.foodPortions.toArray()`
  a `portionsByFood` mapu (filtr `deletedAt`); nahradit inline `amount`/`unit` mapy jednou mapou
  `Record<itemId, AmountValue>`; vyměnit ruční pole + g/ks tlačítko za `<AmountPicker>`; `persistAmount`
  = `resolveAmount(value, options)` → `updateRecipeItemLink({ amountG, amountKs })`. V `linkFood`
  přidat OO5 návrh (viz Auto-návrh). Odstranit `toggleUnit`/`persistAmount` inline větev g/ks —
  nahradí je `lib/amount`.
- `src/features/recipes/CookingModeScreen.tsx` — totéž pro **náhradu** (`replAmount`/`replUnit`/
  `toggleReplUnit`) a **přidání** (`newItemAmount`/`newItemUnit`/`toggleAddUnit`): držet
  `AmountValue`, řízení přes `<AmountPicker>`, commit přes `resolveAmount` do `CookReplacement`
  resp. `addRecipeItem` linku. Přidat `foodPortions` do liveQuery + OO5 návrh při napojení potraviny.
  **Override „jiné množství pro dnešek" zůstává beze změny** (jen text, mimo kcal — OO4).

Vědomě beze změny:
- `src/features/foods/QuickFoodForm.tsx` — míry nedefinuje (mimo rozsah).
- `src/features/nutrition/recipeNutrition.ts` a `src/lib/nutrition.ts` — počítají z `amountG`; míry
  produkují jen `amountG`. **Nulová změna** — to je hlavní síla OO2.
- `src/db` model `RecipeItem`, `CookReplacement`, `CookLog` — žádné nové pole (OO2).
- `src/features/backup/dbBackup.ts`, `src/lib/backup.ts` — `foodPortions` už zálohuje; případné
  `deletedAt` nese `FoodPortion[]` transparentně, formát se nemění.

## Změny datového modelu

- `FoodPortion` = `{ id, foodId, label, grams }` **beze změny** při hard delete; při soft delete
  navíc `deletedAt?: IsoTimestamp | null`. Dexie schéma `foodPortions: 'id, foodId'` se nemění, žádný
  `version()` bump (pole je neindexované).
- `RecipeItem`, `CookReplacement`, `CookLog`, `Recipe`, `Food` — **beze změny**.
- Žádná migrace existujících dat. Míra ukládá jen `amountG` do už existujícího pole.

## Plán implementace

Pořadí je zdola nahoru: čisté funkce s testy dřív než UI (CLAUDE.md). Po každém kroku appka běží
(`npm run dev`) a projde `npm run lint` + `npm run test`.

1. **`lib/amount.ts` + `lib/amount.test.ts`.** `unitOptionsForFood`, `resolveAmount`,
   `convertAmountUnit`. Nikde nezapojeno.
   *Hotovo když:* testy pokrývají g/ks/míra, prázdné, 0/záporné, desetinné, převod jednotky se
   zachováním gramů, a `resolveAmount` pro `g`/`ks` dává stejné výstupy jako dnešní inline větve;
   `npm test` zelené.

2. **`foodPortionsRepo.ts` + test `planPortionChanges`.** CRUD (`listPortions`/`addPortion`/
   `updatePortion`/`removePortion`), `planPortionChanges` (čistá), `reconcilePortions`. Zvolit
   soft/hard delete (default soft → přidat `FoodPortion.deletedAt?` do `db/index.ts`).
   *Hotovo když:* `planPortionChanges` testy (add/update/remove, dedup case-insensitive, zahození
   nevalidních) zelené; `npm run lint` (tsc) projde.

3. **`FoodEditScreen.tsx` — sekce „Domácí míry".** Seed draftů z `listPortions` při načtení
   existující potraviny; přidat/upravit/smazat řádky ve stavu; `handleSave` po uložení potraviny
   zavolá `reconcilePortions(foodId, drafts)`. Validace dle OO7 neblokuje uložení potraviny.
   *Hotovo když:* AC A projde ručně — přidám „lžíce = 15", uložím, znovu otevřu, míra tam je;
   nevalidní řádek se neuloží, ale potravinu nezablokuje; smazaná míra zmizí. Míry teď reálně
   existují jako testovací data pro další kroky.

4. **`components/ui/AmountPicker.tsx`.** Controlled prvek (číslo + řízení jednotky dle počtu voleb).
   *Hotovo když:* vykreslí se se statickým „g" pro 1 volbu, `Segmented` pro 2, `<select>` pro ≥3;
   `npm run lint` projde. (Vizuálně ověřitelné až v kroku 5.)

5. **`lib/portionMatch.ts` + test.** `matchPortionInText` nad `parseLeadingQuantity` + `normalizeForSearch`.
   *Hotovo když:* testy „2 lžíce oleje"→(lžíce,2), skloňování, žádná shoda, bez čísla, prázdné míry;
   `npm test` zelené.

6. **Zapojit `RecipeNutritionScreen.tsx`.** liveQuery + `portionsByFood`; `AmountValue` mapa;
   `<AmountPicker>` místo inline pole/tlačítka; `persistAmount` přes `resolveAmount`; v `linkFood`
   OO5 návrh: nejdřív `matchPortionInText(rawText, portionsOfFood)` → předvyplnit
   `{ unitId: portionId, raw: count }`; jinak dnešní gramový prefill; jinak prázdno.
   *Hotovo když:* AC B/C/D ručně — potravina bez měr se chová přesně jako dnes (g, i g/ks u
   `pieceGrams`); potravina s mírou nabídne míru, „2 lžíce" → 30 g → kcal v souhrnu; `raw_text` se
   nemění; prázdný/0 počet nezapočítá.

7. **Zapojit `CookingModeScreen.tsx`** (náhrada + přidání). Stejný pattern na obou draft místech +
   OO5 návrh při napojení potraviny. Override beze změny.
   *Hotovo když:* AC E ručně — náhrada i přidání s mírou dopočtou stejně jako Kalorie; dokončení
   vaření uloží snapshot (`perPortion` z `amountG`), pozdější změna míry snapshot nezmění; dnešní
   g/ks náhrada/přidání beze změny. Finální `npm run lint` + `npm run test`.

## Rizika a co může selhat

- **Regrese dnešního g/ks (nejvyšší priorita).** Mitigace: `resolveAmount` je pro `g`/`ks` navržená
  byte-identicky s dnešními inline větvemi a je pokrytá testy dřív, než se přepojí UI; tři místa
  spadnou na jednu otestovanou cestu. Ruční ověření v krocích 6–7 explicitně kontroluje potravinu
  bez měr a s `pieceGrams`.
- **Delete semantika (rule 7 vs. OO2 „bez nového pole").** Otevřený bod k potvrzení: soft delete
  (doporučeno, +`deletedAt`, bez bumpu, konzistentní, brání vzkříšení přes zálohu) vs. hard delete
  (nulová změna modelu, ale první natvrdo mazající tabulka + vzkříšení přes aditivní import zálohy).
  Repo API je na volbě nezávislé.
- **Vizuální změna „ks" (Segmented místo cyklického tlačítka).** Funkčně identické, Segmented je už
  standard projektu (g/ml). Flaguju jako vědomé; fallback je zachovat cyklické tlačítko pro přesně
  g/ks a `<select>` jen při ≥1 míře.
- **Přesnost (pravidlo 9).** `amountG` se drží plná (`count * grams` bez pre-roundingu), zaokrouhluje
  se až v `NutritionSummary`. `round2` je jen na zobrazovaném počtu při ručním přepnutí jednotky —
  do `amountG` nevstupuje. Riziko drift při přepnutí předvyplněné hodnoty je stejné jako dnes u g↔ks.
- **Snapshot historie (pravidlo 5).** Nedotčeno: `CookLog.perPortion` se počítá z `amountG` při
  dokončení; míry žádnou další stopu nenechávají. Test v kroku 7 to ověří.
- **Nový záznam se stejným názvem míry (OO7 dedup).** Řeší `planPortionChanges` (první vyhrává);
  pokryto testem. Case-insensitive přes `normalizeForSearch` (i diakritika).
- **Nová potravina + míry před prvním uložením.** Míry se commitují až po `createFood` (potřebují
  `foodId`). Když `handleSave` spadne na validaci (název/energie), necommitne se nic a drafty
  zůstanou ve formuláři — konzistentní, nic se neztratí.

## Co tento návrh vědomě neřeší

- Perzistenci vybrané míry na surovině (OO2 — po reloadu se ukáže gramáž, ne „2 lžíce").
- Živý přepočet surovin při změně/smazání míry (OO3 — bezpředmětné, drží se gramáž).
- Definici měr v `QuickFoodForm` (mimo rozsah — jen název + energie + g/ml).
- Převod ml↔g / hustoty (OO6 — míra je přímý pojmenovaný převod, `energyKcal * grams / 100`).
- Přepis `raw_text` podle míry, globální číselníky měr, škálování porcí přes míru (Mimo rozsah spec).
- Deník (fáze 3).
- Definitivní volbu soft vs. hard delete `FoodPortion` — doporučeno soft, ale otevřeno k potvrzení.

## Finální rozhodnutí (schváleno 2026-09-02) — má přednost před variantami výše

Po revizi s uživatelem a user-advocate. Developer staví na tomhle; kde se to liší od textu výše,
platí tohle.

1. **Řízení jednotky = rozbalovací `<select>`, ale bez regrese g/ks.** Když potravina **nemá žádnou
   míru**, `AmountPicker` vykreslí **dnešní ovládání g/ks beze změny** (přesně jako teď, nulová
   vizuální regrese na horké cestě). Jakmile má **≥1 míru**, jednotka je kompaktní `<select>`
   (g / ks je-li `pieceGrams` / každá míra). Tím padá mezistupeň „2 volby → Segmented" z varianty C —
   Segmented se pro tohle nepoužije. „ks" tak zůstane cyklické tlačítko na potravinách bez měr
   (řeší i risk „vizuální změna ks").

2. **Inline „+ míra" u suroviny (nový rozsah oproti plánu).** Míru půjde založit i **přímo z řádku
   suroviny** na obrazovce Kalorie i ve vaření — ne jen v editoru potraviny. Když je surovina
   napojená na potravinu, u `AmountPicker` bude drobné **„+ míra"**, které rozbalí mini-formulář
   `název + gramy`, uloží přes `addPortion(foodId, label, grams)` a **hned tu míru vybere**. Řeší
   hlavní výtku zákazníka (u jednorázovky nechci odskakovat do editoru potraviny a ztratit místo).
   Validace stejná jako v editoru (OO7); prázdné/nevalidní se neuloží, nic se nerozbije. Bez napojené
   potraviny se „+ míra" nenabízí (není kam ji uložit).

3. **Odvození jednotky při otevření = must-fix „vidět původ čísla" (sjednoceno s OO5).** Přidej čistou
   funkci `deriveInitialAmountValue(item, food, portions)`:
   - `amountKs != null` → jednotka `ks` (dnešní chování).
   - jinak `amountG != null` a `matchPortionInText(raw_text, portions)` vrátí míru P a `amountG` sedí
     na `count × P.grams` (tolerance na zaokrouhlení) → jednotka = **P**, počet = `count`.
     → po znovuotevření se ukáže „2 lžíce", ne holých „30 g" (řeší hlavní vroubek zákazníka), a je to
     **stejný matcher** jako auto-návrh z textu (OO5) — jen se pustí i při otevření, ne jen při napojení.
   - jinak → jednotka `g`, počet = `amountG`.
   Gate na shodu s `raw_text` drží false-positive nízko (nevybere „lžíce" u čísla, které z textu
   nevyplývá). Úložiště zůstává **jen gramáž** (OO2 platí) — tohle je čistě odvození pro zobrazení/edit.
   Readout u pickeru vždy ukáže dopočtenou gramáž (a kcal na Kalorie), takže i při ruční jednotce `g`
   je vidět výsledek. **Prefill z textu je viditelný** (míra + počet jsou vidět v pickeru, jdou změnit),
   ne tichý — a matcher je omezený na míry té potraviny, takže „2 stroužky" nevybere „lžíci".

4. **Pojistka proti překlepu (must-fix, neblokuje).** V editoru potraviny i v inline „+ míra": když je
   gramáž míry nápadně velká (práh > 500 g na 1 míru), zobraz **jemné varování** („150 g na míru, fakt?"),
   ale **uložení nezablokuj**. Jen pošťouchnutí.

5. **Přednabídnuté názvy měr (nice-to-have).** Pole názvu míry dostane `<datalist>` s běžnými názvy:
   `lžíce, lžička, hrnek, plátek, špetka, hrst, kus, sklenice, konzerva, balení`. Gramáž si uživatel
   doplní sám (je u každé potraviny jiná).

6. **Soft delete `FoodPortion` — potvrzeno.** Přidat nepovinné `deletedAt?: IsoTimestamp | null`
   (bez bumpu `version()`), `listPortions`/mapy filtrují `deletedAt == null`. Pravidlo 7.

Beze změny zůstává: OO2 (ukládá se jen gramáž), žádná migrace indexu/formátu zálohy, žádná nová
závislost, `QuickFoodForm` bez měr, nutriční výpočet, model surovin, override „jiné množství pro dnešek".
