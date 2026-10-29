# Backlog nových funkcí (UC016+)

Prioritizovaný seznam stories ve stylu, který se osvědčil v portfolio-trackeru: hlas
**Jako / chci / abych**, akceptační kritéria **Hotovo, když** (Given/When/Then) a u každé
story štítky **Velikost · Priorita · Návrh architekta**. Z tohohle dokumentu se jede
`/feature` story po story (BA už má hrubá AK, architekt se volá jen tam, kde je flag ANO).

Navazuje na `docs/specs/use-cases.md` (UC001–UC015 = hotové).

**Omezení (platí pro všechny):** lokální bez serveru (přenos jen JSON), surovina = volný
text (pravidlo 1), `raw_text` se nepřepisuje (pravidlo 2), kalorie se nepředstírají
(pravidlo 4), interně gramy a plná přesnost (pravidlo 9), lean české UI. **Mimo rozsah:**
plný deník / Fáze 3 (uživatel nechce).

**Legenda.** Velikost: 🟢 malá · 🟡 střední · 🔴 velká. Priorita: nejvyšší / vysoká /
střední / nízká. „Návrh architekta: ANO" = story sahá do modelu / více vrstev / přidává
závislost, tak před psaním jede `architect`; „ne" = přímočaré, developer rovnou.

---

## Hotovo

- **UC016 — Podrecepty** ✅ napojení suroviny na jiný recept, kalorie protečou (obrazovka Kalorie).
- **UC017 — Domácí míry → gramy** ✅ „1 lžíce = 15 g", výběr míry u suroviny.
- **UC020 — Poznámky k receptu** ✅ trvalá poznámka na detailu receptu.
- **UC018 — Hledat podle suroviny** ✅ pokryto stávajícím hledáním (`SearchScreen` hledá
  přes `recipeHaystack` = i suroviny z `rawCapture`). Samostatná funkce není potřeba.
- **UC019 — Duplikovat recept** ✅ akce „Duplikovat recept" na detailu → kopie k úpravě.
- **UC024 — Škálování na cílové kalorie** ✅ na obrazovce Kalorie: cíl kcal/porci → počet porcí + g/porce.
- **UC022 — Co dnes uvařit** ✅ tlačítko „🎲 Co dnes?" na seznamu (náhodně z aktuálně zobrazených).
- **UC025 — Tmavý režim** ✅ přepínač Systém/Světlý/Tmavý ve „Víc", bez FOUC.
- **UC023 — Sekce surovin** ✅ nadpis sekce = řádek „# Na těsto" (bez změny modelu).
- **Sdílení do appky** ✅ (2026-10-20) manifest `share_target`: text z WhatsAppu / Keep / prohlížeče
  → Sdílet → Kuchařka otevře Vložit předvyplněné (`lib/shareTarget.ts`). Jen Android + nainstalovaná
  PWA. IG sdílí jen odkaz → ukáže se nápověda „Odkaz neotevřu".
- **Připomínka a sdílení zálohy** ✅ (2026-10-22) tečka u „Víc", když záloha chybí nebo je starší
  než 30 dní (jen když existuje recept). Na mobilu „Sdílet zálohu" přes systémové sdílení (.txt,
  protože Chrome .json nesdílí; obnova bere obojí).
- **Odkaz z IG** ✅ (2026-10-24) místo slepé hlášky návod přes Circle to Search („podrž spodní lištu,
  označ text v reelu → Kopírovat") a tlačítko „Uložit odkaz na později": recept „Recept z Instagramu"
  (TikTok/YouTube/web obdobně, `lib/links.ts`) s odkazem v postupu, na detailu klikací. Rozdělaný
  náhled ve Vložit zůstává. Ve Vložit je rozbalovací návod „Jak na recept z Instagramu" (`ImportHelp`).
- **Štítky ve Vložit** ✅ (2026-10-22) výběr štítků v náhledu, přežijí nové „Rozebrat" i zavření appky.
- **Procházka appkou 2026-10-23** ✅ časovače se po Hotovo zruší, zapomenuté (doběhlé před >3 h)
  se tiše smažou a mají v názvu začátek kroku. Hláška o rozdělaném vaření ukáže datum a první
  ťuknutí = začít znovu. Po Hotovo je lišta „Vrátit zpět“. U porcí je „z 3 · zpět“. Kalorie ukazují
  „chybí gramy“ a souhrn „Chybí: …“. Výběr potraviny je předvyplněný názvem suroviny. Drobnosti:
  „2 porce“, obnova ze zálohy v prázdném seznamu, „Použito v N receptech“, datum v koši.
  Vynecháno: přepočet množství na konci řádku („Mouka 500 g“) – Martin ho nechce.
- **Procházka appkou 2026-10-24** ✅ časovače jsou lišta dole na každé obrazovce a zvoní všude
  (`TimerDock` v `App.tsx`). Ťuknutí na text kroku ho odškrtne a další krok se posune do zorného pole.
  Zpět zavře jen překryv (fotka, výběr potraviny; `hooks/useBackToClose.ts`). Zavření receptu
  odvodí název jako Uložit. Úprava potraviny se před zahozením zeptá. Odpojení na Kaloriích má
  „Vrátit“. Prázdné hledání nabídne „+ Nový recept ‚xyz‘“ a v Potravinách „+ Založit ‚xyz‘“
  (hledání potravin v URL a po uložení zůstane). Řazení Uvařené ukazuje „uvařeno …“. Statistiky
  vedou na `?neuvarene=1`. Vložit upozorní „Už máš: …“. Zbývá: obnova zálohy přepíše novější
  recepty bez volby – udělat zvlášť (logika v `lib/backup.ts` + test).
- **Obnova zálohy – novější recepty** ✅ (2026-10-26) výchozí „Novější nechat“, vědomě „Přepsat vše“.
- **Procházka appkou 2026-10-29** ✅ (body 1–4, spec `prochazka-2026-10-29.md`) „Zrušit“ časovače
  má „Vrátit zpět“; doběhlý má „+5 min“ a „Zastavit“, po kterém zůstane 2 min tichý řádek „Hotovo“
  s „+5 min“. Displej ve vaření nezhasne ani po návratu do appky (`lib/wakeLock.ts`). Diktovaný
  řádek jde ručně „Rozdělit na N surovin / N kroků“ (`lib/lineSplit.ts`, nikdy automaticky).
  „1 h 30 min“ je jeden časovač (se spojkou „a“ ne). Odloženo: „50 m2“ se bere jako 50 min.
- **Doba přípravy + „⚡ Rychlé"** ✅ nepovinný čas u receptu (odznak na kartě, filtr rychlých ≤ 30 min).
- **UC021 — Týdenní plán** ❌ ZAHOZENO — do osobní kuchařky nesedí (plánování jídel je jiná aplikace).

---

## Procházka 2026-10-29 — nezačaté body 5–12

Návrhy user-advocate, všechny malé, bez změny schématu a bez závislosti. Martin zatím vybral jen 1–4.

5. Druhé ťuknutí na čas v kroku nezaloží stejný časovač znovu; v kroku se ukáže, kolik zbývá.
6. Při prvním časovači věta „Zvoní, jen když je Kuchařka otevřená“; u doběhlého „doběhl před 12 min“.
7. „Přidat fotku“ otevře rovnou foťák (`capture`) — dát volbu „Vyfotit“ / „Z galerie“.
8. Obnova zálohy počítá i stejné recepty jako přepsané — ukázat „2 změněné · 46 beze změny“.
9. „1 h“ v Době nebo „4–6“ v Porcích se uloží prázdné — přepočítat hodiny, jinak hned „nerozumím“.
10. Pod názvem receptu „zapsáno … · uvařeno 4×, naposledy …“ místo holého data.
11. Recept bez zadaných porcí: počítadlo na detailu škáluje od 1 — schovat ho.
12. Řazení „Upravené“ ukazuje na kartě „upraveno …“; tmavé barvy pro hlášku o rozdělaném vaření a pruh postupu.

---

## UC027 — Našeptávač potravin už při psaní receptu ⏸ PARKOVIŠTĚ

> Pozn. 2026-09-08: Po přečtení `RecipeEditScreen` zaparkováno. Obrazovka psaní jsou dvě prostá
> `<textarea>` (volný text, diktování) a **položky receptu vznikají až při uložení** — při psaní
> není k čemu `food_id` připnout. Napojování při psaní by vynutilo rozbití textarey na řádkové
> widgety = zabití rychlého zachycení (pravidlo 1). Napojení už dnes dává smysl na Kaloriích
> (`suggestFood` „→ Máslo?"). Neřešit, dokud nevznikne pádnější důvod.

**Jako** uživatel, který zrovna píše/vkládá recept,
**chci** decentní nabídku napojení řádku suroviny na založenou potravinu už tady,
**abych** nemusel dělat druhý průchod na obrazovce Kalorie.

Poznámky ke stavu: staví na `searchTermFromText` + `matchesQuery` + vzoru `suggestFood`
(už existují). Dotčené: capture obrazovky (`/novy`, `/vlozit`). **Zákazník (user-advocate)
je tu klíčový** — musí posoudit, že to neotravuje.

**Pozor (hlavní úloha appky):** zachycení musí zůstat rychlé (do 60 s, i diktované) a bez
nutriční hlavy (pravidlo 1). Nenásilně: psaní zůstává čistý text, nic neblokuje, nabídka je
opt-in náznak, ne agresivní dropdown.

**Hotovo, když:**
- [ ] Given píšu řádek suroviny, When appka pozná odpovídající potravinu, Then nabídne napojení
  nenásilně (nezdržuje psaní, jde ignorovat), `raw_text` se nemění (pravidlo 2).
- [ ] Napojení zůstává nepovinné; kalorie se nepředstírají (pravidlo 4).
- [ ] Given diktované rychlé psaní, Then nabídka nikdy nepřebije/neukradne fokus psaní.

**Velikost:** 🟡 střední · **Priorita:** střední · **Návrh architekta:** ne (staví na hotových kusech; **Zákazník povinně**)

---

## UC026 — Chytřejší přenos receptu do appky (parkoviště)

**Jako** uživatel s recepty roztroušenými po webu, v knize nebo slyšenými,
**chci** je dostat do appky i jinak než ručním vložením textu (odkaz / fotka-OCR / diktování),
**abych** je nepřepisoval.

**Pozor:** OCR (Tesseract) i hlas (Web Speech) = **nová závislost** → dle konvence CLAUDE.md
**napřed se zeptat**; fetch webu naráží na lokální/CSP omezení. Velké, samostatné, spíš později.
Zapsáno jako parkoviště, ne brzký kandidát.

**Hotovo, když:** (upřesní se, až se do toho půjde — nejdřív rozhodnout, kterou cestou začít)
- [ ] Given zdroj (odkaz / fotka / hlas), When ho předám appce, Then se předvyplní návrh receptu
  k potvrzení; `raw_capture` zůstává zdroj pravdy (pravidlo 2).

**Velikost:** 🔴 velká · **Priorita:** nízká (parkoviště) · **Návrh architekta:** ANO + **nová závislost (zeptat se)**

---

## Jak dál

Velké stories jsou hotové. UC021 Týdenní plán je zahozený. V backlogu zůstávají jen dvě parkoviště:
**UC026 Chytřejší přenos** (OCR/hlas/URL — nová závislost, napřed se zeptat; text z jiných appek
už řeší Sdílení do appky) a **UC027** (koliduje s architekturou zachycení). Další práce jsou drobná
vylepšení z dogfoodingu a procházek appkou, ne nové stories. Nejbližší kandidáti: body 5–12 z
procházky 2026-10-29 (sekce výše).
