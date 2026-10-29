# Procházka appkou 2026-10-29 – časovače, displej, rozdělení řádků, spojené časy

Čtyři body, které Martin vybral z procházky (user-advocate). Ostatní body (5–12) jsou odložené,
viz „Mimo rozsah".

## Kontext

Všechny čtyři body se týkají dvou chvil: **vaření** (mokré ruce, telefon opřený u linky) a
**zachycení** receptu, který někdo diktuje nebo který přišel jako popisek z IG. V obou chvílích
dnes appka člověka zdrží nebo mu něco vezme:

1. **Časovač.** `TimerDock` (`src/features/recipes/CookingTimers.tsx`) má u běžícího časovače
   „Zrušit". To ho hned natvrdo smaže z tabulky `timers` (`removeTimer`) a nejde to vrátit.
   Doběhlý časovač jde jen „Zastavit". Když jídlo ještě není hotové, musí se nový časovač
   zakládat ručně (ťuknout na čas v kroku, nebo napsat minuty do „Vlastní časovač").
   Globální lišta „Vrátit zpět" (`UndoProvider`) už v appce je a k časovačům existuje
   `restoreTimers` (používá ho „Hotovo" ve vaření).
2. **Displej zhasíná.** `src/hooks/useWakeLock.ts` při odchodu z appky (zamknutí, přepnutí
   aplikace) přijde o zámek, protože ho prohlížeč uvolní sám. Proměnná `sentinel` ale dál drží
   starý, už uvolněný zámek. Podmínka `!sentinel` v `onVisibilityChange` proto po návratu
   neplatí a zámek se znovu nevezme. **Ověřeno v kódu.** Displej pak zhasíná, ačkoli SPEC
   (§ režim vaření, E-15) slibuje, že nezhasne.
3. **Diktát na jednom řádku.** Řádek pole Suroviny = jedna položka (`splitIngredientLines`
   dělí jen podle `\n`) a řádek Postupu = jeden krok (vaření dělí podle `\n+`). Diktát
   „200 g mouky, 2 vejce, špetka soli" bez Enterů je tak jedna surovina a souvislý postup je
   jeden krok. Totéž platí pro popisky z IG: parser podle UC031 čárkami záměrně nedělí.
4. **Spojený čas.** `splitStepByDurations` (`src/lib/duration.ts`) udělá z „Péct 1 h 30 min"
   dva klikací časy („1 h" a „30 min"), tedy dva časovače. Dnešní test `„1 hr 30 mins" = dva
   klikací segmenty` toto chování zabetonovává a **musí se změnit**.

Rozhraní: appka má jen jedno, webovou PWA (mobil i desktop). CLI ani API nemá, takže všechno
níže platí pro PWA.

**Schéma DB se nemění u žádného bodu.** „+5 min" jen přepíše `endsAt` u existujícího záznamu
v `timers`. „Vrátit" vrací tentýž záznam. Rozdělení je běžná úprava textu polí. Nová závislost
není potřeba.

### Bod 3 a pravidlo 2 (původní text se nepřepisuje)

- `recipes.raw_capture` dnes není samostatně uchovaný originál. Je to **zrcadlo**, které se při
  každém uložení znovu skládá z polí Suroviny a Postup (`combineRawCapture`). Stejně tak
  `recipe_items.raw_text` = řádek pole.
- Pravidlo 2 zakazuje, aby text **automaticky** přepsalo strukturování nebo napojení na
  potravinu. Rozdělení podle tohoto spec je **ruční úprava, kterou spustí uživatel ťuknutím**.
  Je to totéž, jako by sám dopsal Enter: nespouští se při psaní, při uložení ani v parseru.
- Rozdělení mění jen oddělovač na zalomení řádku. Slova, čísla, jednotky, diakritika ani
  velikost písmen se nemění a nic se nenahrazuje názvem z databáze. Tím je pravidlo 2
  dodržené. Důsledek: po rozdělení už v `raw_capture` nezůstane verze „vše na jednom řádku",
  stejně jako po ručním Enteru (viz PŘEDPOKLAD P3-7).

## User stories

- **US1.** Jako kuchař s mokrýma rukama chci omylem zrušený časovač jedním ťuknutím vrátit, ať
  nepřijdu o odpočet, který běží už 40 minut.
- **US2.** Jako kuchař chci doběhlý časovač jedním ťuknutím prodloužit o 5 minut, když jídlo
  ještě není hotové, ať nemusím zakládat nový.
- **US3.** Jako kuchař chci, aby displej v režimu vaření nezhasl ani po tom, co jsem odskočil do
  jiné aplikace nebo zamkl telefon a vrátil se, ať nemusím umazanými prsty odemykat.
- **US4.** Jako člověk, který si recept nechal nadiktovat nebo ho vložil z IG, chci jedním
  ťuknutím rozdělit suroviny z jednoho řádku na jednotlivé řádky a souvislý postup na kroky,
  ať se recept dá vařit (odškrtávat suroviny i kroky). A chci to, aniž by mi appka sama
  přepisovala text nebo mě rušila při psaní.
- **US5.** Jako kuchař chci, aby „1 h 30 min" v kroku bylo jedno klikací místo pro jeden
  časovač na 90 minut, ne dva časovače.

## Akceptační kritéria

### Bod 1 – Časovač: Vrátit po Zrušit, +5 min u doběhlého

- [ ] Given běží časovač „Krok 3 · Péct" se zbývajícím časem 12:00, When ťuknu na „Zrušit",
      Then časovač zmizí z lišty a objeví se globální lišta „Časovač zrušen" s „Vrátit zpět".
- [ ] Given jsem právě zrušil časovač, When do zmizení lišty ťuknu na „Vrátit zpět", Then se
      časovač vrátí se **stejným názvem a stejným cílovým časem** (`endsAt`). Odpočet ukazuje,
      kolik zbývá teď: čas, kdy byl časovač zrušený, se odečetl, nezastavil se.
- [ ] Given jsem zrušil časovač a nevrátil ho, When lišta „Vrátit zpět" sama zmizí (standardní
      doba `UndoProvider`), Then je časovač zrušený natrvalo a nikde se neobjeví.
- [ ] Given jsem zrušil časovač, jehož cílový čas mezitím uplynul, When ťuknu na „Vrátit zpět",
      Then se vrátí jako doběhlý („Hotovo!") a hned zvoní.
- [ ] Given časovač doběhl a zvoní, Then vedle „Zastavit" je tlačítko „+5 min".
- [ ] Given doběhlý časovač zvoní, When ťuknu na „+5 min", Then se z něj stane běžící časovač
      **se stejným názvem**, který doběhne za 5:00 od ťuknutí. Zvonění přestane, pokud nezvoní
      jiný doběhlý časovač. Nevznikne druhý záznam.
- [ ] Given doběhlý časovač zvoní už 3 minuty, When ťuknu na „+5 min", Then doběhne za 5:00
      od ťuknutí, ne za 2:00 (počítá se od teď, ne od původního konce).
- [ ] Given prodloužený časovač znovu doběhne, Then zvoní a znovu nabízí „+5 min" i „Zastavit".
- [ ] Given běžící (nedoběhlý) časovač, Then „+5 min" u něj **není**.
- [ ] Given doběhlý časovač zvoní, When ťuknu na „Zastavit", Then zvonění přestane a časovač
      **nezmizí hned**: zůstane v liště jako ztlumený řádek „Hotovo" (nezvoní, nebliká) s
      tlačítky „+5 min" a „×". Lišta „Vrátit zpět" se neukáže (změna po schválení, viz níže).
- [ ] Given ztlumený časovač, When uplynou 2 minuty od ztlumení, Then sám zmizí z lišty i
      z tabulky `timers`.
- [ ] Given ztlumený časovač, When ťuknu na „+5 min", Then z něj je běžící časovač na 5:00 od
      ťuknutí (stejný název, žádný druhý záznam). Když znovu doběhne, zvoní.
- [ ] Given ztlumený časovač, When ťuknu na „×", Then zmizí hned.
- [ ] Given ztlumený časovač a jiný zvonící, Then zvoní jen ten zvonící (ztlumený se do zvonění
      nepočítá).
- [ ] Given lišta časovačů na obrazovce se spodní lištou (pod `TabLayout`) i mimo ni, Then
      „Vrátit zpět" i „+5 min" fungují stejně (dock je globální).

### Bod 2 – Displej nezhasne ani po návratu do vaření

- [ ] Given jsem v režimu vaření a prohlížeč podporuje Screen Wake Lock, When obrazovku otevřu,
      Then se požádá o zámek displeje (stav jako dnes).
- [ ] Given jsem v režimu vaření a mám zámek, When appku opustím (zamknutí telefonu, přepnutí
      aplikace, `visibilityState = hidden`) a vrátím se (`visible`), Then se o zámek **znovu
      požádá**, i když ho prohlížeč mezitím uvolnil.
- [ ] Given jsem appku opustil a vrátil se třikrát po sobě, Then po každém návratu je zámek
      znovu aktivní a v každý okamžik drží appka nejvýš jeden živý zámek (žádný neuvolněný
      zbytek).
- [ ] Given jsem v režimu vaření, When obrazovku vaření opustím (zpět na detail, Hotovo), Then
      se zámek uvolní a po návratu appky z pozadí se už **nevezme** (mimo vaření se displej
      chová normálně).
- [ ] Given prohlížeč Wake Lock API nemá, nebo žádost odmítne (např. úspora baterie), When se
      vrátím do vaření, Then appka nic nehlásí a funguje dál bez zámku (fallback jako dnes).
- [ ] Ověřitelné testem v `environment: 'node'` s podvrženým `navigator.wakeLock` a `document`
      (visibilitychange): po sekvenci visible → hidden (zámek uvolněn systémem) → visible je
      `request('screen')` zavolán podruhé.

### Bod 3 – Rozdělit na řádky / na kroky

Logika (rozpoznání a rozdělení) je čistá funkce v `src/lib/` s testy. Platí pro **Upravit** a
**Nový recept** (obojí `RecipeEditScreen.tsx`) i pro **náhled Vložit** (`ImportRecipeScreen.tsx`).

*Suroviny:*
- [ ] Given pole Suroviny obsahuje řádek „200 g mouky, 2 vejce, špetka soli", Then se u pole
      ukáže nenápadná nabídka „Rozdělit na 3 suroviny".
- [ ] Given nabídka je vidět, When na ni ťuknu, Then pole obsahuje tři řádky „200 g mouky",
      „2 vejce", „špetka soli" (oddělovač a okolní mezery zmizí, jinak je text znak po znaku
      stejný) a nabídka zmizí.
- [ ] Given „1,5 kg brambor, 0,5 l mléka", Then rozdělení dá „1,5 kg brambor" a „0,5 l mléka".
      Čárka mezi dvěma číslicemi bez mezery je desetinná, ne oddělovač.
- [ ] Given „200 g sýra (eidam, gouda), 2 vejce", Then rozdělení dá „200 g sýra (eidam, gouda)"
      a „2 vejce". Uvnitř závorek se nedělí.
- [ ] Given středník („200 g mouky; 2 vejce") nebo vložená odrážka „•", Then se dělí stejně
      jako u čárky.
- [ ] Given „sůl a pepř" nebo „sůl, pepř", Then se nabídka **neukáže** (spojka „a" není
      oddělovač, dvě části bez čísla nestačí, viz P3-2).
- [ ] Given nadpis sekce „# Na těsto, polevu", Then se nadpis nikdy nedělí.
- [ ] Given pole má víc řádků a jen jeden z nich splňuje podmínku nabídky, When ťuknu na
      rozdělení, Then se rozdělí jen ten řádek. Ostatní řádky i jejich pořadí zůstanou.
- [ ] Given koncová nebo zdvojená čárka („2 vejce, , sůl,"), Then prázdné části nevzniknou.
- [ ] Počet N v nabídce = počet surovin (neprázdných řádků mimo nadpisy) **po** rozdělení, se
      správným tvarem: „Rozdělit na 2 suroviny", „Rozdělit na 5 surovin".

*Postup:*
- [ ] Given Postup obsahuje řádek „Smíchej mouku s vejci. Nech 20 min odpočinout. Vyválej a peč
      na 180 °C.", Then se ukáže nabídka „Rozdělit na 3 kroky" (5+ „kroků").
- [ ] When na ni ťuknu, Then má Postup tři řádky, každá věta jeden krok **včetně své tečky**
      (mění se jen mezera mezi větami na zalomení řádku), a nabídka zmizí.
- [ ] Given „Přidej cca. 2 lžíce, např. Hery. Pak peč.", Then se za zkratkami („cca.", „např.",
      „tzv.", „tj.", „resp.", „popř.", „příp.") nedělí.
- [ ] Given „1. Smíchej mouku. 2. Peč 20 min.", Then vzniknou kroky „1. Smíchej mouku." a „2. Peč
      20 min.". Tečka hned za samotným číslem (pořadí) není konec věty a číslo zůstane v textu.
- [ ] Given „Peč na 180 °C 1.5 h. Pak vychladit.", Then „1.5" (desetinná tečka bez mezery) věty
      nedělí.
- [ ] Given řádek postupu se dvěma větami („Rozpal pánev. Přidej máslo."), Then se nabídka
      **neukáže** (práh viz P3-3).

*Chování nabídky (obojí):*
- [ ] Given píšu nebo diktuju do pole, Then nabídka nikdy nevezme fokus, nepohne kurzorem ani
      neposune pole, ve kterém píšu (ověřit ručně na mobilu).
- [ ] Given nabídku ignoruju, Then se nic nerozdělí ani při průběžném ukládání, při „Uložit",
      ani při uložení z náhledu Vložit. Recept se uloží s textem tak, jak je.
- [ ] Given jsem rozdělil, Then se objeví „Rozděleno" s „Vrátit zpět". Ťuknutí vrátí pole přesně
      do stavu před rozdělením.
- [ ] Given jsem rozdělil a do pole pak ještě psal, Then „Vrátit zpět" nesmí smazat to, co jsem
      napsal po rozdělení. Mechanismus (lišta zmizí při psaní, nebo Vrátit nic neudělá) určí
      architekt.
- [ ] Given recept v Upravit, rozdělím a pak dám „Zahodit", Then je recept zase ve stavu při
      otevření, tedy nerozdělený (stávající chování Zahodit).
- [ ] Given rozdělení je idempotentní: When výsledek pustím funkcí rozdělení znovu, Then se nic
      nezmění a nabídka se neukáže.
- [ ] Given uložený rozdělený recept, When otevřu vaření, Then jsou suroviny i kroky samostatně
      odškrtávatelné a časy v nových krocích jsou klikací.
- [ ] Given náhled Vložit, When rozdělím, Then se to počítá jako ruční úprava náhledu (nové
      „Rozebrat" se zeptá „Přepsat náhled?") a souhrn náhledu („N surovin · M kroků") se hned
      přepočítá.
- [ ] Testy v `src/lib/`: všechny příklady výše, plus invariant „spojím části zpět oddělovačem a
      dostanu původní řádek, až na mezery kolem oddělovače".

### Bod 4 – Spojené časy

- [ ] Given krok „Péct 1 h 30 min", Then je klikací jeden úsek „1 h 30 min" = 5400 s. Ťuknutí
      spustí **jeden** časovač na 1:30:00.
- [ ] Given „Bake 1 hr 30 mins", Then jeden úsek „1 hr 30 mins" = 5400 s (stávající test se
      přepíše).
- [ ] Given „1 hodinu 30 minut", „2 h 30 min 10 s", Then je každý z nich jeden úsek
      (5400 / 9010 s).
- [ ] Given „1 h a 30 min" nebo „1 hour and 30 minutes" (se spojkou), Then se **nespojí** a
      zůstanou dva úseky jako dnes (3600 s a 1800 s).
- [ ] Given „1h30min" nebo „1h 30m" (bez mezer), Then jeden úsek 5400 s.
- [ ] Given „Péct 1 h, pak nechat 90 s", Then dva úseky (3600 s a 90 s). Čárka nebo jiný text
      mezi časy spojení zabrání (stávající test platí dál).
- [ ] Given „30 min 1 h" nebo „20 min 20 min" (jednotky ne v pořadí h → min → s, nebo se
      opakují), Then se nespojí a zůstanou dva úseky.
- [ ] Given rozsah „12–15 minutes" nebo „1–1,5 h", Then chování jako dnes (klikací je horní
      mez) a spojování se ho netýká.
- [ ] Given údaj doby ve Vložit („Prep: 1 h 30 min", „Doba přípravy: 1 h 30 min"), Then je doba
      přípravy dál 90 min (`parseTimeLine` beze změny výsledku).
- [ ] Given text bez času („Nastrouhat 4 brambory na másle"), Then beze změny (stávající testy
      `duration.test.ts` kromě „dva klikací segmenty" platí dál).

## Okrajové případy a chybové stavy

| Situace | Očekávané chování |
|---|---|
| Zruším dva časovače rychle po sobě | Lišta „Vrátit zpět" je jen jedna (UndoProvider drží jednu akci). Vrátit jde poslední zrušený, první je zrušený natrvalo (P1-3). |
| Zruším časovač a pak zruším i třetí přes „Hotovo" ve vaření | Platí poslední lišta („Uloženo do historie"). Její Vrátit vrátí časovače zrušené tímto Hotovo, ne dřív ručně zrušený. |
| Lišta „Vrátit zpět" překryje jiný řádek docku | Tlačítka ostatních časovačů (hlavně „Zastavit" u zvonícího) musí zůstat ťuknutelná, nebo musí jít lištu zavřít „×". Rozhodne architekt. |
| „+5 min" u časovače, který doběhl před víc než 3 h | Nenastane. Zastaralé časovače se nezobrazují (`isStaleTimer`). |
| „+5 min" ťuknuté dvakrát rychle za sebou | Výsledek je běžící časovač na 5:00 od posledního ťuknutí, ne 10:00 (druhé ťuknutí už míří na běžící časovač, kde „+5 min" není). |
| Zvoní dva doběhlé, „+5 min" dám jen u jednoho | Druhý dál zvoní, zvonění neustane. |
| Zvuk prohlížeč neodemkl | „+5 min" je gesto uživatele, takže zvuk se odemkne stejně jako při zakládání časovače (`primeAlarm`). |
| Wake Lock: návrat do appky, ale vaření mezitím zavřené | Žádná žádost o zámek. |
| Wake Lock: žádost po návratu selže | Tiše bez zámku, bez opakování ve smyčce a bez hlášky. |
| Wake Lock: systém zámek uvolní, zatímco je appka vidět (úspora baterie) | Žádné okamžité opakování (P2-1). Další pokus až při příštím návratu do appky. |
| Rozdělení řádku suroviny, která byla napojená na potravinu | Napojení se smí ztratit (staré položce se nastaví `deletedAt`, nové jsou nenapojené) nebo zůstat u části, kterou spáruje `pairEditedLines`. Úplnost se musí ukázat poctivě („2 z 5 surovin", pravidlo 4). Nic se nedopočítává (P3-5). |
| Rozdělení postupu, když je recept rozvařený (`cookSessions`) | Odškrtnuté kroky jsou uložené podle pořadí a mohou se posunout. Stejně je to dnes při jakékoli ruční úpravě postupu (P3-6). |
| Diktát bez interpunkce („200 g mouky 2 vejce špetka soli") | Nabídka se neukáže, není podle čeho dělit (viz Otevřená otázka 2). |
| Velmi dlouhý řádek (např. 5000 znaků) | Rozpoznání nezdrží psaní. Funkce je lineární a bez zaseknutí na regexu (test s dlouhým vstupem, jako `parseRecipe.review.test.ts`). |
| Prázdné pole / jen mezery | Žádná nabídka. |
| Recept jen s názvem | Uložit jde dál (pravidlo 3), nabídka se neukáže. |
| Čas „1 h 30" (minuty bez jednotky) | Klikací jen „1 h", jako dnes. „30" bez jednotky se nebere. |
| „půl hodiny", „hodinu a půl" | Mimo rozsah (žádné zlomky slovem), chování jako dnes. |

## Změny po schválení (Martin 2026-10-29)

Mají přednost před textem výše (kritéria jsou podle nich už upravená).

1. **„Zastavit" = ztlumit na 2 minuty.** Zastavený doběhlý časovač zůstane v liště jako tiché
   „Hotovo" s „+5 min" a „×" a za 2 minuty od ztlumení zmizí sám. Lišta „Časovač zastaven"
   s „Vrátit zpět" se nedělá, ztlumený řádek ji nahrazuje. „Zrušit" běžícího časovače má dál
   lištu „Časovač zrušen" s „Vrátit zpět".
2. **Texty nabídky:** „Rozdělit na N surovin/suroviny" a „Rozdělit na N kroků/kroky", lišta po
   rozdělení „Rozděleno".
3. **Spojené časy jen bez spojky:** „1 h 30 min", „1h30min" ano, „1 h a 30 min" ani
   „1 hour and 30 minutes" ne.

## Mimo rozsah

- **Body 5–12 z procházky 2026-10-29 (user-advocate)** jsou odložené. Nejsou součástí tohoto
  spec a nic z nich se neimplementuje. Doplnit je do backlogu (`use-cases-navrhy.md`) podle
  zprávy user-advocate.
- Automatické dělení (při psaní, v parseru Vložit, při uložení). Rozdělení je vždy jen ruční
  ťuknutí.
- Dělení textu bez interpunkce (podle čísel), pokud Martin nerozhodne jinak (Otázka 2).
- Opačná akce „spojit řádky", dělení v jiných polích (název, poznámky).
- Úprava parseru Vložit (UC031). Čárkami dál automaticky nedělí.
- „+5 min" u běžícího časovače, jiné prodloužení (+1, +10, vlastní), úprava běžícího časovače.
- Zámek displeje mimo režim vaření (např. když běží časovač na detailu).
- Spojování časů napříč větami, časy slovy („půl hodiny"), rozsahy.
- Změna schématu DB, nová závislost, server a synchronizace.

## Předpoklady

*Bod 1 – časovače*
- PŘEDPOKLAD P1-1: „+5 min" počítá 5 minut **od ťuknutí**, ne od původního konce. Zvonilo-li to
  mezitím, ten čas se nepřičítá.
- PŘEDPOKLAD P1-2: Prodloužení je pevně +5 min a jen jedno tlačítko. Žádná volba délky.
- PŘEDPOKLAD P1-3: Platí dnešní chování `UndoProvider`, tedy jedna akce k vrácení a lišta po
  chvíli zmizí. Pro časovače se neprodlužuje ani nerozšiřuje.
- PŘEDPOKLAD P1-4: Texty jsou „Časovač zrušen" (lišta), „Vrátit zpět" (dnešní text lišty) a
  „+5 min".
- ROZHODNUTO (Martin 2026-10-29): „Zastavit" u doběhlého časovače má taky „Vrátit zpět"
  (lišta „Časovač zastaven"). Původní předpoklad P1-5 neplatí. **Nahrazeno změnou po
  schválení:** místo lišty Vrátit zůstane zastavený časovač 2 minuty jako ztlumený řádek.

*Bod 2 – displej*
- PŘEDPOKLAD P2-1: Zámek se znovu bere jen při návratu appky do popředí, ne hned po tom, co ho
  systém uvolní, zatímco je appka vidět. Ochrana proti smyčce, když systém zámek odpírá kvůli
  baterii.
- PŘEDPOKLAD P2-2: Zámek drží jen obrazovka vaření (jako dnes, E-15). Rozšíření na lištu
  časovačů mimo vaření se nedělá.

*Bod 3 – rozdělení*
- PŘEDPOKLAD P3-1: Oddělovače surovin jsou `,`, `;` a vložená odrážka `•`. Není to spojka
  „a"/„and", pomlčka ani lomítko. Čárka je desetinná jen mezi dvěma číslicemi **bez mezery**
  („1,5"). „mouky, 2 vejce" je oddělovač.
- PŘEDPOKLAD P3-2: Nabídka u surovin se ukáže, když se nějaký řádek (mimo nadpis `#`) rozdělí
  na **≥ 3 části**, nebo na **2 části, které obě začínají číslicí**. „sůl, pepř" ani „2 vejce,
  sůl" nabídku nespustí, „200 g mouky, 2 vejce" ano. Falešná nabídka u „1 cibule, nakrájená,
  osmažená" je přijatelná, dá se ignorovat.
- PŘEDPOKLAD P3-3: Nabídka u postupu se ukáže, když má nějaký řádek **≥ 3 věty**. Konec věty
  je `.`/`!`/`?` (případně se závorkou nebo uvozovkou), za ním mezera a pak velké písmeno nebo
  číslice. Nepočítají se zkratky „cca., např., tzv., tj., resp., popř., příp." ani tečka hned
  za samotným číslem. Dvouvětý krok je běžný a nabídku by spouštěl u většiny ručně psaných
  receptů.
- PŘEDPOKLAD P3-4: Rozdělí se jen řádky, které splňují podmínku nabídky. Ostatní řádky
  zůstanou, i kdyby obsahovaly čárku.
- PŘEDPOKLAD P3-5: Když se rozdělí napojený řádek suroviny, smí se napojení ztratit. Řádky z
  diktátu na jednom řádku bývají nenapojené. Úplnost výživy to ukáže poctivě.
- PŘEDPOKLAD P3-6: Rozdělaný stav vaření se po rozdělení postupu nepřepočítává (stejné jako
  dnes po ruční úpravě).
- PŘEDPOKLAD P3-7: Rozdělení se bere jako ruční úprava textu (soulad s pravidlem 2, viz
  Kontext). Verze „vše na jednom řádku" se nikam zvlášť neukládá. Jediná cesta zpět je
  „Vrátit zpět", v Upravit ještě „Zahodit".
- PŘEDPOKLAD P3-8: Po rozdělení je k dispozici „Vrátit zpět" přes stávající globální lištu.
  Text lišty je „Rozděleno".
- PŘEDPOKLAD P3-9: Texty nabídek jsou „Rozdělit na N surovin" (2–4 „suroviny", 5+ „surovin")
  a „Rozdělit na N kroků" (2–4 „kroky", 5+ „kroků"). N u surovin nepočítá nadpisy sekcí.
  (Změna po schválení, původně „řádky" a „Rozdělit na kroky (N)".)
- PŘEDPOKLAD P3-10: Nabídka je u obou rozhraní stejná: Nový recept, Upravit (jedna obrazovka) i
  náhled Vložit.

*Bod 4 – časy*
- PŘEDPOKLAD P4-1: Spojují se jen sousední časy s jednotkami v klesajícím pořadí h → min → s,
  každá nejvýš jednou. Mezi nimi smí být jen mezery nebo nic („1h30min"). Spojka „a"/„and",
  čárka, tečka nebo jiné slovo spojení zabrání (změna po schválení).
- PŘEDPOKLAD P4-2: Název časovače se nemění („Krok N · …" z `stepTimerLabel`).

## Otevřené otázky

Obě zodpověděl Martin 2026-10-29:
1. Ano, „Vrátit zpět" i po „Zastavit" (viz kritéria bodu 1).
2. Diktování čárky vrací. Dělí se podle čárek (P3-1), dělení podle čísel se nedělá.

Původní znění:

1. **Má mít „Vrátit zpět" i „Zastavit" u doběhlého časovače?** „+5 min" a „Zastavit" budou
   vedle sebe a mokrý palec může trefit vedlejší tlačítko. S Vrátit by se časovač obnovil jako
   doběhlý a znovu zazvonil, takže by šlo dát „+5 min". Bez Vrátit (předpoklad P1-5) je
   zastavení definitivní a v nejhorším případě se založí nový časovač ručně.
2. **Diktuješ suroviny s čárkami?** Pokud ti diktování v telefonu vrací „200 g mouky 2 vejce
   špetka soli" bez čárek, nabídka se podle tohoto spec neukáže. Dělit i podle čísel (nový
   řádek před každým číslem s jednotkou) je riskantnější: „2 vejce 3 žloutky" funguje, ale
   „sýr 30 % 100 g" by se rozdělil špatně. Mám to přidat, nebo stačí čárky?
