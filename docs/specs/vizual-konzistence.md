# Vizuální konzistence UI (konzistenční pas)

## Kontext

Aplikace je funkčně bohatá, ale vizuálně působí jako „poskládaný prototyp": obrazovky vznikaly
postupně, každá si nadefinovala vlastní hlavičku, tlačítka i prázdné stavy ručním Tailwindem.
Není žádná sdílená UI vrstva (`src/components/` obsahuje jen `TabLayout` a `UndoProvider`;
`shadcn/ui` je sice ve stacku v `CLAUDE.md`, ale **není nainstalované ani použité** — vše je
hand-rolled). Cílem je **sjednotit vzhled a chování opakujících se prvků**, ne přidat funkce.

**Rozsah je čistě vizuální/UX.** Nemění se chování, datový model, texty smyslem ani toky.
Drží se lean UI (věcné české texty). Placeholder obálky karet receptů (`RecipeCard.tsx`) jsou
**hotové a mimo tento pas**.

### Zjištěné nekonzistence (inventura z kódu)

| Oblast | Konkrétní nález |
|---|---|
| **Max-šířka** | Tři hodnoty: `max-w-5xl` (Recepty, Hledat, Potraviny), `max-w-2xl` (Nákup, Víc, Statistiky, Kalorie, Vařit, editace, Koš), `max-w-3xl` **jen** RecipeDetail. Pravidlo „5xl mřížka / 2xl čtení" je skoro dodržené — jediný výjimka je detail receptu (3xl). |
| **Hlavička – padding** | Tab-obrazovky `px-4 py-3`, stack-obrazovky `px-2 py-2`. Uvnitř skupin nekonzistentní `gap` (2 vs 3). |
| **Hlavička – pozadí** | Většina `bg-stone-50/90`, ale CookingMode `bg-white/95`. |
| **Hlavička – titulek** | Tab: `h1 text-xl font-semibold`. Stack: `span text-sm font-medium text-stone-600` — ale Statistiky mají `h1` (sémanticky nejednotné: `h1` vs `span`). Detail nemá titulek v hlavičce (je v `main` jako `text-2xl`). |
| **Hlavička – zpět/zavřít** | `‹` (detail, kalorie, statistiky, koš) vs `✕` (editace, import). Hover jednou `hover:bg-stone-200/60`, jednou `hover:bg-stone-100` (CookingMode). |
| **Tlačítka – primární (brand)** | Nejméně 6 kombinací velikosti/rádiusu: `px-4 py-2`, `px-4 py-1.5`, `px-5 py-2.5`, `px-5 py-2`, `px-3 py-1`, full-width `py-3`; a mix `rounded-full` vs `rounded-xl` (např. Nákup „Přidat" je `rounded-xl`, ale „+ Nový recept" `rounded-full`). |
| **Tlačítka – sekundární (outline)** | Podobný rozptyl: `px-3 py-2`, `px-4 py-1.5`, `px-4 py-2`, `px-3 py-1.5`, `px-3 py-1`; `rounded-full` vs `rounded-xl` (Sdílet jako text). |
| **Tlačítka – destruktivní** | Full-width `text-red-600 hover:bg-red-50` je konzistentní (Smazat recept/potravinu, Vyprázdnit koš) — vzor, který stačí povýšit na sdílený. |
| **Chip – štítek (display)** | Stejný „tag" ve třech velikostech: RecipeCard `px-2 py-0.5 text-xs`, RecipeDetail `px-2.5 py-0.5 text-xs`, TagInput `px-2 py-1 text-sm`. |
| **Chip – filtr štítků** | RecipeList neaktivní = brand tint (`bg-brand/10`), Search neaktivní = neutrální border (`border-stone-200`). Stejná funkce, jiný jazyk; jiný padding. |
| **Segmentované přepínače** | Tři různé implementace: histMode (má `p-0.5` kontejner), g/ml ve FoodEdit (`px-3 py-1`), g/ml v QuickFoodForm (`px-3 py-1.5`). |
| **Karty** | Jádro `rounded-2xl border-stone-200 bg-white` je většinou stejné, ale: padding `p-3` vs `p-4` bez pravidla; **řádek potraviny ve FoodsScreen (`rounded-2xl`, `hover:border-stone-300`, `p-4`) vs FoodPicker (`rounded-xl`, `hover:border-brand`, `p-3`)** — stejný koncept, jiný vzhled. |
| **Prázdné stavy** | Od bohatého (Recepty: ikona v dlaždici + nadpis + CTA, `min-h-[60dvh]`) po holý jednořádek (Koš, Hledat). Rozestup `mt-6/mt-8/mt-10`. Hierarchie textu jednou `stone-500` nadpis + `stone-400` podřádek, jinde jen `stone-400`. Ikonu má jen Recepty. |
| **Loading stavy** | Čtyři přístupy: (1) celá obrazovka `return null` → bílé bliknutí (Detail, Vařit, Kalorie, Statistiky); (2) `null` jen obsah, hlavička zůstane (List, Potraviny, Hledat, Picker); (3) **žádné rozlišení → prázdný stav problikne, jako by nebyla data** (Nákup, Koš); (4) inline `…` (Víc). Skeleton/spinner nemá nikdo. |
| **Typografie sekcí** | Nadpis sekce („Suroviny", „Postup") je `text-xs ... uppercase` všude, **kromě CookingMode, kde je `text-sm`**. |
| **Barvy** | brand (`#b45309`, terakota) = akce/výběr; amber = oblíbené (hvězda `amber-500`) + varování (`amber-50/700`); stone = neutrál; red = mazání. brand je fakticky odstín amber-700, takže hvězda `amber-500` a brand koexistují jako dva podobné oranžové bez zapsaného pravidla. |

## Obrazovky v rozsahu

Recepty (`RecipeListScreen`), Detail receptu (`RecipeDetailScreen`), `RecipeCard` (bez obálky),
Vaření (`CookingModeScreen`), Kalorie (`RecipeNutritionScreen`), Statistiky (`StatisticsScreen`),
Editace/Nový (`RecipeEditScreen`), Vložit (`ImportRecipeScreen`), Potraviny (`FoodsScreen`),
Editace potraviny (`FoodEditScreen`), `FoodPicker`, `QuickFoodForm`, Nákup (`ShoppingListScreen`),
Víc (`SettingsScreen`), Hledat (`SearchScreen`), Koš (`TrashScreen`), spodní lišta (`TabLayout`),
a sdílené prvky s vizuálním dopadem: `NutritionSummary`, `ServingsStepper`, `TagInput`,
`UndoProvider`. Konfigurace: `tailwind.config.js`, `src/index.css`.

## User stories

- Jako uživatel chci, aby appka působila jako **jeden ucelený produkt**, ne jako sada různě
  poskládaných obrazovek, abych jí víc věřil a snáz se v ní orientoval.
- Jako uživatel chci, aby **stejná akce vypadala všude stejně** (tlačítko „Uložit", štítek,
  karta, prázdný stav), abych nemusel pokaždé znovu hádat, co je co.
- Jako uživatel chci, aby se obrazovky při načítání **neprobliklo prázdno ani falešný
  „nic tu není"**, aby to nepůsobilo rozbitě.
- Jako uživatel na mobilu i na širokém desktopu chci **klidnou, čitelnou hierarchii**
  (nadpisy, sekce, popisky), abych se rychle chytil.

## Akceptační kritéria

> Ověřitelnost: většina kritérií jde zkontrolovat inspekcí/`grep` nad `src/**` — „existuje jediná
> sdílená definice X a všechna místa ji používají" / „počet variant klesne na N". Přesné hodnoty
> (px, rádius) jsou věc návrhu; kritérium fixuje **jednotnost a počet variant**, ne konkrétní čísla.

- [ ] **Hlavičky.** Všechny obrazovky používají jednu sdílenou hlavičku (nebo jednu zapsanou
  sadu tříd) se dvěma variantami: **tab** (bez zpět, titulek `h1`) a **stack** (zpět/zavřít
  vlevo, titulek, akce vpravo). Pozadí, výška a typografie titulku jsou v rámci varianty
  identické. Ověření: žádná obrazovka si nedefinuje `<header>` třídy ad hoc; CookingMode už
  nemá odlišné `bg-white/95`; titulek je vždy stejný element (konec `h1` vs `span` mixu).

- [ ] **Max-šířka.** Platí dvě zapsané úrovně: **širká** pro mřížky karet (Recepty, Hledat,
  Potraviny) a **úzká** pro čtení/formuláře/jednosloupcové seznamy (zbytek). Každá obrazovka
  mapuje na jednu z nich a **hlavička i `main` mají stejnou** max-šířku. RecipeDetail přestane
  být jediná výjimka (dnes `max-w-3xl`). Ověření: `grep max-w-` vrací jen dvě povolené hodnoty.

- [ ] **Tlačítka.** Existuje uzavřená, zapsaná sada rolí tlačítek — návrh: **primary, secondary,
  ghost, destructive, tint (brand/10), icon** — a každé tlačítko na obrazovkách v rozsahu mapuje
  právě na jednu. V rámci role je **rádius a výchozí velikost pevná**; jediný povolený modifikátor
  velikosti je **full-width** (a stav `disabled`). Ověření: počet unikátních class-stringů u
  `bg-brand`/outline tlačítek klesne na sadu rolí; zmizí mix `rounded-full`/`rounded-xl` pro tutéž
  roli (např. Nákup „Přidat").

- [ ] **Chipy a přepínače.** „Štítek" (display) má jednu podobu sdílenou v RecipeCard, RecipeDetail
  a TagInput. „Filtr štítků" (interaktivní) má jednu podobu s jednotným aktivním/neaktivním stavem
  v RecipeList i Search. Segmentovaný přepínač (na porci/celý, g/ml) má jednu sdílenou podobu.
  Ověření: jeden class-vzor na každý ze tří typů.

- [ ] **Karty.** Jedna sdílená karta (rádius, border, pozadí, hover) pro všechny „řádek/dlaždice/
  panel"; **řádek potraviny ve FoodsScreen a ve FoodPickeru vypadá stejně** (dnes se liší rádiusem
  i hoverem). Padding karet má zapsané pravidlo (např. panel vs hustý řádek). Ověření: FoodsScreen
  a FoodPicker řádek sdílí tentýž vzor; hover je jednotný.

- [ ] **Prázdné stavy.** Každá obrazovka se seznamem/hledáním (Recepty, Hledat, Nákup, Potraviny,
  FoodPicker, Koš, Statistiky) má prázdný stav postavený na jednom sdíleném vzoru: shodné svislé
  umístění, nadpis, nepovinný podřádek a nepovinné CTA, jednotná typografie a rozestup. Texty
  zůstávají věcné (beze změny smyslu). Ověření: prázdné stavy nesdílejí dnešní `mt-6/8/10` rozptyl
  a používají tutéž komponentu/vzor.

- [ ] **Loading stavy.** Žádná obrazovka během načítání primárních dat **nevrací celé prázdno**
  (`return null` pro celou obrazovku) ani **neproblikne prázdný stav**. Detail/Vařit/Kalorie/
  Statistiky si během načítání drží hlavičku (a spodní lištu, kde je) a v obsahu ukážou neutrální
  placeholder; Nákup a Koš neukážou „je prázdný", dokud data nedorazí. Ověření (Given/When/Then):
  *Given* otevřu detail receptu s prázdnou cache, *When* se data načítají, *Then* se nezobrazí bílá
  prázdná obrazovka — zůstane chrom a neutrální placeholder.

- [ ] **Typografie a barevné role.** Platí zapsaná škála (titulek obrazovky / nadpis sekce / titulek
  karty / tělo / meta) použitá jednotně — nadpis sekce má jednu velikost (oprava CookingMode
  `text-sm` → `text-xs`). Barevné role jsou zapsané: **brand = primární/vybráno, amber = oblíbené
  + varování, stone = neutrál, red = destruktivní**; žádná obrazovka nezavádí novou roli.

## Okrajové případy a chybové stavy

| Situace | Očekávané chování |
|---|---|
| Velmi dlouhý název receptu/potraviny v hlavičce či kartě | Ořez (truncate), neláme layout — sjednotit dnešní chování napříč |
| Prázdná databáze vs. prázdný výsledek hledání | Dva rozlišené texty (jako dnes na FoodsScreen/FoodPicker), ale přes jeden sdílený prázdný stav |
| Loading nad prázdnou databází | Placeholder během načítání → poté teprve prázdný stav; nikdy oboje naráz ani prázdný stav první |
| Úzký mobil (~320 px) | Hlavičkové akce a chip-řady se nesmí lámat přes okraj; ověřit na Recepty (2 akce) a Vařit |
| Široký desktop | Obsah drží zapsanou max-šířku a je vycentrovaný (neroztéká se) |
| Redukce pohybu (`prefers-reduced-motion`) | `active:scale-*` / přechody respektují preferenci (dnes se neřeší) — **viz Otevřená otázka 4** |
| Focus/klávesnice | Sdílené prvky (tlačítko, chip, karta-odkaz) mají viditelný focus stav; dnes nejednotné |
| Barevný kontrast | brand na bílé a `text-brand-dark` na `brand/10` musí projít kontrastem pro text |

## Mimo rozsah

- **Jakákoli změna chování, toků, textů smyslem nebo datového modelu.** Čistě vzhled.
- **Obálky karet receptů** (`RecipeCard` placeholder gradienty) — hotové.
- **Nové funkce, obrazovky, nastavení vzhledu** (např. tmavý režim) — nejsou součástí, i když
  sdílená vrstva je do budoucna zjednoduší.
- **Změna značkové barvy / redesign palety.** Role se jen zapíšou a sjednotí, hue se nemění.
- **Přepis logiky načítání dat** (Dexie/`useLiveQuery`) — loading se řeší jen na úrovni toho, co
  se vykreslí, ne jak se data získávají.
- **Přidání běhové závislosti** bez schválení (viz Konvence v `CLAUDE.md`). Skeleton/animace se
  dají udělat čistým Tailwindem (`animate-pulse`), bez knihovny.

## Předpoklady

- **PŘEDPOKLAD:** Rozsah = **cílený konzistenční pas** s malou sadou sdílených prvků
  (Header, Button, Chip/Tag, Card, EmptyState, LoadingState/Skeleton), **ne plný design-systém**
  (tokeny, dokumentace, varianty pro vše). *(Klíčové — viz Otevřená otázka 1.)*
- **PŘEDPOKLAD:** Sdílené prvky se udělají **hand-rolled Tailwindem** v `src/components/ui/`,
  bez nové závislosti a **bez zavádění `shadcn/ui`** (přestože ho stack jmenuje, dnení nainstalované).
  *(Viz Otevřená otázka 2.)*
- **PŘEDPOKLAD:** Dvě úrovně max-šířky: širká pro mřížky karet, úzká pro čtení/formuláře.
  RecipeDetail se sjednotí na úzkou (patří k Vařit/Kalorie). Přesné hodnoty určí návrh (dnes
  fakticky `5xl` a `2xl`).
- **PŘEDPOKLAD:** Loading placeholder bude **nenápadný** (drží chrom + neutrální skeleton/plocha),
  ne spinnery přes celou obrazovku. Cíl je „neblikne prázdno", ne bohatá loading animace.
- **PŘEDPOKLAD:** Amber zůstává rolí pro **oblíbené + varování**; hvězda oblíbených se
  nesjednocuje s brand. brand zůstává jediná primární/akční barva.
- **PŘEDPOKLAD:** Jde o jednu PWA (jedno rozhraní), takže „všude/napříč" = všechny obrazovky
  této aplikace; mobil je primární, layout drží i na širokém desktopu.
- **PŘEDPOKLAD:** Existující věcné texty prázdných/loading stavů se zachovají smyslem; sjednocuje
  se forma, ne obsah.

## Otevřené otázky

1. **Jak daleko jít?** Stačí **cílený konzistenční pas** (pár sdílených komponent + zapsaná
   pravidla, výše), nebo chceš **plnohodnotnější design-systém** (barevné/spacing tokeny v
   `tailwind.config`, jedna dokumentovaná knihovna prvků, systematické varianty)? Zásadně mění
   rozsah práce.
2. **Smím přidat sdílené UI komponenty** (`Header`, `Button`, `Chip`/`Tag`, `Card`, `EmptyState`,
   `Loading`/`Skeleton`) do `src/components/ui/` — hand-rolled, **bez nové závislosti**? A související:
   `CLAUDE.md` jmenuje `shadcn/ui`, ale **není nainstalované**; chceš ho teď zavést (je „posvěcený"
   stackem), nebo zůstat u ručního Tailwindu (menší churn, žádná nová dependency)?
3. **RecipeDetail max-šířka:** je dnešní `max-w-3xl` (jediná výjimka) záměr, nebo ho můžu sjednotit
   na úzkou úroveň jako u Vařit/Kalorie?
4. **Pohyb/přechody:** mám při sjednocení rovnou přidat respekt k `prefers-reduced-motion`
   (vypnout `active:scale`/přechody), nebo to nechat mimo tento pas?

## Finální rozhodnutí a pojistky (závazné) — uzavírá otevřené otázky

Rozhodl uživatel (+ user-advocate), potvrzeno. Reviewer kontroluje proti tomuto.

- **OO1:** cílený konzistenční pas s pár sdílenými komponentami. NE plný design-systém.
- **OO2:** sdílené komponenty **ručním Tailwindem** v `src/components/ui/`, **žádná nová závislost**,
  NEZAVÁDĚT shadcn/ui.
- **OO3:** RecipeDetail sjednotit na úzkou šířku (`max-w-3xl → max-w-2xl`).
- **OO4:** přidat `prefers-reduced-motion` (utlumit skeleton/přechody).

**Pojistky (závazné) — leštění je nesmí porušit:**
- [ ] **Režim vaření zůstává VELKÝ.** Velikost písma surovin i kroků a velikost odškrtávacích
  koleček se NEZMENŠUJE; CTA „Hotovo — uložit do historie" zůstává **výrazné a přes celou šířku**
  (dokumentovaná výjimka z jedné velikosti primary). Šipka `‹` zůstane vlevo nahoře. Klikací plochy
  ve vaření drží velikost pro palec.
- [ ] **Varování o úplnosti kalorií** („⚠ Orientační – z X z Y" v `NutritionSummary`) zůstává jasné
  **varování** (žlutá/amber + ikona), vizuálně **odlišené** od neutrální šedé i od hvězdy oblíbené.
- [ ] **Hvězda oblíbené, akční brand (terakota) a žluté varování jsou od sebe reálně rozeznatelné**
  na obrazovce — ne jen „zapsané role". Pokud dnes amber-hvězda a brand splývají, prakticky je odlišit.
- [ ] **Zachovat teplo:** 🍲 v prázdných stavech, „Hotovo 🎉" po dovaření, teplé pozadí, kulaté rohy
  (`rounded-2xl`). Nezešednit do korporátu; lean UI neznamená vyházet tu jednu emoji na obrazovku.
- [ ] **Loading:** hlavní výhra je **zrušit falešné „prázdný" probliknutí** na Nákupu/Koši (než
  dorazí data). Skeletony jinde střídmě a `motion-reduce`-aware; nepřidávat třpyt tam, kde se načte hned.
- [ ] **Zarovnání čísel na Kaloriích** (kcal vpravo pod sebou) zůstává čitelné.
- [ ] **Nic se nemění v chování ani datech** — jen vzhled/konzistence.
