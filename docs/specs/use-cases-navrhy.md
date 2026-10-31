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

## Procházka 2026-10-29 — body 5–12 ✅ HOTOVO (2026-10-31)

Martin schválil všechny. Bez změny `stores()` a bez závislosti.

5. Časovač z kroku si pamatuje původ (`Timer.source`, `stepTimerSource`); druhé ťuknutí nezaloží
   duplikát a u času v kroku běží odpočet (`StepTimerButton`). Ztlumený stejného původu nahradí nový.
6. Lišta časovačů: 15 s po spuštění „Zvoní, jen když je Kuchařka otevřená"; doběhlý „Doběhl před 12 min".
7. Na dotykovém zařízení „📷 Vyfotit" (`capture`) a „🖼️ Z galerie"; na desktopu jen „Přidat fotku".
8. Obnova zálohy počítá recept se stejným `updatedAt` jako „Beze změny", ne jako přepsaný.
9. Doba bere „1 h", „1 h 30 min", „1:30" (po opuštění pole přepíše na minuty); nečitelná Doba
   nebo Porce „4–6" hned ukáže „nerozumím" (`lib/fieldInput.ts`). Editor i Vložit.
10. Pod názvem „zapsáno … · uvařeno 4×, naposledy …" (`lib/recipeDates.ts`).
11. Recept bez porcí nemá na detailu počítadlo (zůstává „Pro kolik porcí?"). Vaření beze změny
    („počítám od 1" je tam vědomě oznámené).
12. Řazení Upravené ukazuje „upraveno …"; tmavé barvy hlášky o rozdělaném vaření a pruhu postupu.

---

## Procházka 2026-10-31 ✅ HOTOVO (všech 12, 2026-10-31)

Procházka v náhledu na mobilu s prázdnou databází: diktovaný recept (bramboráky, čárky bez
Enterů), vaření s časovačem a Hotovo, Kalorie po načtení potravin, Vložit s popiskem ve stylu IG
(banánový chlebíček), hledání, Víc. Martin schválil všech 12. Žádný bod nemění `stores()` ani
nepřidává závislost. Rozsah času u **Doby** při importu bere dál horní mez (`maxSeconds`).

**Zachycení a Vložit**
1. **Diktovaný postup zůstane jedním obřím krokem.** „Brambory nastrouhat a vymačkat, přidat
   vejce, mouku…, smažit na sádle…“ nemá tečky, takže se „Rozdělit na N kroků“ nenabídne (chce
   ≥ 3 věty). Návrh: nabídnout dělení i u čárky, za kterou začíná sloveso v infinitivu nebo
   rozkazu (`přidat`, `smažit`, `přidej`). Dál jen nabídka na ťuknutí, logika v `lib/lineSplit.ts` + test.
2. **Vložit bere vatu z IG jako surovinu.** „Uložte si na později!“ skončí jako první surovina.
   Návrh: parser pozná výzvy typu uložte/ulož si, sdílej, sleduj, dej like a do náhledu je nedá.
   Originál zůstává v poznámce „Originál“. Nový vzorek do `igSamples.ts`.
3. **Úvodní řádek se stane nadpisem sekce.** „Na formu 25 cm budeš potřebovat:“ se zobrazí jako
   sekce „NA FORMU 25 CM BUDEŠ POTŘEBOVAT“. Návrh: jediná sekce na začátku nebude nadpis. Řádek
   s užitečnou informací (forma 25 cm) půjde na začátek postupu.

**Vaření**
4. **Číslování kroků je dvakrát.** Kolečko „1“ a za ním „1. Banány rozmačkej…“. Návrh: ve vaření
   při zobrazení skrýt úvodní „1.“ / „1)“. Text receptu se nemění (pravidlo 2).
5. **Rozsah času.** U „50–55 minut“ je klikací jen „55 minut“. Návrh: klikací celé „50–55 minut“,
   časovač na dolní mez (50), ať se kontroluje včas. Týká se jen času, ne množství surovin.

**Kalorie a historie**
6. **Koření bez množství blokuje úplnost.** „majoránka“ zůstane „chybí gramy“ a recept je napořád
   „orientační“. Návrh: sušené bylinky a koření **bez čísla** přeskočit jako sůl (majoránka, kmín,
   oregano, bazalka, tymián, skořice…). S číslem („2 lžíce papriky“) se dál napojují.
7. **Kusové suroviny bez kcal.** Na Kaloriích má „800 g brambor“ vedle sebe 616 kcal, ale
   „2 vejce“ jen „110 g“. Návrh: u kusů ukázat kcal stejně jako u gramů.
8. **Historie vaření opakuje celý recept.** Záznam bez odchylek vypíše všech 7 surovin a nabídne
   „Uvařit znovu takhle“, které nic jiného neudělá. Návrh: bez odchylek „podle receptu“ a žádné
   tlačítko. S odchylkami jen změněné řádky (vynecháno, nahrazeno, jiné množství).

**Seznam, detail, Víc**
9. **Úryvek na kartě se slévá.** „800 g brambor 2 vejce 100 g hladké mouky 3 stroužky…“ nemá
   oddělovače. Návrh: oddělit „ · “. Při hledání ukázat úryvek s řádkem, kde se našlo.
10. **Data jako „dnes / včera“.** „zapsáno 31. 10. 2026 · uvařeno 31. 10. 2026“ a „upraveno …“.
    Návrh: u čerstvých dat „dnes“, „včera“, „před 3 dny“ (funkce pro zálohu v `lib/date.ts` už je).
11. **Víc: záloha až pod Vzhledem.** Tečka u Víc upozorňuje na zálohu, ale nahoře je přepínač
    motivu. Návrh: Záloha dat jako první sekce.

**Drobnost**
12. Odškrtávací kolečka ve vaření nemají popisek (`aria-label` „Hotovo: 800 g brambor“).

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
vylepšení z dogfoodingu a procházek appkou, ne nové stories. Procházky 2026-10-29 i 2026-10-31
jsou hotové; další kandidáti vzejdou z příští procházky appkou.
