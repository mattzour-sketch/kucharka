# Návrh: UC029 — Polish: zhuštění ovládání nad seznamem receptů

## Co řešíme

Spec: [`docs/specs/uc029-polish-zhusteni-ovladani.md`](../specs/uc029-polish-zhusteni-ovladani.md).
Zhustit „chrom" nad mřížkou receptů v `src/features/recipes/RecipeListScreen.tsx`, aby na mobilu bylo
dřív vidět recepty — bez ztráty jediné funkce (řazení, ★ Oblíbené, ⚡ Rychlé, štítky, 🎲 Co dnes?, hledání).

**Rozhodnutí uživatele (2026-09-12, závazné):** varianta **A+C** = řazení + oba filtry + „🎲 Co dnes?"
do **jednoho kompaktního řádku**; řádek štítků se nad určitý počet **sbalí** pod „rozbalit/sbalit".
Bez varianty B (žádný sheet/drawer/modal, filtry nesmí zmizet za klik). Responzivně mobil i desktop.
Stav jen v paměti Reactu (pravidlo 6 — žádný `localStorage`). Žádná nová závislost. Bez změny dat.

### Interpretace „A+C" (bod, kde jsem rozhodoval za uživatele)

Variantu C spec definuje dvěma věcmi: (1) **zmenšit** ovládání na mobilu a (2) **přesunout** ho do
sticky `ScreenHeader` (slot `below`). Beru z C jen bod (1) — zhuštění do jednoho řádku — a **ovládání
nechávám v `main`**, nestěhuju ho do hlavičky. Důvody:

- Metriku „horní hrana první karty nad ohybem" relokace do headeru **nezlepší**: při načtení je
  hlavička nahoře tak jako tak, karta začíná pod stejnou výškou chromu. Výhru dělá *snížení výšky*
  chromu (jeden řádek + sbalené štítky), ne jeho přesun.
- Sticky hlavička by narostla na ~3 řádky (titulek + hledání + ovládání) a **ukusovala by místo při
  každém scrollu** — přesně riziko, před kterým spec u varianty C varuje.

Pokud by uživatel chtěl doslovný přesun do hlavičky, je to malá změna (přesun bloku do `below`), ale
nedoporučuju ji. **Tohle je jediné místo, kde jsem si interpretací nebyl 100% jistý.**

## Zvažované varianty

Rozhodnutí o celkovém směru (A+C) padlo; níže jsou varianty **dílčích** rozhodnutí v rámci mandátu.

### Řazení (ovládací řádek je nejužší místo)

| Varianta | Pro | Proti |
|---|---|---|
| **Nechat `<select>`, zkrátit labely** (zvoleno) | Nativní a11y + klávesnice, nejmenší zásah, nejužší (dropdown ukazuje 1 label) | `<option>` nejde zúžit/rozšířit podle breakpointu → zkrácené labely platí i na desktopu |
| Vyměnit za `Segmented` (existuje v `ui/`) | Vše vidět bez rozbalení | 3 textové segmenty = **širší** než select (~170 px konst.), rozbije budget na 375 px; navíc výměna prvku = větší změna |
| Ikona + popover | Nejmenší šířka | Popover = nová komponenta, míří k zakázané variantě B |

### Štítky — mechanika sbalení

| Varianta | Pro | Proti |
|---|---|---|
| **Count-based: ukázat prvních N chipů + „+N dalších"** (zvoleno) | Deterministické, bez měření výšky, přesný počet skrytých, SSR-safe, půlené chipy nehrozí | N chipů ≠ přesně pevný počet řádků (chipy mají různou šířku) |
| Height-based (`max-h-… overflow-hidden`) | Pure CSS, přímo limituje výšku | Neumí spočítat „+N"; hrozí půlený řádek chipů u hrany ořezu |
| `useMediaQuery` + dva JS prahy | Přesné chování mobil/desktop | Nový hook + resize listener; měření; víc kódu, než je třeba |

### „Co dnes?" na mobilu

| Varianta | Pro | Proti |
|---|---|---|
| **Ikona 🎲 na mobilu, „🎲 Co dnes?" na ≥`sm`** (zvoleno) | Zůstává **vidět** (neschová se za klik), ušetří ~60 px šířky | Na mobilu méně objevné (řeší `aria-label` + `title`) |
| Nechat plný text i na mobilu | Max objevnost | Rozbije jednořádkový budget na 375 px |

## Zvolené řešení

**1) Kompaktní ovládací řádek (1 řádek na ≥360 px):**
- Šířkový rozpočet na 375 px: obsah `main` = 375 − 2×16 (`px-4`) = **343 px**. Plný sort label
  („Naposledy upravené" ~175 px) + slovní chipy (~156 px) sám přeteče → proto **zkrácené sort labely**
  + **🎲 jako ikona** na mobilu. Odhad po zhuštění: sort ~86 + ★ Oblíbené ~84 + ⚡ Rychlé ~72 +
  🎲 ~36 + mezery = **~302 px < 343 px** → vejde se. Na 360 px také; na ~320 px se v krajním případě
  zalomí jen 🎲 na druhý řádek (ne „do mnoha řádků") — proto `flex-wrap` zůstává jako pojistka.
- Chipy ★ Oblíbené / ⚡ Rychlé **beze změny** (mají slova, jsou malé `text-xs`). Nikdy se neschovávají
  → jejich aktivní stav (amber/brand) je **vždy vidět** (splňuje „aktivní filtr poznat i po sbalení").

**2) Štítky: `CollapsibleTags` (nová feature-lokální komponenta).**
- Ve sbaleném stavu (výchozí) ukáže prvních `MOBILE_CAP` chipů na mobilu, `DESKTOP_CAP` na desktopu;
  zbytek je skrytý čistě přes Tailwind (`hidden sm:inline-flex` / `hidden`). **Bez JS měření, bez
  matchMedia** — responzivita je jen CSS.
- Přepínač „+N dalších" / „Méně" (dva, po jednom na breakpoint, aby počet seděl — viz níže).
- **Aktivní štítek je z kolabování vyjmutý** → zůstává vidět i sbalený, zvýrazněný (brand).

**3) Ovládání zůstává v `main`** (viz Interpretace výše). Hledání v `below` hlavičky **beze změny**.

Proč takhle: nejmenší zásah, který splní cíl — sdílené komponenty (`FilterChip`, `Button`, `select`,
`Segmented`) se **nemění**, jen se přeskládají; veškerá nová logika je izolovaná v jednom malém souboru.

## Dopad na kód

- **`src/features/recipes/RecipeListScreen.tsx`** — jediná dotčená stávající obrazovka:
  - `SORT_LABELS`: zkrátit na `updated: 'Upravené'`, `cooked: 'Uvařené'`, `name: 'Název'`
    (copy nit k potvrzení: „Upravené"/„Uvařené" jsou vizuálně blízké; alternativa „Vařené" na desktopu
    je clearer, ale `<option>` nejde dělat responzivně — volím jeden krátký set pro obě velikosti).
  - `<select>`: `px-3` → `px-2.5` (drobné zúžení), jinak beze změny (`aria-label="Řazení"` zůstává).
  - „Co dnes?" `Button`: obsah responzivně — `<span aria-hidden>🎲</span>` + `<span className="hidden
    sm:inline">Co dnes?</span>`; přidat `aria-label="Co dnes? (náhodný recept)"` a `title`. Logika
    `disabled={visible.length === 0}` a `onClick` (náhodný výběr z `visible`) **beze změny**.
  - Blok „řádek štítků" (dnešní `tags.length > 0 ? <div className="mt-2 flex flex-wrap…">…</div>`)
    nahradit `<CollapsibleTags tags={tags} activeTag={tagFilter} onToggleTag={…} />`.
  - Ovládací kontejner zůstává `flex flex-wrap items-center gap-2` (flex-wrap = pojistka pro ~320 px).
  - Vše ostatní (live query, `visible` pipeline, `keepVisibleIds`/dimming z UC028, prázdné stavy
    „Nic nenalezeno" vs „Nic neodpovídá filtru", grid) **beze změny**.

- **Nový soubor `src/features/recipes/CollapsibleTags.tsx`** (feature-lokální, **ne** `ui/`):
  - Proč nová komponenta: logika (rozdělení chipů podle capů, dva breakpointové přepínače, a11y
    `aria-expanded`/`aria-controls`, výjimka aktivního štítku) je soběstačná a trochu „fiddly" —
    v už 240řádkové obrazovce by zašuměla. Je **feature-specifická** (zná sémantiku „štítek/aktivní
    filtr", používá `FilterChip`), proto patří k receptům, ne do generického `ui/`.
  - Stav: `const [expanded, setExpanded] = useState(false)` — **jen v paměti** (pravidlo 6).
    Vrací `null`, když `tags.length === 0` (řádek ani přepínač se nezobrazí — jako dnes).
  - **FilterChip se nemění** — responzivní viditelnost nese `<span>` wrapper kolem chipu (FilterChip
    nemá `className` prop; wrap je levnější než rozšiřovat sdílenou komponentu).

Skica `CollapsibleTags` (ne produkční kód):

```tsx
const MOBILE_CAP = 6;    // kolik štítků ukázat sbaleně na mobilu
const DESKTOP_CAP = 16;  // … na desktopu (sbalí se až nad tím)

export default function CollapsibleTags({ tags, activeTag, onToggleTag }: Props) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  if (tags.length === 0) return null;

  const activeIndex = activeTag ? tags.indexOf(activeTag) : -1;
  const mobileHidden = Math.max(0, tags.length - MOBILE_CAP - (activeIndex >= MOBILE_CAP ? 1 : 0));
  const desktopHidden = Math.max(0, tags.length - DESKTOP_CAP - (activeIndex >= DESKTOP_CAP ? 1 : 0));
  const hasMobileToggle = tags.length > MOBILE_CAP;
  const hasDesktopToggle = tags.length > DESKTOP_CAP;

  return (
    <div id={listId} className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag, i) => {
        const active = tag === activeTag;
        // sbaleno: < MOBILE_CAP vidět všude; [MOBILE_CAP,DESKTOP_CAP) jen desktop; zbytek skryté.
        // rozbaleno nebo aktivní → vidět vždy.
        const vis = expanded || active ? '' : i < MOBILE_CAP ? '' : i < DESKTOP_CAP ? 'hidden sm:inline-flex' : 'hidden';
        return (
          <span key={tag} className={vis}>
            <FilterChip active={active} onClick={() => onToggleTag(tag)}>{tag}</FilterChip>
          </span>
        );
      })}

      {hasMobileToggle && (
        <button type="button" className="sm:hidden <pill>" aria-expanded={expanded} aria-controls={listId}
          onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Méně' : `+${mobileHidden} dalších`}
        </button>
      )}
      {hasDesktopToggle && (
        <button type="button" className="hidden sm:inline-flex <pill>" aria-expanded={expanded} aria-controls={listId}
          onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Méně' : `+${desktopHidden} dalších`}
        </button>
      )}
    </div>
  );
}
```

`<pill>` = styl odlišený od filtrů (je to expander, ne filtr) — **přerušovaný** okraj + neutrální text,
s dark variantami a focus-ringem, ať je konzistentní s appkou:
`rounded-full border border-dashed border-stone-300 px-3 py-1 text-xs font-medium text-stone-500
hover:border-stone-400 hover:text-stone-700 dark:border-stone-600 dark:text-stone-400
dark:hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40`.

Proč **dva** přepínače: počet skrytých se liší podle breakpointu a `<option>`/jeden text by nemohl být
korektní pro obě velikosti. Každý je schovaný na opačném breakpointu (`sm:hidden` / `hidden
sm:inline-flex`), takže uživatel vidí vždy právě jeden se správným číslem. `expanded` je sdílený →
rozbalení na mobilu rozbalí i desktop (konzistentní, chipy sdílí jeden DOM).

## Změny datového modelu

**Žádné.** Čistě UI/UX. Žádná migrace, žádná změna Dexie schématu, `visible` pipeline beze změny.

## Chování mobil vs. desktop (konkrétně)

| Počet štítků | Mobil (`<sm`) | Desktop (`≥sm`) |
|---|---|---|
| ≤ `MOBILE_CAP` (≤6) | vše vidět, bez přepínače | vše vidět, bez přepínače |
| 7 – `DESKTOP_CAP` (≤16) | sbaleno na 6 + „+N dalších" | **vše vidět** (štítky se „sbalí jen když je jich hodně") |
| > `DESKTOP_CAP` (>16) | sbaleno na 6 + „+N" | sbaleno na 16 + „+N" |

Capy `MOBILE_CAP=6` (~1–2 řádky na 375 px) a `DESKTOP_CAP=16` jsou **laditelné konstanty** — přesné
hodnoty k potvrzení při živém ověření (spec: „[1–2] řádky", práh „aspoň horní hrana první karty").

## Plán implementace

Pořadí tak, aby po každém kroku šla appka spustit (`npm run dev`).

1. **`CollapsibleTags.tsx`** — nová komponenta dle skici (capy, dva přepínače, `aria-expanded` +
   `aria-controls` přes `useId()`, výjimka aktivního štítku, `null` při 0 štítcích).
   *Hotovo, když:* `npm run lint` (ESLint + `tsc --noEmit`) projde; import komponenty kompiluje.
2. **Napojit do `RecipeListScreen.tsx`** — nahradit inline blok štítků `<CollapsibleTags …/>`
   (`activeTag={tagFilter}`, `onToggleTag={(tag) => setActiveTag(tagFilter === tag ? null : tag)}`).
   *Hotovo, když:* filtrování štítkem funguje jako dřív; rozbalení/sbalení **nereset**uje sort, fav,
   quick, query ani activeTag; aktivní štítek je vidět i sbalený.
3. **Zhustit ovládací řádek** — zkrátit `SORT_LABELS`, `select` `px-2.5`, „Co dnes?" responzivní
   (🎲 / text) + `aria-label`/`title`; `flex-wrap` ponechat.
   *Hotovo, když:* na 375 px je ovládání na jednom řádku; na ≥`sm` má „Co dnes?" plný text;
   „Co dnes?" je `disabled` při prázdném `visible`.
4. **Ověření** — `npm run lint` + `npm run test` + `npm run build`; ručně: 375 px (1 řádek),
   ~320 px (max 1 zalomení, nic nevyteče), mnoho štítků (sbalí + „+N", aktivní vidět), tmavý režim
   (nové prvky čitelné), `prefers-reduced-motion` (nepoužíváme animaci → OK), 0 receptů (ovládání ani
   hledání se nezobrazí), mis-tap ve filtru Oblíbené z UC028 (dimming stále funguje).
   *Hotovo, když:* lint + testy zelené a manuální průchod bez regrese.

## Rizika a co může selhat

- **Šířkový rozpočet jsou odhady**, ne měření. Mitigace: `flex-wrap` zůstává → na ~320 px se nanejvýš
  zalomí 🎲 na 2. řádek, nikdy nevyteče mimo obrazovku.
- **Zkrácené sort labely** platí i na desktopu (`<option>` nejde responzivně) a „Upravené"/„Uvařené"
  jsou vizuálně blízké — copy k potvrzení (uživatel dbá na lean, ale čitelné texty).
- **`<span>` wrapper + `hidden sm:inline-flex`**: ověřit, že se chip jako flex-item korektně zobrazí
  (skryté wrappery se do `gap` nepočítají, takže fantomové mezery nehrozí). Nízké riziko.
- **Počet „+N" vs. vynucený aktivní štítek**: když je aktivní štítek v přetečení, je vidět navíc a
  z počtu se odečítá (`activeIndex >= CAP ? 1 : 0`) — drobná, ošetřená hrana.
- **A11y expanderu**: `aria-expanded`/`aria-controls` + nativní `<button>` (klávesnice zdarma); focus
  po kliku zůstává na přepínači (default, needěláme focus management).

## Co tento návrh vědomě neřeší

- **Doslovný přesun ovládání do sticky hlavičky** (litera varianty C) — viz Interpretace; nedoporučeno.
- **Multi-tag AND** filtr ze starého `SearchScreen` (vědomá ztráta už z UC028, neřešíme).
- **Perzistence** rozbaleno/sbaleno a filtrů mezi relacemi — úmyslně jen `useState` (pravidlo 6).
- **Redesign** `RecipeCard`, `TabLayout`, `ScreenHeader`, ani sdílených `ui/` komponent.
- **Nové typy řazení / filtrů** — jen přeskládání a zhuštění stávajících.
- **Pixel-přesné měření řádků** — sbalení je count-based (deterministické), ne podle naměřené výšky.
```
