# Use casy — Fáze 1 (Kuchařka)

Vazba na `docs/SPEC.md`, sekci 3 (Uživatelské scénáře S1–S7) a sekci 4.1 (funkční
požadavky R-xx). Zapsané jen pro **fázi 1** — bez potravin, nutrice a deníku
(ty přijdou v use casech pro fázi 2 a 3, až na ně dojde řada, viz sekce 9 roadmapy).

Formát: hlavní tok jako číslovaný scénář (rychlá orientace), pod ním alternativní/chybové
toky a akceptační kritéria ve stylu Given/When/Then — stejně jako u ostatních
specifikací v `docs/specs/`.

---

## UC001 — Zachycení nového receptu (text)

Vazba: S1 ★ nejdůležitější scénář, R-01, R-02, R-03, R-05

**Hlavní tok:**
1. Na domovské obrazovce kliknu na velké tlačítko „Nový recept".
2. Zadám název receptu.
3. (Nepovinně) zadám „od koho" a datum zachycení.
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
  a čeká v outboxu na synchronizaci (pravidlo 11, R-02).
- Given uložený recept, Then `raw_capture`/`raw_text` obsahuje přesně to, co
  jsem napsal, beze změny (pravidlo 2, R-05).
- Given recept nemá vyplněné „od koho" ani datum, Then se přesto uloží bez chyby.

---

## UC002 — Zachycení receptu fotkou

Vazba: S2, R-04

**Hlavní tok:**
1. Nový recept → zadám alespoň název.
2. Vyfotím nebo nahraju fotku (kartička s receptem od babičky).
3. Zavřu obrazovku bez přepisu textu — fotka sama je dostatečný podklad.

**Alternativní a chybové toky:**
- Fotka je pořízená offline → uloží se lokálně (blob v IndexedDB) hned,
  nahrání do Storage proběhne přes outbox, až se objeví signál (E-16).
- Později se k receptu doplní i přepsaný text → fotka zůstává u receptu dál
  jako podklad, nemaže se automaticky.

**Akceptační kritéria:**
- Given recept má jen název a fotku, Then je platně uložený (S2 je nepovinný scénář,
  ale nesmí být blokovaný).
- Given appka je offline při focení, Then se fotka neztratí a nahraje se, až
  bude signál.

---

## UC003 — Prohlížení a hledání receptů

Vazba: S5, R-20, R-21

**Hlavní tok:**
1. Otevřu záložku „Recepty" → vidím seznam všech nesmazaných receptů.
2. Napíšu do hledání dotaz, např. „kure smetana" → appka hledá fulltextově
   napříč názvem, surovinami, postupem i polem „od koho", bez ohledu na
   diakritiku a české skloňování.
3. Volitelně filtruju podle štítku nebo autora.
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
- Odškrtnuté suroviny se při zavření a znovuotevření receptu nezapamatovávají
  (žádný trvalý stav odškrtnutí mezi vařeními — otevřená otázka, pokud bys
  chtěl jinak).

**Akceptační kritéria:**
- Given otevřený režim vaření, Then je písmo výrazně větší než v běžném
  zobrazení receptu.
- Given režim vaření je aktivní, Then displej nezhasne, dokud ho neopustím
  (kde to platforma podporuje).
- Given klepnu na surovinu, Then se vizuálně označí jako odškrtnutá.

---

## UC006 — Práce offline a synchronizace

Vazba: pravidlo 11, R-02, NF-3, sekce 7.7 SPEC.md

**Hlavní tok:**
1. Appka je offline (letadlový režim, žádný signál).
2. Zachytím/upravím recept normálně (UC001–UC005 fungují beze změny).
3. Zápis jde okamžitě do IndexedDB a do outboxu, obrazovka se aktualizuje hned.
4. Jakmile appka získá signál, outbox se na pozadí odešle do Supabase.

**Alternativní a chybové toky:**
- Stejný recept se upraví na dvou zařízeních offline současně → řeší se
  podle strategie v SPEC 7.7 (mimo rozsah tohoto use casu, jen odkaz).
- Synchronizace selže (výpadek při odesílání) → záznam zůstává v outboxu a
  zkusí se znovu, uživatel o tom neví a nemusí nic dělat.

**Akceptační kritéria:**
- Given appka je offline, When cokoliv uložím, Then se UI aktualizuje
  okamžitě, bez čekání na síť (pravidlo 11).
- Given appka byla offline a získá signál, Then se čekající změny odešlou
  na pozadí bez zásahu uživatele.

---

## Mimo rozsah (fáze 1)

- Napojení suroviny na potravinu z databáze a gramáž (fáze 2, viz
  `docs/specs/food-picker-vyber.md` a use casy pro fázi 2).
- Cokoliv kolem deníku, cílů a statistik (fáze 3).
- Sken čárového kódu, diktování přes Web Speech API, tisk/export do PDF (v3,
  případně E-14 — vědomě neděláno).
