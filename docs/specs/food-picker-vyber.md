# Jednotný vyhledávací výběr potraviny

## Kontext

Když se surovina receptu napojuje na potravinu (kvůli kaloriím), potřebuji ji rychle
vybrat ze **založených potravin** přes hledání, ne ji dohledávat ručně. Chci, aby tenhle
způsob výběru byl **stejný a dostupný všude**, kde se potravina vybírá.

**Zjištěný stav v kódu (fáze 2):** komponenta pro vyhledávací výběr už existuje —
`src/features/foods/FoodPicker.tsx`. Je to celoobrazovkový overlay s polem pro hledání
(fulltext bez diakritiky přes `matchesQuery`) a seznamem potravin, kde se klepnutím vybere.
Ukazuje název, značku a kcal/100 g|ml, řadí abecedně, filtruje smazané (`deletedAt`).

Používá se dnes na **dvou** ze tří míst z zadání:

| Místo | Soubor | Stav |
|---|---|---|
| Napojení suroviny na potravinu (obrazovka „Kalorie") | `RecipeNutritionScreen.tsx` (`setPickingItemId`) | Hotovo – FoodPicker |
| Náhrada suroviny při vaření | `CookingModeScreen.tsx` (`setReplPickerOpen`) | Hotovo – FoodPicker |
| **Přidání nové suroviny v režimu vaření** | `CookingModeScreen.tsx` (`editMode` → „přidat surovinu…") | **Jen volný text, výběr potraviny chybí** |
| Hlavní editace receptu (velké pole surovin) | `RecipeEditScreen.tsx` | Záměrně jen volný text (viz Předpoklady) |

**Závěr analýzy:** jádro požadavku („pohodlný výběr ze založených potravin přes hledání")
je z velké části hotové. Reálně chybí/nejednotné je:
1. **Přidání suroviny** (režim vaření) nenabízí výběr potraviny vůbec.
2. **Forma** – dnes je to modál/overlay, ne inline „rozbalovací seznam" u pole
   (uživatel v zadání píše „dropdown"). Viz Otevřená otázka 1.
3. **Založení nové potraviny** z prázdného výběru odnaviguje pryč (`/potraviny/nova`)
   a ztratí kontext (rozdělaný recept/vaření). Viz Otevřená otázka 3.
4. Drobné rozdíly chování mezi místy (náhrada předvyplní text názvem potraviny,
   napojení ne).

## User stories

- Jako uživatel chci u suroviny na obrazovce Kalorie **vyhledat a vybrat potravinu**
  ze seznamu založených potravin, abych ji rychle napojil bez ručního dohledávání.
- Jako uživatel chci při vaření **nahradit surovinu** potravinou vybranou přes stejné
  hledání, abych spočítal kalorie dnešní varianty.
- Jako uživatel chci při **přidávání nové suroviny** (v režimu vaření) mít k dispozici
  **stejný vyhledávací výběr** potraviny, aby se výběr choval všude stejně.
- Jako uživatel chci, aby výběr potraviny **nikdy nepřepsal** původní text suroviny —
  napojení je nepovinné a text zůstává tak, jak jsem ho zapsal.

## Akceptační kritéria

- [ ] Given surovina bez napojení na obrazovce „Kalorie", When klepnu na „napojit potravinu",
  Then se otevře vyhledávací výběr se seznamem všech nesmazaných potravin a polem pro hledání.
- [ ] Given otevřený výběr, When napíšu část názvu bez diakritiky (např. „cesnek"),
  Then se seznam zúží na odpovídající potraviny (včetně „česnek") a výsledky se ukážou do 100 ms (NF-2).
- [ ] Given ve výběru vyberu potravinu, When se výběr zavře, Then se na surovinu napojí `food_id`
  a její volný text (`raw_text`) **zůstane beze změny** (pravidlo 1 a 2).
- [ ] Given přidávám novou surovinu v režimu vaření, When ji chci napojit na potravinu,
  Then je k dispozici **stejný** vyhledávací výběr jako u napojení a náhrady; když potravinu
  nevyberu, přidá se surovina jako **čistý volný text** (pravidlo 1). *(závisí na Otevřené otázce 2)*
- [ ] Given je otevřený výběr, When ho zavřu bez výběru, Then se na surovině nic nezmění
  (žádné napojení, žádná změna textu).
- [ ] Given hledaná potravina v seznamu není, When je výsledek prázdný, Then výběr nabídne
  **založení nové potraviny** a po jejím založení se vrátím zpět k výběru bez ztráty kontextu
  (rozdělaný recept/vaření). *(část „návrat bez ztráty kontextu" závisí na Otevřené otázce 3)*
- [ ] Given potravina je soft-smazaná (`deleted_at`), Then se ve výběru nikdy nenabídne (E-08).
- [ ] Given vybraná potravina má vyplněnou hmotnost kusu (`pieceGrams`), When ji vyberu,
  Then se výchozí jednotka množství nastaví na „ks" (jako dnes).

## Okrajové případy a chybové stavy

| Situace | Očekávané chování |
|---|---|
| Databáze potravin je prázdná | Prázdný stav s věcnou nabídkou založit potravinu / naimportovat základní (jako dnes na FoodsScreen) |
| Hledání nic nenajde | „Nic nenalezeno" + nabídka založit potravinu (ideálně s předvyplněným názvem z dotazu – viz OO3) |
| Duplicitní názvy („Rýže" 3×, E-09) | Ve výběru se rozliší značkou a kcal/100 g, aby šlo poznat, která je která |
| Dlouhý název / značka | Ořezat (truncate), neláme layout (dnes už tak je) |
| Přidání suroviny bez napojení | Musí jít vždy – uloží se čistý `raw_text`, napojení je nepovinné (pravidlo 1, 3) |
| Offline | Výběr funguje plně, hledá se lokálně v Dexie, bez sítě (NF-3) |
| Stovky potravin po importu | Hledání do 100 ms; případná virtualizace seznamu je věc architekta, ne tohoto požadavku |
| Vypnutá vs. nahrazená surovina při vaření | Náhrada a „vypnout dnes" se vzájemně vylučují (dnešní chování zachovat) |

## Mimo rozsah

- **Automatické „hádání"/napojování potraviny z volného textu** (autocomplete, který by
  přepisoval `raw_text`). Odporuje pravidlu 1 a E-13.
- **Výběr potraviny v hlavní editaci receptu** (velké textové pole surovin) – zachycení
  zůstává čistě volný text (C-1, S1). Napojení se dělá až na obrazovce „Kalorie".
- **Řazení „oblíbené / naposledy použité"** ve výběru (D-05, fáze 3) – pokud si to uživatel
  nevyžádá zvlášť.
- **Sken čárového kódu** jako zdroj výběru (F-05, fáze 3).
- **Výběr potraviny/receptu do deníku** (fáze 3) – jiný tok (snapshot), řeší se samostatně.
- **Slučování duplicit potravin** (E-09, v3).

## Předpoklady

- **PŘEDPOKLAD:** „Vyhledávací výběr" = existující `FoodPicker` (fulltext bez diakritiky,
  klepnutím vybrat). Cílem je jeho **sjednocené použití + doplnění tam, kde chybí**, ne nová
  komponenta od nuly. *(Pokud uživatel chce jinou formu – viz Otevřená otázka 1.)*
- **PŘEDPOKLAD:** Platí pravidlo 1 a 2 – výběr potraviny nikdy nepřepíše ani nenahradí volný
  text suroviny, `food_id` zůstává nepovinné a uložení nikdy nevyžaduje napojení.
- **PŘEDPOKLAD:** V hlavní editaci receptu (`RecipeEditScreen`, velké pole) se výběr potraviny
  **nenabízí**; přidávání/psaní surovin tam zůstává jako volný text (kvůli rychlosti zachycení).
- **PŘEDPOKLAD:** Jde o jednu PWA (jedno rozhraní), takže „všude" = všechna místa výběru
  potraviny uvnitř této aplikace.
- **PŘEDPOKLAD:** Hledání používá dnešní `matchesQuery` (bez diakritiky, kmen slova) a řazení
  je abecední. Prázdné pole zobrazí všechny potraviny (dnešní chování).
- **PŘEDPOKLAD:** Řádek ve výběru dál ukazuje kcal/100 g|ml jako pomůcku pro odlišení potravin.
- **PŘEDPOKLAD:** Texty a prázdné stavy budou věcné a stručné (bez marketingové vaty).

## Otevřené otázky

1. **Forma výběru:** Vyhovuje ti dnešní **celoobrazovkový overlay** s hledáním jako „ten
   vyhledávací výběr", nebo chceš **inline rozbalovací dropdown** připnutý přímo k poli
   (tj. přepracovat formu, ne jen sjednotit použití)? Zásadně mění rozsah práce.
2. **Přidání suroviny:** Má se při **přidávání nové suroviny** (režim vaření, případně jinde)
   nabízet výběr potraviny? A když při přidání potravinu vyberu, co se stane s `raw_text` –
   **předvyplní se názvem potraviny** (editovatelně), nebo zadám text a potravina je jen
   nepovinné napojení navrch?
3. **Založení potraviny z výběru:** Když hledaná potravina neexistuje, chceš ji **rychle
   založit přímo z výběru a vrátit se k výběru** (bez ztráty rozdělaného receptu/vaření),
   ideálně s názvem předvyplněným z hledaného dotazu? Nebo stačí dnešní odnavigování na
   „+ Založit potravinu"?

## Finální rozhodnutí (závazné) — uzavírá otevřené otázky

Rozhodl uživatel + user-advocate, potvrzeno uživatelem. Reviewer kontroluje proti tomuto.

**OO1 – Forma:** zůstává **celoobrazovkový overlay** `FoodPicker`. Žádný inline dropdown.

**OO2 – Přidání suroviny ve vaření:**
- [ ] Uživatelův napsaný text suroviny **zůstane vždy beze změny**. Napojená potravina se ukáže
  jako štítek **„→ název"** vedle, ne přepsáním textu (stejný model jako obrazovka Kalorie).
- [ ] U řádku „přidat surovinu…" je tlačítko **„napojit potravinu (kvůli kaloriím)"**, které
  otevře stejný `FoodPicker`.
- [ ] Název potraviny se předvyplní do textového pole **jen když je pole prázdné**; předvyplněný
  text jde hned přepsat. Neprázdné pole se **nikdy** nepřepíše (pravidlo 2).
- [ ] Tlačítko **„Přidat" uloží text i napojení (`foodId`) najednou** (napojuje se před přidáním).
- [ ] Napojení jde **odpojit** křížkem u štítku „→ …" ještě před přidáním.
- [ ] **Množství (g/ks) se u přidání neřeší** — doplní se později na obrazovce Kalorie. Napojená
  surovina bez množství se do kcal nezapočítá a projeví se v úplnosti „X z Y" (pravidlo 4).
- [ ] Napojení je **nepovinné**: napsat text a „Přidat" musí jít bez jakéhokoli výběru potraviny.

**OO3 – Rychlé založení potraviny z výběru (inline, bez navigace):**
- [ ] Z výběru jde založit novou potravinu **inline uvnitř overlaye** (žádná navigace pryč →
  rozdělaný recept/vaření i rozepsaný text zůstanou).
- [ ] Formulář chce **jen: název + energie (kcal na 100)** — obojí povinné — a malý přepínač
  **g / ml** (výchozí „g"). Značka, bílkoviny/sacharidy/tuky a hmotnost kusu se tu **nevyplňují**
  (doplní se případně později v plné editaci potraviny).
- [ ] Název je **předvyplněný hledaným dotazem**.
- [ ] Po založení se potravina **rovnou napojí** na surovinu (přes stejný `onSelect`) a výběr se
  **zavře**. Žádné vracení do seznamu a opětovné hledání.
- [ ] Validační hlášky: **„Doplň název."** / **„Doplň energii (kcal na 100 g)."**

**Prázdný výsledek — dva rozlišené stavy:**
- [ ] Prázdná databáze potravin: **„Zatím žádná potravina."** + tlačítko **„Založit potravinu"**
  (inline zakládání, prázdný název).
- [ ] Hledání bez shody (potraviny existují, dotaz nesedí): **„Nic nenalezeno."** + tlačítko
  **„Založit „&lt;dotaz&gt;""** (inline zakládání, název předvyplněný dotazem).

**Napříč místy:** princip „**text zůstává, potravina je štítek vedle**" platí pro **přidání**
(nové) i **Kalorie** (už tak funguje). **Náhrada** ve vaření zůstává beze změny (tam je zadaný
text = název náhrady, dává smysl; rychlé založení ale i tam funguje „zdarma" přes `onSelect`).

## REVIZE po review (2026-08-21) — reaguje na nálezy reviewera + user-advocate

Uživatel si vyžádal **inline našeptávač** u „přidat surovinu" (mění OO1 pro tohle jediné místo)
a zvolil chování „**text zůstává**". Reviewer a user-advocate pak našli reálné mouchy. Uživatel
rozhodl „**předělat**". Nová závazná pravidla pro našeptávač (nahrazují dřívější):

- [ ] **OO1 revize:** u pole „přidat surovinu" ve vaření je povolen **inline našeptávač** (rozbalovací
  seznam pod polem). Ostatní místa (Kalorie, náhrada) dál používají celoobrazovkový overlay.
- [ ] **Ťuknutí na návrh NEPŘEPISUJE text** (ruší dřívější „vyplnit název"). Napsaný text zůstane
  („2 vejce" zůstane „2 vejce") a potravina se jen **napojí** (štítek „→ název", křížek odpojí).
  Tím platí pravidlo 2 i pro inline cestu.
- [ ] **Návrhy fungují i s vedoucím množstvím:** hledá se podle názvu suroviny bez vedoucího čísla
  a jednotky („2 vejce" → nabídne „Vejce", „200 g mouky" → „Mouka").
- [ ] **Napojení u přidání má malé pole na množství (g/ks)** jako u „Nahradit" — aby napojení
  „kvůli kaloriím" opravdu počítalo. Bez množství se surovina uloží (napojení nepovinné), jen se
  do kcal nezapočítá a projeví se v úplnosti (pravidlo 4). U potraviny s `pieceGrams` výchozí „ks".
- [ ] Volný text bez výběru dál funguje (pravidlo 1). Návrhy se skryjí, když je potravina napojená.
