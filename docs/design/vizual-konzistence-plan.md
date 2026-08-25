# Návrh: Vizuální konzistence UI (konzistenční pas)

## Co řešíme

Spec: `docs/specs/vizual-konzistence.md`. Sjednotit vzhled a chování opakujících se prvků
napříč všemi obrazovkami malou sadou ručně psaných Tailwind komponent v `src/components/ui/` —
bez změny chování, dat, textů smyslem a bez nové závislosti.

Rozhodnutí orchestrátora beru jako daná: cílený konzistenční pas (ne plný design-systém),
ruční Tailwind bez shadcn/ui, dvě úrovně max-šířky (`RecipeDetail` na úzkou), respekt
k `prefers-reduced-motion`.

## Zvažované varianty

### Jak sdílet styly (klíčové rozhodnutí)

| Varianta | Pro | Proti |
|---|---|---|
| **A. Malá sada React komponent + pár `*Class()` helperů** (zvoleno) | Jeden zdroj pravdy pro role/varianty; `Button`/`ScreenHeader` nesou i a11y (focus, `disabled`, `aria`); helpery (`cardClass`) pokrývají případy, kde je nositelem stylu `Link`/`<button>` a komponenta by nutila polymorfismus. Žádná závislost. | Malý churn ve všech souborech; nutná disciplína „nepřidávej variantu ad hoc". |
| B. Jen zapsané class-stringy (konstanty), bez komponent | Nejmenší abstrakce. | Nevynutí jednotné chování (focus, motion-reduce, `disabled`) — každý si je zase zapomene; přesně dnešní stav. |
| C. Zavést shadcn/ui | „Posvěcený" stackem. | Nová dependency + generátor + Radix; velký churn, mimo rozhodnutí. Zamítnuto. |
| D. Design-tokeny v `tailwind.config` (spacing/barvy) | Systematické. | Přestřel pro jednu appku; mění víc, než je potřeba. Mimo rozsah (jen `brand` zůstává). |

### Nositel stylu u karet (Link vs div)

Karty jsou často `Link`/`<button>` (RecipeCard, řádek potraviny, odkazy v „Víc"). Polymorfní
`<Card as={Link}>` by zaváděl `asChild` plumbing. Zvoleno: **`cardClass()` vrací string** pro
Link/button + tenká `<Card>` (div) pro pasivní panely, obojí ze stejného zdroje. Grep pak najde
tentýž vzor u FoodsScreen i FoodPickeru.

## Zvolené řešení

Sada komponent + helperů v `src/components/ui/`, hand-rolled Tailwind, žádná závislost.
Přesné px/rádius jsou návrhové (spec fixuje **jednotnost a počet variant**, ne konkrétní čísla);
níže uvádím doporučené hodnoty jako závazné pro implementaci.

### Barevné role (zapsané)

| Role | Použití | Třídy |
|---|---|---|
| **brand** `#b45309` / `brand-dark` `#92400e` | primární akce, vybraný stav, tint (`brand/10` + `text-brand-dark`) | `bg-brand text-white`, `text-brand`, `bg-brand/10 text-brand-dark` |
| **amber** | oblíbené (hvězda `amber-500`) + varování | `text-amber-500`; `bg-amber-50 text-amber-700 border-amber-200` |
| **stone** | neutrál (text, okraje, hover) | `text-stone-500/600`, `border-stone-200/300`, `hover:bg-stone-100` |
| **red** | destruktivní | `text-red-600 hover:bg-red-50`, `border-red-200` |

Pravidlo: **brand je jediná primární/akční barva; amber se s brandem nesměšuje** (hvězda zůstává
amber, nesjednocuje se). Žádná obrazovka nezavádí novou roli.

### Typografická škála (zapsaná)

| Token | Třídy | Kde |
|---|---|---|
| Titulek obrazovky (tab) | `text-xl font-semibold tracking-tight` (`h1`) | ScreenHeader tab |
| Titulek obrazovky (stack) | `text-sm font-medium text-stone-600 truncate` (`h1`) | ScreenHeader stack |
| Titulek stránky (v obsahu) | `text-2xl font-semibold tracking-tight` (`h1`) | Detail (název receptu) |
| Nadpis sekce | `text-xs font-semibold uppercase tracking-wide text-stone-400` (`h2`) | Suroviny/Postup/… — **oprava CookingMode `text-sm`→`text-xs`** |
| Titulek karty | `font-medium truncate` | řádky/karty |
| Tělo | `leading-relaxed` (base) | postup, text |
| Meta | `text-xs text-stone-400` / `text-sm text-stone-500` | data, kcal, popisky |
| Inline odkaz | `text-sm font-medium text-brand` | „Spočítat kalorie →", „Uvařit znovu takhle →" (odkaz, ne tlačítko) |

### Dvě úrovně max-šířky (zapsané)

```ts
// ui/layout.ts
export const SCREEN_WIDTH = {
  wide:   'max-w-5xl', // mřížky karet: Recepty, Hledat, Potraviny
  narrow: 'max-w-2xl', // čtení/formuláře/jednosloupcové: VŠE ostatní (vč. Detailu)
} as const;
```

`ScreenHeader` bere `width` a `main` každé obrazovky používá tentýž token → hlavička i obsah mají
identickou šířku. **Výjimky mimo pravidlo (chrom/overlay, ne obsah obrazovky):** `TabLayout` nav
`max-w-md`, `UndoProvider` toast `max-w-sm`, `QuickFoodForm` uvnitř overlaye `max-w-md`. `RecipeDetail`
přestává být výjimka (`max-w-3xl` → `narrow`).

## Sdílené komponenty — katalog s rolemi/variantami

Všechny interaktivní prvky dostávají jednotně: `transition`, `active:scale-95`
(+ `motion-reduce:active:scale-100 motion-reduce:transition-none`), `focus-visible:outline-none
focus-visible:ring-2 focus-visible:ring-brand/40`, `disabled:opacity-40 disabled:pointer-events-none`.

### `ui/cx.ts` — util
`export const cx = (...p: Array<string|false|null|undefined>) => p.filter(Boolean).join(' ');`
Bez závislosti (žádný clsx).

### `ui/ScreenHeader.tsx`
Jedna hlavička, dvě varianty, sdílené pozadí/okraj/blur/sticky a vnitřní max-šířka.

- Chrom (obě varianty): `sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur`;
  vnitřní kontejner `mx-auto flex items-center gap-2 {SCREEN_WIDTH[width]} px-4 py-3`.
  → **CookingMode ztrácí odlišné `bg-white/95`** (tělo zůstává `bg-white`).
- **tab**: `title` jako `h1` (titulek tab), `actions` vpravo (`ml-auto`). Volitelný `below`
  (druhý řádek, stejný kontejner) pro vyhledávací pole (Foods, Hledat).
- **stack**: vlevo `IconButton` (‹ zpět přes `backTo`/`onBack`, nebo ✕ přes `closeIcon`),
  pak `h1` titulek (stack styl, volitelný — Detail ho nemá), `actions` vpravo (`ml-auto`).
  Sjednocuje dnešní `px-2 py-2` + mix ‹/✕ + `h1`/`span`.

### `ui/Button.tsx` — uzavřená sada rolí
Rádius i velikost **pevné na roli**; jediný modifikátor je `fullWidth` (+ `disabled`).
Renderuje `<button>`, nebo `<Link>` když je `to`. Prochází `onClick/type/disabled/aria*`.

Base (textové role): `inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-medium` + společné (transition/active/focus/disabled/motion-reduce).

| role | přídavné třídy | velikost |
|---|---|---|
| `primary` | `bg-brand text-white shadow-sm hover:bg-brand-dark` | `px-4 py-2` |
| `secondary` | `border border-stone-300 text-stone-700 hover:bg-stone-100` | `px-4 py-2` |
| `ghost` | `text-stone-600 hover:bg-stone-100` | `px-4 py-2` |
| `destructive` | `text-red-600 hover:bg-red-50` | `px-4 py-2` |
| `tint` | `bg-brand/10 text-brand-dark hover:bg-brand/20` | `px-3 py-1.5` |

`fullWidth` → `w-full`. **Ruší se dnešní mix `rounded-full`/`rounded-xl` a 6 velikostí primárního
tlačítka na jednu podobu na roli** (full-width tlačítka Detail/Cook/Trash/FoodEdit přejdou z
`rounded-xl` na `rounded-full`; „Přidat" v Nákupu z `rounded-xl` na `primary` pill).

### `ui/IconButton.tsx` — role „icon"
Base: `inline-flex items-center justify-center rounded-lg` + společné (transition/active/focus/motion-reduce).
`size`: `md` = `h-9 w-9 text-lg` (‹ ✕ ✎ ⋯), `sm` = `h-7 w-7 text-base` (inline × v řádcích).
`tone`: `neutral` = `text-stone-500 hover:bg-stone-200/60`; `favorite` (bere `active`) = aktivní
`text-amber-500` / neaktivní `text-stone-300 hover:text-stone-500`; `danger` = `text-red-500 hover:bg-red-50`.
(icon je jediná role s velikostí — tap-targety v řádcích; není to cíl počtu class-stringů.)

### `ui/Tag.tsx` — štítek (display)
Jedna podoba: `inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-dark`.
Volitelný `onRemove` → přidá × (`IconButton` sm/danger-lite). Nahrazuje tři velikosti (RecipeCard,
RecipeDetail, TagInput).

### `ui/FilterChip.tsx` — filtr štítků (interaktivní)
Base: `rounded-full px-3 py-1 text-xs font-medium` + focus/active-scale/motion-reduce.
Neaktivní: `border border-stone-200 text-stone-600 hover:border-stone-300`.
Aktivní (`activeTone='brand'`, default): `border border-brand bg-brand text-white`.
`activeTone='amber'` (přepínač „Oblíbené"): `border border-amber-300 bg-amber-50 text-amber-600`.
Sjednocuje RecipeList (dnes brand/10 tint neaktivní) a Search (border neaktivní) na **jeden jazyk**
(border neaktivní / brand solid aktivní).

### `ui/Segmented.tsx` — segmentovaný přepínač
`options: {value,label}[]`, `value`, `onChange`. Kontejner `inline-flex rounded-full border
border-stone-200 p-0.5 text-xs font-medium`; položka `rounded-full px-2.5 py-1 transition`;
aktivní `bg-brand text-white`, neaktivní `text-stone-500 hover:text-stone-700`.
Nahrazuje tři implementace (histMode porce/celý, g/ml ve FoodEdit i QuickFoodForm).

### `ui/Card.tsx` + `cardClass()`
`cardClass({ padding, interactive })` → `rounded-2xl border border-stone-200 bg-white`
+ padding (`panel`=`p-4`, `row`=`p-3`, `none`=``)
+ interactive (`transition hover:border-stone-300 hover:shadow-sm active:scale-[0.99] motion-reduce:active:scale-100`).
`<Card>` je tenký `div` nad `cardClass` pro pasivní panely; Link/button karty berou `cardClass()`
přímo do `className`. **Hover se sjednocuje na `stone-300`** (FoodPicker dnes `hover:border-brand`).
Pravidlo paddingu: **panel = `p-4`, hustý řádek = `p-3`**.

### `ui/EmptyState.tsx`
`{ icon?, title, description?, action?, fill? }`. Layout:
`flex flex-col items-center justify-center gap-2 py-16 text-center` (+ `fill` → `min-h-[50dvh]`).
Ikona (volitelně): `mb-1 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-3xl`.
Titulek `text-base font-medium text-stone-700`; popis `text-sm text-stone-400`; akce `mt-2`
(typicky `Button primary`). **Ruší rozptyl `mt-6/8/10` a mix hierarchie textu.** Rozdíl „prázdná DB"
vs „prázdný výsledek" řeší volající jiným `title`/`description` (jako dnes) — forma je jedna.

### `ui/Loading.tsx` — Skeleton (žádné `return null` přes celou obrazovku)
- `Skeleton`: `animate-pulse rounded-md bg-stone-200/70 motion-reduce:animate-none` + `className`.
- Skládané: `RecipeGridSkeleton` (mřížka ~6 karet: `h-32` obálka + 2 řádky) pro List/Search;
  `RowsSkeleton({count})` pro Nákup/Potraviny/Koš/FoodPicker; `ReadingSkeleton` (titulek + řádky)
  pro Detail/Vařit/Kalorie/Statistiky.
Drží chrom (hlavičku, kde je i spodní lištu), v obsahu neutrální placeholder. `prefers-reduced-motion`
utlumí puls.

### Globální backstop pohybu — `src/index.css`
Doplnit jako pojistku (komponenty už `motion-reduce:` nesou, tohle chytne zbytek — progress bar,
puls časovače):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
}
```

## Dopad na kód — plán migrace (obrazovka po obrazovce)

Legenda: H=hlavička, B=tlačítka, C=chipy/přepínače, K=karty, E=prázdný stav, L=loading, T=typografie.

| Soubor | Šířka | Co se mění |
|---|---|---|
| **RecipeListScreen** | wide | H→ScreenHeader tab; B→Button(primary „+ Nový", secondary „Vložit"); C→FilterChip(tag=brand, „Oblíbené"=amber); select zůstává (form control, sladit border); E→EmptyState(fill, ikona 🍲, „Nic neodpovídá filtru" bez ikony); L→RecipeGridSkeleton místo `null` |
| **SearchScreen** | wide | H→ScreenHeader tab + `below`=vyhledávací pole; C→FilterChip(brand); E→EmptyState; L→RecipeGridSkeleton |
| **FoodsScreen** | wide | H→ScreenHeader tab + `below`=hledání; K→**řádek potraviny `cardClass(row, interactive)`** (`p-4`→`p-3`, hover brand→stone-300) — sjednoceno s FoodPickerem; B→Button(primary „+ Nová", ghost „Doplnit základní", primary seed); E→EmptyState(DB vs výsledek); L→RowsSkeleton |
| **ShoppingListScreen** | narrow | H→ScreenHeader tab (count jako `actions`); B→Button(primary „Přidat", secondary/ghost mazání); K→list Card + řádky; IconButton(sm) na ×; E→EmptyState; **L→oprava probliku**: `loading=items===undefined` → RowsSkeleton, prázdný stav až po načtení |
| **SettingsScreen** | narrow | H→ScreenHeader tab; B→Button(primary/secondary); K→Card panely + nav `cardClass(panel, interactive)` |
| **RecipeDetailScreen** | **3xl→narrow** | H→ScreenHeader stack (backTo „/", bez titulku; actions: IconButton favorite, Button secondary „Upravit", primary „Vařit"); **main `max-w-3xl`→`max-w-2xl`**; C→Tag; Segmented(histMode); K→Card na cook-logy; B→Button(secondary „Do nákupu", secondary fullWidth „Sdílet", destructive fullWidth „Smazat"); IconButton(sm) na × logu; T→sekce token; NotFound→EmptyState; **L→ScreenHeader + ReadingSkeleton místo `return null`** |
| **CookingModeScreen** | narrow | H→ScreenHeader stack (backTo `/recept/:id`, title=název; **ruší `bg-white/95`**); **T→„Suroviny/Postup" `text-sm`→`text-xs`**; B→Button(primary „Hotovo"/„Uložit do historie" fullWidth, secondary „Zrušit/Začít znovu", tint „Přidat"/„napojit", tint/secondary/ghost v edit řádku); IconButton(✎, ⋯); Segmented není; K→Card(lastLog muted, finish panel), timer řádky Card; suggestion řádky `cardClass(row, interactive)`; NotFound→EmptyState; **L→ScreenHeader(title=Skeleton) + ReadingSkeleton** |
| **RecipeNutritionScreen** | narrow | H→ScreenHeader stack (backTo `/recept/:id`, title „Kalorie"); K→řádek `Card(row)`; B→Button(tint „napojit", ghost „přeskočit"); IconButton(sm) odpojit; inputy/g-ks toggle zůstávají; E→EmptyState; **L→ScreenHeader + ReadingSkeleton** |
| **StatisticsScreen** | narrow | H→ScreenHeader stack (backTo „/vic", title „Statistiky" — **h1 přes ScreenHeader, konec h1/span mixu**); K→Card(Tile, top řádky `cardClass(panel, interactive)`); E→EmptyState (fix `mt-10`); **L→ScreenHeader + ReadingSkeleton** |
| **RecipeEditScreen** | narrow | H→ScreenHeader stack (closeIcon ✕ `onBack=handleClose`, title, actions Button primary „Uložit"); T→labely sekcí token; TagInput→Tag |
| **ImportRecipeScreen** | narrow | H→ScreenHeader stack (closeIcon, actions Button primary disabled „Uložit"); B→Button(secondary „Ze schránky", primary „Rozebrat"); T→labely token |
| **FoodEditScreen** | narrow | H→ScreenHeader stack (closeIcon, actions Button primary „Uložit"); C→Segmented(g/ml); B→Button destructive fullWidth „Smazat"; NumberField zůstává |
| **FoodPicker** (overlay) | — | Ponechat overlay chrom; B→Button ghost „Zavřít"; **K→řádek `cardClass(row, interactive)`** (sjednoceno s FoodsScreen); E→EmptyState(DB vs výsledek) + Button; L→RowsSkeleton |
| **QuickFoodForm** | — | C→Segmented(g/ml); B→Button(primary „Založit a napojit", ghost „Zpět") |
| **TrashScreen** | narrow | H→ScreenHeader stack (backTo „/vic", title „Koš"); K→Card(row); B→Button(secondary „Obnovit", destructive fullWidth „Vyprázdnit"); E→EmptyState; L→RowsSkeleton (dnes `?? []` problikne prázdno) |
| **RecipeCard** | — | Vnější Link→`cardClass(panel, interactive)` (+`overflow-hidden`); tagy→Tag; **obálka/gradienty beze změny (mimo rozsah)** |
| **NutritionSummary** | — | Skořápku sladit s `cardClass` (rádius/okraj); vnitřek (amber varování, řádky) beze změny |
| **CookingTimers** | — | B→Button(secondary „Zrušit/Zastavit", secondary „+ Časovač"); timer řádek→Card (hotový = brand tint, zachovat) |
| **ServingsStepper** | — | Beze změny (specifický control; okraj už `stone-200`) |
| **TabLayout / UndoProvider** | — | Chrom, beze změny (jen `motion-reduce` chytne backstop) |

Nové soubory (proč vznikají): `src/components/ui/{cx.ts, layout.ts, ScreenHeader.tsx, Button.tsx,
IconButton.tsx, Tag.tsx, FilterChip.tsx, Segmented.tsx, Card.tsx, EmptyState.tsx, Loading.tsx}` —
jediný zdroj pravdy pro role a chování opakujících se prvků. Volitelný `src/components/ui/index.ts`
(barrel) pro import.

## Změny datového modelu

**Žádné.** Bez migrace, bez dotyku Dexie/`useLiveQuery`, bez nové závislosti. Pas je čistě
vizuální/UX; handlery, `onClick`, `disabled` logika, `aria-*` i toky zůstávají identické.

## Plán implementace
(pořadí je bezpečné po částech; po každém kroku jde appka spustit a `npm run lint`/`build` musí projít)

1. **Primitiva `ui/`** (cx, layout, Button, IconButton, Tag, FilterChip, Segmented, Card+cardClass,
   EmptyState, Loading/Skeleton, ScreenHeader) + backstop v `index.css`. Nic je zatím neimportuje.
   *Hotovo:* `tsc`/lint/build zelené; appka beze změny.
2. **Hlavičky** — obrazovka po obrazovce swap `<header>`→`ScreenHeader`. Součástí je Detail
   `max-w-3xl`→`max-w-2xl` (H i `main`) a odstranění CookingMode `bg-white/95`.
   *Hotovo:* `grep max-w-` u obrazovek vrací jen `5xl`/`2xl`; každá hlavička je ScreenHeader;
   titulek je vždy `h1`.
3. **Tlačítka** — swap ad-hoc `<button>`/CTA `<Link>` na `Button`/`IconButton` po obrazovkách.
   *Hotovo:* u `bg-brand`/outline tlačítek klesne počet unikátních class-stringů na sadu rolí;
   zmizí `rounded-full`/`rounded-xl` mix pro tutéž roli.
4. **Chipy a přepínače** — Tag / FilterChip / Segmented.
   *Hotovo:* jeden class-vzor na každý ze tří typů; RecipeList i Search mají stejný filtr.
5. **Karty + řádek potraviny** — `cardClass`/`Card`; FoodsScreen a FoodPicker řádek identický.
   *Hotovo:* grep potvrdí sdílený vzor a jednotný hover `stone-300`.
6. **Prázdné stavy** — EmptyState všude (Recepty, Hledat, Nákup, Potraviny, FoodPicker, Koš, Statistiky).
   *Hotovo:* žádné `mt-6/8/10`; jednotná typografie/rozestup; texty smyslem beze změny.
7. **Loading** — Skeleton; přepis `return null` na ScreenHeader+skeleton (Detail/Vařit/Kalorie/
   Statistiky) a oprava probliku prázdna (Nákup/Koš).
   *Hotovo (G/W/T):* Given prázdná cache, When se detail načítá, Then zůstane chrom + neutrální
   placeholder (nikdy bílá prázdná obrazovka ani „nic tu není" před daty).
8. **Typografie + sweep** — sekce token (CookingMode `text-sm`→`text-xs`), dočištění zbytků.
   *Hotovo:* `npm run lint` + `npm run test` zelené; ruční projití akceptačních kritérií.

## Rizika a co může selhat

- **Propašování změny chování při swapování.** Mitigace: pouze záměna `className`/elementu;
  `Button`/`IconButton` prochází `onClick/type/disabled/aria*` beze změny; handlery se nedotýkají.
- **Pořadí hooků při přepisu loadingu** (Detail/Vařit/Kalorie). Všechny hooky jsou už nad guardem
  `if (data === undefined) …`; guard jen změní návrat z `null` na `<ScreenHeader/>+<Skeleton/>`.
  Nesmí se pod guard přidat nový hook. *Ověření:* `react-hooks/exhaustive-deps` v lintu.
- **Titulek stack hlavičky během loadingu** (název receptu ještě není). Detail hlavičku bez titulku
  má; Vařit dostane `title={<Skeleton/>}`. Zpětný cíl (`backTo`) je z URL `:id`, tj. znám hned.
- **Vědomé vizuální posuny** (spec je chce): FilterChip neaktivní tint→border v RecipeList;
  řádek potraviny `p-4`→`p-3`; full-width tlačítka `rounded-xl`→`rounded-full`; Tag `text-sm`→`text-xs`
  v TagInput; velký „Hotovo" CTA přejde na standardní výšku primary.
- **Globální `prefers-reduced-motion` backstop** utlumí i puls doběhlého časovače (užitečný signál).
  Přijímám — uživatel si pohyb vypnul; komponentní `motion-reduce:` cílí jen `active:scale`/transition.
- **Kontrast:** `text-brand` a `text-white` na `bg-brand` i `text-brand-dark` na `bg-brand/10`
  projít kontrolou; focus `ring-brand/40` držet viditelný, ale nenápadný.
- **Úzký mobil (~320 px):** hlavičkové `actions` a chip-řady nesmí přetéct — ověřit na Recepty
  (2 akce) a Vařit; `truncate` na titulcích/názvech.

## Co tento návrh vědomě neřeší

- **Obálky/gradienty `RecipeCard`** (hotové, mimo rozsah) — mění se jen skořápka karty.
- **Logika načítání dat** (Dexie/`useLiveQuery`) — loading se řeší jen na úrovni vykresleného.
- **Sdílené form-controly** (inputy/`textarea`/nativní `<select>`) do vlastních komponent —
  jsou vcelku konzistentní; jen se sladí okraj/rádius, extrakce je samostatný pozdější pas.
- **Sticky Detail titulek na scrollu** (název receptu v hlavičce) — to je featura, ne konzistence.
- **Design-tokeny v `tailwind.config`, tmavý režim, změna palety, shadcn/ui** — mimo rozhodnutý rozsah.
- **Přesná px/rádius jako „finální pravda"** — spec je nechává na návrhu; fixuje se jednotnost a počet
  variant, doporučené hodnoty výše jsou pro implementaci závazné, ne pro budoucí rozšíření sady.
