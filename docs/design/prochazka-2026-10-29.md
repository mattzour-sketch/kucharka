# Návrh: Procházka 2026-10-29 – časovače, displej, rozdělení řádků, spojené časy

## Co řešíme

Spec: [`docs/specs/prochazka-2026-10-29.md`](../specs/prochazka-2026-10-29.md), body 1–4, včetně
rozhodnutí Martina z 2026-10-29: „Zastavit" má taky „Vrátit zpět" a dělí se jen podle čárek,
středníků a odrážek. Shrnutí: vrátit omylem zrušený nebo zastavený časovač a prodloužit doběhlý
o 5 min, opravit zámek displeje po návratu do appky, ručně rozdělit diktát z jednoho řádku na řádky
nebo kroky a brát „1 h 30 min" jako jeden časovač. Bez změny schématu DB a bez nové závislosti.

### Změny po schválení (Martin 2026-10-29)

Mají přednost před zbytkem návrhu:

1. **„Zastavit" doběhlého časovače ho jen ztlumí** (místo smazání a lišty „Časovač zastaven"
   s Vrátit). Nové nepovinné neindexované pole `Timer.silencedAt?: IsoTimestamp | null`, bez
   nové verze `stores()` a bez migrace (Dexie v `stores()` deklaruje jen klíč a indexy,
   stejně přibylo `ImportDraft.tags`). Logika v `lib/timers.ts`: `timerState(timer, now)` →
   `running | ringing | silenced`, `isTimerGone` (zastaralý, nebo ztlumený ≥
   `SILENCED_TIMER_MS` = 2 min), `snoozedEndsAt`. Repo: `silenceTimer`, `snoozeTimer`
   (`endsAt` = teď + 5 min, `silencedAt: null`), `removeStaleTimers` → `removeGoneTimers`
   (tvrdé smazání jako dřív, `timers` jsou zařízení-lokální). `TimerDock` zvoní jen pro
   `ringing`; ztlumený řádek „Hotovo" má „+5 min" a „×" (smaže hned). „Zrušit" běžícího
   časovače má dál lištu „Časovač zrušen" s Vrátit zpět (bod 1.1 níže platí jen pro Zrušit).
2. **Texty:** `ingredientSplitLabel` = „Rozdělit na N surovin" (2–4 „suroviny"),
   `stepSplitLabel` = „Rozdělit na N kroků" (2–4 „kroky"). Lišta „Rozděleno".
3. **Spojené časy jen bez spojky:** `JOIN_GAP_RE = /^\s*$/`. „1 h a 30 min" a „1 hour and 30
   minutes" zůstanou dva úseky. Riziko „Vař 10 min a 30 s" (níže) tím odpadá.

### Ověřený stav kódu (vstup pro návrh)

- **Lišta „Vrátit zpět"** (`components/UndoProvider.tsx`): drží jednu akci, za 6 s zmizí, má „×".
  Sedí `fixed bottom-20 z-50` (80 px od spodku) a obal přes celou šířku (`inset-x-0 px-4`) chytá
  ťuknutí i mimo samotnou pilulku. `showUndo` nic nevrací a lištu zvenku zavřít nejde.
  `TimerDock` se vykresluje uvnitř `UndoProvider` (`App.tsx`), takže `useUndo()` v něm funguje.
- **Překryv s dockem je skutečný.** Dock je `fixed z-30`, na obrazovkách se spodní lištou
  `bottom-14` (56 px), jinde `bottom-0`. Řádek docku má asi 52 px. Na záložkách lišta „Vrátit zpět"
  (80–124 px) překryje **první** řádek docku, ve vaření překryje **druhý** řádek. Na mobilu je
  pilulka (`max-w-sm`) skoro stejně široká jako displej, takže zakryje i tlačítko vpravo.
- **Časovače** (`timerRepo.ts`): `removeTimer` maže natvrdo. `timers` je zařízení-lokální tabulka,
  není v záloze ani v SQL, takže pravidlo 7 se jí netýká (stejné jako dnes u Hotovo).
  `restoreTimers` dělá `bulkPut`, tedy vrací tentýž záznam se stejným `id`, `label` a `endsAt`.
  Zvonění řídí `anyExpired` v `TimerDock` (efekt `startAlarm`/`stopAlarm`), takže vrácený
  doběhlý časovač se rozezvoní sám.
- **`useWakeLock`**: chyba je přesně podle spec. `sentinel` po skrytí drží uvolněný zámek a
  `!sentinel` v `onVisibilityChange` už neplatí. Logika je přímo v `useEffect` a sahá na globální
  `navigator` a `document`, takže v node testu ji nejde spustit. Projekt nemá `vi.stubGlobal` ani
  fake DOM nikde.
- **Pole Suroviny a Postup**: `RecipeEditScreen` má `useState` pro každé pole, debounce autosave
  500 ms, „Zahodit" se vrací na `originalRef`. `ImportRecipeScreen` drží obě pole v `preview`
  (`updateField`), „Přepsat náhled?" se ptá podle `isPreviewEdited(preview, parsedPreview)`
  a souhrn je `previewSummary` za běhu. Ruční rozdělení se tak v náhledu automaticky počítá jako
  úprava a souhrn se přepočítá bez dalšího kódu.
- **Kroky** se ve vaření dělí `split(/\n+/)` (`CookingModeScreen.tsx:423`), stejně jako
  v `previewSummary`.
- **`duration.ts`**: `DURATION_RE` končí `\b`. „1h30min" proto dnes chytí jen „30min",
  protože mezi `h` a `3` hranice slova není. `\b` je ASCII, takže „5 minutách" dnes chytí „5 minut".
  To se nesmí rozbít. `parseTimeLine` sčítá sekundy všech úseků (`durationMinutes`) a
  `isOnlyDuration` kontroluje text mimo úseky. Spojení úseků proto součty nezmění.

## Zvažované varianty

### A) „Vrátit zpět" a dock: jak nezakrýt tlačítka

| Varianta | Pro | Proti |
|---|---|---|
| Nic neměnit, „×" už existuje | Nulová změna | Na zvonící „Zastavit" jsou potřeba dvě přesná ťuknutí mokrým prstem. Spec to připouští jen jako nouzi |
| Lištu dát nahoru, když je dock vidět | Jednoduché CSS | Lišta skáče mezi horní a dolní částí. Nahoře zakryje hlavičku s „Hotovo" a „Zpět" |
| Jeden společný spodní „stack" v `App.tsx` (UndoBar nad dockem ve flex sloupci) | Bez měření | Vykreslení lišty se musí vytáhnout z `UndoProvider`. Mění se pozice lišty na všech obrazovkách bez docku. Zásah do víc souborů |
| **Dock nahlásí, kolik místa zabírá, a lišta se posune nad něj** (zvoleno) | Lišta zůstane tam, kde je dnes, a jen se zvedne, když je pod ní dock. Řeší i ostatní lišty („Uloženo do historie" s vrácenými časovači). Jedno číslo v kontextu | Měření přes `ResizeObserver`. `UndoProvider` dostane drobný obecný vstup („dole je obsazeno N px"), o časovačích ale nic neví |

### B) Wake lock testovatelný v node

| Varianta | Pro | Proti |
|---|---|---|
| Opravit jen hook a testovat s `vi.stubGlobal('navigator'/'document')` a `renderToStaticMarkup` | Málo souborů | `renderToStaticMarkup` nespouští `useEffect`, takže hook v node vůbec nepoběží. Bez @testing-library to nejde |
| **Čistý „keeper" v `src/lib/wakeLock.ts` se vstřikovanými závislostmi, hook jen napojí `navigator.wakeLock` a `document`** (zvoleno) | Test bez globálů, deterministický. Stejný vzor jako ostatní `lib/` | Nový soubor. Spec mluví o „podvrženém `navigator.wakeLock` a `document`" a podvrhy jsou tu parametry, ne globály. Smysl kritéria je stejný |

### C) Undo po rozdělení, aby nesmazalo text napsaný potom

| Varianta | Pro | Proti |
|---|---|---|
| Snapshot celého pole, Vrátit ho bez podmínky přepíše | Triviální | Smaže, co se napsalo po rozdělení. Porušuje kritérium |
| Jen „compare-and-swap": Vrátit vrátí pole, jen když je pořád přesně výsledek rozdělení, jinak nic | Bezpečné, žádná změna `UndoProvider` | „Vrátit zpět" na liště zůstane a ťuknutí nic neudělá. Na mobilu s klávesnicí navíc lišta 6 s visí nad polem, do kterého se píše |
| **CAS + lišta zmizí, jakmile se do toho pole začne psát nebo se obrazovka zavře** (zvoleno) | Žádné mrtvé tlačítko. CAS jistí i okrajové případy (nové „Rozebrat", Zahodit) | `showUndo` musí vracet funkci na zavření (zpětně kompatibilní, dnešní volající návratovou hodnotu ignorují) |

### D) Spojené časy

| Varianta | Pro | Proti |
|---|---|---|
| Jeden velký regex pro „h? min? s?" se spojkami | Jeden průchod | Nečitelné. Pořadí jednotek a „každá jednou" se v regexu hlídá špatně. Riziko backtrackingu |
| **Dnešní regex najde jednotlivé časy, druhý krok sousední spojí podle mezery mezi nimi a pořadí jednotek** (zvoleno) | Regex se mění minimálně. Pravidla P4-1 jsou čitelná podmínka. Rozsahy se nemění | Malá úprava konce regexu kvůli „1h30min" (viz rizika) |

## Zvolené řešení

### Bod 1 – časovače

1. **Zrušit / Zastavit** (po schválení platí jen pro Zrušit, Zastavit viz „Změny po schválení") v `TimerDock`: kopie záznamu `timer` (celý objekt z `useLiveQuery`) →
   `removeTimer(timer.id)` → `showUndo({ message: done ? 'Časovač zastaven' : 'Časovač zrušen',
   undo: () => { primeAlarm(); return restoreTimers([timer]); } })`. Vrací se tentýž záznam
   (stejné `id`, `label`, `endsAt`), takže odpočet „běžel dál". Když `endsAt` mezitím uplynul,
   `anyExpired` ho sám rozezvoní a nabídne „+5 min". `primeAlarm()` je na začátku `undo`, protože
   `handleUndo` volá `run()` synchronně v obsluze kliknutí, tedy v gestu uživatele.
   Jedna akce v `UndoProvider` (P1-3) platí beze změny: další `showUndo` přepíše předchozí, takže
   dřív zrušený časovač zůstane zrušený.
2. **+5 min** jen u doběhlého (`done`): `primeAlarm(); void snoozeTimer(timer.id)`. Repo přepíše
   `endsAt` na `snoozedEndsAt(Date.now())`. Počítá se od ťuknutí, ne od původního konce (P1-1),
   a druhý záznam nevznikne. Dvojí ťuknutí dá 5:00 od posledního ťuknutí, protože druhé taky jen
   přepíše `endsAt`. Zvonění přestane samo, až `anyExpired` = false (jiný zvonící zvoní dál).
3. **Nezakrýt dock**: `UndoProvider` dostane `setBottomInset(px)`. `TimerDock` měří svou pevnou
   `<section>` (`ref` + `ResizeObserver` + změna `pathname`) a hlásí
   `window.innerHeight - rect.top` (vzdálenost horní hrany docku od spodku okna, včetně `bottom-14`
   nad záložkami). Když je dock prázdný nebo se odpojí, hlásí 0. Lišta má místo `bottom-20`
   inline `bottom = max(80, inset + 8)` px. Bez docku tedy sedí přesně jako dnes, s dockem těsně
   nad ním. K tomu dvě drobnosti:
   - vnější obal lišty `pointer-events-none`, pilulka `pointer-events-auto`, aby prázdné okraje
     obalu nechytaly ťuknutí,
   - hodnota kontextu přes `useMemo`, aby změna insetu nepřekreslovala všechny `useUndo()`
     konzumenty.

### Bod 2 – wake lock

Nový `src/lib/wakeLock.ts` (čistá logika, žádné globály):

```ts
export interface WakeLockSentinelLike { release(): Promise<void> }
export interface WakeLockLike { request(type: 'screen'): Promise<WakeLockSentinelLike> }
export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}
/** Drží displej rozsvícený, dokud se nezavolá vrácená funkce `stop`. */
export function keepScreenAwake(wakeLock: WakeLockLike | undefined, doc: VisibilitySource): () => void;
```

Chování (stav `stopped`, `sentinel`, `pending`):
- `acquire()`: nic, když `stopped`, `pending`, chybí API, dokument není `visible`, nebo už
  `sentinel` je. Jinak `pending = true` → `await request('screen')`. Po návratu: když je mezitím
  `stopped` **nebo dokument není `visible`**, zámek hned uvolní a nedrží ho (závod „žádost
  doběhla až po skrytí"). Jinak `sentinel = next`. `catch` mlčí. `finally` nastaví `pending = false`.
- `visibilitychange` → `hidden`: **sám** zavolá `sentinel?.release().catch(() => {})` a
  `sentinel = null`. Jádro opravy: po skrytí appka nikdy nedrží odkaz na mrtvý zámek. Explicitní
  `release()` je idempotentní a zaručuje „nejvýš jeden živý zámek", i kdyby ho prohlížeč sám
  neuvolnil.
- `visibilitychange` → `visible`: `acquire()`.
- Když systém zámek uvolní, zatímco je appka vidět, nic se neděje (P2-1): `sentinel` drží
  uvolněný objekt a další pokus přijde až po příštím skrytí a návratu. Bez posluchače `release`
  a bez smyčky.
- `stop()`: `stopped = true`, odebrat posluchač, uvolnit `sentinel`.

`hooks/useWakeLock.ts` se zmenší na
`useEffect(() => keepScreenAwake(getWakeLock(), document), [])`. Volání v
`CookingModeScreen` zůstává stejné, takže zámek dál drží jen vaření (P2-2).

### Bod 3 – rozdělit na řádky / na kroky

Nový `src/lib/lineSplit.ts`:

```ts
export interface SplitProposal {
  /** Nový obsah celého pole (ostatní řádky beze změny, i prázdné a v původním pořadí). */
  text: string;
  /** N do nabídky: suroviny bez nadpisů, resp. všechny kroky v poli, po rozdělení. */
  count: number;
}
export function splitIngredientLine(line: string): string[];   // části jednoho řádku
export function splitSentences(line: string): string[];        // věty jednoho řádku
export function proposeIngredientSplit(text: string): SplitProposal | null;
export function proposeStepSplit(text: string): SplitProposal | null;
export function ingredientSplitLabel(count: number): string;   // „Rozdělit na 3 suroviny" (czechPlural)
export function stepSplitLabel(count: number): string;         // „Rozdělit na 3 kroky"
```

- **`splitIngredientLine`**: jeden průchod znaky s hloubkou závorek `(`/`)` (neuzavřená `(`
  dál nedělí, přebytečná `)` hloubku nepodlezne pod 0). Oddělovač na hloubce 0 je `;`, `•`
  a `,`, kromě čárky, která má **těsně** před sebou i za sebou číslici („1,5"). Části se ořežou
  a prázdné zahodí („2 vejce, , sůl,"). Žádný regex s backtrackingem, O(n).
- **`proposeIngredientSplit`**: `text.split('\n')`. Nadpis (`isIngredientHeading`) se nikdy
  nedělí. Řádek se nahradí `parts.join('\n')`, jen když splní P3-2: **≥ 3 části, nebo 2 části,
  které obě začínají číslicí**. Ostatní řádky zůstanou znak po znaku (P3-4). Když se nezmění žádný
  řádek, vrátí `null`. `count` = `splitIngredientLines(text)` bez nadpisů.
- **`splitSentences`**: jeden průchod s průběžným začátkem „slova" (`tokenStart` se posune
  na každé mezeře), takže kontrola zkratky je O(1) a celé je O(n) i pro 5000 znaků bez mezer.
  Hranice věty: běh `.`/`!`/`?`, za ním volitelně uzavírací `)`, `"`, `“`, `”`, `»`, `'`, `’`,
  pak ≥ 1 mezera a další znak `\p{Lu}` nebo číslice. Výjimky platí jen pro samotnou `.`: slovo
  před ní (malými písmeny, bez úvodní závorky nebo uvozovky) je v `ABBREVIATIONS = ['cca', 'např',
  'tzv', 'tj', 'resp', 'popř', 'příp']`, nebo je celé z číslic („1." jako pořadí). „1.5" se
  nedělí, protože za tečkou není mezera. Věta si nechá svou tečku. Mezi větami se jen mezera
  nahradí `\n`.
- **`proposeStepSplit`**: dělí jen řádky s **≥ 3 větami** (P3-3). `count` = neprázdné řádky
  výsledku, tedy počet kroků v poli po rozdělení, stejně jako `previewSummary` a vaření.
- **Idempotence** plyne z konstrukce: části už nemají oddělovač na hloubce 0 ani hranici věty.
  Ověří se testem.

**UI pro obě obrazovky** přes jeden hook a jednu komponentu:

- `src/features/recipes/useSplitOffer.ts`:
  ```ts
  useSplitOffer(kind: 'ingredients' | 'steps', value: string,
                update: (fn: (current: string) => string) => void)
    → { label: string | null; apply: () => void; noteEdit: () => void }
  ```
  - `proposal = useMemo(...)` podle `value`.
  - `apply()`: `before = value`, `after = proposal.text`, pak `update(() => after)` a
    `dismissRef.current = showUndo({ message: 'Rozděleno', undo: () => update((current) =>
    current === after ? before : current) })`. Tím je zajištěný CAS: když se pole po rozdělení
    změnilo, Vrátit nic nepřepíše.
  - `noteEdit()`: volá se z `onChange` pole (jen uživatelský vstup, ne programové nastavení) a
    zavře lištu, pokud je pořád „naše" (`dismissRef.current?.()`, pak `null`).
  - Cleanup efektu při odpojení obrazovky taky zavře „naši" lištu. Po „Uložit" by jinak na
    detailu zůstalo Vrátit, které už nic nevrátí.
- `src/features/recipes/SplitOffer.tsx`: malý `Button role="ghost"` s textem `label`.
  `label === null` → nic. Sedí **vpravo v řádku popisku pole** („SUROVINY … Rozdělit na 3
  řádky"). Řádek popisku má pevnou výšku podle tlačítka, takže objevení nabídky nic neposune. Nic
  nedostává fokus a nic se nevolá z `onChange`, kromě výpočtu nabídky.
- `RecipeEditScreen`: `update = setIngredients` / `setInstructions` (oba setState berou
  funkci). Autosave, snapshot i „Zahodit" fungují beze změny, rozdělení je pro ně jen další úprava
  textu.
- `ImportRecipeScreen`: `update = (fn) => setPreview((prev) => prev ? { ...prev, ingredients:
  fn(prev.ingredients) } : prev)` (pro postup analogicky). Když `preview` mezitím zmizel
  (Zahodit), Vrátit nic neudělá.

### Bod 4 – spojené časy

V `splitStepByDurations` nejdřív posbírat jednotlivé shody (dnešní regex) jako
`{ start, end, seconds, rank }`, kde `rank` je h = 0, min = 1, s = 2 (nová `unitRank` vedle
`unitToSeconds`). Pak sousední spojit, když:
- text mezi nimi odpovídá `JOIN_GAP_RE = /^\s*$/` (jen mezery nebo nic; spojka „a"/„and",
  čárka, tečka i jiné slovo spojení zabrání – změna po schválení), a
- `rank` nové shody je **větší** než `rank` poslední shody ve skupině (h → min → s, každá
  jednotka nejvýš jednou).

Úsek skupiny = `step.slice(first.start, last.end)` (spojka je uvnitř klikacího úseku),
`seconds` = součet. Shoda s `seconds <= 0` se dál přeskakuje a do mezery se počítá jako text,
takže spojení přeruší.

Konec regexu `\b` → `(?![a-z])` (s příznakem `i`). Rozdíl proti `\b`: za jednotkou smí hned
následovat číslice („1h30min", „2h30m10s"). Diakritika za jednotkou se chová stejně jako dnes:
„5 minutách" je dál „5 minut", protože `á` není `[a-z]`, stejně jako dnes není `\w`.

`parseTimeLine` se nemění. Součty sekund jsou stejné a spojka „a"/„and" je teď uvnitř úseku,
takže ji `isOnlyDuration` ani nevidí.

## Dopad na kód

- `src/lib/duration.ts` – `unitRank`, sběr shod a spojování skupin v `splitStepByDurations`,
  konec `DURATION_RE` `\b` → `(?![a-z])`. Veřejné API (`DurationSegment`, signatura) beze změny.
- `src/lib/duration.test.ts` – **přepsat** test „„1 hr 30 mins" = dva klikací segmenty" na
  jeden úsek `{ text: '1 hr 30 mins', seconds: 5400 }`. Přidat případy z bodu 4. Ostatní testy
  beze změny.
- `src/lib/recipeImportLines.test.ts` – přidat regresi „Prep: 1 h 30 min" a „Doba přípravy:
  1 h 30 min" → 90. Stávající případy („Prep: 1 hr 15 mins" = 75) se nemění.
- `src/lib/timers.ts` (+ `timers.test.ts`) – `SNOOZE_MS = 5 * 60 * 1000`,
  `snoozedEndsAt(now: number): string`.
- `src/features/recipes/timerRepo.ts` – `snoozeTimer(id, now = Date.now())` =
  `db.timers.update(id, { endsAt: snoozedEndsAt(now) })`.
- `src/components/undoContext.ts` – `showUndo: (request) => () => void` (vrací „zavři, pokud jsem
  to pořád já"), nové `setBottomInset: (px: number) => void`.
- `src/components/UndoProvider.tsx` – id aktuální akce v `ref` kvůli dismiss, stav `bottomInset`,
  inline `bottom`, `pointer-events`, `useMemo` hodnoty kontextu.
- `src/features/recipes/CookingTimers.tsx` (`TimerDock`) – `useUndo`, Zrušit/Zastavit s undo,
  „+5 min" u doběhlého, měření a hlášení insetu.
- **nový** `src/lib/wakeLock.ts` + `wakeLock.test.ts` – logika zámku, testovatelná v node.
- `src/hooks/useWakeLock.ts` – tenký obal nad `keepScreenAwake`, typy se přesunou do `lib/`.
- **nový** `src/lib/lineSplit.ts` + `lineSplit.test.ts` – rozpoznání a rozdělení.
- **nový** `src/features/recipes/useSplitOffer.ts` – sdílený hook obou obrazovek. Je to
  samostatný `.ts`, protože pravidlo `react-refresh/only-export-components` nechce hook v
  `.tsx` vedle komponenty.
- **nový** `src/features/recipes/SplitOffer.tsx` – tlačítko nabídky.
- `src/features/recipes/RecipeEditScreen.tsx` – dvakrát `useSplitOffer`, řádky popisků se
  `SplitOffer`, `noteEdit()` v `onChange` obou textarea.
- `src/features/recipes/ImportRecipeScreen.tsx` – totéž nad `preview`.

`CookingModeScreen.tsx` se nemění (dělení kroků `\n+` i `useWakeLock()` zůstávají).

## Změny datového modelu

Žádné. Žádná nová tabulka, index, verze `stores()` ani SQL migrace. „+5 min" přepíše `endsAt`
existujícího záznamu v `timers`, „Vrátit" vrátí tentýž záznam (`bulkPut`). Rozdělení je úprava
textu polí, která se uloží stávající cestou (`updateRecipeContent` → `pairEditedLines`,
`rawCapture` přes `combineRawCapture`). Nová závislost není potřeba (`ResizeObserver` a Wake Lock
API jsou API prohlížeče).

## Plán implementace

Každý krok končí zeleným `npm run lint` a `npm run test` a appka jde spustit. Logika má testy
dřív než UI.

1. **Spojené časy – testy** (`duration.test.ts`, `recipeImportLines.test.ts`). Přepsat test
   „dva klikací segmenty". Přidat: „Péct 1 h 30 min" → 1 úsek 5400; „Bake 1 hr 30 mins" → 5400;
   „1 hodinu 30 minut" 5400; „2 h 30 min 10 s" 9010; „1 h a 30 min" a „1 hour and 30 minutes"
   5400 (spojka uvnitř `text`); „1h30min" a „1h 30m" 5400; „30 min 1 h" a „20 min 20 min" → dva
   úseky; „Péct 1 h, pak nechat 90 s" beze změny; „Bake for 12–15 minutes" a „1–1,5 h" → horní
   mez; „po 5 minutách" → „5 minut" (regrese diakritiky); „1 h 30" → jen „1 h". Do
   `parseTimeLine` přidat „Prep: 1 h 30 min" a „Doba přípravy: 1 h 30 min" → 90.
   *Hotovo, když:* nové testy padají a jen ty.
2. **Spojené časy – implementace** v `duration.ts`. *Hotovo, když:* testy z kroku 1 projdou a celá
   sada je zelená (včetně `parseRecipe*` a `recipeImportLines`). Ve vaření je „1 h 30 min"
   jedno klikací místo a spustí 1:30:00.
3. **Časovače – logika**: `SNOOZE_MS` a `snoozedEndsAt` v `timers.ts` s testem („doběhlý před 3 min →
   konec = teď + 5 min, nezávisle na původním `endsAt`"). `snoozeTimer` v `timerRepo.ts`.
   *Hotovo, když:* test projde, lint čistý (repo funkce zatím nikde volaná není).
4. **`UndoProvider` – dismiss a inset**: `showUndo` vrací dismiss, `setBottomInset`, inline
   `bottom = max(80, inset + 8)`, `pointer-events`, `useMemo`. *Hotovo, když:* tsc projde (stávající
   volající se nemusí měnit) a ruční kontrola ukáže, že smazání receptu nebo položky nákupu dál
   ukáže lištu na stejném místě jako dnes.
5. **`TimerDock`**: Zrušit/Zastavit s undo („Časovač zrušen" / „Časovač zastaven"), „+5 min" jen u
   `done` (vedle „Zastavit", `role="secondary"`), měření `<section>` → `setBottomInset`, při
   prázdném docku nebo odpojení 0. *Hotovo, když* ruční kontrola v `npm run dev` ukáže:
   - zrušit běžící časovač → Vrátit → stejný název a odpočet, který mezitím ubíhal,
   - časovač na 10 s zrušit, počkat → Vrátit → „Hotovo!" a zvoní,
   - „+5 min" → 5:00 a zvonění přestane. Se dvěma zvonícími zvoní dál,
   - „Zastavit" → Vrátit → zase zvoní a nabízí „+5 min",
   - na seznamu receptů (záložky) i ve vaření se dvěma až třemi časovači lišta „Vrátit zpět" sedí
     nad dockem a žádné tlačítko docku nezakryje.
6. **Wake lock – testy** (`src/lib/wakeLock.test.ts`, falešný `doc` s nastavitelným
   `visibilityState` a mapou posluchačů, falešný `wakeLock.request` jako `vi.fn`, sentinely s
   `release` jako `vi.fn` a počítadlem živých zámků, pomocník `flush()` na mikroúlohy):
   - start ve `visible` → 1× `request`,
   - visible → hidden → visible → `request` 2×, první sentinel `release` 1×,
   - tři cykly → `request` 4× a živý zámek je pořád nejvýš jeden,
   - `stop()` → uvolní a další `visible` už nic nežádá,
   - `wakeLock` `undefined` a `request` reject → nic nevyhodí a bez dalšího pokusu do příštího
     návratu,
   - systém uvolní zámek ve `visible` bez změny viditelnosti → žádný nový `request` (P2-1),
   - závod: `request` visí, přijde `hidden`, pak resolve → zámek se hned uvolní a nedrží.
     Další `visible` → nový `request`,
   - `stop()` během visící žádosti → po resolve uvolněno.
   *Hotovo, když:* testy existují a padají (modul jen se signaturou).
7. **Wake lock – implementace** `keepScreenAwake` a přepis `useWakeLock` na obal. *Hotovo, když:*
   testy z kroku 6 projdou. Ruční ověření na Androidu: ve vaření zamknout, odemknout, chvíli čekat →
   displej nezhasne. Totéž po přepnutí do jiné appky.
8. **Rozdělení – testy** (`src/lib/lineSplit.test.ts`): všechny příklady z akceptačních kritérií
   bodu 3 (suroviny i postup). K tomu:
   - nadpis `# Na těsto, polevu` nedělený,
   - víceřádkové pole s jedním kandidátem (ostatní řádky a prázdné řádky znak po znaku),
   - tvary popisků (2 „suroviny", 5 „surovin"; 3 „kroky", 5 „kroků"),
   - idempotence (`propose*(result.text) === null`),
   - invariant „spojím části `', '` a dostanu původní řádek bez mezer kolem čárek" (tabulka
     několika řádků jen s čárkami),
   - výkon: 5000 znaků s čárkami, 5000 znaků bez mezer s tečkami a 5000 `(` → doběhne v řádu ms,
     stejně jako `parseRecipe.review.test.ts`,
   - prázdné pole a jen mezery → `null`.
   *Hotovo, když:* testy existují a padají.
9. **Rozdělení – implementace** `lineSplit.ts`. *Hotovo, když:* testy z kroku 8 projdou, celá
   sada zelená.
10. **Rozdělení – hook a komponenta** `useSplitOffer.ts`, `SplitOffer.tsx`. *Hotovo, když:* lint a
    tsc projdou (zatím nepoužité).
11. **`RecipeEditScreen`**: řádky popisků s `SplitOffer`, `noteEdit()` v `onChange`. *Hotovo, když*
    ruční kontrola ukáže:
    - diktát na jednom řádku → nabídka → rozdělit → „Rozděleno",
    - Vrátit vrátí přesně původní text,
    - rozdělit a začít psát → lišta zmizí,
    - u Upravit rozdělit a „Zahodit" → recept nerozdělený,
    - uložit, otevřít vaření → suroviny i kroky samostatně a časy klikací,
    - nabídka při psaní neposune pole ani nevezme fokus (mobil).
12. **`ImportRecipeScreen`**: totéž nad `preview`. *Hotovo, když:* po rozdělení se souhrn „N surovin
    · M kroků" hned změní a nové „Rozebrat" se zeptá „Přepsat náhled?". Uložení bez ťuknutí na
    nabídku uloží text nerozdělený.
13. Závěr: `npm run lint`, `npm run test`, nahlásit výsledek. Případně doplnit `lineSplit.ts` a
    `wakeLock.ts` do výčtu `src/lib/` v `CLAUDE.md` (jen se souhlasem Martina).

## Rizika a co může selhat

- **Regex `(?![a-z])` místo `\b`**: nově chytí jednotku těsně před číslicí. „1h30" (bez jednotky
  minut) dá klikací „1h", což je v souladu se spec („1 h 30" → jen „1 h"). Vedlejší účinek: „50 m2"
  by se stalo „50 m" = 50 min. V receptech nepravděpodobné, ale je to změna chování.
- ~~**Spojka „a" mezi časy** spojí i „Vař 10 min a 30 s nech stát" na 630 s.~~ Odpadá, se spojkou
  se nespojuje (změna po schválení).
- **Měření docku**: `ResizeObserver` hlásí velikost, ne pozici. Pozice se mění se změnou
  `pathname` (záložky ↔ ostatní), proto se přeměřuje i na změnu `pathname`. Když se něco přehlédne,
  lišta skončí o kus výš nebo níž, nikdy pod `bottom: 80px`. Funkčnost to nerozbije, „×" zůstává.
- **Mobilní klávesnice**: lišta je `fixed` k layout viewportu. Na Androidu se s klávesnicí
  posune nad ni a může zakrýt spodek pole. Proto se „Rozděleno" zavře při psaní.
- **Sentence heuristika**: „Peč ve 2. Pak…" (číslo na konci věty) se nerozdělí a diktát bez
  velkého písmene po tečce se taky nerozdělí. Obojí jen znamená, že nabídka chybí nebo je kroků
  méně. Nic se nepokazí, protože dělení je ruční.
- **Napojené suroviny**: rozdělený řádek dostane nové položky a napojení se může ztratit
  (P3-5). `pairEditedLines` může jednu část spárovat se starou položkou podle názvu potraviny.
  Úplnost se ukáže poctivě (pravidlo 4).
- **Rozvařený recept**: po rozdělení postupu se odškrtnuté kroky podle indexu posunou (P3-6),
  stejně jako dnes po ruční úpravě.
- **Undo po rozdělení a odchod z obrazovky**: lišta se při odpojení zavře. Kdyby to selhalo, CAS
  přes setState odpojené komponenty nic neudělá a recept zůstane rozdělený. Nic se neztratí.
- **Wake lock**: explicitní `release()` při `hidden` na už uvolněném zámku je podle specifikace
  API neškodný a případná chyba se polyká.

## Co tento návrh vědomě neřeší

- Body 5–12 z procházky a jejich zápis do backlogu.
- Automatické dělení (při psaní, v parseru Vložit, při uložení), dělení podle čísel bez
  interpunkce, opak „spojit řádky", dělení v názvu a poznámkách.
- Víc akcí v `UndoProvider` naráz nebo delší doba lišty pro časovače (P1-3).
- „+5 min" u běžícího časovače, jiné délky prodloužení, úprava běžícího časovače.
- Zámek displeje mimo vaření a opakování žádosti, když ho systém odepře ve viditelné appce.
- Časy slovy („půl hodiny"), spojování napříč větami, rozsahy.
- Přechod `timers` na `deletedAt`. Tabulka je zařízení-lokální a mimo zálohu i SQL, tvrdé mazání
  je tam dnes záměrné (stejně jako u Hotovo).
