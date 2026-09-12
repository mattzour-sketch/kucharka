# UC029 — Polish: zhuštění ovládání nad seznamem receptů (mobil)

Malý UI/UX polish z dogfoodingu. Rozhodnutí o konkrétní variantě je **otevřené** — návrhy jsou
níže, výběr nechávám na uživateli (viz Otevřené otázky). Žádná změna dat ani chování funkcí.

## Kontext

Přehled receptů (`src/features/recipes/RecipeListScreen.tsx`) má nad první kartou hodně „chromu",
který na mobilu (úzký viewport) odsune první recept dolů — uživatel musí scrollovat, než recept
uvidí. Aktuálně jsou nad mřížkou čtyři vrstvy:

1. **Hlavička** (`ScreenHeader`, sticky): logo + „Kuchařka" + tlačítka „Vložit" a „+ Nový recept".
2. **Hledací pole** — řádek `below` v hlavičce (přidáno v UC028), zobrazí se jen když jsou recepty.
3. **Řádek ovládání**: `select` řazení (Naposledy upravené / uvařené / podle názvu) + chip
   „★ Oblíbené" + chip „⚡ Rychlé" + tlačítko „🎲 Co dnes?". `flex-wrap` — na mobilu se láme na víc řádků.
4. **Řádek štítků**: filtrovací chipy podle tagů receptů. `flex-wrap`, proměnlivá výška — při mnoha
   štítcích zabere nejvíc místa a je hlavní viník.

**Cíl:** zhustit / chytře schovat část ovládání, aby bylo na mobilu vidět víc receptů, **aniž se
ztratí kterákoli funkce**: řazení, filtr Oblíbené, filtr Rychlé, filtr štítků, náhodný výběr
(„Co dnes?", UC022), hledání (UC018/UC028). Ryze UI/UX. **Žádná změna datového modelu.**

## Varianty řešení (nerozhodnuto — vybírá uživatel)

Tři konkrétní směry, seřazené od nejmenšího zásahu. Nedoporučuju jednu — potřebuju rozhodnutí.

- **A — Sbalit jen štítky (nejmenší zásah).** Řádek ovládání zůstává. Řádek štítků se na mobilu
  ořízne na 1 (příp. 2) řádky s přepínačem „Štítky ▾ / další"; zbytek se rozbalí na vyžádání.
  Aktivní štítek je vždy vidět. Desktop beze změny.
  _Plus:_ minimální riziko, řazení/filtry zůstávají hned viditelné. _Minus:_ ušetří jen výšku štítků.

- **B — Vše za jedno tlačítko „Filtry".** Řazení + Oblíbené + Rychlé + štítky se schovají za jedno
  tlačítko „Filtry" s odznakem počtu aktivních. Inline zůstane jen hledání, „Co dnes?" a „Filtry".
  Rozbalení = inline panel nebo spodní sheet.
  _Plus:_ nejvíc uvolní plochu pro recepty. _Minus:_ filtry/řazení na tap navíc; spodní sheet =
  nová komponenta (v `components/ui/` dnes není — viz Předpoklady); nutný indikátor aktivních filtrů.

- **C — Ovládání do (sticky) hlavičky.** Řádek ovládání se přesune do `ScreenHeader` (slot `below`,
  k hledání) a na mobilu se zmenší (např. řazení jako `Segmented`/ikona). Ovládání je pořád po ruce,
  ale mimo tok obsahu, takže první karta začíná výš.
  _Plus:_ ovládání stále vidět. _Minus:_ sticky hlavička naroste a ukusuje místo při scrollu;
  „Co dnes?" v hlavičce může být těsno.

Prvky lze kombinovat (např. A + přesun „Co dnes?"). Existující stavební kameny k opětovnému použití:
`FilterChip`, `Segmented`, `Button`, `ScreenHeader` (sloty `title`/`actions`/`below`).

## User stories

- Jako uživatel na mobilu, který si vybírá, co uvařit, chci po otevření přehledu vidět recepty
  rovnou (ne až po scrollu přes ovládání), abych se rychleji dostal k obsahu.
- Jako uživatel chci mít řazení, filtry (Oblíbené / Rychlé / štítky), „Co dnes?" i hledání dál
  dostupné, abych zhuštěním o žádnou funkci nepřišel.
- Jako uživatel chci poznat, že mám zapnutý filtr, i když je ovládání sbalené, abych se nelekl, že
  „recepty zmizely".

## Akceptační kritéria

**Guardraily — platí pro každou zvolenou variantu**
- [ ] Given jakákoli varianta, Then zůstanou dostupné všechny dnešní funkce: řazení (3 klíče),
      filtr Oblíbené, filtr Rychlé, filtr štítku, „🎲 Co dnes?", fulltext hledání — žádná nezmizí.
- [ ] Given zhuštění je jen UI, Then se nemění datový model ani schéma (žádná migrace) a nemění se
      chování hledání/filtrů/řazení z UC028 (`matchesQuery(recipeHaystack(recipe), query)`, respekt
      k aktivním filtrům i řazení).
- [ ] Given interakce z UC028 (aktivní filtr „Oblíbené" + odznačení hvězdy na kartě → `dimmed` /
      `keepVisibleIds`), Then funguje dál i po zhuštění ovládání.

**Efekt — měřitelný**
- [ ] Given referenční mobilní viewport (PŘEDPOKLAD ~375×667 px) se seznamem receptů a se štítky,
      When se přehled načte, Then je nad ohybem vidět víc obsahu receptů než dnes — konkrétně aspoň
      horní hrana první karty (přesný práh potvrdit, viz Otevřené otázky).
- [ ] Given mnoho štítků na mobilu, When se přehled načte, Then řádek štítků nezabere víc než
      [1–2] řádky; zbytek je dostupný přes „další/rozbalit" (přesný počet řádků potvrdit).

**Stav filtrů zůstává čitelný**
- [ ] Given aktivní filtr nebo nedefaultní řazení a sbalené ovládání, Then je z obrazovky poznat,
      že filtr běží (aktivní chip zůstává vidět / odznak počtu u „Filtry"), ne „recepty beze stopy".
- [ ] Given sbalené ovládání, When ho rozbalím, Then vidím a můžu měnit všechny filtry i řazení;
      When ho zase sbalím, Then aktivní filtry i řazení zůstanou v platnosti (sbalení nic neresetuje).

**A11y / téma / pohyb / prázdné stavy**
- [ ] Given nový přepínač „rozbalit/Filtry" (pokud ho varianta má), Then má `aria-expanded` +
      `aria-controls`, čitelný český popisek a ovládá se klávesnicí.
- [ ] Given tmavý režim (UC025), Then jsou všechny zhuštěné/schované prvky čitelné (kontrast, okraje)
      jako zbytek appky.
- [ ] Given `prefers-reduced-motion`, Then případná rozbalovací animace neanimuje (konzistentní
      s `motion-reduce` ve `FilterChip`).
- [ ] Given „Co dnes?" (ať skončí kdekoli), When `visible.length === 0`, Then je akce nedostupná
      (`disabled`), jako dnes.
- [ ] Given 0 receptů, Then se ovládání ani hledání nezobrazují (jako dnes) a polish nic nerozbije.

**Desktop bez regrese**
- [ ] Given desktop (≥ `sm`), Then zůstává mřížka 2–3 sloupce a ovládání se nerozbije; zhuštění cílí
      na mobil a desktop nezhoršuje.

## Okrajové případy a chybové stavy

| Situace | Očekávané chování |
|---|---|
| Mnoho štítků (přeteče přes řádek) | Zhuštěno na [1–2] řádky, zbytek pod „další/rozbalit"; aktivní štítek je vždy vidět. |
| Žádné štítky (`tags.length === 0`) | Řádek štítků ani jeho přepínač se nezobrazí (jako dnes). |
| Aktivní filtr + sbalené ovládání | Viditelný indikátor běžícího filtru; žádné „zmizely recepty" bez vysvětlení. |
| Velmi úzký telefon (~320 px) | Ovládání se nerozbije ani nevyteče mimo obrazovku; místo lámání do mnoha řádků se zhustí. |
| Sticky hlavička při scrollu (varianta C) | Sticky prostor nesmí narůst tak, aby ukusoval příliš místa; řešit, ať se ovládání v hlavičce nerozšíří nadměrně. |
| Landscape / tablet | Nezhoršit; na širokém viewportu se chová jako dnes. |
| Změna řazení/filtru při sbaleném ovládání | Po akci se seznam přepočítá okamžitě (live query) a indikátor aktivních filtrů se aktualizuje. |
| Filtr přežije zpět z detailu / duplikaci | Stejné chování jako dnes — zhuštění nemění (ne)perzistenci filtrů. |

## Mimo rozsah

- Změna datového modelu nebo schématu / migrace (zakázáno CLAUDE.md).
- Nové typy řazení nebo nové filtry — jen přeskládání/zhuštění stávajících.
- Změna logiky hledání (UC028 beze změny) a chování „Co dnes?" (UC022 beze změny).
- Redesign karty receptu (`RecipeCard`) a spodní lišty tabů (`TabLayout`).
- Perzistence zvolených filtrů/řazení mezi relacemi (dnes jen `useState` v paměti — beze změny).
- Nová závislost (např. knihovna pro drawer/sheet) bez předchozího schválení — pokud ji zvolená
  varianta potřebuje, je to Otevřená otázka, ne součást tohoto rozsahu.
- Desktop redesign (platí jen no-regress).

## Předpoklady

- PŘEDPOKLAD: „Mobil" = úzký viewport pod Tailwind `sm` (~< 640 px). Desktop (≥ `sm`) dnes zobrazuje
  2–3 sloupce a problém nemá; polish je mobile-first a desktop nezhoršuje.
- PŘEDPOKLAD: Referenční zařízení pro „kolik je vidět" ≈ 375×667 px (malý telefon). Konkrétní práh
  „aspoň X karet / horní hrana první karty nad ohybem" je k potvrzení.
- PŘEDPOKLAD: Tlačítka „Vložit" a „+ Nový recept" v hlavičce zůstávají a nehýbe se s nimi — zachycení
  receptu je hlavní úloha appky (CLAUDE.md). Případné zmenšení na ikonu na mobilu je až open question.
- PŘEDPOKLAD: Hledací pole (UC028) je častá akce a zůstává hned dostupné, neschovává se za „rozbalit"
  (potvrdit — mohlo by jít i pod toggle).
- PŘEDPOKLAD: Největší viník výšky je řádek štítků a lámající se řádek ovládání; ty mají prioritu
  ke zhuštění.
- PŘEDPOKLAD: Řešení vystačí s Tailwindem a stávajícími komponentami (`FilterChip`, `Segmented`,
  `Button`, `ScreenHeader`). V `components/ui/` dnes **není** sheet/drawer/popover — varianta B se
  spodním sheetem by znamenala novou komponentu (příp. novou závislost → napřed schválit, CLAUDE.md).
- PŘEDPOKLAD: Filtry/řazení zůstávají jen v paměti (`useState`) a defaultní řazení je „Naposledy
  upravené" — polish (ne)perzistenci nemění.
- PŘEDPOKLAD: Lean české UI — přidané labely jsou věcné („Filtry", „Štítky", „další"), bez balastu.

## Otevřené otázky

1. **Která varianta — A, B, nebo C** (nebo kombinace)? Jak agresivně schovávat vs. nechat viditelné?
2. **Referenční viewport a práh** „kolik receptů má být vidět bez scrollu" (návrh: 375×667, aspoň
   horní hrana první karty). Souhlas / jiné číslo?
3. **Kolik řádků štítků** nechat rozbalených (1 vs. 2), než se zbytek schová?
4. **Smí „🎲 Co dnes?" zmizet z první obrazovky** (přesun do hlavičky / pod „rozbalit" / FAB)? Je to
   objevná funkce — schování sníží její viditelnost.
5. **Hledací pole vždy vidět, nebo taky pod toggle?** (Předpoklad: vždy vidět.)
6. **Je OK přidat přepínač „rozbalit/sbalit" (toggle)** i při lean UI? A má si pamatovat stav mezi
   návštěvami, nebo se vždy otevře sbalené?
7. **Jak signalizovat aktivní filtr při sbaleném ovládání** — odznak s počtem u „Filtry", tečka,
   nebo nechat aktivní chip vidět?
8. **Platí polish jen pro mobil** (jen responsive, desktop beze změny), nebo zhustit i desktop?
9. **Smí varianta zavést spodní sheet/drawer** (nová komponenta v `ui/`, příp. nová závislost),
   nebo se držet inline expandu bez nové komponenty?

## Rozhodnutí (uživatel 2026-09-12) — platí pro návrh i implementaci

1. **Varianta = kombinace A+C** (bez B). Řazení + filtry (★ Oblíbené, ⚡ Rychlé) + „🎲 Co dnes?"
   do jednoho kompaktního řádku; řádek štítků sbalitelný. Žádný spodní sheet, žádná nová závislost.
2. **Rozsah = mobil i desktop, responzivně.** Na mobilu (pod `sm`) plné zhuštění včetně sbalení
   štítků; na desktopu zůstává ovládání vidět v tomtéž řádku, štítky se sbalí jen při přetečení
   (vysoký cap).
3. **Ovládací řádek:** řazení zůstává `<select>` (ukazuje aktuální hodnotu — must-fix advokáta),
   chipy „★ Oblíbené"/„⚡ Rychlé" **s textem** (ne holé ikony), „Co dnes?" jako ikona 🎲 na mobilu
   a plný text „🎲 Co dnes?" na `≥sm`. `flex-wrap` jako pojistka na ~320 px.
4. **Štítky = chytré defaulty bez pamatování** (Q6). Toggle „+N dalších / Méně" se ukáže **jen když
   se štítky nevejdou** (cap na řádky); při málo štítcích se nic neschová ani nezobrazí toggle.
   Viditelné (při sbalení) = **nejpoužívanější podle počtu receptů**, aktivní štítek je z kolabování
   vyjmutý (vždy vidět). Stav rozbaleno/sbaleno **jen v paměti** — žádný localStorage (pravidlo 6).
   Splňuje advokátův must-fix „ať jsou vidět moje používané štítky" bez další výjimky z pravidla.
5. **Aktivní filtr zůstává výrazně vidět** (Q7) — aktivní chip se nikdy neschovává; žádný abstraktní
   odznak „Filtry (N)".
6. **Přidat „Zrušit filtry" jedním ťuknutím** (must advokáta, nad rámec původního rozsahu): když
   běží libovolný filtr (Oblíbené / Rychlé / štítek) nebo hledání, zobrazí se akce „✕ Zrušit filtry",
   která vše vrátí na plný seznam. Pojistka proti pocitu „recepty zmizely".
7. „Co dnes?" (Q4) **zůstává na první obrazovce** (jen zmenšené na ikonu na mobilu), neschovává se.
   Hledací pole (Q5) zůstává **vždy vidět**. Referenční viewport (Q2) ~375×667, práh „aspoň horní
   hrana první karty" — přesné hodnoty capů se doladí při živém ověření (Q3).
