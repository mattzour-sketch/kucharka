# UC031 — Vložení receptu z Instagramu (a jiných cizích textů) bez přepisování

Rozšíření dnešního „Vložit recept" (UC011, SPEC §11, `/vlozit`) tak, aby zkopírovaný popisek
receptu z Instagramu (typicky anglicky, se sekcemi a podsekcemi) dopadl do správných polí a
uživatel ho nemusel ručně přeskládávat. Jde o **text, který už je ve schránce** — načtení z odkazu,
OCR ze screenshotu a hlas zůstávají v parkovišti UC026. Několik zásadních rozhodnutí (překlad,
jednotky, °F) je **otevřených** — viz Otevřené otázky, nerozhoduju za uživatele.

## Kontext

Uživatel vidí recept na Instagramu a chce ho mít v kuchařce, aniž by ho přepisoval. Recept
z IG má přitom jinou stavbu než recept od babičky:

- **Nemá název** — popisek začíná rovnou sekcí „Ingredients:" nebo marketingovou větou s emoji.
- **Je anglicky** — značky sekcí (`Ingredients` / `Instructions` / `Directions` / `Method`),
  jednotky (`tsp`, `tbsp`, `cup`, `oz`), teplota ve °F.
- **Má podsekce surovin** („For the icing:", „For the dough:").
- **Má balast** — úvodní odstavec, makra („Macros per roll: …"), výzvy („Save this!",
  „Follow @…"), blok hashtagů na konci, emoji jako odrážky.

### Dnešní stav (ověřeno v kódu a spuštěním `parseRecipeText` na ukázce níže)

- Parser (`src/lib/parseRecipe.ts`) zná **jen české značky**: suroviny = `suroviny|ingredience`,
  postup = `postup|priprava|instrukce|navod` (bez diakritiky, case-insensitive, řádek musí být
  celý jen značka, volitelně s dvojtečkou). Anglické značky nepozná → spadne na heuristiku „první
  neprázdný řádek = název, první prázdný řádek odděluje suroviny od postupu".
- Výsledek na ukázce:
  - `name` = `"Ingredients:"` (značka se vzala jako název),
  - `ingredients` = jen prvních 7 řádků (těsto), odrážky `* ` správně oříznuté,
  - `instructions` = „For the icing:" + 5 surovin polevy + „Instructions:" + kroky →
    **poleva se ztratí v postupu** a v režimu vaření by se z každé suroviny polevy stal
    odškrtávací krok (`CookingModeScreen` dělí postup na kroky po řádcích).
- Když parser najde značku surovin, **všechno před ní kromě prvního řádku zahodí** (úvod, makra).
  Hashtagy a výzvy na konci skončí v postupu → v režimu vaření jako kroky.
- Počet porcí se hledá jen česky (řádek obsahuje `porc` + číslo), a to kdekoli v textu — i v kroku
  postupu („Rozkrojte na 8 porcí").
- Obrazovka `ImportRecipeScreen.tsx`: textarea pro vložení → „Rozebrat" → **editovatelný náhled**
  (název, porce, suroviny, postup) → „Uložit". Uložit jde bez názvu (fallback „Vložený recept").
  Náhled **nemá** pole pro dobu přípravy (`prepMinutes`) ani pro zdroj (`Recipe.source`), obojí
  se ukládá jako `null`.
- `rawCapture` se při uložení skládá z **upraveného náhledu** (`combineRawCapture(ingredients,
  instructions)`) a při editaci receptu se přepočítá. **Původně vložený text se nikde neuchová.**
- Konvence sekcí surovin (UC023, `src/lib/ingredientSection.ts`): řádek surovin `# Nadpis` je
  nadpis sekce, ne surovina — mimo kalorie, nákup i progres vaření. Podsekce z IG se na ni
  přirozeně mapuje.
- Množství a jednotky (dotčené, ale mimo parser receptu):
  - `scale.ts` škáluje vedoucí číslo nezávisle na jazyce („1 tsp" → „2 tsp"). **Nezvládne**
    unicode zlomky („½ cup" se neškáluje, bez upozornění), smíšená čísla („1 1/2 cups" ×2 →
    „2 1/2 cups", správně 3) a rozsahy („1–2 tbsp" ×2 → „2 –2 tbsp"). V anglických receptech
    jsou tyto zápisy běžné.
  - `ingredientParse.ts` (předvyplnění gramáže při napojování) zná jen `g/dkg/kg/ml/l` a české
    nevažitelné míry. „90g flour" → 90 g ✓; „1 tsp baking powder" → gramáž nic, hledaný výraz
    „tsp baking powder" (jednotka proteče do hledání potraviny). `oz`/`lb`/`cup` nezná.
  - `portionMatch.ts` (UC017) páruje míru jen na shodu s názvem míry u potraviny — „tbsp"
    nenajde míru „lžíce".
  - Databáze potravin je česká, takže anglické názvy („all-purpose flour") napojení nenabídnou.
  - `duration.ts` (klikací časovače ve vaření) chytne „15 minutes" a „min", ale **ne** „mins",
    „hour(s)", „hr", „seconds".

### Ukázkový vstup (referenční pro akceptační kritéria)

```
Ingredients:

* 90g all-purpose flour
* 85g non-fat plain Greek yogurt
* 1 tsp baking powder
* Pinch of salt
* 4 tsp zero-calorie sugar-free brown sugar
* Cinnamon, to taste
* Pinch of salt

For the icing:

* 2 tbsp light cream cheese
* 20g non-fat plain Greek yogurt
* 30g powdered monk fruit sweetener
* 10ml almond milk
* 1 tsp pure vanilla extract

Instructions:

1. Add your flour, 85g Greek yogurt, baking powder, and a pinch of salt to a bowl. Mix together, then knead for about 5 minutes...
2. In a separate bowl, mix your zero-calorie brown sugar with cinnamon and a small pinch of salt.
...
5. Bake at 375°F for 12–15 minutes, or until the tops are slightly browned...
...
8. Spread or drizzle the icing over the top and enjoy.
```

## User stories

- Jako uživatel, který na Instagramu narazí na recept, chci zkopírovaný popisek vložit do appky
  a dostat ho rovnou rozdělený na suroviny a postup, abych nic nepřepisoval ani nepřeskládával.
- Jako uživatel chci, aby se podsekce surovin („For the icing:") převedly na sekce kuchařky
  (`# For the icing`), abych při vaření viděl, co patří k polevě, a poleva se neztratila v postupu.
- Jako uživatel chci, aby značka sekce ani balast (hashtagy, výzvy) neskončily jako název,
  surovina nebo krok vaření, abych je nemusel mazat ručně.
- Jako uživatel chci, aby číslované kroky zůstaly tak, jak je autor napsal, abych se v postupu
  orientoval stejně jako v originále.
- Jako uživatel chci, aby dál fungovalo vložení českého receptu (SMS, poznámka, recept sdílený
  z appky), abych novou funkcí nic nerozbil.
- Jako uživatel chci recept uložit hned, i když parser něco netrefil nebo chybí název, abych
  zachycení nikdy nezdržel (pravidlo 3, hlavní úloha appky).
- *(podle Otevřené otázky 1)* Jako uživatel chci mít recept v kuchařce česky, abych ho našel
  hledáním („skořice") a mohl suroviny napojit na české potraviny.
- *(podle Otevřených otázek 4 a 5)* Jako uživatel chci vidět teplotu ve °C a rozumět anglickým
  jednotkám, abych nemusel přepočítávat při vaření.

## Akceptační kritéria

**A. Rozpoznání značek sekcí (EN + CZ)**
- [ ] Given vložím ukázkový vstup, When dám „Rozebrat", Then řádek „Ingredients:" není název,
      surovina ani krok a řádek „Instructions:" není surovina ani krok.
- [ ] Given řádek, který je celý jen značkou surovin, Then se pozná bez ohledu na velikost písmen,
      diakritiku, koncovou dvojtečku a úvodní emoji / odrážku. Minimální sada: `Ingredients`,
      `Ingredient list`, `What you need`, `You'll need`, `Suroviny`, `Ingredience`,
      `Potřebujeme`, `Budete potřebovat`.
- [ ] Given řádek, který je celý jen značkou postupu, Then se pozná stejně. Minimální sada:
      `Instructions`, `Directions`, `Method`, `Steps`, `How to make`, `Preparation`, `Postup`,
      `Příprava`, `Instrukce`, `Návod`, `Jak na to`.
- [ ] Given značka s doplňkem v závorce (`Ingredients (makes 8):`, `Suroviny (na 4 porce):`),
      Then se pozná jako značka (a doplněk může nést počet porcí, viz D).
- [ ] Given značka napsaná „tučným" Unicode písmem (`𝗜𝗻𝗴𝗿𝗲𝗱𝗶𝗲𝗻𝘁𝘀`, na IG běžné), Then se pozná
      stejně jako obyčejné `Ingredients`.
- [ ] Given slovo značky uvnitř věty („Mix the ingredients well."), Then to **není** značka.
- [ ] Given postup je v textu **před** surovinami, Then každá sekce sahá do další značky (ne do
      konce textu) a suroviny nekončí v postupu ani naopak.
- [ ] Given značka i obsah na jednom řádku (`Ingredients: 90g flour, 85g yogurt`), Then se pozná
      jako značka a zbytek řádku za dvojtečkou se nezahodí (skončí jako řádek surovin, čárkami se
      nedělí — PŘEDPOKLAD).

**B. Podsekce surovin → konvence `# X` (UC023)**
- [ ] Given uvnitř sekce surovin řádek zakončený dvojtečkou bez vedoucího množství („For the
      icing:", „Na polevu:", „Dough:"), Then se v náhledu surovin objeví jako `# For the icing`
      (bez dvojtečky, v původním znění a jazyce).
- [ ] Given ukázkový vstup, Then náhled surovin má **13 řádků** v tomto pořadí: 7 surovin těsta
      (včetně obou „Pinch of salt"), `# For the icing`, 5 surovin polevy — bez odrážek `* `.
- [ ] Given uložený recept z ukázky, Then na detailu i ve vaření je „For the icing" nadpis sekce
      (neodškrtává se, není v kaloriích, úplnosti ani nákupu) — chování UC023 beze změny.
- [ ] Given podsekce je první řádek sekce surovin („For the dough:"), Then i ona se převede na
      `# For the dough`.
- [ ] Given vložím text sdílený z appky, který už obsahuje `- # Na těsto`, Then vznikne
      `# Na těsto` (ne `# # Na těsto`) — round-trip se sdílením zůstává.

**C. Název**
- [ ] Given text začíná rovnou značkou sekce (ukázka), Then pole „Název" je v náhledu prázdné
      (s placeholderem), **nikdy** v něm není značka sekce.
- [ ] Given před první značkou je neprázdný řádek, Then se nabídne jako název (varianty — jen
      první řádek / očištěný o emoji a hashtagy / zkrácený — viz Otevřená otázka 8).
- [ ] Given název zůstane prázdný, When dám „Uložit", Then se recept uloží (dnešní fallback
      „Vložený recept"), nic neblokuje (pravidlo 3).

**D. Porce a metadata**
- [ ] Given řádek metadat `Serves 4`, `Servings: 4`, `Makes 8`, `Yield: 8`, `4 servings`,
      `Porce: 4`, `Pro 4 osoby`, Then se předvyplní „Porcí" a řádek neskončí mezi surovinami
      ani v postupu.
- [ ] Given číslo porcí jen uvnitř kroku postupu („Divide into 8 portions", „Rozkrojte na 8
      porcí"), Then se jako počet porcí **nebere**.
- [ ] Given řádky `Prep time`, `Cook time`, `Total time`, `Doba přípravy`, makra/nutrition,
      `Notes`/`Tips`/`Poznámky`, `Equipment`, Then neskončí jako surovina; kam patří (doba přípravy,
      poznámka, postup, nikam), rozhodne Otevřená otázka 6.
- [ ] Given deklarovaná makra autora („Macros per roll: 150 kcal, 12P…"), Then se **nikdy**
      nestanou nutričními hodnotami receptu (pravidlo 4 — hodnoty se jen počítají z napojených
      surovin).

**E. Postup**
- [ ] Given ukázkový vstup, Then postup obsahuje jen kroky 1–8 **přesně v původním znění včetně
      číslování** („1. Add your flour…"), bez „Instructions:" a bez surovin polevy.
- [ ] Given kroky číslované `1.`, `1)`, `Step 1:`, `1️⃣`, Then se číslování ponechá, jak je.
- [ ] Given blok hashtagů (řádky tvořené jen `#slovy`) kdekoli v textu, Then neskončí v postupu
      ani v surovinách (případné použití jako štítky — Otevřená otázka 9).
- [ ] Given uložený recept, When otevřu režim vaření, Then počet kroků odpovídá číslovaným krokům
      originálu (žádné kroky navíc z hashtagů, značek nebo surovin podsekcí).

**F. Úklid řádků surovin**
- [ ] Given suroviny s odrážkami `*`, `-`, `•`, `·`, `▪️`, `✅`, `🔸`, `▢`/`☐` (web recepty), Then se
      odrážka odřízne a řádek začíná množstvím (aby fungovalo škálování i předvyplnění gramáže).
- [ ] Given číslovaný seznam surovin (`1. 90 g mouky`), Then se odřízne číslo seznamu, zůstane
      `90 g mouky` (jinak by škálování násobilo „1").
- [ ] Given emoji uvnitř řádku suroviny („50 g butter 🧈"), Then zůstává (mění se jen úvodní
      odrážka).

**G. Regrese a základní garance**
- [ ] Všechny dnešní testy `parseRecipe.test.ts` projdou beze změny očekávání (formát sdílení
      z appky, přeškálované porce, český text s/bez prázdného řádku, odrážky bez prázdného řádku).
- [ ] Given text bez jakékoli značky, Then se chová jako dnes (heuristika název / prázdný řádek /
      odrážky).
- [ ] Given appka je offline, Then „Rozebrat" i „Uložit" fungují beze změny, bez síťového
      požadavku (pravidlo 11) — platí pro vše kromě případné online varianty překladu (OO1).
- [ ] Given jakýkoli výsledek parseru, Then je vždy vidět editovatelný náhled a „Uložit" nic
      nevaliduje navíc (pravidla 1 a 3).
- [ ] Given uložený recept, Then každý řádek surovin je `raw_text` doslova tak, jak byl
      v náhledu v okamžiku uložení (pravidlo 2) — žádná pozdější úprava textu na pozadí.

**H. Vložený odkaz místo textu**
- [ ] Given vložím jen URL (typicky `https://www.instagram.com/p/…` — IG „Sdílet → Kopírovat
      odkaz"), When dám „Rozebrat", Then appka věcně řekne, že odkaz neotevře a má se zkopírovat
      text popisku; URL se neuloží jako název receptu.

**I. Překlad, jednotky, °F** — kritéria se doplní podle rozhodnutí OO1, OO4, OO5, OO7. Pevné je:
- [ ] Given jakákoli zvolená varianta, Then se text suroviny po uložení nepřepisuje (pravidlo 2);
      obohacení (přepočet °C, překlad) je buď vidět a potvrzené v náhledu před uložením, nebo se
      jen zobrazuje při čtení.

## Okrajové případy a chybové stavy

| Situace | Očekávané chování |
|---|---|
| Prázdný text / jen mezery | „Rozebrat" zůstává neaktivní (dnešní chování). |
| Jen URL (IG, web) | Hláška „Odkaz neumím otevřít — zkopíruj text popisku." (znění lean); nic se nerozebere. Načtení z URL je UC026. |
| Text bez jakékoli značky (IG popisek jen s odrážkami) | Dnešní heuristika; první řádek = název, pokud to není značka ani hashtagový řádek. |
| Jen značka surovin, žádný postup | Vše pod značkou jsou suroviny, postup prázdný. |
| Jen značka postupu, žádné suroviny | Suroviny prázdné, text před značkou → název (+ viz OO6), zbytek postup. |
| Dvě značky surovin (např. „Ingredients" + v textu znovu „Ingredients for the sauce:") | Druhá se bere jako podsekce `# …`, ne jako nová sekce. PŘEDPOKLAD. |
| Podsekce bez dvojtečky, velkými písmeny („FOR THE ICING") | Viz OO10 (konzervativně jen s dvojtečkou vs. i CAPS řádky). |
| Řádek suroviny končící dvojtečkou, ale s množstvím („2 eggs:") | Není podsekce (má vedoucí množství), zůstává surovinou. |
| Podsekce v postupu („For the icing:" mezi kroky) | Zůstane jako řádek postupu (konvence `#` je jen pro suroviny, UC023). V režimu vaření z něj bude krok — viz OO10. |
| Stejná surovina dvakrát („Pinch of salt") | Obě zůstanou, žádné slučování. |
| „Serves 4–6" | Porce = 4 (dolní mez). PŘEDPOKLAD. |
| „Makes 8 rolls" | Porce = 8 (appka zná jen porce, ne kusy). PŘEDPOKLAD. |
| Značka ve „fancy" Unicode písmu (𝗕𝗼𝗹𝗱, 𝘐𝘵𝘢𝘭𝘪𝘤) | Pozná se jako značka; ostatní text se neupravuje. |
| Emoji před značkou („🥣 Ingredients:", „👩‍🍳 Method") | Pozná se jako značka. |
| Keycap emoji v krocích („1️⃣ Mix…") | Ponechá se beze změny. |
| Krok rozlomený do víc řádků bez čísla | Zůstává, jak je; ve vaření bude víc kroků (dnešní chování dělení po řádcích). Slučování mimo rozsah. |
| Výzvy „Save this!", „Follow @…", „Comment ROLLS…" za posledním krokem | PŘEDPOKLAD: spolehlivě je nepoznáme → zůstanou na konci postupu, uživatel je smaže v náhledu. Hashtagové řádky se odstraní vždy. |
| Popisek obsahuje dva recepty | Rozebere se jako jeden; rozdělení mimo rozsah. |
| Recept z webu zkopírovaný i s „Jump to recipe", hodnocením, „1x 2x 3x", „US Customary / Metric" | Best-effort: značky sekcí se poznají, balast mezi nimi zůstane v náhledu k ručnímu smazání. |
| Web recept s oběma jednotkami („1 cup (120 g) flour") | Text beze změny; škálování vynásobí jen první číslo („2 cup (120 g)") — viz OO4. |
| Unicode zlomek / smíšené číslo / rozsah („½ cup", „1 1/2 cups", „1–2 tbsp") | Dnes se neškáluje, resp. škáluje **chybně** (viz Kontext). Řešit / neřešit v této story — OO4. |
| Teplota už uvedená v obou jednotkách („375°F (190°C)") | Nic se nedoplňuje (platí, pokud se zvolí doplňování °C — OO5). |
| Opakované „Rozebrat" po ruční úpravě náhledu | Dnešní chování (náhled se přepíše znovu rozebraným textem). Beze změny. |
| Velmi dlouhý první řádek použitý jako název | Viz OO8 (zkrátit / nechat / nepoužít). |
| Jiný jazyk (DE „Zutaten", ES „Ingredientes") | Nepozná se, spadne na heuristiku. Mimo rozsah. |

## Mimo rozsah

- Načtení receptu z odkazu na IG/web, OCR ze screenshotu, diktování — parkoviště UC026
  (síť/CSP, přihlášení k IG, nová závislost).
- Web Share Target (sdílení z IG přímo do appky) — IG sdílí odkaz, ne text popisku, takže by
  nepomohlo bez načtení z URL.
- Stažení fotky receptu z IG.
- Automatické napojení surovin na potraviny při vložení (pravidlo 1; napojuje se na obrazovce
  Kalorie).
- Převzetí deklarovaných maker autora jako nutričních hodnot (pravidlo 4).
- Sloučení kroků rozlomených na víc řádků, rozdělení jednoho popisku na víc receptů.
- Konvence nadpisů (`#`) pro sekce **postupu** — pokud OO10 nerozhodne jinak.
- Jiné jazyky než čeština a angličtina.
- Nová závislost bez předchozího schválení (konvence CLAUDE.md) — týká se hlavně OO1.

## Předpoklady

- PŘEDPOKLAD: Uživatel umí z IG zkopírovat **text popisku** (dlouhý stisk / přes web IG) a vložit
  ho na obrazovku „Vložit recept". Ukázka v zadání je takto zkopírovaná. (Viz OO3.)
- PŘEDPOKLAD: Jediné rozhraní je PWA (web i mobil, stejné UI); požadavek se týká jen obrazovky
  `/vlozit` a čisté logiky `parseRecipe.ts`. Žádné CLI ani API.
- PŘEDPOKLAD: Náhled zůstává povinný mezikrok a jde v něm vše upravit; parser se smí plést, nesmí
  ale nic zablokovat.
- PŘEDPOKLAD: Úprava textu **před uložením** (odříznutí odrážek, převod podsekce na `# X`,
  odstranění hashtagových řádků) pravidlo 2 neporušuje — uživatel výsledek vidí a potvrzuje
  v náhledu; `raw_text` je to, co potvrdil. (Otázka, zda uchovat i originál, je OO2.)
- PŘEDPOKLAD: Podsekce se pozná jen konzervativně: řádek v sekci surovin **zakončený dvojtečkou
  a bez vedoucího množství**. UC023 vědomě odmítl autodetekci dvojtečky pro *zobrazení*; tady jde
  o jednorázový návrh v náhledu, který uživatel vidí a opraví.
- PŘEDPOKLAD: Text nadpisu podsekce zůstává v původním jazyce a znění, jen bez dvojtečky
  (`# For the icing`), dokud OO1 nerozhodne o překladu.
- PŘEDPOKLAD: Úvodní emoji/symbol na začátku řádku suroviny je odrážka a odřízne se; emoji uvnitř
  řádku zůstávají.
- PŘEDPOKLAD: Číslování kroků postupu se nemění ani nepřečíslovává.
- PŘEDPOKLAD: Řádky tvořené jen hashtagy se zahodí (do postupu ani surovin nepatří), dokud OO9
  nerozhodne o štítcích.
- PŘEDPOKLAD: Počet porcí se bere jen z řádku metadat (začíná klíčovým slovem, nebo „N servings /
  N porcí" samostatně), ne z kroku postupu. „4–6" → 4, „Makes 8" → 8.
- PŘEDPOKLAD: Duplicitní suroviny se neslučují.
- PŘEDPOKLAD: Zobrazení kalorií, škálování a napojení se v této story nemění, pokud OO4 nerozhodne
  jinak. Jednotky zůstávají volný text (pravidlo 1).
- PŘEDPOKLAD: Lean české UI — nové hlášky věcné, bez sentimentu.

## Otevřené otázky

Seřazeno podle toho, jak moc odpověď mění návrh (nahoře největší dopad).

1. **Překlad do češtiny — ano/ne a jak?** Lokálně bez serveru a bez modelu kvalitní překlad nejde.
   Varianty:
   (a) **nepřekládat** — recept zůstane anglicky, přeložit si ho jde ručně v náhledu (nulová
   cena, offline);
   (b) **přeložit mimo appku** — uživatel si popisek přeloží v IG („Zobrazit překlad") nebo
   v Google Překladači a vloží český text (nulová cena, parser jen musí zvládnout i český
   strojový překlad);
   (c) **malý vestavěný slovník** jen pro značky, podsekce („For the icing" → „Na polevu") a
   jednotky (tsp → lžička) — offline, bez závislosti, ale suroviny a kroky zůstanou anglicky;
   (d) **překladač v prohlížeči** (Chrome Translator API) — bez npm závislosti, ale podle
   dostupných informací jen v desktopovém Chrome, na mobilu ne (nutno ověřit);
   (e) **online služba** (DeepL/Google/LLM) — kvalitní, ale nová závislost, síť (pravidlo 11),
   API klíč v klientovi (pravidlo 12 povoluje jen `anon`) nebo server, který appka nemá.
   Dopady: anglický recept **nenajde hledání česky** („skořice" ≠ „cinnamon"), **nenabídne
   napojení** na českou databázi potravin a v anglických krocích nefungují časovače
   „hours/mins/seconds". Co chceš?

2. **Uchovat původní vložený text?** Dnes se originál po uložení ztratí (`rawCapture` je jen
   zrcadlo upraveného náhledu a při editaci se přepočítá). U IG receptu to znamená ztrátu úvodu,
   maker a — při překladu — anglického originálu. Varianty: nechat jak je / uložit originál jako
   poznámku k receptu (UC020, bez změny modelu) / nové pole v modelu (migrace, architekt).
   Souvisí s pravidlem 2 („původní zachycený text se nepřepisuje").

3. **Jak text z IG dostáváš?** Kopíruješ text popisku (předpoklad), nebo máš v ruce jen odkaz /
   screenshot? Pokud jen odkaz nebo screenshot, parser sám nepomůže a jde o UC026 (načtení z URL
   / OCR — síť nebo nová závislost). Ukázka v zadání vypadá jako zkopírovaný text.

4. **Anglické jednotky (tsp/tbsp/cup/oz/lb) — jen text, nebo i rozumět jim?** Text zůstává
   vždy (pravidlo 1). Otázka je, co z tohohle chceš v této story:
   (a) nic navíc — škálování „1 tsp" → „2 tsp" funguje už dnes;
   (b) aby jednotka nepropadla do hledání potraviny („tsp baking powder" → „baking powder");
   (c) `oz`/`lb` převádět na gramy při napojování (jednoznačné: 28,35 g / 453,6 g);
   (d) párovat `tbsp`↔`lžíce`, `tsp`↔`lžička`, `cup`↔`hrnek` s mírami potravin (UC017) —
   pozor, US cup = 240 ml, „hrnek" v appce si definuješ sám;
   (e) opravit škálování unicode zlomků, smíšených čísel a rozsahů („1 1/2 cups" dnes ×2 dá
   chybně „2 1/2 cups") — týká se i českých receptů („1–2 lžíce").
   (b)–(d) jsou fáze 2 (napojení); (e) je věcná chyba zobrazení.

5. **°F → °C?** Původní text se nepřepisuje. Varianty: (a) nechat „375°F" (přepočítáš si sám);
   (b) v náhledu **doplnit** „375°F (190 °C)" — uvidíš a potvrdíš před uložením; (c) nechat text
   a přepočet jen **zobrazit** na detailu/ve vaření (jako škálování). Zaokrouhlení: 375 °F =
   190,6 °C — na 5 °C (190) nebo na 10 °C? Platí i pro „Gas mark"?

6. **Kam s úvodem, makry, poznámkami a časy?** Dnes se text před značkou (kromě prvního řádku)
   zahodí. Varianty pro úvod + makra + „Notes/Tips": zahodit / do poznámky k receptu (UC020) /
   na konec postupu (ve vaření by z nich byly kroky). A `Prep/Cook/Total time` — předvyplnit
   „Dobu přípravy" (to by přidalo pole do náhledu; a kterou hodnotu: total, nebo prep + cook?),
   nebo ignorovat?

7. **Anglické časy v krocích jako časovače?** Ve vaření dnes klikne „15 minutes", ale ne „mins",
   „1 hour", „hr", „30 seconds". Rozšířit v rámci této story, nebo zvlášť (a jen pokud se
   nepřekládá — OO1)?

8. **Název, když chybí.** Když popisek začíná větou („The BEST protein cinnamon rolls 🔥 only
   150 kcal!"), nabídnout ji jako název (případně očištěnou o emoji/hashtagy a zkrácenou), nebo
   nechat pole prázdné a jen ho zvýraznit? Když začíná rovnou „Ingredients:", zůstane prázdné —
   stačí fallback „Vložený recept", nebo chceš něco jiného (např. kurzor rovnou v poli Název)?

9. **Hashtagy → štítky?** Zahodit (předpoklad), nebo nabídnout jako štítky? IG hashtagy jsou
   většinou balast (#healthyrecipes, #fyp), takže automaticky spíš ne. A **autor / @handle**:
   uložit jako zdroj receptu (`Recipe.source` existuje, ale nikde se nezobrazuje)?

10. **Jak odvážně hledat podsekce?** Konzervativně jen řádek s dvojtečkou (předpoklad), nebo i
    řádek velkými písmeny bez dvojtečky („FOR THE ICING")? A podsekce v **postupu** („For the
    icing:" mezi kroky) — nechat jako řádek (ve vaření z něj bude krok), nebo zavést nadpisy
    i pro postup (rozšíření UC023, dotkne se režimu vaření)?

## Rozhodnutí (uživatel 2026-09-23) — platí pro návrh i implementaci

1. **Překlad: NE.** Recept zůstává v jazyce autora. Žádná nová závislost, žádná síť, vše offline.
   (Česky si uživatel doplní název a štítky.)
2. **Původní vložený text se uloží jako poznámka k receptu** (existující mechanismus poznámek,
   UC020) — celý, beze změny, včetně úvodu, maker a poznámek autora. Žádná změna schématu DB.
   Splňuje pravidlo 2 (nic se neztratí), i když se suroviny/postup v náhledu upraví.
3. **°F → °C: doplnit do textu postupu** ve tvaru `375°F (190 °C)` — originál zůstává, převod je
   jen přidaný a viditelný/upravitelný v náhledu. Zaokrouhlení na 5 °C (190, ne 191).

### Defaulty potvrzené mlčky (uživatel nerozporoval)
4. **Podsekce** = řádek končící dvojtečkou bez množství → `# X` (UC023); konzervativně — řádky
   velkými písmeny bez dvojtečky se za nadpis nepovažují. Jen v surovinách.
5. **Název**: značka sekce nikdy není název; když chybí, pole zůstane prázdné k doplnění
   (uložení použije dnešní fallback).
6. **Hashtagy a výzvy** („Follow @…", řádky jen s `#tagy`) se zahodí; `@autor` se, je-li
   rozpoznán, vyplní do `Recipe.source`.
7. **Porce** jen z řádků „Serves / Makes / Yield / Porce", nikdy z textu kroků. **„Prep time"**
   → `prepMinutes`, pokud jde spolehlivě přečíst.
8. **Anglické časy v krocích** (min/mins/minutes, hr/hour(s), sec/seconds) se chytají jako časovače.
### Doplnění po Fázi 2 (user-advocate must-fixy + architekt, uživatel 2026-09-23)
10. **A — nápověda, jak z IG zkopírovat text** na obrazovce Vložit + v hlášce při vložení
    samotného odkazu.
11. **B — rozdělaný náhled přežije zavření appky:** nová tabulka Dexie `importDrafts` (v7,
    aditivní, bez migrace dat) — **schváleno uživatelem**. Opakované „Rozebrat" nesmí bez dotazu
    přepsat ruční úpravy v náhledu.
12. **C — náhradní název** „Recept od @autor" (je-li autor), jinak dnešní fallback; po „Rozebrat"
    fokus do pole Název.
13. **D — zdroj `@autor`** editovatelný v náhledu a zobrazený v detailu receptu. Úprava zdroje
    v editaci, hledání a filtr podle zdroje patří do samostatné položky „Od koho".
14. **E — originál** = samostatná poznámka s pevnou hlavičkou `Originál (vložený text):`, v detailu
    sbalená a vizuálně oddělená od uživatelových poznámek. Hlavička se nesmí měnit.
15. **Doba přípravy:** `Total time`, když je uvedený, jinak `Prep time` (kvůli filtru „⚡ Rychlé").
16. **Souhrn v náhledu** „13 surovin (1 sekce) · 8 kroků". Ostatní drobnosti (časovač u rozsahu,
    dvojí číslování ve vaření, štítky v náhledu) **odloženy**.

### UC031b — skutečné popisky a „bez rozebrání" (uživatel 2026-09-25)
Offline parser selhal na všech 4 skutečných popiscích, které uživatel dodal (`src/lib/igSamples.ts`):
název z řádku maker, kroky mezi surovinami, sekce bez dvojtečky nebo v `[Sauce]`. Varianta
s Claude API byla zvážená a **zamítnutá** (placené API mimo předplatné). Rozhodnutí:
17. **Zůstává offline parser**, vylepšený tak, aby tyhle 4 popisky rozebral správně (testy).
18. **„Uložit bez rozebrání"**: vložený text se uloží jako recept tak, jak je (název = první
    řádek, celý text v postupu, žádné suroviny). Pro texty, které parser netrefí.
19. **Pole „Od koho" v náhledu ani na detailu není**, uživatele nezajímá. `source` se dál tiše
    ukládá kvůli náhradnímu názvu.

9. **Mimo rozsah:** oprava škálování zlomků/rozsahů (`1 1/2`, `1–2`, `½`) — patří do plánovaného
   #2+3 „Vaření, kterému se dá věřit"; převody jednotek (oz/lb → g); vložení odkazu / screenshotu
   (UC026). Jednotky tsp/tbsp/cup zůstávají volný text (pravidlo 1).
