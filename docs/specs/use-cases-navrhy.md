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
- **Doba přípravy + „⚡ Rychlé"** ✅ nepovinný čas u receptu (odznak na kartě, filtr rychlých ≤ 30 min).
- **UC021 — Týdenní plán** ❌ ZAHOZENO — do osobní kuchařky nesedí (plánování jídel je jiná aplikace).

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

Jede se shora dolů podle priority, story po story přes `/feature`. Hotovo je vše kromě dvou:
zbývá už jen velký **UC021 Týdenní plán** (nová tabulka + migrace + nákup z plánu) a parkoviště
**UC026 Chytřejší přenos** (OCR/hlas/URL — nová závislost, napřed se zeptat). UC027 je
zaparkovaný (koliduje s architekturou zachycení).
