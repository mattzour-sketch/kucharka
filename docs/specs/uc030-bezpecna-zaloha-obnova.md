# UC030 — Bezpečná a kompletní JSON záloha a obnova

Zpevnění jediné pojistky proti ztrátě dat (NF-4, N-01/N-02) u local-first appky bez serveru.
Řeší tři potvrzené díry: neúplnou zálohu, obnovu naslepo a nulovou viditelnost stavu zálohy.
Několik zásadních rozhodnutí (režim obnovy, kam se stavem, rozsah dat) je **otevřených** — viz
Otevřené otázky, nerozhoduju za uživatele.

## Kontext

V lokální variantě (bez serveru) je JSON export/import **jediná** záloha i jediný způsob, jak
přenést data na jiné zařízení (SPEC 7.1, 7.8, NF-4: „Ztráta dat je jediná neopravitelná chyba.").
Dnešní stav (ověřeno v kódu) má tři problémy:

1. **Záloha je nekompletní.** `collectBackupData` (`src/features/backup/dbBackup.ts` ř. 18–50)
   sbírá `foods`, `foodPortions`, `recipes`, `recipeItems`, `recipeNotes`, `logEntries`, `goals`,
   `weightEntries`, `recipePhotos` — ale **vynechává `cookLogs` (historie vaření, §10) a
   `shoppingItems` (nákupní seznam)**. Přitom veze `logEntries`, `goals` a `weightEntries`, které
   se dnes v appce nikde nepoužívají (referencované jsou **jen** v `dbBackup.ts`). Výsledek: záloha
   veze prázdný deník fáze 3, ale ne reálnou historii vaření a nákup. Při přenosu na nové zařízení
   se historie vaření a nákupní seznam ztratí.

2. **Obnova je nebezpečná.** `importBackupJson` (ř. 60–96) rovnou zapíše přes `bulkPut` (upsert
   podle id) bez potvrzení a bez shrnutí předem. Uživatel před zápisem neví, co se nahraje, kolik
   toho je, z kdy záloha je, ani jestli mu to přepíše dnešní úpravy. Dozví se až potom, a jen
   „Import hotový: X receptů." (`SettingsScreen.tsx` ř. 47).

3. **Žádná viditelnost zálohy.** Nikde není „naposledy zálohováno před X" a appka nikdy nevyzve
   k záloze → uživatel zapomene a může o rodinnou kuchařku přijít.

Dnes je export/import v jediném rozhraní (PWA), na obrazovce **„Víc"** → sekce **„Záloha dat"**
(`src/features/settings/SettingsScreen.tsx` ř. 75–101), plus sekce **„Úložiště"** už zobrazuje
stav trvalého úložiště a obsazené místo. `navigator.storage.persist()` se už volá při startu
(`main.tsx` ř. 17 → `ensurePersistentStorage` v `src/lib/storage.ts`).

### Rozsah zálohy — pokrytí tabulek (cílový stav)

Databáze má 13 tabulek (`src/db/index.ts`). Cílem je, aby bylo **explicitně jasné**, co záloha
pokrývá. Sporné řádky (fáze 2/3, efemérní stav) jsou k rozhodnutí — viz Otevřené otázky.

| Tabulka | Fáze | Používá appka dnes? | V záloze dnes | Cíl |
|---|---|---|---|---|
| `recipes` | 1 | ano | ano | ano |
| `recipeItems` | 1 | ano | ano | ano |
| `recipeNotes` | 1 | ano | ano | ano |
| `recipePhotos` | 1 | ano | ano | ano |
| `cookLogs` (historie vaření §10) | 1 | ano | **ne** | **doplnit → ano** |
| `shoppingItems` (nákup) | 1 | ano | **ne** | **doplnit → ano** |
| `cookSessions` (rozdělané vaření §6) | 1 | ano (stav sezení) | ne | otázka (efemérní?) |
| `timers` (běžící časovače §7) | 1 | ano (stav) | ne | otázka (efemérní?) |
| `foods` | 2 | ano | ano | ano (potvrdit) |
| `foodPortions` | 2 | ano | ano | ano (potvrdit) |
| `goals` | 2/3 | ne (jen backup) | ano | otázka |
| `weightEntries` | 2/3 | ne (jen backup) | ano | otázka |
| `logEntries` (deník fáze 3) | 3 | ne (jen backup) | ano | otázka |

## User stories

- Jako uživatel, který přechází na nový telefon, chci, aby záloha obsahovala i historii vaření
  a nákupní seznam, abych po obnově neztratil, co jsem uvařil a co mám nakoupit.
- Jako uživatel obnovující ze souboru chci před zápisem vidět, co a kolik se nahraje a z kdy záloha
  je, abych omylem nepřepsal dnešní data zastaralou zálohou.
- Jako uživatel chci obnovu potvrdit (nebo zrušit), aby se do databáze nic nezapsalo, dokud
  neřeknu ano.
- Jako uživatel chci v Nastavení vidět „naposledy zálohováno před X", abych poznal, že mám čerstvou
  zálohu — a nenápadně být upozorněn, když je stará.
- Jako uživatel, kterému na datech záleží, chci mít jistotu, že prohlížeč data jen tak nevyhodí
  (trvalé úložiště), aby lokální databáze nebyla jen naděje.

## Akceptační kritéria

**Kompletnost zálohy**
- [ ] Given DB se záznamy v `cookLogs` a `shoppingItems`, When exportuju zálohu, Then JSON obsahuje
      pole pro `cookLogs` i `shoppingItems` a počet položek v každém = počet v DB.
- [ ] Given záloha z plné DB, When ji naimportuju do prázdné DB, Then počet `cookLogs`
      a `shoppingItems` po obnově odpovídá záloze (round-trip beze ztráty).
- [ ] Given záloha s fotkami, When ji naimportuju, Then se fotky obnoví jako dřív (regrese:
      data URL ⇄ blob round-trip se nerozbije).
- [ ] Given dokument, Then existuje explicitní přehled, které tabulky záloha pokrývá a které ne
      (tabulka výše), aby „co záloha zálohuje" nebylo tušení.

**Kompatibilita formátu**
- [ ] Given starší záloha (dnešní formát bez `cookLogs`/`shoppingItems`), When ji naimportuju,
      Then projde bez chyby a chybějící tabulky se berou jako prázdné (dnešní chování `parseBackup`
      se zachová, žádný crash).
- [ ] Given cizí JSON (jiný `format`), When ho vyberu k obnově, Then se odmítne s hláškou
      „Tohle není záloha Osobní kuchařky." a do DB se nic nezapíše (regrese).
- [ ] Given záloha s `version` vyšší, než appka umí, When ji vyberu, Then se odmítne s hláškou
      o novější verzi a do DB se nic nezapíše (regrese).

**Bezpečná obnova — shrnutí a potvrzení**
- [ ] Given vyberu soubor k obnově, When se načte a je to platná záloha, Then se PŘED jakýmkoli
      zápisem do DB zobrazí shrnutí obsahující aspoň: počet receptů, počet surovin/položek, počet
      fotek, počet záznamů vaření, počet položek nákupu, velikost souboru a datum zálohy
      (`exportedAt` z obálky).
- [ ] Given zobrazené shrnutí, When obnovu potvrdím, Then a teprve teď se zapíše do DB.
- [ ] Given zobrazené shrnutí, When obnovu zruším, Then se do DB nezapíše nic (stav DB je bitově
      stejný jako před výběrem souboru).
- [ ] Given proběhlá obnova, Then výsledná hláška uvádí, co se nahrálo (ne jen počet receptů).
- [ ] Given poškozený / nevalidní JSON (např. přeseknutý soubor), When ho vyberu, Then se zobrazí
      chyba, žádné shrnutí a žádný zápis.

**Režim obnovy (merge/replace) — platí pro zvolenou variantu (viz Otevřená otázka 1)**
- [ ] Given zvolený režim „doplnit" (merge/upsert, dnešní chování), When obnovím, Then se záznamy
      doplní nebo přepíšou podle `id` a žádný existující záznam se nesmaže.
- [ ] Given zvolený režim „nahradit vše" (pokud se zavede), When ho potvrdím, Then výsledný stav
      pokrytých tabulek odpovídá záloze (co v záloze není, po obnově zmizí) — a chování u tabulek,
      které soubor neobsahuje, je definované (viz Okrajové případy).

**Viditelnost zálohy a připomínka**
- [ ] Given jsem na tomhle zařízení někdy úspěšně exportoval zálohu, When otevřu „Víc", Then vidím
      „naposledy zálohováno před X" (relativní čas z lokálního času zařízení).
- [ ] Given jsem na tomhle zařízení nikdy nezálohoval, When otevřu „Víc", Then vidím věcný prázdný
      stav (např. „zatím nezálohováno") bez sentimentu (lean UI).
- [ ] Given úspěšný export, When doběhne, Then se „naposledy zálohováno" aktualizuje na teď.
- [ ] Given poslední záloha je starší než zvolený práh, Then appka nenápadně připomene zálohu
      (forma i práh = Otevřená otázka 6); připomínka nikdy nezakrývá ani neblokuje zachycení
      receptu (hlavní úloha appky).

**Trvalé úložiště (persist)**
- [ ] Given spuštění appky, Then se požádá o trvalé úložiště (zachovat dnešní `ensurePersistentStorage`).
- [ ] Given „Víc" → „Úložiště", Then je vidět stav trvalého úložiště (zapnuté/nezapnuté) jako dnes;
      případné zviditelnění/vysvětlení či akce na vyžádání = Otevřená otázka 3.

## Okrajové případy a chybové stavy

| Situace | Očekávané chování |
|---|---|
| Prázdná DB při exportu | Vznikne platný soubor s prázdnými poli; import takové zálohy nic nerozbije. |
| `cookLogs`/`shoppingItems` se mažou natvrdo (bez `deletedAt`) | **Merge** import starší zálohy **vzkřísí** smazané záznamy vaření a smazané/odškrtnuté položky nákupu (upsert podle `id`). Chování musí být pro uživatele předvídatelné — shrnutí před obnovou to má napovědět; definitivní řešení závisí na Otevřené otázce 1. |
| Import stejné zálohy dvakrát (merge) | Idempotentní (upsert podle `id`), žádné duplicity. |
| „Nahradit vše" a soubor neobsahuje některou tabulku (např. stará záloha bez `cookLogs`) | Musí být definováno, zda se ta tabulka vyprázdní, nebo ponechá; naivní „smaž vše a nahraj" by nechtěně smazal dnešní historii vaření. K rozhodnutí (Otevřená otázka 1). |
| Velká záloha (hodně fotek) | Base64 data URL výrazně nafoukne velikost; export, shrnutí i obnova nesmí spadnout; velikost souboru se ukáže ve shrnutí. Případné limity = mimo rozsah / otázka. |
| Cizí JSON / novější verze / poškozený soubor / prázdný (0 B) soubor | Srozumitelná česká hláška, žádný zápis do DB. |
| Zrušení výběru souboru v dialogu | Nic se neděje, žádná hláška. |
| „Naposledy zálohováno" v soukromém režimu / blokované úložiště | Graceful fallback (jako `theme.ts`: try/catch, přinejhorším se čas nezapamatuje), appka nespadne. |
| Trvalé úložiště prohlížeč nepovolí | Appka funguje dál; stav „nezapnuté" + dnešní vysvětlení („povolí se většinou až po přidání na plochu"). |
| Obnova na novém/prázdném zařízení (hlavní přenosový scénář) | Merge = fakticky plný import; po obnově sedí počty proti shrnutí. |
| Běží časovač / rozdělané vaření během obnovy | Pokud `cookSessions`/`timers` nejsou v záloze, obnova je nepřepíše (viz Otevřená otázka 5). |

## Mimo rozsah

- Serverová / cloudová synchronizace a automatický upload zálohy (NF-4 zmiňuje serverovou kopii,
  ale ta patří do pozdější fáze; tady jde o ruční soubor v local-first appce fáze 1).
- Automatický periodický export bez akce uživatele.
- Export do CSV (N-03) a export receptu do PDF (R-25) — samostatné funkce.
- Šifrování / ochrana zálohy heslem.
- Selektivní obnova (vybrat jen některé recepty/položky) — pokud se nerozhodne jinak.
- Sdílení jednotlivého receptu ven (jiná story).
- Nová závislost (knihovna na modal/diff apod.) bez předchozího schválení (konvence CLAUDE.md).

## Předpoklady

- PŘEDPOKLAD: Jediné rozhraní je PWA (web i mobil, stejné UI); požadavek platí pro jedinou
  obrazovku „Víc" → „Záloha dat". Žádné CLI ani API.
- PŘEDPOKLAD: `cookLogs` i `shoppingItems` JSOU reálná uživatelská data fáze 1, která chceme
  zálohovat (ověřeno: aktivně se čtou i zapisují přes `cookLogRepo.ts` a `shoppingRepo.ts`).
- PŘEDPOKLAD: `logEntries` (deník fáze 3), `goals` a `weightEntries` se dnes v appce nikde
  nepoužívají (ověřeno: referencované jen v `dbBackup.ts`); v praxi jsou prázdné. Zůstávají ve
  formátu kvůli dopředné kompatibilitě, dokud se nerozhodne jinak (viz Otevřená otázka 4).
- PŘEDPOKLAD: `foods` a `foodPortions` (fáze 2, aktivně používané) v záloze zůstávají.
- PŘEDPOKLAD: Formát zůstává jeden JSON soubor s obálkou `{ format, version, exportedAt, data }`;
  rozšíření o `cookLogs`/`shoppingItems` je aditivní a starší zálohy (bez nich) musí jít dál
  naimportovat (chybějící tabulky = prázdné, jak `parseBackup` dělá dnes).
- PŘEDPOKLAD: Datum zálohy pro shrnutí lze vzít z obálky `exportedAt`; dnes ho parse vrstva
  zahazuje (`parseBackup` vrací jen `BackupData`), takže shrnutí bude potřebovat i metadata obálky.
  (Konstatování stavu, ne návrh řešení — to je na architektovi.)
- PŘEDPOKLAD: „Naposledy zálohováno" je stav **per zařízení** (týká se exportu na tomhle přístroji),
  ne obsah kuchařky; zobrazí se v sekci „Záloha dat"/„Úložiště", nevyskakuje jako modal.
- PŘEDPOKLAD: Základ „důvěry v data" (`navigator.storage.persist()` při startu + zobrazení stavu
  úložiště) už existuje; tato story ho případně jen zviditelní/doplní, neimplementuje od nuly.
- PŘEDPOKLAD: Relativní čas („před X dny") se počítá z lokálního času zařízení.
- PŘEDPOKLAD: Lean české UI — věcné texty, prázdný stav bez sentimentu.

## Otevřené otázky

1. **Merge vs. replace vs. obojí?** Dnes je jen „doplnit" (upsert podle `id`) — nikdy nemaže, ale
   u `cookLogs`/`shoppingItems` (mažou se natvrdo) **vzkřísí** dřív smazané záznamy staré zálohy.
   Chceme přidat i „nahradit vše"? Pokud ano, co je default a jak se řeší tabulky, které soubor
   neobsahuje (aby „nahradit" nechtěně nesmazalo dnešní historii vaření)? Nebo stačí jen merge
   a resurrection řešit jinak (např. shrnutím / soft-delete i pro fáze 1 — širší zásah)?
2. **Kam s „naposledy zálohováno" vzhledem k pravidlu 6?** Je to per-zařízení pref, obdoba motivu —
   ten má **vědomou výjimku z pravidla 6** (localStorage, `theme.ts`, rozhodnuto 2026-09-08), ale
   s jiným odůvodněním (FOUC), které tady neplatí. Volby: (a) další vědomá výjimka do localStorage,
   (b) nová Dexie meta-tabulka (čistě dle pravidla 6, ale je to stav zařízení, ne obsah, a znamená
   bump schématu). Rozhodni.
3. **Řešit `persist()` v téhle story?** Už se volá při startu a stav se zobrazuje. Chceme navíc:
   tlačítko „Zapnout trvalé úložiště" na vyžádání, lepší vysvětlení při odmítnutí prohlížečem, nebo
   provázání s hláškou o důvěře v data? Nebo nechat, jak je?
4. **Co s daty fáze 2/3 v záloze?** Nechat `logEntries`/`goals`/`weightEntries` ve formátu (dnes
   prázdné, dopředná kompatibilita), nebo je z `BackupData` vypustit a doplnit až ve fázi 2/3?
5. **Zálohovat `cookSessions` (rozdělané vaření) a `timers` (běžící časovače)?** Předpoklad: ne,
   je to efemérní stav zařízení, ne obsah kuchařky. Potvrdit.
6. **Jak nenápadná má být připomínka staré zálohy a jaký práh?** NF-4 mluví o „týdenním" exportu.
   Škála od nejnenápadnějšího: jen text „naposledy zálohováno před X" → decentní tečka/odznak u
   tabu „Víc" → jemný banner v Nastavení → nic proaktivního. Práh 7 / 14 / 30 dní? Nesmí rušit
   rychlé zachycení receptu.
7. **Má úspěšná OBNOVA taky nastavit „naposledy zálohováno"?** Návrh: ne (obnova není záloha) — ale
   po obnově na novém zařízení by uživatel neměl hned dostat výzvu k záloze. Zvážit.
8. **Bumpnout `BACKUP_VERSION` na 2** kvůli přidaným tabulkám? Změna je aditivní a `parseBackup` je
   tolerantní, takže verze je spíš signál; ovlivní ale hlášku o „novější verzi" u dopředné
   kompatibility.
9. **Podpořit ověření obnovitelnosti zálohy?** SPEC 7.8: „záloha, kterou jsi nezkusil obnovit, je
   jen naděje." Má appka nějak pomoct ověřit, že soubor jde obnovit (např. „jen zkontrolovat" bez
   zápisu)? Nejspíš mimo rozsah, ale zmiňuji.

## Rozhodnutí (uživatel 2026-09-13) — platí pro návrh i implementaci

1. **Kompletnost zálohy:** doplnit do `collectBackupData`/`BackupData` tabulky `cookLogs`
   (historie vaření) a `shoppingItems` (nákup). Data fáze 2/3 (`logEntries`/`goals`/
   `weightEntries`) **zůstávají** ve formátu (dnes prázdná, dopředná kompatibilita) — otázka 4.
2. **Efemérní stav se nezálohuje:** `cookSessions` (rozdělané vaření) ani `timers` (běžící
   časovače) do zálohy nepatří — otázka 5.
3. **Režim obnovy = Doplnit (merge/upsert), jako dnes** — otázka 1. Nikdy nemaže, nezahodí dnešní
   nové recepty. Bezpečnost řeší potvrzovací shrnutí PŘED zápisem (viz bod 4). Variantu „Nahradit
   vše" teď neděláme.
4. **Bezpečná obnova:** před jakýmkoli zápisem ukázat shrnutí (počty receptů/surovin/fotek/vaření/
   nákupu, velikost souboru, datum zálohy z `exportedAt`) a nechat potvrdit / zrušit; při zrušení
   se DB nedotkne. `parseBackup` musí propustit i obálku (`exportedAt`) do shrnutí.
5. **„Naposledy zálohováno" = localStorage** (vědomá výjimka z pravidla 6, stejný typ jako téma —
   je to fakt o zařízení, ne data aplikace; do zálohy nepatří) — otázka 2. Úspěšná **obnova**
   „naposledy zálohováno" **nenastavuje** (obnova ≠ záloha) — otázka 7.
6. **Připomínka = nenápadná** (otázka 6): v „Víc" řádek „naposledy zálohováno před X" + jemná
   tečka/zvýraznění, když je záloha starší než **30 dní**. Žádný banner, nesmí rušit zachycení.
   Prázdný stav „zatím nezálohováno".
7. **`navigator.storage.persist()`** nechat na startu + jen zobrazit stav (žádné nové tlačítko) —
   otázka 3.
8. **`BACKUP_VERSION` → 2** kvůli přidaným tabulkám; `parseBackup` dál tolerantně čte v1 (chybějící
   tabulky = prázdné) — otázka 8.
9. **Ověření obnovitelnosti (SPEC 7.8) — mimo tuhle dávku** (otázka 9). Pozn.: shrnutí obnovy ho
   částečně supluje (soubor se rozparsuje a validuje ještě před zápisem).

### Doplnění po Fázi 2 (user-advocate must-fixy, uživatel 2026-09-13)

10. **Shrnutí obnovy = PLNÝ DOPAD, ne jen obsah souboru.** Před zápisem porovnat zálohu s aktuální
    DB podle `id` a ukázat: kolik receptů **přibude nových**, kolik **přepíše existující** (a z toho
    kolik má uživatel **novější než záloha** — porovnání `updatedAt` u receptů), a kolik **dřív
    smazaných** položek nákupu/vaření se **vrátí** (merge vzkřísí tvrdě smazané). Tohle je hlavní
    bezpečnostní přínos celé story.
11. **Po exportu říct, kde soubor je a ať ho uživatel odnese mimo zařízení** (mail/cloud/flash) —
    jinak „záloha" leží na stejném telefonu, který se může ztratit. Věcná věta, ne banner.
12. **Po úspěšné obnově nastavit „naposledy zálohováno" = `exportedAt` obnovené zálohy** (ne „teď").
    Pravdivé „data jsou ke dni X" a hlavně žádný falešný poplach „nezálohováno" hned po přenosu na
    nový telefon. (Zpřesňuje bod 5 — export nastavuje „teď", obnova nastavuje datum zálohy.)
13. **Název exportovaného souboru s datem:** `kucharka-YYYY-MM-DD.json`.
14. **Datum zálohy ve shrnutí lidsky** („13. 9. 2026 14:30"), ať jde poznat, která záloha je novější
    než co mám. U staré **v1** zálohy (neobsahuje `cookLogs`/`shoppingItems`) psát ve shrnutí
    „neobsahuje", ne „0 záznamů" — rozlišit „nula" od „tahle záloha to nemá".
15. **Hláška o odmítnutí (novější/cizí/poškozený soubor)** musí říct, co dělat („aktualizuj appku"
    / „tohle není záloha kuchařky"), ne jen že něco nesedí.

**Stále odloženo:** režim „nahradit vše" (advokát potvrdil, že není must — pokrývá jen návrat po
vlastním pokažení); plné ověření obnovitelnosti (SPEC 7.8). Práh připomínky zůstává **30 dní**
(advokát navrhoval 14; ponecháno dle volby uživatele).
