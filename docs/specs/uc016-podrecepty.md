# UC016 — Podrecepty (recept jako surovina)

Vazba: R-17 (podrecepty), E-03 (cyklická reference receptů), SPEC 7.5 a pseudokód „Pseudokód
s podrecepty", R-12 (napojení suroviny + gramáž), R-31 (přiznání úplnosti). Formálně fáze 2
(nutriční nadstavba). Pravidla CLAUDE.md: 1 (surovina = volný text), 2 (`raw_text` se
nepřepisuje), 3 (recept jde uložit jen s názvem), 4 (kalorie se nepředstírají), 9 (interně
gramy a plná přesnost), 10 (hodnoty na 100 g z `cooked_weight_g ?? součet surovin`).

## Kontext

Některé stavební kameny vařím dokola — bešamel, vývar, těsto, náplň. Dnes je musím u každého
receptu buď rozepsat na jednotlivé potraviny znovu, nebo je vzdát a kalorie z nich nezapočítat.
Cílem je napojit surovinu nadřazeného receptu na **jiný recept** (místo na potravinu) a nechat
kalorie podreceptu **protéct** do součtu nadřazeného — normalizované na 100 g finální hmotnosti
podreceptu a přepočtené podle toho, kolik gramů podreceptu do receptu jde.

Napojení na podrecept je, stejně jako napojení potraviny, **nepovinné**. Bez něj zůstává dnešní
tok beze změny.

### Zjištěný stav v kódu (ověřeno k dnešku)

- **Model už to umí bez migrace.** `RecipeItem.subRecipeId?: string | null` v `src/db/index.ts`
  existuje, je nullable a indexované (`recipeItems: 'id, recipeId, foodId, subRecipeId, sortOrder'`).
  `subRecipeId` je součást zálohy/obnovy (`dbBackup.ts` čte i zapisuje `recipeItems`).
- **Výpočet podrecepty umí.** `recipeTotals` v `src/lib/nutrition.ts` u položky s `subRecipeId`
  rekurzivně spočítá podrecept, normalizuje ho na 100 g **jeho** finální hmotnosti
  (`cookedWeightG ?? součet gramáží napojených surovin`) a přepočte podle `amountG` položky.
  `foodId` má přednost: když jsou na položce oba, `subRecipeId` se ignoruje.
- **Detekce cyklu existuje (E-03).** `recipeTotals` drží `visited` set a při opakovaném receptu
  vyhodí chybu místo zacyklení. `nutritionFromData` (`src/features/nutrition/recipeNutrition.ts`)
  chybu chytí a vrátí `hasCycle: true`; `NutritionSummary` zobrazí „Recept obsahuje sám sebe –
  hodnoty nelze spočítat." a žádné číslo.
- **CHYBÍ (náplň tohoto UC):**
  1. `updateRecipeItemLink` (`src/features/recipes/recipesRepo.ts`) dnes bere jen
     `{ foodId, amountG, amountKs, isSkipped }` — **ne `subRecipeId`**.
  2. UI napojení: obrazovka „Kalorie" (`RecipeNutritionScreen.tsx`) umí napojit jen potravinu
     (`FoodPicker`). Chybí volba „napojit podrecept" a **výběr receptu** (obdoba `FoodPickeru`;
     `RecipePicker` zatím neexistuje). Řádek s `subRecipeId` se dnes vykreslí jako **nenapojený**
     (kód testuje jen `item.foodId`), takže nabízí „napojit potravinu".
  3. Zobrazení příspěvku podreceptu na řádku (dnes se počítá `contribution` jen pro `foodId`)
     a rozlišení podreceptu v souhrnu.
- **Pozor — úplnost dnes podrecept bez surovin přepočítává špatně.** `completeness()`
  (`src/lib/nutrition.ts`) není rekurzivní a bere `subRecipeId != null && amountG != null` jako
  **napojenou** položku bez ohledu na to, jestli podrecept vůbec něčím přispěje. `recipeTotals`
  přitom takový prázdný podrecept do součtu **nezapočítá** (`if (!sub.computable) continue`).
  Výsledek: „X z Y surovin" může tvrdit „úplné", i když podrecept nedal nic (rozpor s pravidlem 4).
  Náprava spadá do tohoto UC (viz AK C) — přesný způsob nechávám na architektovi.
- **Pozor — rozbité napojení se dnes hlásí jako cyklus.** `nutritionFromData` chytá v `catch`
  jakoukoliv chybu a vrací `hasCycle: true`. Neznámý/rozbitý `subRecipeId` (`toCalc` vyhodí
  „Neznámý recept") tak skončí zprávou „Recept obsahuje sám sebe". Viz Otevřená otázka 7.

## User stories

- Jako uživatel chci u suroviny napojit místo potraviny **jiný recept** (např. „domácí
  bešamel"), abych stavební kameny nemusel rozepisovat do každého receptu znovu.
- Jako uživatel chci, aby se kalorie podreceptu **protekly** do nadřazeného receptu podle
  toho, kolik gramů podreceptu použiju, abych viděl reálný součet i na porci a na 100 g.
- Jako uživatel chci, aby appka **bezpečně ošetřila cyklus** (recept sám sebe, nebo dva
  navzájem), aby výpočet nespadl a jasně mi řekl, že to spočítat nejde.
- Jako uživatel chci, aby napojení podreceptu **nikdy nepřepsalo** text suroviny a nebylo
  povinné — bez napojení zůstává dnešní tok beze změny.
- Jako uživatel chci vidět **příspěvek podreceptu** přímo na řádku suroviny i v souhrnu
  a umět ho zase **odpojit**.

## Akceptační kritéria

### A. Napojení suroviny na podrecept

- [ ] Given surovina bez napojení na obrazovce Kalorie, When zvolím „napojit podrecept" a vyberu
  recept, Then se na položce uloží `subRecipeId` a řádek se zobrazí jako napojený na podrecept
  (jeho název, výběr množství, příspěvek), ne jako nenapojená surovina.
- [ ] Given výběr podreceptu (picker), Then se **nenabízí aktuální recept** (nejde napojit sám
  na sebe) a nabízí se jen nesmazané recepty (`deletedAt == null`).
- [ ] Given surovina už napojená na potravinu, When ji napojím na podrecept, Then se `foodId`
  (a `amountKs`) zruší a aktivní zůstane jen `subRecipeId` — potravina a podrecept se na téže
  surovině **vylučují** (nikdy nejsou aktivní obě).
- [ ] Given napojení podreceptu, Then se `raw_text` suroviny **nezmění ani o písmeno**
  (pravidlo 2) a napojení jde kdykoliv provést i zrušit — uložení receptu to nikdy neblokuje
  (pravidla 1, 3).
- [ ] Given výběr podreceptu otevřený, When ho zavřu bez volby, Then se na surovině nic nezmění.

### B. Protečení kalorií a gramáž podreceptu

- [ ] Given surovina napojená na podrecept a zadaná gramáž (např. „200 g bešamelu"), Then se
  do součtu nadřazeného receptu započítá `hodnoty_podreceptu_na_100g × 200 / 100`, kde
  `hodnoty_podreceptu_na_100g = celkem_podreceptu / finální_hmotnost_podreceptu × 100`
  a `finální_hmotnost = cookedWeightG ?? součet gramáží napojených surovin podreceptu`
  (SPEC 7.5, pravidlo 10).
- [ ] Given napojený podrecept, Then se množství zadává **v gramech** (kolik gramů podreceptu
  jde do nadřazeného); „ks" ani domácí míry se u podreceptu nenabízejí (PŘEDPOKLAD, viz OO1).
- [ ] Given podrecept napojený **bez zadané gramáže** (`amountG == null`), Then se do kalorií
  nezapočítá a počítá se jako **nenapojený** v úplnosti (obdoba potraviny bez gramáže).
- [ ] Given hluboké zanoření (recept → podrecept → pod-podrecept), Then se hodnoty spočítají
  rekurzivně přes všechny úrovně (`recipeTotals` s předávaným `visited`).
- [ ] Given gramáž podreceptu, Then se interně drží plná přesnost a zaokrouhluje se **až
  v zobrazení** (pravidlo 9).

### C. Podrecept bez napojených surovin (pravidlo 4)

- [ ] Given surovina napojená na podrecept, který **nemá ani jednu napojenou surovinu**
  (není `computable`), Then podrecept do kalorií **nepřispěje** a položka se počítá jako
  **nenapojená** v úplnosti nadřazeného receptu — sníží poměr „X z Y" a případně vyvolá
  varování „Orientační" (dnešní `completeness()` ji chybně počítá jako napojenou; sjednotit
  s tím, co `recipeTotals` reálně započítá).
- [ ] Given podrecept napojený jen **částečně** (např. 3 z 5 svých surovin), Then přispěje
  hodnotami spočítanými **jen z jeho napojených surovin** (nepředstírá chybějící, pravidlo 4).
  Zda se částečnost podreceptu propíše do úplnosti nadřazeného receptu, řeší Otevřená otázka 3.

### D. Cyklus (recept sám na sebe / vzájemně)

- [ ] Given recept, který by odkazoval sám na sebe, When počítám kalorie, Then výpočet
  **nespadne**, `hasCycle == true` a souhrn zobrazí „Recept obsahuje sám sebe – hodnoty nelze
  spočítat." bez jakéhokoliv čísla (E-03).
- [ ] Given vzájemný cyklus (A → B → A), When počítám kterýkoliv z nich, Then se chová stejně
  jako přímý cyklus (`visited` set to zachytí), bez pádu.
- [ ] Given cyklus kdekoliv v řetězci, Then je **celý** nadřazený recept nespočitatelný (i jeho
  jinak platné potraviny se nezobrazí) — je to bezpečnostní stav, ne částečný výpočet.
- [ ] Given picker podreceptů, Then se aktuální recept nenabízí (viz AK A); prevence
  **tranzitivních** cyklů v pickeru řeší Otevřená otázka 2 — bezpečnostní síť výpočtu (E-03)
  platí tak jako tak.

### E. Zobrazení na řádku i v souhrnu

- [ ] Given surovina napojená na `computable` podrecept se zadanou gramáží, Then řádek ukáže
  název podreceptu (např. „→ domácí bešamel"), zadanou gramáž a **příspěvek v kcal** (obdoba
  řádku s potravinou).
- [ ] Given položky s podrecepty, Then souhrn (Celkem / na porci / na 100 g) zahrne protečené
  kalorie a ukazatel úplnosti „X z Y" odpovídá tomu, co se reálně započítalo (R-31).
- [ ] Given napojený podrecept, který není `computable` (bez surovin), Then řádek dá najevo,
  že nepřispívá kaloriemi (např. bez čísla / náznak „bez kalorií"), a promítne se do úplnosti
  podle AK C.
- [ ] Given souhrn se zobrazuje i na detailu receptu (`RecipeDetailScreen`), Then tam podrecepty
  protékají stejně jako na obrazovce Kalorie (stejná funkce `nutritionFromData`).

### F. Odpojení

- [ ] Given surovina napojená na podrecept, When dám „odpojit", Then se `subRecipeId`,
  `amountG` (i `amountKs`) vynulují, `raw_text` zůstane beze změny a příspěvek zmizí ze součtu
  i z úplnosti.

### G. Nepovinnost a chování beze změny

- [ ] Given recept bez jediného napojeného podreceptu, Then se celý dnešní tok (napojení
  potraviny, g/ks/míry, souhrn) chová **beze změny** (žádná regrese na Kaloriích ani na detailu).
- [ ] Given nová surovina zapsaná v úpravě receptu, Then vzniká s `subRecipeId = null`
  a napojení podreceptu je čistě opt-in krok na Kaloriích (jediné povinné pole je `raw_text`).

## Okrajové případy a chybové stavy

| Situace | Očekávané chování |
|---|---|
| Recept odkazuje sám na sebe | `hasCycle`, hláška „obsahuje sám sebe", žádné číslo, nespadne (E-03) |
| Vzájemný cyklus A ↔ B | Totéž jako přímý cyklus (`visited` set) |
| Cyklus hluboko v řetězci (A→B→C→A) | Celý nadřazený recept nespočitatelný, bez pádu |
| Podrecept bez napojených surovin | Nepřispěje, počítá se jako nenapojený → sníží úplnost (AK C) |
| Podrecept napojený bez gramáže (`amountG == null`) | Nepočítá se, je nenapojený v úplnosti |
| Na téže surovině `foodId` i `subRecipeId` | UI je vylučuje; kdyby v datech byly obě, `foodId` vyhrává (dnešní výpočet) |
| Podrecept napojený jen částečně (3 z 5) | Přispěje jen ze svých napojených surovin (pravidlo 4); propagace úplnosti → OO3 |
| Napojený podrecept se soft-smaže (`deletedAt`) | Viz OO5 (dnes se dál počítá — `recipeMap` obsahuje i smazané) |
| Rozbitý/neznámý `subRecipeId` | Nesmí spadnout; dnes se mylně hlásí jako cyklus (OO7) |
| Podrecept s nulovou finální hmotností (součet gramáží = 0, bez `cookedWeightG`) | Dělení nulou → Infinity/NaN; ošetřit (nepovažovat za `computable`/nepočítat) |
| Počet porcí podreceptu nezadaný | Nevadí — tok je po hmotnosti (100 g), ne po porcích |
| Odpojení podreceptu | `subRecipeId`/`amountG`/`amountKs` = null, `raw_text` zůstává, kcal zmizí |
| Offline | Napojení, výpočet i výběr fungují plně lokálně (Dexie), bez sítě |
| Export / import zálohy | `subRecipeId` je v `recipeItems`, přenáší se stávající zálohou (`dbBackup.ts`) |

## Mimo rozsah

- **Migrace databáze.** `subRecipeId` v modelu i v záloze už je; UC nepřidává sloupce ani tabulky.
- **Nová závislost.** Řeší se stávajícím stackem (Dexie, React, čistý nutriční modul).
- **Automatický přepis `raw_text`** názvem podreceptu (odporuje pravidlu 2).
- **Automatické/tiché napojení podreceptu** bez potvrzení. (Návrh napojení podreceptu z textu
  — obdoba `suggestFood` — je nanejvýš pozdější rozšíření, ne náplň tohoto UC.)
- **Inline zakládání nového receptu** z pickeru podreceptů (na rozdíl od `QuickFoodForm`
  u potravin) — vybírá se z existujících receptů.
- **Deník / zápis do deníku (fáze 3).** Snapshot z receptu s podrecepty je jiný tok a řeší se
  zvlášť (výpočet přes `recipeTotals` už podrecepty umí, ale UI deníku sem nepatří).
- **Napojení podreceptu při vaření** (náhrada / přidání suroviny) — viz Otevřená otázka 6
  (`CookReplacement` dnes zná jen `foodId`).

## Předpoklady

- **PŘEDPOKLAD:** Množství podreceptu se zadává **v gramech** (kolik gramů podreceptu jde do
  nadřazeného) a ukládá do stávajícího `amountG`. Žádné nové pole, žádná migrace. „Porce
  podreceptu" ani „podíl / celý recept" jako jednotka **nejsou** (viz OO1).
- **PŘEDPOKLAD:** Potravina a podrecept se na jedné surovině **vylučují** — napojení jednoho
  zruší druhé; nikdy nejsou aktivní obě. (Kopíruje výpočet, kde `foodId` má přednost.)
- **PŘEDPOKLAD:** V pickeru podreceptů se **aktuální recept nenabízí** (self-exclusion).
  Hlubší (tranzitivní) cykly nechává picker na bezpečnostní síti výpočtu (`hasCycle`) — pokud
  OO2 nerozhodne jinak.
- **PŘEDPOKLAD:** Napojení podreceptu se dělá na obrazovce **Kalorie** (jako napojení potraviny),
  přes nový `RecipePicker` analogický `FoodPickeru`; „ks" ani domácí míry se u podreceptu
  nenabízejí.
- **PŘEDPOKLAD:** Prázdný podrecept (bez napojených surovin) se v úplnosti nadřazeného receptu
  počítá jako **nenapojený** (pravidlo 4). To vyžaduje narovnat dnešní `completeness()`, která
  ho počítá jako napojený; přesný způsob je na architektovi.
- **PŘEDPOKLAD:** `RecipePicker` nabízí jen **nesmazané** recepty, řazené podle názvu (jako
  `FoodPicker`); bez inline zakládání receptu.
- **PŘEDPOKLAD:** Interně gramy a plná přesnost (pravidlo 9), zaokrouhlení až v zobrazení.
- **PŘEDPOKLAD:** Jde o jednu PWA (jedno rozhraní) — „napojení podreceptu" žije na Kaloriích
  a na detailu se souhrn jen zobrazuje (vaření viz OO6).
- **PŘEDPOKLAD:** UI texty a prázdné stavy budou věcné a stručné (lean, česky).

## Otevřené otázky

1. **Jednotka množství podreceptu.** Stačí gramy, nebo chceš u podreceptu i jednotku
   **„porce"** (1 porce = `finálníHmotnost / servings`) či **„celý recept"**? To by znamenalo
   rozšířit `unitOptionsForFood`/výběr množství o variantu „podrecept" (dnes umí jen potravinu).
2. **Prevence cyklů v pickeru.** Má stačit vyloučit sebe sama a spolehnout se na výpočet
   (`hasCycle`), nebo má picker **aktivně skrývat/blokovat** recepty, které by vytvořily
   tranzitivní cyklus (A → B → A)?
3. **Propagace neúplnosti podreceptu nahoru.** Má **částečně** napojený podrecept (3 z 5)
   snižovat úplnost **nadřazeného** receptu (rekurzivně), nebo se nahoře řeší jen
   „napojen / nenapojen" a částečnost uvnitř podreceptu se neprojeví? (Dnes se neprojeví.)
4. **Co ukázat u receptu v pickeru.** Zobrazovat u nabízeného receptu jeho **kcal / 100 g**
   (a označit „bez kalorií", když není `computable`), aby bylo dopředu jasné, co poteče?
5. **Soft-smazaný napojený podrecept.** Když se napojený podrecept smaže (`deletedAt`), má se
   v nadřazeném brát jako **rozbité napojení** (nepočítat, snížit úplnost), nebo se dál počítat
   z jeho posledních hodnot? (Dnes se počítá dál — `recipeMap` obsahuje i smazané.)
6. **Platí to i pro vaření?** Má jít napojit podrecept i při **náhradě / přidání suroviny**
   v režimu vaření (jako UC017 rozšířil míry do vaření), nebo zatím jen na obrazovce Kalorie?
   (`CookReplacement` dnes zná jen `foodId`.)
7. **Rozlišit „rozbité napojení" od „cyklu".** Dnes obojí spadne do jedné hlášky „Recept
   obsahuje sám sebe". Má se rozbitý/neznámý `subRecipeId` hlásit jinak (a snížit úplnost),
   nebo to necháme jako dnes?
8. **UX napojení: dvě tlačítka vs. jeden picker.** Má u nenapojené suroviny být „napojit
   potravinu" i „napojit podrecept" jako dvě volby, nebo jeden sjednocený výběr
   „napojit (potravina / recept)"?

## Rozhodnutí (uzavřené otázky) — platí pro návrh i implementaci

Rozhodnuto uživatelem 2026-09-06. Downstream (architekt, developer) staví na tomhle.

1. **OO1 — množství podreceptu = GRAMY** do stávajícího `amountG`. Žádná jednotka „porce"
   ani „celý recept", žádné nové pole, žádná migrace. (Do budoucna klidně rozšíření.)
2. **OO8 — JEDEN sjednocený výběr.** U nenapojené suroviny je jedno napojení „potravina /
   recept" — picker s přepínačem (potraviny vs. recepty), ne dvě samostatná tlačítka. Vrací
   buď `foodId`, nebo `subRecipeId`. (Návrh komponenty na architektovi — rozšířit `FoodPicker`,
   nebo nový sdílený `LinkPicker`.)
3. **OO6 — platí i pro VAŘENÍ.** Podrecept jde napojit i při náhradě a přidání suroviny
   (jako UC017 rozšířil míry). `CookReplacement` dostane nepovinné `subRecipeId` (vnořený typ,
   bez migrace); `applyReplacements` a přidání suroviny ve vaření ho musí umět. Override „jiné
   množství pro dnešek" zůstává jen text.
4. **OO2 — cykly: jen self-exclude + síť výpočtu.** Picker nenabízí aktuální recept; hlubší
   (tranzitivní) cykly řeší bezpečnostní síť `hasCycle` (E-03), picker je aktivně nehlídá.
5. **OO3 — neúplnost:** narovnat `completeness()` tak, aby **nespočitatelný podrecept** (bez
   napojených surovin) nebyl počítán jako napojený (pravidlo 4). **Částečně** napojený
   podrecept (3/5) se nahoru rekurzivně **nepropaguje** (nadřazený ho bere jako napojený;
   jeho vlastní částečnost je vidět v jeho souhrnu). Způsob narovnání na architektovi.
6. **OO4 — picker ukáže `kcal / 100 g`** u spočitatelných receptů, u nespočitatelných „bez
   kalorií". Jen nesmazané recepty, řazené dle názvu.
7. **OO5 + OO7 — rozbité/neznámé/soft-smazané napojení = nenapojená položka, ne cyklus.**
   Rozliš „neznámý/smazaný podrecept" od skutečného cyklu: rozbité napojení výpočet neshodí,
   položka se počítá jako nenapojená (sníží úplnost), a hláška „obsahuje sám sebe" se nechá
   **jen** pro reálný cyklus. Soft-smazaný podrecept (`deletedAt`) se bere jako rozbité napojení
   (nepočítá se) — konzistence s pravidlem 7. Způsob (upravit `nutritionFromData`/zdroj) na architektovi.
8. **Nulová finální hmotnost podreceptu** (součet gramáží = 0, bez `cookedWeightG`) → podrecept
   není `computable` (žádné dělení nulou), chová se jako prázdný (bod 5).

Beze změny: model `RecipeItem`/schéma (jen se začne používat `subRecipeId`), nutriční jádro
(`recipeTotals` už podrecepty i cykly umí), žádná nová závislost, lean české UI.
