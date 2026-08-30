# Use casy — Fáze 1 (Kuchařka)

Vazba na `docs/SPEC.md`, sekci 3 (Uživatelské scénáře S1–S7) a sekci 4.1 (funkční
požadavky R-xx). Základ (UC001–UC006) je čistě **fáze 1** — bez potravin, nutrice
a deníku. Zbytek (UC007–UC015) je nad rámec formální fáze 1, ale v appce už
reálně existuje (nákupní seznam, koš, sdílení, časovače, historie vaření…),
tak je zapsaný rovnou, aby dokumentace odpovídala skutečnému stavu appky,
ne jen roadmapě.

Formát: hlavní tok jako číslovaný scénář (rychlá orientace), pod ním alternativní/chybové
toky a akceptační kritéria ve stylu Given/When/Then — stejně jako u ostatních
specifikací v `docs/specs/`.

---

## UC001 — Zachycení nového receptu (text)

Vazba: S1 ★ nejdůležitější scénář, R-01, R-02, R-03, R-05

**Hlavní tok:**
1. Na domovské obrazovce kliknu na velké tlačítko „Nový recept".
2. Zadám název receptu.
3. (Nepovinně) upravím datum zachycení (jinak se použije dnešní).
4. Do jednoho velkého textového pole napíšu suroviny a postup volně za sebou,
   jak to slyším — žádné dohledávání, žádný číselník.
5. Zavřu obrazovku (uložení běží průběžně na pozadí, viz E-16/pravidlo 11).

**Alternativní a chybové toky:**
- Nevyplním název vůbec → při zavření/opuštění se název odvodí z prvního
  řádku textu, nebo se použije „Bez názvu" (žádná validace zachycení nezastaví).
- Appka je offline (letadlový režim, signál u babičky v kuchyni) → uložení
  proběhne stejně, bez chyby, bez čekání.

**Akceptační kritéria:**
- Given prázdný formulář, When vyplním jen název, Then jde recept uložit (pravidlo 3).
- Given appka je offline, When recept uložím, Then se uloží okamžitě do IndexedDB
  (appka je lokální, žádná síť ani synchronizace — pravidlo 11).
- Given uložený recept, Then `raw_capture`/`raw_text` obsahuje přesně to, co
  jsem napsal, beze změny (pravidlo 2, R-05).
- Given recept nemá vyplněné datum, Then se přesto uloží bez chyby (jediné
  povinné pole je název).

---

## UC002 — Zachycení receptu fotkou

Vazba: S2, R-04

**Hlavní tok:**
1. Nový recept → zadám alespoň název.
2. Vyfotím nebo nahraju fotku (kartička s receptem od babičky).
3. Zavřu obrazovku bez přepisu textu — fotka sama je dostatečný podklad.

**Alternativní a chybové toky:**
- Fotka se uloží lokálně (blob v IndexedDB) hned; žádné nahrávání na server –
  appka je lokální, fotka žije jen v tomhle prohlížeči (E-16).
- Později se k receptu doplní i přepsaný text → fotka zůstává u receptu dál
  jako podklad, nemaže se automaticky.

**Akceptační kritéria:**
- Given recept má jen název a fotku, Then je platně uložený (S2 je nepovinný scénář,
  ale nesmí být blokovaný).
- Given appka je offline při focení, Then se fotka uloží lokálně a neztratí se
  (nikam se nenahrává, žije jen v tomhle prohlížeči).

---

## UC003 — Prohlížení a hledání receptů

Vazba: S5, R-20, R-21

**Hlavní tok:**
1. Otevřu záložku „Recepty" → vidím seznam všech nesmazaných receptů.
2. Napíšu do hledání dotaz, např. „kure smetana" → appka hledá fulltextově
   napříč názvem, surovinami i postupem, bez ohledu na diakritiku a české
   skloňování.
3. Volitelně řadím (naposledy upravené / uvařené / podle názvu) a filtruju
   podle štítku nebo jen oblíbené.
4. Kliknu na recept → otevře se detail.

**Alternativní a chybové toky:**
- Hledání nic nenajde → appka ukáže prázdný stav, ne chybu.
- Recept je smazaný (`deleted_at` vyplněné) → v seznamu ani ve výsledcích
  hledání se nikdy nezobrazí (pravidlo 7).

**Akceptační kritéria:**
- Given recept se surovinou „Máslo" v dotazu „maslo" (bez diakritiky),
  Then se recept najde (R-20).
- Given dotaz „smetanou" a recept obsahující slovo „smetana", Then se recept
  najde (skloňování, viz `docs/SPEC.md` Příloha A).
- Given smazaný recept, Then se nikdy neobjeví v seznamu ani ve filtru (pravidlo 7).

---

## UC004 — Editace a strukturování receptu

Vazba: S4 (nepovinný, „úklidový" scénář), R-11, R-16, R-18

**Hlavní tok:**
1. Otevřu recept → „Upravit".
2. Upravím pole surovin/postupu (jedna surovina na řádek).
3. Přidám nebo odeberu štítky (snídaně, rychlovka, po babičce…).
4. Zavřu — uloží se průběžně, žádné explicitní „Uložit" není nutné.

**Alternativní a chybové toky:**
- Otevřu starý recept zachycený jedním polem (bez rozdělení na suroviny/postup) →
  appka ho zpětně kompatibilně načte do editace (legacy `raw_capture`).
- Rozmyslím si úpravu a zavřu bez změny → nic se nepřepíše navíc, mění se jen to,
  co jsem fakticky upravil.

**Akceptační kritéria:**
- Given rozepsaná úprava, When zavřu obrazovku, Then se změny uloží bez
  nutnosti mačkat „Uložit" (průběžné ukládání).
- Given recept beze změny otevřu a hned zavřu, Then se `updated_at` nezmění
  (žádný falešný zápis).
- Given upravuji suroviny, Then `raw_text` každé položky odpovídá přesně
  tomu řádku, co jsem napsal (pravidlo 2).

---

## UC005 — Vaření podle receptu (režim vaření)

Vazba: S3, R-22

**Hlavní tok:**
1. Otevřu recept, stojím u sporáku, ruce od těsta.
2. Přepnu do režimu vaření: velké písmo, displej nezhasíná.
3. Odškrtávám suroviny klepnutím, jak je použiju.
4. Procházím postup po krocích.
5. Opustím režim vaření → displej se pustí zhasnout jako normálně.

**Alternativní a chybové toky:**
- Zařízení nepodporuje Screen Wake Lock API → appka to neshodí, jen displej
  zhasne jako obvykle (fallback, E-15).
- Odškrtnuté suroviny i hotové kroky se pamatují: když vaření opustím a vrátím
  se (do pár hodin), stav je zachovaný (sezení vaření, §6). Nahoře vidím průběh
  – kolik surovin a kroků mám hotových.

**Akceptační kritéria:**
- Given otevřený režim vaření, Then je písmo výrazně větší než v běžném
  zobrazení receptu.
- Given režim vaření je aktivní, Then displej nezhasne, dokud ho neopustím
  (kde to platforma podporuje).
- Given klepnu na surovinu, Then se vizuálně označí jako odškrtnutá.
- Given odškrtnu suroviny (a označím hotové kroky) a odejdu z vaření, When se
  za chvíli vrátím, Then je ten stav zachovaný (sezení vaření, §6).

---

## UC006 — Práce offline a lokální data (bez serveru)

Vazba: pravidlo 6/11, NF-3, rozhodnutí „bez serveru"

Appka jede **čistě lokálně, bez serveru** (vědomé rozhodnutí projektu): žádné
přihlášení, žádná synchronizace, žádný Supabase ani outbox. Všechna data žijí
v IndexedDB v tomhle prohlížeči. „Offline" tím pádem není zvláštní režim, je to
výchozí stav. Záloha a přenos na jiné zařízení = ruční **export/import JSON**.

**Hlavní tok:**
1. Appka funguje stejně online i offline – nic nečeká na síť (UC001–UC005 beze změny).
2. Každý zápis jde okamžitě do IndexedDB, obrazovka se aktualizuje hned.
3. Když chci data zálohovat nebo přenést na jiné zařízení, ve „Víc" udělám
   export do JSON; na druhém zařízení ho naimportuju.

**Alternativní a chybové toky:**
- Vymažu data prohlížeče / přeinstaluju bez zálohy → recepty jsou pryč; export
  je jediná pojistka (žádný server data nedrží).
- Import ze zálohy narazí na už existující záznam → sloučí se podle id (upsert),
  nezaloží duplicitu.

**Akceptační kritéria:**
- Given appka je bez sítě, When cokoliv uložím, Then se to uloží okamžitě a UI
  se aktualizuje bez čekání (pravidlo 11).
- Given udělám export do JSON, Then soubor obsahuje recepty, potraviny i historii
  a jde jím obnovit stav na jiném zařízení.
- Given nikde není server, Then appka nikdy neposílá data ven ani nečeká na síť.

---

## UC007 — Napojení suroviny na potravinu s návrhem gramáže

Vazba: S4, R-12, R-31, `docs/specs/food-picker-vyber.md`. Formálně fáze 2
(nutriční nadstavba), ale v kódu už existuje, proto je zapsaný i tady, aby
UC dokumentace odpovídala skutečnému stavu appky.

Tenhle use case existoval dřív jen jako ruční napojení (otevřít vyhledávací
výběr, najít potravinu, pak ještě samostatně napsat gramáž — i když ji
uživatel často už napsal v `raw_text`, např. „40g másla"). Teď appka tu
gramáž a odhad potraviny nabízí sama, jako **návrh k potvrzení**, ne jako
automatické napojení — `raw_text` se tím nemění (pravidlo 2).

**Hlavní tok:**
1. Otevřu recept → „Kalorie" (obrazovka doplnění nutričních hodnot, S4).
2. U suroviny, kterou appka umí rozpoznat (např. „40g másla"), se vedle
   „napojit potravinu" objeví návrh `→ Máslo?`.
3. Klepnu na návrh → potravina se napojí a gramáž (40 g) se rovnou předvyplní
   z textu suroviny, aniž bych ji psal znovu.
4. U surovin bez jednoznačné gramáže (např. „hrst mouky", „2 vejce") appka
   nic nehádá — nabídne jen běžné ruční napojení nebo přeskočení.

**Alternativní a chybové toky:**
- Appka najde shodu, ale je špatná (jiná potravina stejného/podobného
  názvu) → klepnu na „napojit potravinu" a vyberu ručně; návrh se tím
  nezruší nijak automaticky, jen ho ignoruju.
- Text obsahuje gramáž, ale žádná odpovídající potravina v databázi není →
  zobrazí se jen běžné „napojit potravinu" bez návrhu; gramáž se i tak
  předvyplní, jakmile potravinu napojím ručně.
- Potravina má vyplněnou hmotnost kusu (`pieceGrams`) → gramáž se
  nepředvyplňuje automaticky, protože jednotka je „ks", ne „g" (aby se to
  nespletlo).

**Akceptační kritéria:**
- Given surovina s `raw_text` „40g másla" a existující potravina „Máslo",
  When otevřu obrazovku Kalorie, Then se u položky nabídne návrh „→ Máslo?".
- Given klepnu na návrh, Then se potravina napojí a pole gramáže se
  vyplní hodnotou 40, aniž bych cokoliv psal (R-12).
- Given návrh se nezobrazí nebo ho ignoruju, Then se nic nenapojí samo —
  napojení je pořád jen na moje potvrzení (pravidlo 1).
- Given `raw_text` neobsahuje rozpoznatelnou jednotku (např. „hrst mouky"),
  Then se gramáž nepředvyplní a musím ji zadat ručně.
- Given `raw_text` suroviny, Then se po napojení nezmění ani o písmeno
  (pravidlo 2 — návrh čte text, nikdy ho nepřepisuje).

---

## UC008 — Smazání a obnovení receptu (koš)

Vazba: pravidlo 7, E-08, `/kos`

**Hlavní tok:**
1. V seznamu receptů smažu recept.
2. Recept zmizí ze seznamu, appka ukáže toast „Smazáno" s možností „Zpět".
3. Klepnu na „Zpět" do pár vteřin → recept se vrátí, jako by se nic nestalo.
4. Pokud toast proklikám, recept zůstává v „Koši" (`/kos`), odkud ho jde
   kdykoliv obnovit ručně.

**Alternativní a chybové toky:**
- Mazání je vždy soft-delete (`deleted_at`), nikdy natvrdo – schéma to drží
  kvůli budoucí synchronizaci (pravidlo 7), i když dnes appka běží jen lokálně.
- Smažu potravinu, která je někde napojená na surovinu → napojení zůstává
  (`food_id` ukazuje na smazaný, ale stále existující řádek), jen se potravina
  dál nenabízí při novém napojování (E-08).

**Akceptační kritéria:**
- Given smažu recept, Then zmizí ze seznamu i z hledání okamžitě, ale řádek
  v databázi zůstává s vyplněným `deleted_at` (pravidlo 7).
- Given klepnu na „Zpět" v toastu, Then se `deleted_at` vrátí na `null` a
  recept je opět všude vidět.
- Given otevřu „Koš", Then vidím jen smazané záznamy a můžu je obnovit.

---

## UC009 — Oblíbené, řazení a filtrování seznamu receptů

Vazba: R-16, R-21 (rozšíření UC003)

**Hlavní tok:**
1. V seznamu receptů označím recept jako oblíbený (hvězdička).
2. Přepnu řazení seznamu — naposledy upravené / abecedně / oblíbené první.
3. Ke štítkům a řazení (UC003) přidám i filtr „jen oblíbené".

**Alternativní a chybové toky:**
- Žádný recept není oblíbený → filtr „jen oblíbené" ukáže prázdný stav,
  ne chybu.
- Řazení a filtrování se kombinuje s fulltextovým hledáním z UC003 zároveň,
  ne místo něj.

**Akceptační kritéria:**
- Given recept označím jako oblíbený, Then zůstane oblíbený i po zavření a
  znovuotevření appky (perzistentní, ne jen v paměti).
- Given přepnu řazení na „oblíbené první", Then se seznam přeuspořádá bez
  ztráty aktivního filtru/hledání.

---

## UC010 — Nákupní seznam z receptů

Vazba: Fáze 4 roadmapy (`docs/SPEC.md` §9), `/nakup`

**Hlavní tok:**
1. V detailu receptu klepnu „🛒 Do nákupního seznamu" – jeho suroviny
   (naškálované podle zvoleného počtu porcí) se přidají do seznamu, označené
   názvem receptu.
2. Zopakuju u dalších receptů (třeba na týden); položky se přidávají za sebe.
   Množství se záměrně nesčítají (volný text spolehlivě sečíst nejde) – radši
   vypsané, ať vím, z čeho co je.
3. Ručně si přidám i položku mimo recepty (např. „toaletní papír").
4. V obchodě odškrtávám; odškrtnuté klesnou dolů. Seznam žije nezávisle na
   receptech – úprava receptu ho zpětně nemění.

**Alternativní a chybové toky:**
- Suroviny se nesjednocují ani nededuplikují – každý řádek receptu je vlastní
  položka (volný text jako „2 vejce" + „3 vejce" spolehlivě sečíst nejde).
- Úklid: „Smazat nakoupené" smaže odškrtnuté, „Vymazat vše" celý seznam;
  obojí jde vzít zpět (Vrátit zpět).

**Akceptační kritéria:**
- Given pošlu do nákupu dva recepty, každý se surovinou „vejce", Then jsou
  v seznamu obě položky (nesjednocuje se) a u každé je vidět, z jakého receptu je.
- Given odškrtnu položku, Then zůstane odškrtnutá i po zavření appky, dokud
  ji ručně nesmažu nebo nevyčistím celý seznam.
- Given appka je offline, When si udělám nákupní seznam, Then to funguje
  bez sítě jako všechno ostatní (pravidlo 11).

---

## UC011 — Sdílení a vložení receptu jako text

Vazba: SPEC §11 (dokončeno), `/vlozit`

**Hlavní tok (sdílení):**
1. Otevřu recept → „Sdílet".
2. Appka poskládá recept (název, suroviny, postup) do čistého textu a
   předá ho systémovému sdílení telefonu (SMS, WhatsApp, e-mail, …).

**Hlavní tok (vložení):**
1. Mám zkopírovaný text receptu odjinud (SMS od babičky, poznámka).
2. V appce otevřu „Vložit ze schránky" (`/vlozit`).
3. Appka z vloženého textu rovnou založí nový recept — stejná filozofie
   jako S1: žádné parsování, které by nutilo cokoliv opravovat před uložením.

**Alternativní a chybové toky:**
- Schránka je prázdná nebo appka k ní nemá přístup (oprávnění prohlížeče) →
  appka to řekne rovnou, nespadne, nabídne i ruční vložení do pole.
- Vložený text je nestrukturovaný (jeden blok bez řádkování) → uloží se
  celý jako `raw_capture`/`raw_text`, stejně jako u UC001 — nic se nezahazuje.

**Akceptační kritéria:**
- Given recept sdílím, Then vygenerovaný text obsahuje název, suroviny a
  postup čitelně, bez interních ID nebo HTML.
- Given vložím zkopírovaný text, Then appka nabídne uložit ho jako nový
  recept, aniž bych cokoliv psal ručně (S1 varianta).
- Given appka je offline, Then vložení ze schránky i sdílení funguje beze
  změny (sdílení systémovým dialogem, žádná síť navíc).

---

## UC012 — Náhrada suroviny při vaření

Vazba: S3, rozšíření UC005

**Hlavní tok:**
1. Jsem v režimu vaření (UC005).
2. U jedné suroviny místo napojené potraviny nemám doma přesně to, co recept
   chce (mám řepkový olej místo olivového).
3. Klepnu na surovinu → „nahradit pro dnešní vaření" → vyberu jinou potravinu.
4. Kalorie tohodle vaření se dopočítají podle náhrady; recept samotný
   (`recipe_items`, `raw_text`) zůstává nezměněný.

**Alternativní a chybové toky:**
- Surovinu pro dnešek jen vypnu (nedávám ji vůbec) → nejde kombinovat s
  náhradou zároveň, appka nabídne jedno nebo druhé (aktuální chování).
- Recept nemá na tuhle surovinu napojenou potravinu vůbec → náhrada nemá co
  nahrazovat, appka nabídne rovnou napojit (viz UC007), ne „nahradit".

**Akceptační kritéria:**
- Given nahradím surovinu při vaření, Then se dopočítané kalorie tohodle
  vaření změní podle náhrady, ale recept samotný zůstává beze změny.
- Given zavřu a znovu otevřu recept mimo vaření, Then je surovina zpátky
  původní, bez náhrady (náhrada je jen pro daný běh vaření).

---

## UC013 — Časovače v režimu vaření

Vazba: S3, rozšíření UC005

**Hlavní tok:**
1. Jsem v režimu vaření, postup obsahuje krok s časem („peč 20 minut").
2. U kroku appka nabídne spustit časovač na rozpoznaný čas.
3. Klepnu na start → časovač běží, i když telefon uzamknu nebo appku
   na chvíli opustím.
4. Po doběhnutí appka upozorní (zvuk/vibrace/notifikace, podle platformy).

**Alternativní a chybové toky:**
- Appka nerozpozná čas v kroku (nestandardní formulace) → časovač se
  nenabídne, krok jinak funguje normálně (žádná chyba, jen chybí zkratka).
- Zavřu appku úplně (ne jen uzamknu telefon) → časovač může přestat běžet
  podle možností platformy; to je otevřená otázka mimo rozsah tohoto UC.

**Akceptační kritéria:**
- Given krok obsahuje „20 minut", Then appka nabídne časovač předvyplněný
  na 20 minut.
- Given časovač doběhne, Then appka na to zřetelně upozorní, i když mám
  telefon uzamknutý.

---

## UC014 — Historie vaření a statistiky

Vazba: S6/S7 (částečně, mimo dosah plného deníku fáze 3), `/statistiky`

Tohle **není** deník z fáze 3 (žádné cíle, žádné makroživiny přes den) —
je to jednodušší: záznam o tom, že jsem recept uvařil, kdy a s jakými
kaloriemi (pokud je recept napojený, jinak bez čísla, viz pravidlo 4).

**Hlavní tok:**
1. Dovařím podle receptu, v režimu vaření klepnu „Hotovo".
2. Appka zapíše záznam do historie: recept, datum, počet porcí, kalorie
   na porci/na celý dávka (pokud je spočítatelné).
3. V „Statistiky" vidím přehled — nejčastěji vařené recepty, historii v čase.

**Alternativní a chybové toky:**
- Recept nemá napojené žádné suroviny → záznam v historii vznikne i tak,
  jen bez kalorií (pravidlo 4 — žádné číslo, ne odhad).
- Recept nemá vyplněný počet porcí → appka umí zobrazit kalorie na uvařenou
  dávku místo na porci (přepínání celek/porce).

**Akceptační kritéria:**
- Given dovařím recept a klepnu „Hotovo", Then se do historie zapíše
  záznam s dnešním datem.
- Given recept nemá žádné napojené suroviny, Then záznam v historii
  neukazuje žádné kalorické číslo (pravidlo 4).
- Given otevřu „Statistiky", Then vidím přehled historie napříč recepty,
  ne jen posledního vaření.

---

## UC015 — Instalace appky na telefon (PWA)

Vazba: Fáze 0 roadmapy, sekce 7.1 SPEC.md

**Hlavní tok:**
1. Otevřu appku poprvé ve webovém prohlížeči na telefonu.
2. Prohlížeč (nebo appka vlastní výzvou) nabídne „Přidat na plochu".
3. Nainstaluju → appka běží jako samostatná ikona, bez adresního řádku
   prohlížeče.
4. Appka funguje offline i po instalaci (Service Worker, stejná IndexedDB).

**Alternativní a chybové toky:**
- Platforma instalaci PWA nepodporuje nebo ji uživatel odmítne → appka
  funguje dál normálně v prohlížeči, nic se nerozbije.
- Appka se aktualizuje na produkci (nový deploy) → nainstalovaná appka
  dostane update Service Workera, aniž bych ji musel znovu instalovat.

**Akceptační kritéria:**
- Given appku nainstaluju na telefon, Then jde spustit ikonou z plochy bez
  otevírání prohlížeče.
- Given appka je nainstalovaná a zapnu letadlový režim, Then appka jde
  spustit a plně používat offline (kontrola po Fázi 1 podle SPEC §9).

---

## Mimo rozsah (fáze 1)

- Zbytek nutriční nadstavby mimo UC007 — výpočet celkových hodnot na porci
  a na 100 g, ukazatel úplnosti, CRUD potravin (fáze 2, viz
  `docs/specs/food-picker-vyber.md`).
- Plný deník s cíli a makroživinami přes den (fáze 3) — UC014 je jen
  jednoduchá historie vaření, ne deník.
- Sken čárového kódu, diktování přes Web Speech API, tisk/export do PDF (v3,
  případně E-14 — vědomě neděláno).
