# Návrh: UC031 — Vložení receptu z Instagramu (a jiných cizích textů)

## Co řešíme

Spec: [`docs/specs/uc031-vlozeni-receptu-z-instagramu.md`](../specs/uc031-vlozeni-receptu-z-instagramu.md),
závazná sekce **Rozhodnutí (uživatel 2026-09-23), body 1–9**, plus must-fixy A–E od user-advocate.
Zkopírovaný popisek z IG (anglicky, se sekcemi, podsekcemi a balastem) má na obrazovce „Vložit"
dopadnout do správných polí, originál se nesmí ztratit a rozdělaný náhled má přežít přepnutí appky.
Vše offline, bez nové závislosti a bez překladu (Rozhodnutí 1).

Rozhodnutí beru jako mandát. Otevřené bylo jen **jak** je technicky provést: rozdělení parseru,
kam s originálem bez změny schématu, jak udržet rozdělaný náhled a co dělat s must-fixy.

### Ověřený stav kódu (vstup pro návrh)

- `parseRecipe.ts`: značky jen CZ, řádek musí být celý jen značkou. Porce = libovolný řádek s „porc" +
  číslem (i krok postupu). V režimu se značkami se jako název bere první neprázdný řádek, takže
  i sama značka.
- `ImportRecipeScreen.tsx`: 6× `useState`, nic se neukládá do DB, dokud uživatel neklepne na „Uložit".
  Náhled nemá pole doby ani zdroje. `rawCapture = combineRawCapture(náhled)`, originál se zahodí.
  Opakované „Rozebrat" přepíše náhled bez dotazu.
- **Poznámky (UC020)**: tabulka `recipeNotes {id, recipeId, notedOn, body}`, **víc datovaných
  poznámek** na recept (`addRecipeNote`, detail je vypisuje od nejnovější). Vstup je **jednořádkový
  `<input>`**, takže uživatel víceřádkovou poznámku vytvořit nemůže. Mazání je **natvrdo**
  (`db.recipeNotes.delete`), tedy stávající dluh vůči pravidlu 7. `RecipeNote` nemá `deletedAt`.
  Poznámky jsou v záloze (`BackupData.recipeNotes`). `duplicateRecipe` je nekopíruje a `emptyTrash`
  je nemaže.
- **Koncepty:** samostatná tabulka ani mechanismus draftů **neexistuje**. „Průběžné ukládání
  konceptu" v `RecipeEditScreen` znamená, že se rovnou založí a průběžně přepisuje **skutečný recept**
  v `recipes` (debounce 500 ms, `createRecipeWithContent`/`updateRecipeContent`). Zařízení-lokální
  stav bez SQL protějšku už v Dexie je: `cookSessions` (v3) a `timers` (v4). Nejsou v záloze ani
  v `supabase/migrations/0001_init.sql`.
- **Časovače:** `CookingModeScreen` dělí `instructions` na kroky po řádcích (`split(/\n+/)`), čísluje je
  `index + 1` v kolečku a text kroku posílá do `splitStepByDurations`. `DURATION_RE` chytne „15 minutes"
  (`minut[a-z]*`), ale ne „mins/hour/hr/sec/seconds". `unitToSeconds` přitom anglické tvary **už umí**
  (`startsWith('h' | 'min' | 's')`), stačí tedy rozšířit regex.
- `Recipe.source` existuje a je indexovaný, ale **nikde se nezapisuje ani nezobrazuje**
  (`createRecipeWithContent` dává `null`, `RecipeContent` pole nemá). `prepMinutes` se ukládá
  a zobrazuje (⏱, filtr „⚡ Rychlé" ≤ 30 min).
- `ConfirmDialog` v `components/ui/` existuje (UC030), znovu se použije.
- Ověřeno v Node: `NFKD` převede `𝗜𝗻𝗴𝗿𝗲𝗱𝗶𝗲𝗻𝘁𝘀` i `𝘐𝘯𝘴𝘵𝘳𝘶𝘤𝘵𝘪𝘰𝘯𝘴` na ASCII, ale **změní i `½` → `1⁄2`**
  a `’` nechá být. NFKD se proto smí použít **jen na rozpoznání značek**, nikdy na obsah.
  Obecná třída `[\p{P}\p{S}\p{Z}]` na odrážky by uřízla i `#`, `~` a `(`, takže je potřeba výjimka.

## Zvažované varianty

### 1) Struktura parseru

| Varianta | Pro | Proti |
|---|---|---|
| **Klasifikace řádků + průchod sekcemi, malé čisté funkce ve 2 nových modulech** (zvoleno) | Každé pravidlo z Rozhodnutí je samostatná, tabulkově testovatelná funkce; `parseRecipeText` zůstane čitelná orchestrace; heuristika bez značek zůstane skoro beze změny | Víc souborů; pořadí klasifikace (metadata před značkou) je potřeba pohlídat testem |
| Rozšířit regexy přímo v dnešním `parseRecipe.ts` | Nejméně souborů | Z jedné funkce by vzniklo ~300 řádků větvení; dnes 4 testy, bude jich ~60 a nebude jasné, co je čím pokryté |
| Obecný „recipe grammar" / tokenizer | Elegantní | Přestřelené pro best-effort parser, za kterým stejně vždy následuje náhled |

### 2) Kam s originálem (Rozhodnutí 2 + must-fix E), bez změny schématu

| Varianta | Pro | Proti |
|---|---|---|
| **Samostatná poznámka `recipeNotes` s pevnou hlavičkou `Originál (vložený text):` na 1. řádku; detail ji pozná a vykreslí zvlášť, sbalenou** (zvoleno) | Nulová změna schématu; jednoznačné rozpoznání (uživatel víceřádkovou poznámku přes UI vytvořit nemůže); přežije zálohu i obnovu; vlastní poznámky zůstanou čisté | Hlavička je „protokol v textu": nesmí se už nikdy změnit (staré poznámky by se přestaly poznávat) |
| Originál do `recipes.rawCapture` | Pole se tak jmenuje | `RecipeEditScreen` i `syncRawCapture` ho **přepočítávají** z náhledu, takže by se originál při první editaci ztratil. Rozhodnutí 2 říká poznámka |
| Nové pole `Recipe.originalText` | Čisté | Změna modelu + SQL migrace; Rozhodnutí 2 ji výslovně vylučuje |

### 3) Rozdělaný náhled musí přežít zavření PWA (must-fix B)

| Varianta | Pro | Proti |
|---|---|---|
| **Nová zařízení-lokální tabulka `importDrafts` (Dexie v7, jeden řádek `id: 'current'`)** (zvoleno) | Náhled žije mimo `recipes`: nic polovičatého se neobjeví v seznamu ani v koši; vzor `cookSessions`/`timers` (lokální, bez SQL, bez zálohy); po znovuotevření `/vlozit` se prostě obnoví | **Bump schématu v7** (aditivní, jedna tabulka). Rozhodnutí 2 „bez změny schématu" se týkalo originálu, ale **je potřeba to od uživatele odsouhlasit** |
| Znovupoužít vzor `RecipeEditScreen`: po „Rozebrat" hned založit recept a průběžně ho přepisovat | Žádná změna schématu, jediný existující „draft" mechanismus | Neuložený import se objeví v seznamu jako „Vložený recept"; zrušení by znamenalo soft-delete a zaplevelení koše; originál by musel vzniknout už při rozebrání a při opakovaném rozebrání se přepisovat (dnes neexistuje `updateRecipeNote`); `servings` v tom toku chybí |
| `sessionStorage` / `localStorage` | Triviální | **Zakázáno pravidlem 6** |

Pokud uživatel v7 neodsouhlasí, fallbackem je varianta 2 řádku (recept jako koncept) a zbytek návrhu
platí beze změny.

## Zvolené řešení

1. **Parser** = klasifikace každého řádku (značka / hashtagy / výzva / porce / doba / metadata / text)
   → průchod stavovým automatem sekcí (každá značka přepne sekci, sekce končí **jen další značkou**,
   ne prázdným řádkem) → úklid surovin (odrážka → číslo seznamu → podsekce `# X`) → úklid postupu
   (°F → doplnit °C). Bez jediné značky se použije **dnešní heuristika**, jen se z ní napřed odfiltrují
   řádky s hashtagy, výzvami a metadaty a v postupu se doplní °C.
2. **`ParsedRecipe` zpětně kompatibilně:** nová pole jsou **volitelná a vynechaná, když nic nenajdu**
   (ne `null`). Dnešní `toEqual` testy tak projdou beze změny (`toEqual` ignoruje `undefined` klíče).
3. **Originál** = samostatná poznámka s hlavičkou (varianta 2A), zakládá se ve **stejné transakci**
   jako recept.
4. **Časovače:** rozšířit `DURATION_RE` o anglické tvary. `unitToSeconds` beze změny.
5. **Náhled na obrazovce Vložit:** nová pole „Doba (min)" a „Od koho" (obojí z Rozhodnutí 7/6 musí
   být vidět a upravitelné, spec I). Stav náhledu je jeden objekt, průběžně ukládaný do `importDrafts`.
   Opakované rozebrání se po ruční úpravě zeptá přes `ConfirmDialog`.
6. **Detail:** `od @autor` v meta řádku. Originál se vykreslí jako sbalené `<details>` „Originál"
   pod vlastními poznámkami.

Proč takhle: všechno, co se dá splést (rozpoznání značek, porcí, podsekcí, °F, časů, hlavičky
originálu, detekce ručních úprav), je v `src/lib/` a pokryje se node testy dřív než UI. DB a UI
zůstávají tenké obaly, stejně jako u UC030.

## Dopad na kód

### `src/lib/recipeImportLines.ts` — NOVÝ, klasifikace a úklid řádků (čistá logika)

Skica signatur (ne produkční kód):

```ts
export type SectionKind = 'ingredients' | 'instructions' | 'other';

export interface SectionMarker {
  section: SectionKind;
  /** Obsah za dvojtečkou na stejném řádku („Ingredients: 90g flour" → „90g flour"); '' když není. */
  inline: string;
  /** Porce ze závorky („Ingredients (makes 8):", „Suroviny (na 4 porce):"). */
  servings?: number;
}

/** JEN pro porovnávání: NFKD → bez diakritiky → lowercase → ’‘` na ' → uřízne úvodní
 *  emoji/odrážky/ZWJ/VS16 a koncové emoji/mezery. Na obsah se NIKDY nepoužívá (½ → 1⁄2!). */
export function normalizeMarkerText(line: string): string;

/** Řádek, který je CELÝ značkou (+ volitelně „(…)" a „: obsah"). „Mix the ingredients well." → null. */
export function matchSectionMarker(line: string): SectionMarker | null;

export function isHashtagLine(line: string): boolean;        // všechny tokeny `#slovo`; „# Na těsto" NE
export function isPromoLine(line: string): boolean;          // Follow @…, Save this…, Comment X for…, link in bio, Recipe by @…, samotné @handle
export function extractAuthorHandle(line: string): string | undefined; // „@fitfoodie" jen z promo/credit řádku
export function parseServingsLine(line: string): number | undefined;   // Serves/Servings/Makes/Yield/Porce/„4 servings"/„Pro 4 osoby"/„Na 4 porce"
export function parsePrepTimeLine(line: string): number | undefined;   // Prep time/Prep/Doba přípravy/„Příprava: 20 min" → minuty
export function isMetaLine(line: string): boolean;           // Cook time, Total time, Macros…, Nutrition…, „… kcal" řádek maker
export function stripLeadingBullet(line: string): string;    // * - • · ▪️ ✅ 🔸 ▢ ☐ …; NE # ~ ≈ ( a číslice/zlomky
export function stripListNumbers(lines: string[]): string[]; // „1. 90 g mouky" → „90 g mouky", jen když čísla jdou 1,2,3…
export function toSubsectionHeading(line: string): string;   // „For the icing:" → „# For the icing"; jinak beze změny
```

Pravidla, na která je potřeba dát pozor:

- **Sady značek** (po `normalizeMarkerText`, ukotveno na začátek i konec, s volitelným `(…)` a `: obsah`):
  - suroviny: `ingredients?`, `ingredient list`, `what you('ll)? need`, `you'?ll need`, `suroviny`,
    `ingredience`, `potrebujeme`, `budete potrebovat`;
  - postup: `instructions?`, `directions?`, `method`, `steps?`, `how to make( it)?`, `preparation`,
    `postup`, `priprava`, `instrukce`, `navod`, `jak na to`;
  - `other` (**jen holá značka bez obsahu na řádku**): `notes?`, `tips?`, `poznamk[ay]`, `equipment`,
    `vybaveni`, `nutrition( info| facts)?`. Obsah sekce se do náhledu nedostane, zůstane v originále.
    „Tip: …" s obsahem na stejném řádku **není** značka (jinak by „Tip:" uprostřed postupu smazal
    zbytek kroků).
- **Pořadí klasifikace:** hashtagy → výzva → porce → doba → metadata → značka → text. „Příprava: 20 min"
  je tedy doba, ne značka postupu s obsahem „20 min".
- **Číslované kroky** (`^\d+[.)]`, `^step \d`, keycap `1️⃣`) se **nikdy** neklasifikují jako výzva ani
  metadata („3. Save the rest for later." zůstane).
- **Podsekce** = řádek v sekci surovin, který končí `:`, **nezačíná číslicí ani zlomkem**, má ≤ 60 znaků
  a **není už nadpisem** (`isIngredientHeading`). Díky tomu „- # Na těsto" ze sdílení → `# Na těsto`,
  nikoli `# # Na těsto`. CAPS bez dvojtečky se nadpisem nestává (Rozhodnutí 4).
- **Odrážky:** třída úvodních znaků `[\p{P}\p{S}\p{Z}\p{M}‍]` **mínus** `#`, `~`, `≈`, `(`. Emoji
  uvnitř řádku zůstávají („50 g butter 🧈").
- `parsePrepTimeLine` sčítá segmenty z `splitStepByDurations` (znovupoužití `duration.ts`,
  „1 hr 15 mins" → 75). Bez rozpoznané délky vrátí `undefined` („spolehlivě přečíst", Rozh. 7).

### `src/lib/temperature.ts` — NOVÝ

```ts
/** (F − 32) × 5/9, zaokrouhleno na 5 °C (Rozhodnutí 3): 375 → 190, 350 → 175, 400 → 205. */
export function fahrenheitToCelsius5(f: number): number;
/** Za každý údaj ve °F doplní „ (NNN °C)". Chytá „375°F", „375 °F", „375ºF", „350F", „350 degrees F",
 *  „… Fahrenheit" i rozsah „350–375°F" → „ (175–190 °C)". Přeskočí, když hned následuje údaj v °C
 *  („375°F (190°C)", „375°F / 190°C"). Holé „350F" bez ° jen pro 100–600 (ne „Step 2F"). °C ani
 *  „C fan" se nemění. */
export function addCelsiusToFahrenheit(text: string): string;
```

Zaokrouhlení v textu je vědomé rozhodnutí uživatele (Rozh. 3). Nejde o hodnotu datové vrstvy,
takže pravidlo 9 neporušuje.

### `src/lib/parseRecipe.ts` — orchestrace

```ts
export interface ParsedRecipe {
  name: string;
  servings: number | null;
  ingredients: string[];
  instructions: string | null;
  /** UC031: „@autor", jen když se našel. Klíč chybí = nenalezeno (zpětná kompatibilita toEqual). */
  source?: string;
  /** UC031: minuty z „Prep time" / „Doba přípravy", jen když jdou spolehlivě přečíst. */
  prepMinutes?: number;
}

/** Celý vstup je jen URL (IG „Kopírovat odkaz") → UI ukáže nápovědu, nic se nerozebírá. */
export function isBareUrl(text: string): boolean;

export function parseRecipeText(text: string): ParsedRecipe;
```

Tok uvnitř `parseRecipeText` (každý krok je volání výše uvedené funkce):

1. Rozdělit na řádky (CRLF → LF, `trimEnd`). Pro každý řádek klasifikace. Porce (první nalezená, i ze
   závorky značky), doba (první) a autor (první) se posbírají. Řádky hashtagů, výzev, porcí, doby
   a metadat **vypadnou ze všech sekcí**.
2. Pokud existuje aspoň jedna značka: projít stavovým automatem `preamble → (ingredients |
   instructions | other)*`. Opakovaná značka stejné sekce nic nepřepíná. `inline` obsah značky je
   první řádek sekce.
3. **Název** = první `text` řádek preambule (bez hashtagových tokenů, zkrácený na 80 znaků jako
   `deriveName`). Když preambule žádný nemá, zůstane `''` a značka se názvem nikdy nestane. Zbytek
   preambule se zahodí (je v originále).
4. **Suroviny:** `stripLeadingBullet` → `stripListNumbers` → `toSubsectionHeading` → bez prázdných.
5. **Postup:** řádky beze změny (včetně číslování), prázdné běhy sloučit na jeden prázdný řádek,
   `addCelsiusToFahrenheit`, `trim() || null`.
6. Bez značek: dnešní heuristika (název = první řádek / prázdný řádek / odrážky) nad **odfiltrovanými**
   řádky, dnešní `stripBullet` nahradit `stripLeadingBullet` (je to jeho nadmnožina) a v postupu
   doplnit °C. Podsekce se tu **nepřevádějí** (spec G „jako dnes").

Vědomá změna chování: porce se už neberou z libovolného řádku s „porc" + číslem, jen z řádku metadat
(Rozh. 7). Krok „Rozdělit na 4 porce." proto nově **zůstane v postupu** (dnes zmizí). Existující testy
to nepokrývají, nic se nerozbije.

### `src/lib/duration.ts`

- `DURATION_RE` rozšířit o anglické jednotky (delší tvary dřív):
  `hodin[a-z]*|hod|hours?|hrs?|h|minut[a-z]*|mins?|m|sekund[a-z]*|sek|seconds?|secs?|s`.
  Ověřeno: „5 mins", „1 hour", „2 hrs", „30 seconds", „10 sec", „1 hr 30 mins" (2 segmenty); „Bake
  2 sheets" a „4 servings" nic.
- `unitToSeconds` **beze změny**. Anglické tvary už pokrývá přes `startsWith`.

### `src/lib/originalNote.ts` — NOVÝ (must-fix E, Rozhodnutí 2)

```ts
/** NEMĚNIT – podle této hlavičky se poznávají i staré poznámky (a poznámky ze zálohy). */
export const ORIGINAL_NOTE_HEADER = 'Originál (vložený text):';
export function buildOriginalNote(pasted: string): string;          // HEADER + '\n' + text beze změny
export function originalNoteText(body: string): string | null;      // text originálu, nebo null = běžná poznámka
export function partitionNotes<T extends { body: string }>(notes: T[]): { own: T[]; originals: T[] };
```

Jednoznačnost: rozpoznává se `body.startsWith(HEADER + '\n')`. Poznámky z detailu jdou přes
jednořádkový `<input>`, takže uživatel takovou poznámku nevytvoří.

### `src/lib/importPreview.ts` — NOVÝ (must-fix B, C)

```ts
export interface ImportPreview {
  name: string; servings: string; prepMinutes: string; source: string;
  ingredients: string; instructions: string;          // textové hodnoty polí, jak je vidí uživatel
}
export function previewFromParsed(parsed: ParsedRecipe): ImportPreview;
/** Liší se náhled od stavu hned po posledním „Rozebrat"? → ptát se před přepsáním. */
export function isPreviewEdited(current: ImportPreview, parsedAs: ImportPreview): boolean;
/** „Recept od @autor", když je zdroj; jinak dnešní „Vložený recept". */
export function fallbackImportName(source: string): string;
```

### `src/db/index.ts` — v7 `importDrafts` (must-fix B, **ke schválení**)

```ts
/** Rozdělaný náhled na obrazovce Vložit (UC031). Stav zařízení jako cookSessions: bez SQL, bez zálohy. */
export interface ImportDraft {
  id: 'current';
  pasteText: string;
  /** Text, ze kterého vznikl náhled; při uložení jde do poznámky „Originál". null = nerozebráno. */
  parsedText: string | null;
  preview: ImportPreview | null;
  /** Náhled hned po „Rozebrat", slouží k detekci ručních úprav. */
  parsedPreview: ImportPreview | null;
  updatedAt: IsoTimestamp;
}
// this.version(7).stores({ importDrafts: 'id' });
```

`ImportPreview` je čistý typ z `lib/importPreview.ts`. `db` ho jen importuje (jako dnes `Meal`
z `lib/nutrition`).

### `src/features/recipes/importDraftRepo.ts` — NOVÝ

```ts
export function getImportDraft(): Promise<ImportDraft | undefined>;
export function saveImportDraft(draft: Omit<ImportDraft, 'id' | 'updatedAt'>): Promise<void>; // put
export function clearImportDraft(): Promise<void>;   // delete – zařízení-lokální stav jako cookSessions, pravidlo 7 se netýká
/** Jedna transakce [recipes, recipeItems, recipeNotes, importDrafts]: recept + porce + originál + smazání konceptu. */
export function saveImportedRecipe(input: {
  content: RecipeContent; servings: number | null; originalText: string;
}): Promise<string>;
```

`saveImportedRecipe` uvnitř volá `createRecipeWithContent`, `updateRecipeMeta` a `addRecipeNote`
(vnořené Dexie transakce nad podmnožinou tabulek jsou v pořádku) a pak `clearImportDraft`. Dnešní
nepárové `create` + `updateRecipeMeta` se tím zároveň stane atomickým.

### `src/features/recipes/recipesRepo.ts`

- `RecipeContent` + `source?: string | null` (volitelné, takže `RecipeEditScreen` se nemění).
- `createRecipeWithContent`: `source: content.source?.trim() || null`.
- `updateRecipeContent` **beze změny** (`source` nepřepisuje, editace ho tedy nesmaže).

### `src/features/recipes/ImportRecipeScreen.tsx`

- Stav: `pasteText`, `preview: ImportPreview | null`, `parsedPreview`, `parsedText`, `message`,
  `saving`, `confirmReparse`.
- **Načtení konceptu** (jednou, vzor `loadedRef` z `RecipeEditScreen`). Když existuje, obnoví se
  a nahoře se ukáže řádek „Obnoven rozdělaný náhled." + `ghost` tlačítko „Zahodit"
  (`clearImportDraft` + reset). Bez autofocusu.
- **Průběžné ukládání:** debounce 400 ms `saveImportDraft` + **okamžitý flush na
  `visibilitychange → hidden`**, protože PWA na pozadí může zemřít dřív, než debounce doběhne.
  Neukládá se, dokud se nenačetlo, ani když je vše prázdné.
- **Rozebrat / Vložit ze schránky:** `isBareUrl` → hláška (A), nic dál. Jinak, když
  `preview && isPreviewEdited(preview, parsedPreview)` → `ConfirmDialog` „Přepsat náhled?" / „Ruční
  úpravy náhledu se ztratí." / `confirmRole="destructive"` „Přepsat". Jinak rovnou rozebrat.
- **Náhled:** Název (placeholder `Název – jinak „{fallbackImportName(source)}"`), řádek
  `Porcí · Doba [ ] min · Od koho [ ]` (`flex-wrap`), Suroviny, Postup. Po rozebrání s prázdným
  názvem `nameRef.focus()` + `scrollIntoView({ block: 'center' })` (C).
- **Uložit:** `saving` blokuje dvojí klepnutí. `saveImportedRecipe({ content: { …, source,
  prepMinutes: parseDecimal(prepMinutes), tags: [] }, servings, originalText: parsedText })` →
  `navigate('/recept/:id')`. `rawCapture` zůstává `combineRawCapture(náhled)` (zrcadlo, jako dnes).
- **Nápověda (A):** pod vložným polem, dokud není náhled, jeden řádek `text-xs text-stone-400`.

### `src/features/recipes/RecipeDetailScreen.tsx`

- Meta řádek: `… · ⏱ 25 min · od @autor` (jen když `recipe.source`). Jen text, bez odkazu (D).
- Poznámky: `const { own, originals } = partitionNotes(notes)`. Seznam vlastních poznámek beze změny
  nad `own`. Pod ním každý originál jako nativní `<details>` (bez stavu, přístupné) se `summary`
  „Originál · 23. 9. 2026", uvnitř `whitespace-pre-wrap text-sm` s `originalNoteText(body)`
  a `IconButton` „Smazat originál" (dnešní `handleDeleteNote` + undo).

### Testy (nové / rozšířené, viz sekce Testy)

`recipeImportLines.test.ts`, `temperature.test.ts`, `originalNote.test.ts`, `importPreview.test.ts`
(nové); `parseRecipe.test.ts`, `duration.test.ts` (rozšířit, dnešní případy beze změny).

## Změny datového modelu

- **Recept, položky, poznámky: bez změny.** `source` a `prepMinutes` už v `Recipe` jsou. Originál je
  běžný řádek `recipeNotes`.
- **Formát těla poznámky:** konvence `Originál (vložený text):\n<text>`. Aditivní, stará data
  nedotčená, žádná migrace.
- **Dexie v7: nová tabulka `importDrafts: 'id'`** (jeden řádek). Aditivní bump, stávající data se
  nemigrují. **Bez SQL migrace** (lokální stav zařízení, stejně jako `cookSessions`/`timers`)
  a **bez zálohy** (`BackupData` se nemění). **Vyžaduje souhlas uživatele** (viz varianta 3).
- `RecipeContent` (TS rozhraní repa): `+ source?: string | null`.

## Plán implementace

Pořadí volím tak, aby po každém kroku appka běžela a `npm run lint` + `npm run test` byly zelené.
Testy se píšou **před** kódem (CLAUDE.md).

1. **`lib/temperature.ts` + testy.** *Hotovo, když:* tabulka případů °F/°C (níže) je zelená.
2. **`lib/duration.ts` regex + testy.** *Hotovo, když:* nové EN případy i všechny 4 dnešní testy
   projdou; ve vaření je „5 mins" klikací (ruční kontrola na existujícím receptu).
3. **`lib/recipeImportLines.ts` + testy** (klasifikátory a úklid, tabulkově). *Hotovo, když:*
   pozitivní i negativní tabulky projdou.
4. **`lib/parseRecipe.ts` přepsat na orchestraci + testy** (IG ukázka, regrese). Obrazovka se
   nemění, nová volitelná pole zatím ignoruje. *Hotovo, když:* 4 dnešní testy beze změny očekávání
   + nové testy zelené; ruční vložení IG ukázky dá 13 surovin a 8 kroků.
5. **`lib/originalNote.ts`, `lib/importPreview.ts` + testy.** *Hotovo, když:* zelené.
6. **`db` v7 + `importDraftRepo.ts` + `RecipeContent.source`.** *Hotovo, když:* `tsc` prochází;
   appka se po upgradu DB otevře a stávající recepty jsou vidět (DevTools → IndexedDB má
   `importDrafts`).
7. **`ImportRecipeScreen`:** pole Doba/Od koho, náhradní název + fokus (C), URL hláška + nápověda (A),
   ukládání přes `saveImportedRecipe` (originál). *Hotovo, když:* uložený IG recept má na detailu
   13 surovin s nadpisem „For the icing", 8 kroků a v DB poznámku s hlavičkou.
8. **`ImportRecipeScreen`: koncept v `importDrafts` + dotaz před přepsáním (B).** *Hotovo, když:* na
   mobilu rozebrat → upravit název → přepnout appku / zabít ji → znovu otevřít `/vlozit` → náhled
   i úprava jsou zpět; „Rozebrat" po úpravě se zeptá; po uložení je koncept pryč.
9. **`RecipeDetailScreen`: `od @autor` (D) + sbalený originál (E).** *Hotovo, když:* vlastní poznámky
   se vypisují jako dřív, originál je sbalený pod nimi s popiskem „Originál", smazání jde vrátit.
10. **Volitelné nice-to-have** (viz níže), každé zvlášť.
11. **Ověření:** `npm run lint`, `npm run test`, `npm run build`; ručně IG ukázka na mobilu (světlý
    i tmavý režim), český text ze sdílení (round-trip), vložení samotné URL, offline režim.

## Testy

**`parseRecipe.test.ts`, 4 dnešní testy beze změny.** Nové:

- **Celá IG ukázka ze spec** (fixture = ukázka s kroky 1–8 vypsanými celé; `...` ze spec doplnit
  věrohodným textem). Očekávání:
  - `name === ''`, `servings === null`, bez `source`/`prepMinutes`;
  - `ingredients` = přesně 13 řádků: `90g all-purpose flour`, `85g non-fat plain Greek yogurt`,
    `1 tsp baking powder`, `Pinch of salt`, `4 tsp zero-calorie sugar-free brown sugar`,
    `Cinnamon, to taste`, `Pinch of salt`, `# For the icing`, `2 tbsp light cream cheese`,
    `20g non-fat plain Greek yogurt`, `30g powdered monk fruit sweetener`, `10ml almond milk`,
    `1 tsp pure vanilla extract`;
  - `instructions.split(/\n+/)` má **8** položek, první začíná `1. Add your flour`, žádná neobsahuje
    `Instructions` ani `cream cheese`; krok 5 obsahuje `375°F (190 °C) for 12–15 minutes`.
- **IG ukázka + balast:** před ní „The BEST protein cinnamon rolls 🔥" + „Macros per roll: 150 kcal…",
  za ní „Follow @fitfoodie for more!", „Save this recipe 🔖", „Comment ROLLS for the full recipe"
  a blok `#protein #healthyrecipes #fyp`. Očekávání: `name` = úvodní věta, `source === '@fitfoodie'`,
  stále 13 surovin a 8 kroků (žádný hashtag, výzva ani makra).
- **Tučné písmo:** `𝗜𝗻𝗴𝗿𝗲𝗱𝗶𝗲𝗻𝘁𝘀` / `𝗜𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀` se chová jako obyčejné značky.
- **Postup před surovinami:** `Instructions:\n1. Mix\n\nIngredients:\n- 2 eggs` → suroviny `['2 eggs']`,
  postup `1. Mix`.
- **Značka s obsahem:** `Ingredients: 90g flour, 85g yogurt` → první surovina `90g flour, 85g yogurt`.
- **Značka se závorkou:** `Suroviny (na 4 porce):` → `servings 4`; `Ingredients (makes 8):` → 8.
- **Porce:** `Serves 4–6` → 4, `Makes 8 rolls` → 8, `Yield: 8`, `4 servings`, `Pro 4 osoby`;
  **negativ:** krok „Divide into 8 portions" / „Rozkrojte na 8 porcí" → `servings null` a krok zůstane.
- **Doba:** `Prep time: 10 minutes` → 10; `Prep: 1 hr 15 mins` → 75; `Doba přípravy: 20 min` → 20;
  `Prep time: a few minutes` → klíč chybí; `Cook time: 25 min` → není doba ani surovina.
- **Regrese round-trip se sekcí:** `buildRecipeText({ ingredients: ['# Na těsto', '200 g mouky'], … })`
  → `ingredients` přesně `['# Na těsto', '200 g mouky']` (ne `# # Na těsto`, ne `Na těsto`).
- **Bez značek:** text jen s odrážkami a hashtagovým řádkem na konci → dnešní výsledek bez hashtagu.
- **Podsekce jen v surovinách:** `For the icing:` v postupu zůstane řádkem postupu.
- `isBareUrl`: `https://www.instagram.com/p/abc/` → true; `  www.x.cz  ` → true; recept obsahující URL → false.

**`recipeImportLines.test.ts` (tabulkově):**

- `matchSectionMarker` pozitivní: `Ingredients`, `INGREDIENTS:`, `🥣 Ingredients:`, `Ingredients 👇`,
  `Ingredient list`, `What you need:`, `You’ll need`, `Potřebujeme:`, `Budete potřebovat`,
  `Instructions`, `Directions:`, `👩‍🍳 Method`, `Steps`, `How to make`, `Preparation`, `Postup`,
  `Příprava`, `Instrukce`, `Návod`, `Jak na to:`, `Notes:` (other). Negativní: `Mix the ingredients well.`,
  `Ingredients for the sauce:`, `Tip: use parchment`.
- `isHashtagLine`: `#vegan #protein` ano; `# Na těsto`, `Enjoy! #yum` ne.
- `isPromoLine`: `Follow @x for more`, `Save this recipe for later 🔖`, `Comment ROLLS for the recipe`,
  `Link in bio`, `@fitfoodie` ano; `3. Save the rest of the icing for later.`, `Save 2 tbsp for garnish` ne.
- `stripLeadingBullet`: `* `, `- `, `• `, `· `, `▪️ `, `✅ `, `🔸 `, `▢ `, `☐ ` pryč; `# Na těsto`,
  `~200 g`, `(optional) salt`, `½ cup`, `1️⃣ Mix` beze změny; `50 g butter 🧈` beze změny.
- `stripListNumbers`: `['1. 90 g mouky', '2. 2 vejce']` → `['90 g mouky', '2 vejce']`;
  `['1.5 kg brambor']` beze změny; `['3. vejce', '7. mouka']` (neposloupné) beze změny.
- `toSubsectionHeading`: `For the icing:` → `# For the icing`; `Na polevu:`, `Dough:`; `2 eggs:`,
  `FOR THE ICING`, `# Na těsto:` beze změny.

**`temperature.test.ts`:** `375°F` → `375°F (190 °C)`; `350F`, `350 °F`, `350 degrees F`, `350ºF`
→ `(175 °C)`; `400°F` → 205; `350–375°F` → `(175–190 °C)`; beze změny: `375°F (190°C)`,
`375°F / 190°C`, `200 °C`, `180C fan`, `Step 2F`.

**`duration.test.ts`:** `5 mins` 300, `1 hour` 3600, `2 hrs` 7200, `1 hr 30 mins` dva segmenty,
`30 seconds` 30, `10 sec` 10; negativ `Bake 2 sheets`, `4 servings`, `375°F`. `12–15 minutes`
dokumentuje dnešní chování (klikací `15 minutes`), viz nice-to-have.

**`originalNote.test.ts`:** build → `originalNoteText` round-trip (víceřádkový text i s emoji beze
změny); běžná poznámka „Originál je lepší" → `null`; `partitionNotes` rozdělí a zachová pořadí.

**`importPreview.test.ts`:** `fallbackImportName('@x')` → `Recept od @x`, `''` → `Vložený recept`;
`isPreviewEdited` false hned po rozebrání, true po změně libovolného pole.

**Ručně:** přežití konceptu po zabití PWA (Android i iOS), dotaz před přepsáním, fokus do Název,
sbalený originál, `od @autor`, offline, tmavý režim.

## Must-fixy A–E

| | Řešení | Velikost | Rozsah |
|---|---|---|---|
| **A** Nápověda k IG | Statický řádek pod vložným polem (dokud není náhled): „Instagram: ⋯ → Kopírovat odkaz, otevři ho v prohlížeči a tam zkopíruj text popisku." Hláška při samotné URL: „Odkaz neotevřu. Otevři ho v prohlížeči, zkopíruj text popisku a vlož ho sem." | **S** | Čisté rozšíření UC031 (spec H) |
| **B** Náhled přežije zavření + nepřepsat úpravy | `importDrafts` (Dexie v7), debounce + flush na `visibilitychange`, obnova po otevření `/vlozit` s „Zahodit"; `isPreviewEdited` → `ConfirmDialog` | **M** | UC031, ale **mění schéma (v7)**, nutný souhlas. Zároveň mění řádek okrajových případů spec („Opakované Rozebrat… beze změny") |
| **C** Náhradní název + fokus | `fallbackImportName` („Recept od @autor" / „Vložený recept"), ukázaný v placeholderu; fokus do Název jen když je prázdný | **S** | Čisté rozšíření |
| **D** Zdroj v náhledu a na detailu | Pole „Od koho" v náhledu, `RecipeContent.source`, `od @autor` v meta řádku detailu | **S** | Sahá do `recipesRepo` (volitelné pole) a detailu. Editace zdroje v `RecipeEditScreen`, hledání (`recipeHaystack`) a filtr podle autora nechávám na „Od koho" (SPEC R-03/R-20/R-21/E-19) |
| **E** Originál oddělený a sbalený | Poznámka s pevnou hlavičkou, `partitionNotes`, `<details>` „Originál" pod vlastními poznámkami | **S** | Bez změny schématu; sahá do zobrazení UC020 na detailu |

Pozn. k D: položka „Od koho" v `docs/specs/use-cases-navrhy.md` **není**. Existuje jen jako
požadavky v `docs/SPEC.md` (R-03 pole „od koho", R-20 fulltext, R-21 filtr podle autora, E-19 pole
hned při zachycení). Doporučuju, aby ji BA do backlogu zapsal. Do té doby uživatel překlep ve zdroji
po uložení **neopraví** (editace zdroj nezobrazuje). To je známá mezera, první krok té story.

## Nice-to-have (odhad, neplánováno závazně)

| Položka | Řešení | Velikost | Doporučení |
|---|---|---|---|
| Souhrn „13 surovin (1 sekce) · 8 kroků" | Čistá `previewSummary(ingredients, instructions)` přes `isIngredientHeading` + `czechPlural` | S | **Ano**, levné a hned ukáže, jestli parser trefil sekce |
| Štítky v náhledu | Znovupoužít `TagInput` + `tagSuggestions`, `tags` do `ImportPreview` | S | Volitelně. Podle Rozh. 1 si uživatel štítky doplňuje sám, tady by to šlo bez další editace |
| „Vypadá to zkráceně" | `looksTruncated(text, parsed)`: končí na „… more / …více", nebo je značka surovin a chybí postup → jeden řádek pod náhledem | S | Ano, pokud se v praxi objeví zkrácené popisky |
| Časovač u rozsahu „12–15 minutes" | V `DURATION_RE` předřadit rozsah `(\d+)\s*[–-]\s*(\d+)\s*unit`, celý úsek klikací, sekundy = **dolní** mez (u pečení kontrola dřív) | S | Ano, u anglických receptů je to běžné |
| Dvojí číslování „(1) 1. Add…" ve vaření | Čistá `stepDisplayText(step, index)` uřízne vedoucí `N.`/`N)`/`Step N:`, když `N === index + 1`. Jen zobrazení, data beze změny (pravidlo 2) | S | Ano, ale jako samostatný commit, protože sahá do `CookingModeScreen` |

## Rizika a co může selhat

- **Falešná značka / falešná výzva.** Každé zahození řádku je ztráta v náhledu. Zmírnění: značky jen
  jako celý řádek, výzvy úzkou sadou vzorů, nikdy číslované kroky. Originál navíc je v poznámce, takže
  se nic neztratí nevratně. Negativní testy jsou povinné.
- **`other` sekce spolkne kroky.** Holé „Notes:" uprostřed postupu by skryla zbytek. Proto jen holá
  značka a „Tip: …" s obsahem značkou není. Originál tuto chybu kryje.
- **NFKD na obsahu** by rozbil zlomky (`½` → `1⁄2`). Pravidlo: NFKD jen v `normalizeMarkerText`.
  Nadpis podsekce ve fancy písmu zůstane fancy (`# 𝗙𝗼𝗿 𝘁𝗵𝗲 𝗶𝗰𝗶𝗻𝗴`). Je to věrné znění, jen ošklivé.
- **Hlavička originálu je trvalý kontrakt.** Změna textu `ORIGINAL_NOTE_HEADER` = staré originály se
  začnou zobrazovat jako běžné poznámky. Konstanta s komentářem NEMĚNIT + test.
- **Koncept a zabití PWA.** Debounce nemusí stihnout doběhnout, proto flush na `visibilitychange`.
  Zápis do IndexedDB při `hidden` ale prohlížeč negarantuje na 100 %. Nejhůř se ztratí posledních
  ~400 ms psaní.
- **Dexie v7 upgrade.** Aditivní tabulka je bezpečná. Starší build ale novější DB neotevře (stejné jako
  každý předchozí bump).
- **Dvojí uložení.** Bez `saving` guardu by dvojí klepnutí založilo 2 recepty a 2 originály. Guard
  + jedna transakce, která zároveň maže koncept.
- **Sémantika `prepMinutes`.** Rozh. 7 bere „Prep time", ale appka pole používá pro „⚡ Rychlé"
  (≤ 30 min). IG „Prep 10 / Cook 25 / Total 35" tedy recept označí za rychlý. Viz místo k potvrzení.
- **Stávající dluhy, které tahle story zviditelní (neopravuje):** poznámky (i originál) se mažou
  **natvrdo** (pravidlo 7). `emptyTrash` nemaže `recipeNotes`, takže originál smazaného receptu
  zůstane v DB jako sirotek. `duplicateRecipe` poznámky nekopíruje, kopie tedy originál nemá.
  Komentář u `Recipe.rawCapture` („NIKDY se nepřepisuje") neodpovídá kódu, který ho přepočítává.
- **Cesta kopírování z IG (A) se mění podle verze appky.** Text nápovědy před nasazením ověřit na
  uživatelově telefonu. Odkaz „Otevřít v prohlížeči" přímo z hlášky jsem vědomě nenavrhl: na
  Androidu by odkaz instagram.com nejspíš skočil zpátky do IG appky (App Links).

## Místa, kde jsem rozhodoval (k potvrzení)

1. **Dexie v7 `importDrafts`** pro must-fix B. Rozhodnutí 2 „bez změny schématu" se týkalo originálu.
   Tohle je aditivní lokální tabulka, ale je to změna schématu, **potřebuju souhlas**. Fallback:
   recept jako koncept (varianta 3B).
2. **`Cook time` / `Total time` se nikam nepromítají** (Rozh. 7 zmiňuje jen Prep). Doporučení
   k potvrzení: brát `Total time`, když je, jinak `Prep time`, protože to líp sedí na „⚡ Rychlé".
3. **Sekce Notes/Tips/Equipment/Nutrition** se do náhledu nedostanou (zůstanou v originále). Spec je
   nechával na OO6, Rozh. 2 to podle mě pokrývá.
4. **Název z úvodní věty** preambule, jen očištěný o hashtagy a zkrácený na 80 znaků (OO8 nebyla
   výslovně rozhodnuta, Rozh. 5 řeší jen chybějící název).
5. **Autor jen z promo/credit řádků** („Follow @x", „Recipe by @x", samotné „@x"), ne z libovolné
   zmínky (`1 scoop @myprotein whey` by jinak byl „autor"). Zkopírovaný IG popisek autora často vůbec
   neobsahuje, proto je pole v náhledu editovatelné.
6. **°C se doplňuje jen do postupu** (Rozh. 3), ne do surovin ani názvu.

## Co tento návrh vědomě neřeší

- Překlad (Rozh. 1), převody oz/lb → g, párování tsp/tbsp/cup s mírami, škálování `½`, `1 1/2`,
  `1–2` (Rozh. 9, patří do „Vaření, kterému se dá věřit").
- Načtení z URL, OCR, Web Share Target (UC026).
- Editace/hledání/filtr zdroje („Od koho", SPEC R-03/R-20/R-21) mimo náhled a detail.
- Podsekce v postupu a CAPS nadpisy bez dvojtečky (Rozh. 4).
- Soft-delete poznámek, úklid poznámek v `emptyTrash`, kopírování poznámek při duplikaci. Každé je
  samostatný malý úkol (`deletedAt` na `RecipeNote` jde bez bumpu schématu, neindexované pole jako
  u `FoodPortion`).
- Mazání hashtagů na konci jinak textového řádku („Enjoy! #yum" zůstane).
- Jiné jazyky než CZ/EN.
