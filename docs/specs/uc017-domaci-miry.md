# UC017 — Domácí míry → gramy

Vazba: F-06 (vlastní míry u potraviny „1 lžíce = 14 g"), E-04 (kusy/míry → `food_portions`,
interně vždy gramy), R-12 (napojení suroviny + gramáž), SPEC 6.6 a 7.5. Formálně fáze 2
(nutriční nadstavba). Pravidla CLAUDE.md: 1 (surovina = volný text), 2 (`raw_text` se
nepřepisuje), 3 (recept jde uložit jen s názvem), 4 (kalorie se nepředstírají), 5 (historie
je snapshot), 9 (interně gramy a plná přesnost).

## Kontext

Největší tření při počítání kalorií u běžných receptů je ruční převod „domácích" množství
na gramy. Dnes musí uživatel u suroviny „2 lžíce oleje" sám přepsat množství na gramy, jinak
se kcal nespočítají (nutriční výpočet je čistě gramový). Cílem je nechat u potraviny
nadefinovat běžné míry („1 lžíce" = 15 g, „1 hrnek" = 250 g, „1 plátek" = 20 g) a u suroviny
pak vybrat míru + počet (např. „2 lžíce"), z čehož se dopočítá gramáž (30 g) i kalorie.

Míry jsou **nepovinné**. Bez nich zůstává dnešní zadání v g/ks beze změny.

### Zjištěný stav v kódu (ověřeno k dnešku)

- Tabulka `foodPortions` v Dexie schématu **existuje** (`src/db/index.ts`):
  `interface FoodPortion { id: string; foodId: string; label: string; grams: number }`,
  registrovaná jako `foodPortions: 'id, foodId'`. Je zapojená do zálohy/obnovy
  (`src/features/backup/dbBackup.ts` ji čte i zapisuje přes `bulkPut`).
- **Jinak se nikde nepoužívá** — žádná repo vrstva, žádné UI, žádný výpočet.
- Potravina má dnes `pieceGrams?: number | null` (hmotnost 1 kusu → jednotka „ks"). Míry jsou
  jeho zobecnění (víc pojmenovaných měr na potravinu). Definuje se v editoru potraviny
  (`FoodEditScreen.tsx`), který má dnes jen pole „Hmotnost 1 kusu (g)".
- Surovina (`RecipeItem`) má `amountG` (zdroj pravdy pro kcal) a `amountKs` (jen když je
  jednotka „ks"; gramáž se z něj dopočítá `amountKs * pieceGrams`). **Pole pro „vybranou míru
  a počet" v modelu není** (viz Otevřená otázka 2).
- Napojení + zadání množství: obrazovka „Kalorie" (`RecipeNutritionScreen.tsx`) — přepínač
  g/ks + pole na množství. Vaření (`CookingModeScreen.tsx`) má stejný pattern na **třech**
  místech: náhrada suroviny, přidání suroviny, a override „jiné množství pro dnešek" (ten je
  jen text, do kcal nevstupuje).
- Nutriční výpočet je gramový a `basis`-agnostický: `energyKcal * amountG / 100` (nerozlišuje
  g vs ml). Viz Okrajové případy a Otevřená otázka 6.

## User stories

- Jako uživatel chci u potraviny nadefinovat vlastní domácí míry (např. „1 lžíce" = 15 g),
  abych u surovin nemusel přepočítávat běžná množství na gramy ručně.
- Jako uživatel chci u napojené suroviny vybrat míru a počet (např. „2 lžíce") místo psaní
  gramů, aby se gramáž i kalorie dopočítaly samy.
- Jako uživatel chci, aby výběr míry nikdy nepřepsal původní text suroviny a nikdy nebyl
  povinný — bez míry zůstává dnešní zadání v g/ks beze změny.
- Jako uživatel chci (podle rozhodnutí OO4) mít stejný výběr míry i při vaření (náhrada /
  přidání suroviny), aby se zadávání množství chovalo napříč appkou stejně.

## Akceptační kritéria

### A. Definice měr u potraviny

- [ ] Given editace potraviny, When přidám míru s názvem „lžíce" a hodnotou 15, Then se
  u potraviny uloží míra „1 lžíce = 15 g" a je dál k dispozici při zadávání množství suroviny.
- [ ] Given potravina s víc mírami (lžíce, hrnek, plátek), When je uložím a appku znovu
  otevřu, Then jsou míry zachované (perzistentní přes Dexie, ne jen v paměti).
- [ ] Given zakládám míru bez názvu nebo bez (kladné) gramáže, Then se taková neúplná míra
  neuloží jako platná, ale **uložení potraviny to nezablokuje** (potravina se uloží i bez ní;
  pravidlo 3 analogicky).
- [ ] Given míru u potraviny smažu, Then se přestane nabízet při zadávání množství
  (dopad na už napojené suroviny řeší Otevřená otázka 3).
- [ ] Given rychlé inline založení potraviny z výběru (`QuickFoodForm`), Then se míry
  **nedefinují** (jen název + energie + g/ml); doplní se až v plné editaci potraviny
  (PŘEDPOKLAD, viz Otevřená otázka níže není — je to záměrné zúžení rozsahu).

### B. Výběr míry + počtu u suroviny (obrazovka Kalorie)

- [ ] Given surovina napojená na potravinu, která má aspoň jednu míru, When zadávám množství,
  Then můžu místo gramů (a „ks") vybrat **míru** (např. „lžíce") a zadat **počet** (např. 2).
- [ ] Given potravina nemá žádnou míru, Then se výběr míry nenabízí a množství zadávám v g
  (a v „ks", má-li potravina `pieceGrams`) přesně jako dnes.
- [ ] Given surovina má napsaný text „2 lžíce oleje" a olej má míru „lžíce", When vyberu
  míru „lžíce" a počet 2, Then se `raw_text` suroviny **nezmění ani o písmeno** (pravidlo 2).
- [ ] Given je otevřený výběr míry, When ho zavřu bez volby, Then se na surovině nic nezmění.

### C. Dopočet gramů a kalorií

- [ ] Given vyberu „2 lžíce" a 1 lžíce = 15 g, Then se dopočítá gramáž 30 g a z ní kalorie
  podle napojené potraviny (`energyKcal * 30 / 100`), stejně jako by uživatel zadal 30 g ručně.
- [ ] Given surovina s vybranou mírou, Then se do souhrnu (celek / na porci / na 100 g)
  započítá dopočtená gramáž a odpovídající kcal; je vidět v ukazateli úplnosti „X z Y" (R-31).
- [ ] Given gramáž z míry, Then se interně drží plná přesnost a zaokrouhluje se **až
  v zobrazení** (pravidlo 9) — 30 položek se zaokrouhlením na celé kcal nesmí nasčítat odchylku.
- [ ] Given surovina má v textu míru („2 lžíce"), ale **nemá napojenou potravinu**, Then se
  kalorie nespočítají (pravidlo 4) a surovina se počítá jako nenapojená v úplnosti.
- [ ] Given počet = 0 nebo prázdné pole, Then je gramáž z míry nedefinovaná (null) a surovina
  se do kcal nezapočítá — nezobrazí se žádné falešné číslo (analogie dnešního prázdného množství).

### D. Chování bez míry (beze změny)

- [ ] Given žádná potravina v receptu nemá míry, Then se celý dnešní tok napojení a zadání
  g/ks chová beze změny (žádná regrese na obrazovce Kalorie ani ve vaření).
- [ ] Given surovina napojená na potravinu s `pieceGrams` a bez dalších měr, Then dnešní
  přepínač g/ks funguje jako dnes (dokud OO1 nerozhodne o sloučení „ks" mezi míry).

### E. Vaření (rozsah dle Otevřené otázky 4)

- [ ] Given nahrazuji nebo přidávám surovinu v režimu vaření a náhradní/přidaná potravina má
  míry, When vyberu míru + počet, Then se gramáž a kcal té varianty dopočítají stejně jako
  na obrazovce Kalorie. *(závisí na OO4)*
- [ ] Given uložím vaření do historie, Then se do záznamu zapíše **snapshot** dopočtené
  gramáže/kcal a pozdější změna míry u potraviny tento záznam nezmění (pravidlo 5).

## Okrajové případy a chybové stavy

| Situace | Očekávané chování |
|---|---|
| Míra s nulovou/zápornou/nečíselnou gramáží | Neuloží se jako platná míra; uložení potraviny to nezablokuje |
| Prázdný název míry | Neuloží se jako platná míra (bez názvu ji nejde vybrat) |
| Dvě míry stejného názvu u jedné potraviny | Viz Otevřená otázka 7 (povolit / bránit duplicitě) |
| Hodně měr u jedné potraviny | Seznam se scrolluje, neláme layout; případný strop řeší OO7 |
| Míra smazaná u potraviny, ale použitá u suroviny | Viz Otevřená otázka 3 (zmrazit gramáž vs. odpojit) |
| Změna gramáže míry (15 → 14 g) po napojení | Viz Otevřená otázka 3 (přepočítat live vs. zmrazit) |
| Počet je desetinný („1,5 hrnku") | Dopočítá se z desetinné hodnoty (PŘEDPOKLAD: povoleno jako u „ks") |
| Potravina má `pieceGrams` i pojmenované míry | Vztah „ks" ↔ míry řeší Otevřená otázka 1 |
| Potravina má základ „ml" (mléko, olej po objemu) | Hodnota míry vs. g/ml řeší Otevřená otázka 6 |
| Surovina napojená přes míru, pak potravinu odpojím | Napojení i míra se zruší, `raw_text` zůstává; kcal zmizí (pravidlo 4) |
| Offline | Definice i výběr míry fungují plně lokálně (Dexie), bez sítě |
| Export / import zálohy | Míry se přenášejí (dnes už `foodPortions` v `dbBackup.ts`) |

## Mimo rozsah

- **Automatický přepis `raw_text`** podle vybrané míry (např. dopsání „= 30 g" do textu).
  Odporuje pravidlu 2 a E-13.
- **Globální / sdílené číselníky měr** napříč potravinami nebo předvyplněné katalogy měr.
  Každá potravina má vlastní míry (pokud OO nerozhodne jinak).
- **Hustoty a převod objem↔hmotnost** (ml → g podle potraviny). Míra je přímý pojmenovaný
  převod na základní jednotku, žádný fyzikální model.
- **Škálování počtu porcí přes vybranou míru** nad rámec dnešního chování (dnes se škáluje
  gramáž ve výpočtu a text přes `scaleQuantityText`) — beze změny.
- **Definice měr v rychlém inline zakládání potraviny** (`QuickFoodForm`) — zůstává jen
  název + energie + g/ml.
- **Deník (fáze 3).** Zápis potraviny/receptu do deníku je jiný tok (snapshot) a řeší se zvlášť.

## Předpoklady

- **PŘEDPOKLAD:** Míry se definují v editoru potraviny (`FoodEditScreen`), jako rozšíření
  dnešního pole „Hmotnost 1 kusu"; ne v rychlém inline zakládání.
- **PŘEDPOKLAD:** Míra = pojmenovaný převod na základní jednotku potraviny; uložená hodnota
  je za **1 kus míry** (dnešní `FoodPortion.grams`) a počet je násobitel (2 lžíce → grams × 2).
- **PŘEDPOKLAD:** Počet u míry smí být desetinný (1,5), stejně jako dnes u „ks".
- **PŘEDPOKLAD:** Výběr míry nikdy nepřepíše `raw_text` ani nevynutí napojení potraviny; bez
  měr je celý tok beze změny (pravidla 1, 2, 3).
- **PŘEDPOKLAD:** Kalorie z míry vzniknou jen s napojenou potravinou (pravidlo 4); samotný
  text „2 lžíce" bez napojení kcal nedá.
- **PŘEDPOKLAD:** Interně se drží plná přesnost (grams míry × počet), zaokrouhluje se až
  v zobrazení (pravidlo 9).
- **PŘEDPOKLAD:** Existující schéma `foodPortions` i jeho záloha/obnova se využijí tak, jak
  jsou; náplní požadavku je doplnit repo vrstvu, UI a výpočet (ne měnit schéma zálohy).
- **PŘEDPOKLAD:** Historie vaření zůstává snapshot (pravidlo 5) — pozdější úprava míry nemění
  minulé záznamy.
- **PŘEDPOKLAD:** Jde o jednu PWA (jedno rozhraní), takže „všude" = všechna místa výběru
  množství uvnitř této aplikace.
- **PŘEDPOKLAD:** UI texty a prázdné stavy budou věcné a stručné (lean, česky).

## Otevřené otázky

1. **Vztah „ks" a pojmenovaných měr.** Má se dnešní přepínač g/ks sloučit do jednoho výběru
   měr (kde „ks" je jen jedna z měr odvozená z `pieceGrams`), nebo „ks" zůstává zvlášť a míry
   jsou navíc? Ovlivní datový model i UI.
2. **Perzistence volby u suroviny.** Má se u suroviny pamatovat **vybraná míra + počet** (aby
   se po znovuotevření zobrazilo „2 lžíce"), nebo se ukládá **jen výsledná gramáž** (zobrazí se
   „30 g")? Dnešní `RecipeItem` má jen `amountG`/`amountKs`; pro míru pole chybí.
3. **Přepočet při změně/smazání míry.** Když u potraviny změním „1 lžíce" z 15 na 14 g (nebo
   míru smažu), mají se už napojené suroviny **přepočítat live** (jako se dnes bere aktuální
   `energyKcal`), nebo zůstat **zmrazené** na původní gramáži? Úzce souvisí s OO2.
4. **Rozsah ve vaření.** Má být výběr míry i u **náhrady** a **přidání suroviny** v režimu
   vaření, nebo zatím jen na obrazovce Kalorie? („při vaření" má tři místa zadání množství;
   override „jiné množství pro dnešek" je jen text a do kcal nevstupuje.)
5. **Návrh míry z textu.** Má appka z „2 lžíce oleje" **nabídnout** předvyplnění míra = lžíce,
   počet = 2 (návrh k potvrzení, jako se dnes předvyplní gramáž z „40g" v UC007), nebo se míra
   volí vždy ručně? (Automatický přepis textu se nikdy neděje — pravidlo 2.)
6. **Míry u potravin v „ml".** Hodnota míry je dnes v poli `grams`, ale potravina může mít
   základ „ml" (mléko, olej po objemu). Má hodnota míry **sledovat základ potraviny** (g vs
   ml) a podle toho se i popisovat, nebo je vždy v gramech?
7. **Duplicity a limity.** Povolit dvě míry stejného názvu u jedné potraviny? Je žádoucí
   validace na rozsah gramáže nebo strop počtu měr?

## Rozhodnutí (uzavřené otázky) — platí pro návrh i implementaci

Rozhodnuto uživatelem 2026-09-02. Downstream (architekt, developer) staví na tomhle.

1. **OO1 — „ks" vs. míry: koexistují.** `pieceGrams` („ks") zůstává jak je, nemigruje se.
   Pojmenované míry jsou **další volby ve stejném výběru množství** (g / ks je-li `pieceGrams` /
   každá míra). Jeden picker, žádné sloučení „ks" do `foodPortions`.
2. **OO2 — ukládá se jen výsledná gramáž.** Volba „2 lžíce" se přepočte na 30 g a uloží do
   **stávajícího `amountG`**. **Žádné nové pole v modelu, žádná migrace.** Po znovuotevření se
   v poli množství ukáže „30 g"; text „2 lžíce oleje" drží `raw_text` (pravidlo 2). Míra je tedy
   **pomůcka při zadávání**, ne trvalý atribut suroviny.
3. **OO3 — přepočet je bezpředmětný.** Protože se drží jen gramáž (OO2), změna/smazání míry
   u potraviny **nemění** už zadané suroviny (žádná živá vazba). Nové zadání použije novou hodnotu.
   (Řádky v Okrajových případech „změna/smazání míry po napojení" = beze změny gramáže suroviny.)
4. **OO4 — míry i při vaření: ANO.** Výběr míry je na obrazovce **Kalorie**, v editoru potraviny
   (definice) a ve **vaření u náhrady i přidání suroviny**. (Override „jiné množství pro dnešek"
   zůstává jen text mimo kcal — beze změny.)
5. **OO5 — návrh míry z textu: ANO.** Když `raw_text` obsahuje rozpoznatelnou míru a počet
   („2 lžíce …") a napojená potravina takovou míru má, appka **předvybere** míru + počet (návrh
   k potvrzení, jako gramáž v UC007). Nikdy nepřepisuje text (pravidlo 2). Když nerozpozná,
   spadne do ručního výběru. Parser buď rozšíří stávající prefill v UC007 (`RecipeNutritionScreen`),
   nebo přidá lehký matcher „počet + název míry potraviny" — na návrhu architekta.
6. **OO6 — míra = název + gramy, basis-agnostická.** Hodnota se drží v `FoodPortion.grams`
   a vstupuje do dnešního výpočtu `energyKcal * grams / 100` bez ohledu na základ (g/ml), přesně
   jak appka počítá dnes. **Žádný převod ml↔g.** (U „ml" potravin je to stejná aproximace jako teď.)
7. **OO7 — validace.** Míra je platná jen s **neprázdným názvem** a **kladnou gramáží**. Stejný
   název u jedné potraviny se **nezduplikuje** (case-insensitive, dedup jako u seedu potravin —
   poslední/existující vyhrává, nová se nepřidá jako druhá). Počet měr bez tvrdého stropu (seznam
   se scrolluje). Počet u míry smí být **desetinný** („0,5 hrnku"), jako dnes „ks".

Důsledek pro rozsah: bez migrace DB a bez nové závislosti; dotčené jsou UI vrstvy (editor
potraviny, obrazovka Kalorie, vaření), lehká repo vrstva nad `foodPortions` a sdílená komponenta
výběru množství. Akceptační kritéria s „*(závisí na OO4)*" nyní **platí** (vaření je v rozsahu).
