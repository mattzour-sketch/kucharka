# Návrhy nových use casů (backlog UC016+)

Kandidáti k **postupnému plnění** — věci, které appka zatím nemá. Navazuje na
`docs/specs/use-cases.md` (UC001–UC015 = hotové). Sepsáno jako podklad k
prioritizaci; každý UC dostane plnou spec (Given/When/Then) až se do něj půjde.

Poznámka ke vzniku: BA i user-advocate agenti při zadání narazili na rate limit,
tak je backlog syntéza z obou úhlů (produktová úplnost + reálná uživatelská přání
z dřívějších rozhovorů). Klidně to necháme agenty rozšířit, až limit padne.

**Omezení (platí pro všechny):** lokální bez serveru (přenos jen JSON), surovina =
volný text (pravidlo 1), kalorie se nepředstírají (pravidlo 4), lean UI. **Mimo
rozsah:** plný deník/Fáze 3 (uživatel nechce).

Legenda velikosti: 🟢 malé · 🟡 střední · 🔴 velké. „Model" = sahá do datového modelu.

---

## UC016 — Podrecepty (recept jako surovina) 🟡 · model: bez migrace

Surovinu receptu jde napojit na **jiný recept** (např. „domácí bešamel", „těsto"),
ne jen na potravinu. Kalorie podreceptu protečou do nadřazeného.

**Proč:** stavební kameny, co vařím dokola (bešamel, vývar, těsto), nechci
přepisovat do každého receptu; a kalorie mají téct skrz.

**Hrubá AK:**
- Given surovina, When ji napojím na jiný recept místo potraviny, Then se do
  kalorií započítá podle jeho hodnot na 100 g / porci.
- Given podrecept odkazuje sám na sebe (cyklus), Then se to bezpečně ošetří
  (výpočet už cyklus umí — E-03), nespadne.
- `raw_text` se nemění (pravidlo 2). Pole `sub_recipe_id` v modelu už existuje,
  jen chybí UI napojení.

## UC017 — Domácí míry → gramy (lžíce, hrnek, plátek) ✅ HOTOVO 🟡 · model: FoodPortion (schéma existuje)

U potraviny půjde nadefinovat běžné míry („1 lžíce" = 15 g, „1 hrnek" = 250 g)
a u suroviny pak vybrat míru místo ručního zadávání gramů.

**Proč:** dnes „2 lžíce oleje" musím ručně přepsat na gramy, jinak se kalorie
nespočítají — tohle je největší tření počítání kalorií u běžných receptů.

**Hrubá AK:**
- Given potravina má míru „lžíce = 15 g", When u suroviny zvolím „2 lžíce",
  Then se gramáž (30 g) a kcal dopočítají.
- Míry jsou nepovinné; bez nich zůstává dnešní zadání g/ks.
- Tabulka `food_portions` v Dexie/migraci už je, jen se nepoužívá.

## UC018 — Hledat podle suroviny („co udělám z cukety") 🟢 · model: bez migrace

Ve vyhledávání/receptech jde najít recepty **obsahující danou surovinu**.

**Proč:** mám půl cukety a chci vědět, co z ní udělám — dnes hledám v hlavě.

**Hrubá AK:**
- Given zadám surovinu „cuketa", Then vidím recepty, jejichž `raw_text` ji
  obsahuje (bez diakritiky, se stemem jako dnešní hledání).
- Kombinuje se se stávajícími filtry (štítek, oblíbené).

## UC019 — Duplikovat recept 🟢 · model: bez migrace

Z receptu udělám kopii jako základ pro variantu („guláš, ale ostrý").

**Proč:** nechci od nuly, chci vyjít z hotového a jen upravit.

**Hrubá AK:**
- Given recept, When dám „Duplikovat", Then vznikne nový recept se stejnými
  surovinami/postupem/štítky, samostatný (úprava kopie nemění originál).
- Kopie nepřebírá historii vaření ani oblíbenost.

## UC020 — Poznámky k receptu (mimo vaření) ✅ HOTOVO 🟢 · model: recipeNotes (existuje)

K receptu si kdykoliv připíšu volnou poznámku („příště míň soli", „od Aničky").

**Proč:** poznámky z vaření jdou dnes jen do historie u konkrétního uvaření;
chci i trvalou poznámku k receptu samotnému.

**Hrubá AK:**
- Given recept, When přidám poznámku, Then se zobrazuje na detailu a přežije.
- Tabulka `recipe_notes` už v modelu existuje.

## UC021 — Týdenní plán jídel (+ nákup z plánu) 🔴 · model: nová tabulka

Recepty přiřadím na dny v týdnu; z plánu jde jedním klikem naplnit nákupní seznam.

**Proč:** plánuju dopředu; dnes musím do nákupu posílat recept po receptu ručně.

**Hrubá AK:**
- Given plán na týden, When přidám recept na „středu", Then je vidět v plánu.
- Given hotový plán, When dám „Do nákupu", Then se přidají suroviny všech
  receptů plánu (naškálované podle porcí), jako u dnešního nákupu z receptu.
- Nová lokální tabulka (např. `meal_plan`).

## UC022 — „Co dnes uvařit" (náhodný návrh) 🟢 · model: bez migrace

Tlačítko vylosuje recept — klidně jen z rychlých, podle štítku, nebo z dlouho
nevařených.

**Proč:** věčná otázka „co dnes"; občas chci, ať to za mě appka píchne.

**Hrubá AK:**
- Given kliknu „Co dnes uvařit", Then dostanu jeden náhodný recept (volitelně
  filtr štítkem / „dlouho nevařené" z historie).

## UC023 — Sekce surovin (na těsto / na náplň) 🟡 · model: drobná změna

Suroviny receptu jde rozdělit do pojmenovaných skupin.

**Proč:** složitější recepty čtu po částech; jeden dlouhý seznam je nepřehledný.

**Hrubá AK:**
- Given recept, When přidám nadpis skupiny, Then se pod něj řadí suroviny až do
  dalšího nadpisu.
- Volný text zůstává zdroj pravdy; skupiny nesmí zablokovat prosté zachycení.

## UC024 — Škálování na cílové kalorie / porci 🟢 · model: bez migrace

Zadám cílové kcal na porci a appka poradí počet porcí / gramáž.

**Proč:** hlídám si porci na X kcal; dnes to počítám z hlavy.

**Hrubá AK:**
- Given recept s napojenými surovinami a cíl „500 kcal/porce", Then appka ukáže,
  na kolik porcí to vyjde (jen orientačně, pravidlo 4 — nepředstírá).

## UC025 — Tmavý režim 🟡 · model: jen předvolba

Přepínač světlý/tmavý motiv (večerní vaření, šetření očí).

**Proč:** večer u sporáku svítí bílá appka do očí.

**Hrubá AK:**
- Given zapnu tmavý režim, Then se drží i po znovuotevření a respektuje
  systémovou předvolbu jako výchozí. (Předvolba vzhledu, ne data appky.)

## UC026 — Chytřejší přenos receptu do appky 🔴 · velké / nová závislost

Nad rámec dnešního „vložit text": import z **odkazu** (web recept), z **fotky
stránky (OCR)**, nebo **diktování hlasem**.

**Proč:** recepty mám roztroušené po webu, v knize, nebo je slyším.

**Pozor:** OCR (Tesseract) i hlas (Web Speech) = **nová závislost** a nižší
spolehlivost; fetch z webu naráží na lokální/CSP omezení. Spíš samostatné, velké,
napřed se zeptat. Zapsáno jen jako parkoviště, ne jako brzký kandidát.

---

## Jak dál

Vyber, které UC chceš rozjet první (klidně víc), a pojedeme je jeden po druhém —
každý přes svou spec + implementaci + ověření. Můj tip na start (užitek/cena):
**UC017 domácí míry** (odblokuje kalorie u běžných receptů), **UC018 hledat podle
suroviny** a **UC016 podrecepty** (model to už umí).
