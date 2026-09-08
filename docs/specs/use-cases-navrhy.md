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

---

## UC027 — Našeptávač potravin už při psaní receptu

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

## UC023 — Sekce surovin (na těsto / na náplň)

**Jako** uživatel se složitějšími recepty,
**chci** rozdělit suroviny do pojmenovaných skupin,
**abych** je četl po částech a neztrácel se v jednom dlouhém seznamu.

Poznámky ke stavu: musí respektovat „volný text" (pravidlo 1) — skupiny nesmí zablokovat prosté
zachycení. Otevřené: jak skupinu reprezentovat (nadpis jako speciální řádek vs. pole na položce).
Dotčené: model položek / konvence `raw_text`, editor + `RecipeDetailScreen` + `CookingModeScreen`.

**Hotovo, když:**
- [ ] Given recept, When přidám nadpis skupiny, Then se pod něj řadí suroviny až do dalšího
  nadpisu (na detailu i ve vaření).
- [ ] Volný text zůstává zdroj pravdy; recept jde dál uložit jen s názvem (pravidla 1, 3).
- [ ] Bez skupin se seznam chová jako dnes (žádná regrese).

**Velikost:** 🟡 střední · **Priorita:** střední · **Návrh architekta:** ANO (reprezentace skupin v modelu / parsování)

---

## UC025 — Tmavý režim

**Jako** uživatel, co večer vaří u sporáku,
**chci** přepnout na tmavý motiv,
**abych** mě appka neoslňovala do očí.

Poznámky ke stavu: průřezová změna motivu (CSS proměnné / Tailwind `dark`). Pozor: pravidlo 6
zakazuje `localStorage` pro **data appky** — předvolba vzhledu je per-zařízení UI, ne data, ale
kde ji držet je potřeba rozhodnout (architekt). Výchozí = respektovat systémovou předvolbu.

**Hotovo, když:**
- [ ] Given zapnu tmavý režim, Then se drží i po znovuotevření a jako výchozí respektuje
  systémovou předvolbu.
- [ ] Motiv je konzistentní přes všechny obrazovky (sdílené komponenty `ui/`), včetně varovných
  a „bez kalorií" stavů.

**Velikost:** 🟡 střední · **Priorita:** nižší · **Návrh architekta:** ANO (kam s předvolbou + průřezový motiv)

---

## UC021 — Týdenní plán jídel (+ nákup z plánu)

**Jako** uživatel, co plánuje dopředu,
**chci** přiřadit recepty na dny v týdnu a jedním klikem z plánu naplnit nákupní seznam,
**abych** neposílal do nákupu recept po receptu ručně.

Poznámky ke stavu: nová lokální tabulka (např. `meal_plan`) → Dexie `version()` bump; napojení na
existující „do nákupu" (naškálování podle porcí). Dotčené: `src/db/index.ts`, nová obrazovka plánu,
nákupní repo.

**Hotovo, když:**
- [ ] Given plán na týden, When přidám recept na „středu", Then je vidět v plánu (přežije restart).
- [ ] Given hotový plán, When dám „Do nákupu", Then se přidají suroviny všech receptů plánu
  (naškálované podle porcí), jako u dnešního nákupu z receptu.
- [ ] Smazání položky plánu je soft (pravidlo 7); plán nemění recepty ani historii.

**Velikost:** 🔴 velká · **Priorita:** nízká · **Návrh architekta:** ANO (nová tabulka + migrace + napojení na nákup)

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

Jede se shora dolů podle priority, story po story přes `/feature`. Rychlé výhry bez architekta
jsou hotové (UC019/UC024/UC022). Zbývá: **UC027 Našeptávač při psaní** (architekt netřeba, ale
Zákazník povinně), pak architekt-flagované **UC023 Sekce surovin**, **UC025 Tmavý režim**,
**UC021 Týdenní plán** a parkoviště **UC026 Chytřejší přenos**.
