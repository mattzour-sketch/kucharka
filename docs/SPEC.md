# Osobní kuchařka s počítáním kalorií — dokumentace projektu

**Verze:** 0.2
**Datum:** 2. 8. 2026
**Platforma:** web + mobil (jedna PWA)
**Uživatelé:** 1 (osobní projekt)

> **Změna oproti v0.1:** primární funkcí je **sbírka receptů**, ne kalorický deník.
> Kalorie jsou nepovinná nadstavba. Změna se propisuje do cílů, datového modelu
> (sekce 7.4), pořadí fází (sekce 9) i do toho, co je vlastně MVP.

---

## 0. TL;DR

**Osobní kuchařka, která umí počítat kalorie.** Ne kalorická tabulka, která umí recepty. To pořadí určuje celý zbytek dokumentu.

Hlavní úloha: **zachytit recept v okamžiku, kdy ho slyším.** Sedím u babičky v kuchyni, ona povídá „a mouky tak dvě hrsti, ale opatrně", a já mám třicet sekund na to, abych si to uložil, aniž bych přerušil hovor. Recept musí jít uložit offline, bez jediné nutriční hodnoty, bez jediného gramu.

Kalorie jsou **nepovinná nadstavba**, kterou k receptu doplním později doma — u některých receptů nikdy, a to je v pořádku.

**Dvě metriky úspěchu, v tomhle pořadí:**
1. Zachytit diktovaný recept do 60 sekund, jednou rukou, bez signálu.
2. Zapsat jídlo do deníku na 3 klepnutí — až budu deník vůbec používat.

**Technicky:** jedna PWA (React + TypeScript), lokální databáze v prohlížeči, synchronizace do Supabase. Žádné nativní appky, žádné dvě kódové základny.

> ### Nejdůležitější důsledek pro implementaci
> **Surovina receptu je volný text, ne odkaz do databáze potravin.** Odkaz na
> potravinu a gramáž jsou nepovinná pole, která se doplňují až později. Kdyby byly
> povinné, zachycení receptu by trvalo deset minut a aplikace by zůstala prázdná.
> Tohle je jediné rozhodnutí, které nesmí být při implementaci potichu obrácené —
> a přitom se obrací samo, protože „surovina = odkaz do tabulky" je přirozenější
> datový model. Viz 7.4 a E-12.

---

## 1. Vize a motivace

### Primární problém: recepty se ztrácejí

Recepty, které mají cenu, nejsou na internetu. Jsou na papírku v šuplíku, ve zprávě od kamaráda, v hlavě babičky a v tom, že „to přece znáš". Když se nezapíšou v ten okamžik, kdy zazní, tak zmizí — někdy definitivně.

Aplikace je hlavně nástroj na **zachycení**. Z toho plyne skoro všechno ostatní:

- Musí fungovat **offline**. U babičky v kuchyni nemusí být signál a rozhodně tam nebudu čekat na načítání.
- Musí přijmout **neúplný a nepřesný vstup**. „Hrst mouky", „podle chuti", „než to zežloutne". Aplikace, která chce gramy, se v téhle situaci nedá použít.
- Musí být rychlá **na vstup**, ne na výstup. Strukturování, dohledávání a uklízení se dá udělat potom v klidu.
- Recept musí být použitelný **u sporáku** — velké písmo, displej nezhasíná, suroviny odškrtnutelné.

### Sekundární problém: kalorické tabulky

Existující kalorické tabulky mají tři vady, kvůli kterým je vždycky do dvou týdnů přestanu používat: recepty jsou v nich otravné, zápis trvá dlouho a data nejsou moje. Když už tedy vlastní kuchařka bude existovat a bude mít u surovin gramáže, je počítání kalorií skoro zadarmo.

Ale je to **nadstavba**. Když ji nikdy nedodělám, aplikace pořád dává smysl. Obráceně to neplatí.

### Proč to spojit do jedné aplikace

Protože recept s gramážemi je 90 % práce, kterou kalorický deník potřebuje. Dělat z toho dvě aplikace by znamenalo psát suroviny dvakrát.

Není to produkt pro veřejnost — je to nástroj pro jednoho člověka, což dovoluje vyhodit spoustu složitosti (role, sdílení, moderace, onboarding, platby).

---

## 2. Cíle a ne-cíle

### 2.1 Cíle

| # | Cíl | Jak poznám, že je splněn | Váha |
|---|-----|--------------------------|------|
| C-1 | **Rychlé zachycení receptu** | Diktovaný recept uložený do 60 s, offline, bez nutričních dat | ★★★ |
| C-2 | **Recept je použitelný u sporáku** | Uvařím podle něj, aniž bych sáhl na zhasínající displej | ★★★ |
| C-3 | **Recept se dá najít** | Podle názvu, suroviny, štítku i toho, od koho je | ★★★ |
| C-4 | Funguje offline | Plný zápis i čtení bez signálu, dosynchronizuje se potom | ★★★ |
| C-5 | Data jsou moje | Export do JSON/CSV kdykoli, jedním klepnutím | ★★★ |
| C-6 | Postupné obohacení o nutriční data | Suroviny lze dodatečně napojit na potraviny a dostat kcal na porci | ★★ |
| C-7 | Rychlý zápis do deníku | Oblíbené jídlo do deníku za ≤ 3 klepnutí a ≤ 5 s | ★★ |
| C-8 | Jeden kód pro web i mobil | Jedna kódová základna, jedno nasazení | ★★ |
| C-9 | Nízké provozní náklady | Do 0 Kč/měsíc na free tierech | ★ |

### 2.2 Ne-cíle (vědomě mimo rozsah)

- **Sdílení a komunita** — žádné veřejné recepty, lajky, přátelé, feed.
- **Více uživatelů** — jeden účet. (Datový model to ale nezablokuje, viz 7.3.)
- **Sledování tréninku** — kalorie z pohybu neřeším, případně jen ručně jako denní bonus.
- **Nutriční poradenství** — aplikace nepočítá „doporučený denní příjem" ani nedává rady. Cíle si nastavím ručně.
- **Mikroživiny v v1** — vitamíny, minerály. Data pro ně stejně většinou nejsou.
- **Plánování jídelníčku dopředu** — až fáze 3.
- **App Store / Google Play** — instalace přes „Přidat na plochu".
- **Monetizace, analytika, marketing.**

---

## 3. Uživatelské scénáře

Scénáře jsou seřazené podle četnosti. Návrh UI musí optimalizovat S1 a S2 — ty se dějí denně, zbytek výjimečně.

### S1 — Zachycení diktovaného receptu ★ nejdůležitější scénář

Jsem u babičky. Řekne mi recept na bramborák. Vytáhnu telefon, otevřu aplikaci (**už na první obrazovce je velké tlačítko „Nový recept"**), napíšu název a pak jen píšu do jednoho velkého pole, jak to říká — „4 velký brambory, 2 vejce, hrst mouky, česnek, majoránka". Nic nedohledávám, nic nevybírám z číselníku. Uložím.

Signál tam není. To nesmí vadit.

**Co z toho plyne:** jedno textové pole, žádný průvodce, žádná povinná pole kromě názvu. Strukturování na jednotlivé suroviny se děje až potom — buď automaticky rozdělením po řádcích, nebo ručně, doma.

### S2 — Zachycení fotkou (2× měsíčně)

Babička má recept napsaný na kartičce. Vyfotím ji. Fotka se uloží k receptu jako podklad a přepíšu ji, až budu mít čas — nebo nikdy, protože fotka sama o sobě stačí.

### S3 — Vaření podle receptu (3× týdně)

Stojím u sporáku, ruce od těsta. Otevřu recept, přepnu do **režimu vaření**: velké písmo, displej nezhasíná, suroviny jdou odškrtávat klepnutím. Postup po krocích.

### S4 — Úklid receptu (nárazově, v klidu doma)

Otevřu recept zachycený minulý týden. Rozdělím text na jednotlivé suroviny, u těch, u kterých mě to zajímá, dohledám potravinu v databázi a doplním gramáž. Vyplním počet porcí. Aplikace mi ukáže kcal na porci a poznámku, že je spočítala jen z části surovin.

Tenhle scénář je **nepovinný**. Recept bez něj funguje dál.

### S5 — Hledání receptu (2× týdně)

„Co jsem to dělal z kuřete a smetany?" Hledám podle suroviny, ne jen podle názvu. Nebo si vyfiltruju vše, co je od babičky.

### S6 — Zápis do deníku (denně, až ve fázi 3)

Uvařím hrnec rizota, nandám si 340 g. Vyberu recept, zadám množství. Funguje jen u receptů, které prošly S4.

### S7 — Nedělní kontrola (1× týdně, až ve fázi 3)

Týdenní graf: průměrné kcal/den, rozložení makroživin, kolik dní jsem cíl trefil.

---

## 4. Funkční požadavky

Priorita: **MVP** = bez toho aplikace nedává smysl. **v2** = udělá se, až MVP poběží. **v3** = možná někdy.

### 4.1 Recepty — jádro aplikace

**Zachycení**

| ID | Požadavek | Priorita |
|----|-----------|----------|
| R-01 | Nový recept: název + **jedno velké textové pole** na všechno ostatní. Povinný je jen název | MVP |
| R-02 | Uložení funguje kompletně offline, bez jediného síťového dotazu | MVP |
| R-03 | Pole „od koho" (babička Marie, kamarád Petr, časopis) a datum zachycení | MVP |
| R-04 | Fotka jako podklad — vyfotit kartičku a uložit k receptu i bez přepisu | MVP |
| R-05 | Původní zachycený text se **nikdy nepřepisuje** ani po strukturování (viz E-17) | MVP |
| R-06 | Zvuková nahrávka jako podklad, když je na psaní málo času | v3 |

**Struktura a suroviny**

| ID | Požadavek | Priorita |
|----|-----------|----------|
| R-10 | Suroviny jako seznam řádků **volného textu** — „hrst hladké mouky" je platná surovina | MVP |
| R-11 | Rozdělení zachyceného textu na suroviny a postup, editovatelné ručně | MVP |
| R-12 | K řádku suroviny lze **nepovinně** připojit potravinu z databáze a gramáž | MVP |
| R-13 | Postup přípravy jako volný text, pro režim vaření dělený po řádcích | MVP |
| R-14 | Počet porcí — **nepovinné pole** | MVP |
| R-15 | Pole „hmotnost po uvaření" — když je vyplněné, hodnoty na 100 g se počítají z něj | v2 |
| R-16 | Štítky (snídaně, rychlovka, po babičce, meal prep) | MVP |
| R-17 | Recept jako surovina jiného receptu („domácí bešamel" v „lasagních") | v3 |
| R-18 | Duplikace receptu jako základ pro variantu | v2 |
| R-19 | Změna počtu porcí přepočítá gramáže u napojených surovin | v3 |

**Hledání a čtení**

| ID | Požadavek | Priorita |
|----|-----------|----------|
| R-20 | Fulltext přes název, suroviny, postup i pole „od koho", bez ohledu na diakritiku | MVP |
| R-21 | Filtr podle štítků a podle autora | MVP |
| R-22 | **Režim vaření**: velké písmo, displej nezhasíná, odškrtávání surovin | MVP |
| R-23 | Fotka hotového jídla | v2 |
| R-24 | Poznámky k receptu s datem („podruhé jsem dal míň soli, lepší") | v2 |
| R-25 | Tisk / export receptu do PDF | v3 |

**Nutriční nadstavba**

| ID | Požadavek | Priorita |
|----|-----------|----------|
| R-30 | Výpočet celkových hodnot, na porci a na 100 g z napojených surovin | v2 |
| R-31 | **Ukazatel úplnosti** — „spočítáno ze 6 z 9 surovin, orientační" (viz E-13) | v2 |
| R-32 | Živý přepočet při editaci | v2 |
| R-33 | Zapsání receptu do deníku v gramech nebo v porcích | v3 |

### 4.2 Potraviny

Databáze potravin slouží **jen** k nepovinnému obohacení receptů a k deníku. Bez ní musí aplikace fungovat.

| ID | Požadavek | Priorita |
|----|-----------|----------|
| F-01 | Vyhledávání potravin podle názvu v lokální databázi (fulltext, bez diakritiky, od 2 znaků) | v2 |
| F-02 | Ruční založení potraviny: název, značka, kcal, bílkoviny, sacharidy, tuky na 100 g/ml | v2 |
| F-03 | Volitelné pole: cukry, nasycené tuky, vláknina, sůl | v2 |
| F-04 | Označení, zda jsou hodnoty na 100 g nebo 100 ml | v2 |
| F-05 | Sken čárového kódu → dotaz na Open Food Facts → předvyplněný formulář k potvrzení | v3 |
| F-06 | Vlastní míry u potraviny („1 ks vejce = 58 g", „1 lžíce = 14 g") | v2 |
| F-07 | Označení oblíbené | v2 |
| F-08 | Editace a mazání potraviny (se soft-delete, viz E-08) | v2 |
| F-09 | Fotka obalu u vlastní potraviny | v3 |
| F-10 | Import ze souboru CSV (počáteční naplnění databáze) | v2 |

### 4.3 Deník

Celý deník je **fáze 3**. Do té doby aplikace kalorie vůbec nesleduje.

| ID | Požadavek | Priorita |
|----|-----------|----------|
| D-01 | Denní přehled: 4 jídla (snídaně, oběd, večeře, svačina) + součty | v3 |
| D-02 | Přidání položky (potravina nebo recept) s množstvím v gramech | v3 |
| D-03 | Zbývající kalorie do cíle na jednu obrazovku, bez scrollování | v3 |
| D-04 | Rozpad makroživin za den (g i % energie) | v3 |
| D-05 | Rychlý výběr: oblíbené + posledně použité nahoře ve vyhledávání | v3 |
| D-06 | Přepínání dnů (šipky, kalendář, gesto swipe) | v3 |
| D-07 | Editace a smazání zapsané položky | v3 |
| D-08 | Kopírování celého dne nebo jednoho jídla na jiný den | v3 |
| D-09 | Rychlý zápis jen kalorií, bez potraviny („restaurace, ~700 kcal") | v3 |
| D-10 | Zápis vody | v4 |

### 4.4 Cíle a měření

| ID | Požadavek | Priorita |
|----|-----------|----------|
| G-01 | Ruční nastavení denního cíle kcal + bílkoviny/sacharidy/tuky v gramech | v3 |
| G-02 | Historie cílů — změna cíle nepřepíše hodnocení minulých dní | v3 |
| G-03 | Zápis hmotnosti s datem | v3 |
| G-04 | Graf hmotnosti s klouzavým průměrem (7 dní) | v3 |

### 4.5 Statistiky

| ID | Požadavek | Priorita |
|----|-----------|----------|
| S-01 | Graf denního příjmu za posledních 7 / 30 dní | v3 |
| S-02 | Průměry za období a počet dní v cíli | v3 |
| S-03 | Nejčastěji zapisované potraviny a recepty | v3 |
| S-04 | Podíl makroživin v čase | v4 |

### 4.6 Data a nastavení

| ID | Požadavek | Priorita |
|----|-----------|----------|
| N-01 | Export všech dat do JSON, včetně fotek | MVP |
| N-02 | Import z dřívějšího exportu (obnova) | MVP |
| N-03 | Export deníku do CSV | v3 |
| N-04 | Tmavý režim | v2 |
| N-05 | Přihlášení (magic link e-mailem) | MVP |
| N-06 | Volba jednotky energie (kcal / kJ) | v4 |

---

## 5. Nefunkční požadavky

| ID | Oblast | Požadavek |
|----|--------|-----------|
| NF-1 | Rychlost startu | Otevření na obrazovku nového receptu do 2 s na mobilu, i offline. **Tohle je limitující požadavek celé aplikace** — pomalý start znamená, že se recept nezapíše |
| NF-2 | Rychlost hledání | Výsledky do 100 ms — hledá se lokálně, ne přes síť |
| NF-3 | Offline | Plná funkčnost bez sítě včetně fotek. Jediná výjimka je sken čárových kódů. Zápisy se frontují a odešlou později |
| NF-4 | Odolnost dat | Ztráta dat je jediná neopravitelná chyba. Serverová kopie + týdenní automatický export |
| NF-5 | Cílová zařízení | Mobil na výšku 360–430 px (primární), desktop 1280+ (sekundární) |
| NF-6 | Prohlížeče | Poslední 2 verze Chrome, Safari, Firefox |
| NF-7 | Ovládání jednou rukou | Vše důležité v dolní třetině obrazovky |
| NF-8 | Přesnost | Interně plná přesnost, zaokrouhluje se až při zobrazení (viz E-06) |
| NF-9 | Náklady | Free tier Supabase + Vercel/Cloudflare |

---

## 6. UX — informační architektura a obrazovky

### 6.1 Navigace

Spodní lišta se **čtyřmi** položkami. Víc jich být nesmí — pátá už se hledá.

```
┌─────────────────────────────────────┐
│                                     │
│           obsah stránky             │
│                                     │
├─────────────────────────────────────┤
│  Recepty    Hledat    Dnes    Víc   │
└─────────────────────────────────────┘
```

- **Recepty** — výchozí obrazovka po otevření, se **stálým tlačítkem „+ Nový recept"** nahoře
- **Hledat** — fulltext přes recepty, filtry podle štítků a autora
- **Dnes** — deník (přibude až ve fázi 3; do té doby je tam místo něj „Potraviny")
- **Víc** — statistiky, cíle, export, nastavení

Ve fázi 1 stačí dvě položky: Recepty a Víc.

### 6.2 Obrazovka „Nový recept" — nejdůležitější obrazovka v aplikaci

Jedno pole. Žádný průvodce, žádné kroky, žádná povinná pole kromě názvu.

```
┌─────────────────────────────────────┐
│  ✕   Nový recept          [Uložit]  │
├─────────────────────────────────────┤
│  Název:  Babiččin bramborák         │
│  Od:     babička Marie              │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │ 4 velký brambory                ││
│  │ 2 vejce                         ││
│  │ hrst hladký mouky               ││
│  │ 4 stroužky česneku              ││
│  │ majoránka, sůl, pepř            ││
│  │                                 ││
│  │ Nastrouhat najemno, nechat      ││
│  │ okapat. Smažit na sádle na      ││
│  │ prudkým ohni.                   ││
│  │ Nesmí se to míchat dlouho!      ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  [📷 Vyfotit]        [🏷 Štítky]     │
└─────────────────────────────────────┘
```

Poznámky k návrhu:

- Kurzor skočí do velkého pole hned po otevření, klávesnice naskočí sama.
- **Diktování se neřeší v aplikaci.** Systémová klávesnice na iOS i Androidu už diktování umí a umí ho líp než cokoliv, co by šlo napsat. Aplikace jen nesmí bránit — obyčejný `<textarea>` stačí. Viz E-14.
- Uložit jde kdykoliv, i s prázdným tělem.
- Automatické průběžné ukládání konceptu do IndexedDB — když aplikace spadne nebo přijde hovor, text zůstane.

### 6.3 Obrazovka „Recept" a režim vaření

Recept se zobrazuje ve dvou režimech. Výchozí je čtecí, tlačítko „Vařit" přepne do režimu vaření:

```
┌─────────────────────────────────────┐
│  ‹   Babiččin bramborák       [⋯]   │
│      od babičky Marie · 3. 8. 2026  │
├─────────────────────────────────────┤
│  SUROVINY                           │
│    ☑ 4 velký brambory               │
│    ☑ 2 vejce                        │
│    ☐ hrst hladký mouky              │
│    ☐ 4 stroužky česneku             │
│    ☐ majoránka, sůl, pepř           │
├─────────────────────────────────────┤
│  POSTUP                             │
│    Nastrouhat najemno, nechat       │
│    okapat.                          │
│                                     │
│    Smažit na sádle na prudkým       │
│    ohni.                            │
│                                     │
│    Nesmí se to míchat dlouho!       │
└─────────────────────────────────────┘
```

V režimu vaření: písmo o dvě velikosti větší, **displej nezhasíná** (Screen Wake Lock API, viz E-15), odškrtnuté suroviny zešednou. Odškrtnutí je dočasné, neukládá se.

### 6.4 Obrazovka „Dnes" (fáze 3)

```
┌─────────────────────────────────────┐
│  ‹   ne 2. srpna   ›          [📅]  │
├─────────────────────────────────────┤
│                                     │
│         1 340 / 2 100 kcal          │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  zbývá 760  │
│                                     │
│   B 94/150 g   S 121/210 g   T 48/70│
├─────────────────────────────────────┤
│  SNÍDANĚ                    412 kcal│
│    Ovesná kaše          80 g   310  │
│    Banán               120 g   102  │
│    + přidat                         │
├─────────────────────────────────────┤
│  OBĚD                       928 kcal│
│    Kuřecí rizoto       340 g   304  │
│    + přidat                         │
├─────────────────────────────────────┤
│  VEČEŘE                       0 kcal│
│    + přidat                         │
├─────────────────────────────────────┤
│  SVAČINA                      0 kcal│
│    + přidat                         │
└─────────────────────────────────────┘
```

Principy:
- Součty a zbytek do cíle jsou vidět **bez scrollování**.
- Klepnutí na položku = editace množství, dlouhé podržení = smazat.
- Swipe doleva/doprava přepíná dny.

### 6.5 Obrazovka „Přidat položku" (fáze 3)

```
┌─────────────────────────────────────┐
│  ✕   Přidat do: Oběd                │
├─────────────────────────────────────┤
│  🔍 hledat…                    [⌗]  │  ← ⌗ = sken kódu
├─────────────────────────────────────┤
│  ★ OBLÍBENÉ                         │
│    Kuřecí rizoto         100 g  89  │
│    Tvaroh Pilos          150 g 120  │
│                                     │
│  ⏱ POSLEDNÍ                         │
│    Rohlík                 43 g 130  │
│    Máslo                  10 g  75  │
└─────────────────────────────────────┘
```

Až se deník bude dělat, tohle je jeho nejdůležitější obrazovka. Klíčové rozhodnutí: u oblíbených a posledních se pamatuje i **naposledy použité množství**. Klepnutí na položku ji rovnou zapíše v tomto množství a vrátí mě na deník — to je ta cesta na 3 klepnutí (Přidat → položka → hotovo). Množství jde upravit až potom klepnutím na řádek v deníku. Tenhle pattern („optimistický zápis") je rozdíl mezi appkou, kterou používám, a appkou, kterou po měsíci smažu.

### 6.6 Doplnění nutričních hodnot (fáze 2)

Obrazovka, kam se člověk dostane z receptu přes „Spočítat kalorie". Vlevo řádky tak, jak byly zachyceny, vpravo nepovinné napojení.

```
┌─────────────────────────────────────┐
│  ✕   Bramborák — kalorie    [Uložit]│
├─────────────────────────────────────┤
│  Porcí:  [ 4 ]                      │
├─────────────────────────────────────┤
│  „4 velký brambory"                 │
│      → Brambory syrové     600 g ✓  │
│  „2 vejce"                          │
│      → Vejce slepičí       116 g ✓  │
│  „hrst hladký mouky"                │
│      → [ napojit potravinu ]        │
│  „4 stroužky česneku"               │
│      → Česnek               12 g ✓  │
│  „majoránka, sůl, pepř"             │
│      → [ přeskočit ]           ⊘    │
├─────────────────────────────────────┤
│  Hmotnost po uvaření: [    ] g  ⓘ   │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │ ⚠ Orientační — 3 z 5 surovin    ││
│  │ Celkem     712 kcal             ││
│  │ Porce      178 kcal  B 7 S32 T 2││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

Zásadní detaily:

- **Levý sloupec je nedotknutelný.** Původní text suroviny se nikdy nepřepíše názvem z databáze. „Hrst hladký mouky" zůstane „hrst hladký mouky", i když se k ní připojí položka „Mouka pšeničná hladká".
- Řádek jde označit jako **přeskočený** (koření, voda) — pak se nepočítá do úplnosti a nekazí ukazatel.
- Souhrn **vždy** nese informaci o úplnosti (R-31, E-13). Nikdy neukazuje číslo, které vypadá přesně, když přesné není.
- Souhrnný panel se přepočítává při psaní, ne až po uložení.

---

## 7. Technická architektura

### 7.1 Volba platformy: PWA

**Rozhodnutí: jedna Progressive Web App, žádné nativní aplikace.**

Zdůvodnění: požadavek „web i mobil" plus „jeden vývojář, volný čas" dává jediný rozumný výsledek. PWA se na telefonu přidá na plochu, běží na celou obrazovku bez adresního řádku, funguje offline a nasazuje se pushnutím do gitu. Nativní appka by znamenala dvě kódové základny navíc, vývojářský účet u Applu za peníze a schvalovací proces — všechno kvůli aplikaci pro jednoho člověka.

Zvažované alternativy:

| Varianta | Proč ne |
|----------|---------|
| React Native / Expo | Web je „taky", ne rovnocenně. Dvojí ladění UI. Overkill pro CRUD nad tabulkou |
| Flutter | Totéž + web build je těžký a pomalý |
| Nativní iOS + Android | Trojnásobek práce |
| Capacitor kolem té samé PWA | **Zůstává jako otevřená možnost** — když bude potřeba lepší sken kamery nebo widget, obalí se stejný kód. Zatím zbytečné |

**Omezení PWA, se kterými je nutné počítat:**
- Kamera pro sken čárového kódu vyžaduje HTTPS (na localhostu funguje i bez).
- Sken kódu je v prohlížeči pomalejší a náchylnější na špatné světlo než nativně. Proto musí vždy existovat cesta „zadat ručně".
- Safari na iOS umí odklidit data webu, který dlouho nepoužíváš. Po instalaci na plochu je situace lepší, ale **spoléhat se jen na lokální databázi nelze** — serverová kopie není luxus, je to nutnost (NF-4).
- Push notifikace na iOS fungují jen u aplikace nainstalované na plochu. Pro připomínky zapisování to stačí, ale je to v3.

### 7.2 Stack

| Vrstva | Volba | Poznámka |
|--------|-------|----------|
| Jazyk | TypeScript | Ne JavaScript. U nutričních výpočtů se typová kontrola vyplatí |
| Framework | React 18 + Vite | Rychlý build, velká ekosféra |
| UI | Tailwind CSS + shadcn/ui | Komponenty do vlastního kódu, žádná závislost na cizím design systému |
| Routing | React Router | |
| Lokální DB | Dexie.js (nad IndexedDB) | Zdroj pravdy pro UI |
| Serverová DB | Supabase (Postgres + Auth) | Free tier, řádkové zabezpečení, REST i realtime |
| Server-state | TanStack Query | Cache, retry, invalidace |
| PWA | vite-plugin-pwa (Workbox) | Service worker, manifest, offline shell |
| Sken kódu | `@zxing/browser` | Přes `getUserMedia` |
| Grafy | Recharts | |
| Hosting | Cloudflare Pages / Vercel | Automatické nasazení z gitu |

### 7.3 Architektura — „local-first"

```
┌──────────────────────────────────────────┐
│              PWA (prohlížeč)             │
│                                          │
│   React UI                               │
│      ↕ (čte i zapisuje POUZE lokálně)    │
│   Dexie / IndexedDB   ← zdroj pravdy     │
│      ↕                                   │
│   Sync worker  ──── outbox fronta        │
└──────────────┬───────────────────────────┘
               │  HTTPS, když je síť
               ▼
┌──────────────────────────────────────────┐
│           Supabase                       │
│   Postgres + Row Level Security          │
│   Auth (magic link)                      │
└──────────────────────────────────────────┘
```

Klíčové pravidlo: **UI nikdy nečeká na síť.** Zápis jde do IndexedDB, obrazovka se aktualizuje okamžitě, do fronty se přidá úkol k odeslání. Tohle je celý důvod, proč bude appka připadat rychlá.

### 7.4 Datový model

Schéma v PostgreSQL (v Dexie se zrcadlí stejná struktura, jen bez cizích klíčů).

```sql
-- ---------------------------------------------------------------
-- POTRAVINY
-- ---------------------------------------------------------------
create table foods (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  brand         text,
  barcode       text,
  -- všechny hodnoty jsou na 100 g nebo 100 ml podle sloupce basis
  basis         text        not null default 'g' check (basis in ('g','ml')),
  energy_kcal   numeric     not null,
  protein_g     numeric     not null default 0,
  carbs_g       numeric     not null default 0,
  fat_g         numeric     not null default 0,
  sugar_g       numeric,
  satfat_g      numeric,
  fiber_g       numeric,
  salt_g        numeric,
  source        text        not null default 'custom'
                check (source in ('custom','openfoodfacts','nutridatabaze','usda','import')),
  source_ref    text,       -- id/kód v původní databázi
  is_favorite   boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz -- soft delete kvůli synchronizaci
);

create index foods_name_idx on foods (lower(name));
create unique index foods_barcode_idx on foods (barcode)
  where barcode is not null and deleted_at is null;

-- Domácí míry: "1 ks", "1 lžíce", "1 hrnek"
create table food_portions (
  id       uuid primary key default gen_random_uuid(),
  food_id  uuid not null references foods(id) on delete cascade,
  label    text not null,      -- 'ks', 'lžíce', 'plátek'
  grams    numeric not null
);

-- ---------------------------------------------------------------
-- RECEPTY
-- ---------------------------------------------------------------
create table recipes (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,          -- jediné povinné pole
  source          text,        -- "babička Marie", "kamarád Petr", odkaz na web
  captured_on     date        not null default current_date,

  -- Původní zachycený text tak, jak byl napsán. NIKDY se nepřepisuje
  -- strukturováním — je to doklad o tom, co bylo doopravdy řečeno. Viz E-17
  raw_capture     text,

  instructions    text,        -- postup; pro režim vaření se dělí po řádcích
  servings        numeric      check (servings is null or servings > 0),  -- NEPOVINNÉ
  cooked_weight_g numeric,     -- zvážená hmotnost po uvaření; NULL = použij součet surovin
  photo_url       text,        -- fotka kartičky nebo hotového jídla
  audio_url       text,
  tags            text[]       not null default '{}',
  is_favorite     boolean      not null default false,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now(),
  deleted_at      timestamptz
);

create index recipes_tags_idx  on recipes using gin (tags);
create index recipes_source_idx on recipes (lower(source));

-- Položka receptu.
-- POZOR: raw_text je jediné povinné pole. food_id, sub_recipe_id a amount_g
-- jsou NEPOVINNÉ obohacení, které se doplňuje až později (nebo nikdy).
-- Viz E-12 — tohle je nejdůležitější rozhodnutí v celém modelu.
create table recipe_items (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipes(id) on delete cascade,

  raw_text      text not null,   -- "hrst hladký mouky" — zdroj pravdy, needituje se automaticky

  food_id       uuid references foods(id),      -- nepovinné napojení
  sub_recipe_id uuid references recipes(id),    -- nepovinné napojení
  amount_g      numeric check (amount_g is null or amount_g > 0),
  is_skipped    boolean not null default false, -- koření, voda — nepočítá se do úplnosti

  note          text,
  sort_order    integer not null default 0,
  constraint at_most_one_target check (num_nonnulls(food_id, sub_recipe_id) <= 1)
);

-- Poznámky k receptu z jednotlivých vaření (R-24)
create table recipe_notes (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references recipes(id) on delete cascade,
  noted_on   date not null default current_date,
  body       text not null
);

-- ---------------------------------------------------------------
-- DENÍK
-- ---------------------------------------------------------------
create table log_entries (
  id           uuid primary key default gen_random_uuid(),
  logged_on    date not null,          -- lokální datum, ne timestamp! viz E-07
  meal         text not null check (meal in ('breakfast','lunch','dinner','snack')),
  food_id      uuid references foods(id),
  recipe_id    uuid references recipes(id),
  amount_g     numeric not null,

  -- SNAPSHOT: spočítáno v okamžiku zápisu a NIKDY se nepřepočítává. Viz E-01
  display_name text    not null,
  energy_kcal  numeric not null,
  protein_g    numeric not null,
  carbs_g      numeric not null,
  fat_g        numeric not null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint one_source check (num_nonnulls(food_id, recipe_id) <= 1)
);

create index log_entries_date_idx on log_entries (logged_on)
  where deleted_at is null;

-- ---------------------------------------------------------------
-- CÍLE A HMOTNOST
-- ---------------------------------------------------------------
create table goals (
  id          uuid primary key default gen_random_uuid(),
  valid_from  date    not null,   -- nový cíl = nový řádek, staré dny se nemění
  energy_kcal numeric not null,
  protein_g   numeric,
  carbs_g     numeric,
  fat_g       numeric
);

create table weight_entries (
  id           uuid primary key default gen_random_uuid(),
  measured_on  date    not null unique,
  weight_kg    numeric not null
);
```

**Poznámky k modelu:**

- `num_nonnulls(...) <= 1` u deníku (ne `= 1`) záměrně — dovoluje záznam bez vazby, tzn. rychlý zápis „restaurace, 700 kcal" (D-09).
- `deleted_at` všude, kde se synchronizuje. Tvrdé smazání by při synchronizaci mezi zařízeními vzkřísilo záznam z druhého zařízení.
- Sloupec `user_id uuid` v každé tabulce nepřidávám kvůli současnosti, ale kvůli budoucnosti — až bude potřeba druhý účet, je to migrace na pět minut místo přepisu aplikace. Pokud chceš být důsledný, přidej ho hned a nastav RLS `user_id = auth.uid()`.
- **Recept musí být validní i úplně prázdný.** Jediné povinné pole v celém stromu je `recipes.name` a `recipe_items.raw_text`. Každý `not null` navíc je potenciální důvod, proč se recept u babičky neuloží.
- Fotky se ukládají do Supabase Storage, ale **nejdřív jako blob do IndexedDB** a nahrávají se až na síti (E-16).

### 7.5 Klíčové výpočty

#### Úplnost dat — počítá se dřív než cokoliv jiného

Většina receptů nebude mít napojené všechny suroviny. Aplikace to musí **přiznat**, ne zamlčet.

```
započitatelné = položky, kde is_skipped = false
napojené      = započitatelné, kde food_id/sub_recipe_id A ZÁROVEŇ amount_g nejsou null

úplnost = napojené / započitatelné

úplnost = 1      → hodnoty se zobrazí normálně
0 < úplnost < 1  → "⚠ Orientační, spočítáno z N z M surovin"
úplnost = 0      → nezobrazovat žádná čísla, nabídnout "Spočítat kalorie"
```

Do součtů se počítají jen napojené položky. Chybějící se **nedohadují**.

#### Nutriční hodnoty receptu

```
CELKEM = Σ (amount_g / 100) × hodnota_na_100g   (jen přes napojené položky)

hmotnost_surovin  = Σ amount_g  (jen napojené položky)
finální_hmotnost  = cooked_weight_g ?? hmotnost_surovin

NA 100 G  = CELKEM / finální_hmotnost × 100
NA PORCI  = CELKEM / servings
```

**Proč pole „hmotnost po uvaření" existuje.** Rýže a těstoviny nasávají vodu, maso a omáčky ji ztrácejí. Kalorie se vařením nemění, ale hmotnost ano — a když se hodnota na 100 g počítá ze syrových surovin, výsledek je nepoužitelný. To je nejčastější chyba, kterou dělají i velké aplikace.

Příklad — Kuřecí rizoto, 4 porce:

| Surovina | Množství | kcal/100 g | kcal |
|----------|----------|-----------|------|
| Kuřecí prsa syrová | 400 g | 106 | 424 |
| Rýže dlouhozrnná syrová | 200 g | 350 | 700 |
| Cibule | 100 g | 40 | 40 |
| Olej řepkový | 20 g | 884 | 177 |
| **Součet surovin** | **720 g** | | **1 341** |

Hrnec po uvaření váží 1 500 g (rýže nasákla vodu).

- Na porci: `1341 / 4 = 335 kcal` — na hmotnosti po uvaření nezáleží.
- Na 100 g: `1341 / 1500 × 100 = 89 kcal`
- Kdyby se počítalo ze syrových 720 g, vyšlo by 186 kcal/100 g — **víc než dvojnásobek**. Kdo si nandá 340 g a použije špatné číslo, zapíše si 633 kcal místo skutečných 304.

#### Pseudokód s podrecepty

```ts
type Nutrients = { kcal: number; protein: number; carbs: number; fat: number };

function recipeTotals(recipeId: string, visited = new Set<string>()): {
  totals: Nutrients; finalWeight: number;
} {
  if (visited.has(recipeId)) {
    throw new Error("Cyklická reference receptů");   // viz E-03
  }
  visited.add(recipeId);

  const recipe = getRecipe(recipeId);
  const totals: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let rawWeight = 0;

  for (const item of recipe.items) {
    let per100: Nutrients;

    if (item.foodId) {
      per100 = getFood(item.foodId);                    // hodnoty už jsou na 100 g
    } else {
      // podrecept: spočítej rekurzivně a normalizuj na 100 g JEHO finální hmotnosti
      const sub = recipeTotals(item.subRecipeId!, visited);
      per100 = scale(sub.totals, 100 / sub.finalWeight);
    }

    const factor = item.amountG / 100;
    totals.kcal    += per100.kcal    * factor;
    totals.protein += per100.protein * factor;
    totals.carbs   += per100.carbs   * factor;
    totals.fat     += per100.fat     * factor;
    rawWeight      += item.amountG;
  }

  visited.delete(recipeId);
  return { totals, finalWeight: recipe.cookedWeightG ?? rawWeight };
}
```

#### Zápis do deníku (snapshot)

```ts
function logRecipe(recipeId: string, grams: number, meal: Meal, day: string) {
  const { totals, finalWeight } = recipeTotals(recipeId);
  const f = grams / finalWeight;          // podíl z celého hrnce

  db.logEntries.add({
    id: uuid(), loggedOn: day, meal, recipeId, amountG: grams,
    displayName: getRecipe(recipeId).name,
    energyKcal: totals.kcal    * f,       // ← uloží se VÝSLEDEK, ne odkaz
    proteinG:   totals.protein * f,
    carbsG:     totals.carbs   * f,
    fatG:       totals.fat     * f,
  });
}
```

Statistiky a denní součty se pak počítají výhradně ze sloupců v `log_entries`, nikdy dopočítáváním z receptů. Vedlejší efekt: dotazy na statistiky jsou triviální `SUM()` a rychlé i nad roky dat.

### 7.6 Zdroje nutričních dat

| Zdroj | Co obsahuje | Přístup | Vhodné na |
|-------|-------------|---------|-----------|
| **Open Food Facts** | Balené výrobky včetně českých, čárové kódy | Veřejné API, bez klíče, licence ODbL | Sken kódu v obchodě |
| **NutriDatabáze.cz** (ÚZEI) | Suroviny podle českých zvyklostí | Registrace zdarma, export pro přihlášené | Počáteční naplnění surovin |
| **USDA FoodData Central** | Suroviny, velmi podrobné | API klíč zdarma | Doplnění, co chybí |
| **Ruční opis z obalu** | Cokoliv | — | Vždycky musí být možnost |

**Open Food Facts — konkrétně.** <cite index="10-1">Základní URL je `https://world.openfoodfacts.org/api/v2`, hlavní volání je `/product/{barcode}.json` a vrací vše, co je o produktu známo; pro čtení dat není potřeba žádný API klíč ani registrace.</cite> Zajímavé pole je `nutriments`, kde <cite index="4-1">hodnoty přepočtené na 100 g mají příponu `_100g` — tedy `energy-kcal_100g`, `carbohydrates_100g`, `sugars_100g` a podobně; odpověď navíc obsahuje `product_name` a stav `status`, kde jednička znamená nalezeno.</cite> Mapování na vlastní tabulku:

| Pole v OFF | Sloupec v `foods` |
|------------|-------------------|
| `product_name` | `name` |
| `brands` | `brand` |
| `code` | `barcode` |
| `nutriments["energy-kcal_100g"]` | `energy_kcal` |
| `nutriments.proteins_100g` | `protein_g` |
| `nutriments.carbohydrates_100g` | `carbs_g` |
| `nutriments.fat_100g` | `fat_g` |
| `nutriments.sugars_100g` | `sugar_g` |
| `nutriments["saturated-fat_100g"]` | `satfat_g` |
| `nutriments.fiber_100g` | `fiber_g` |
| `nutriments.salt_100g` | `salt_g` |

Na co si dát pozor:
- <cite index="10-1">Odpověď se `status: 0` znamená, že kód v databázi zatím není — chybějící pole jsou u málo zdokumentovaných produktů běžná, takže je nutné psát kód defenzivně.</cite> Fallback = ruční formulář.
- Data zadávají dobrovolníci, takže mohou být špatně. **Po skenu vždy zobrazit hodnoty k potvrzení**, nikdy neuložit naslepo.
- <cite index="2-1">Fulltextové vyhledávání ve v2 API na serveru není; strukturované filtrování podle kategorií, značek a nutrientů je dostupné přes `/api/v2/search`, zatímco plnotextové hledání zajišťuje samostatná služba Search-a-licious.</cite> Pro potřeby aplikace to nevadí — hledá se lokálně ve vlastní databázi, OFF slouží jen k dohledání kódu.
- Naskenovanou potravinu si vždy ulož do vlastní tabulky. Podruhé už síť není potřeba.
- Slušné chování: posílat vlastní `User-Agent` s názvem aplikace a nedělat zbytečné dotazy — je to provozované z darů.

**NutriDatabáze.cz.** <cite index="11-1">Databázi spravuje Centrum pro databázi složení potravin ČR při Ústavu zemědělské ekonomiky a informací, ve verzi 8.20 obsahuje data pro 934 potravin, export je dostupný pro registrované uživatele a registrace je zdarma.</cite> Zásadní ale je, že <cite index="11-1">databáze je chráněná autorským zákonem a použití dat musí být v souladu s licenčními podmínkami.</cite> Pro osobní neveřejnou aplikaci by to problém být nemělo, ale **licenční podmínky si před stažením přečti** — a rozhodně data nikam nepublikuj.

### 7.7 Synchronizace a offline

Pro jednoho uživatele stačí ta nejjednodušší strategie, která funguje:

1. **Zápis** jde do IndexedDB a zároveň do tabulky `outbox` (typ operace, tabulka, id, payload, čas).
2. **Sync worker** se probouzí při startu aplikace, při návratu online (`window.online`) a po každé změně. Odešle frontu, po potvrzení mazá záznamy z outboxu.
3. **Stahování** změn: dotaz `where updated_at > poslední_sync`.
4. **Konflikty:** last-write-wins podle `updated_at`. U jednoho uživatele s dvěma zařízeními je pravděpodobnost konfliktu minimální a cena chyby nízká.
5. **Mazání** nikdy natvrdo — jen `deleted_at`, jinak se smazané záznamy budou vracet z druhého zařízení.

Service worker cachuje app shell strategií „stale-while-revalidate", takže aplikace naběhne i úplně offline.

### 7.8 Bezpečnost a zálohy

- **Autentizace:** Supabase Auth, magic link na e-mail. Žádná hesla ke správě.
- **Autorizace:** zapnutá Row Level Security na všech tabulkách. Ano, i pro jediného uživatele — bez ní je anonymní klíč v prohlížeči přístup k celé databázi pro kohokoliv, kdo se podívá do síťové karty devtools.
- **Klíče:** v klientovi smí být pouze `anon` klíč. `service_role` klíč nikdy nesmí opustit server, jinak jsou RLS pravidla k ničemu.
- **Zálohy:** tři vrstvy — Supabase automatické zálohy, měsíční ruční `pg_dump`, a exportní JSON (N-01) uložený do cloudu. Zálohu je potřeba **jednou vyzkoušet obnovit**, jinak to není záloha, ale naděje.

### 7.9 Nasazení

```
git push  →  Cloudflare Pages/Vercel build  →  produkce
```

- HTTPS je povinné — bez něj nefunguje kamera ani instalace PWA.
- Proměnné prostředí: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Manifest PWA: název, ikony 192 a 512 px, `display: standalone`, `theme_color`.
- Migrace databáze verzovat v repozitáři (Supabase CLI), ne klikat ručně v konzoli.

---

## 8. Zrádná místa

Tohle je nejcennější část dokumentu. Každý bod je chyba, která se objeví až po měsících používání, kdy už se špatně opravuje.

| ID | Problém | Řešení |
|----|---------|--------|
| **E-01** | **Změna receptu přepíše historii.** Upravím recept, přidám lžíci oleje — a najednou má i loňský červen o 200 kcal víc | Deník ukládá **vypočtený snapshot**, ne odkaz na recept (viz 7.5). Zásadní rozhodnutí celého návrhu |
| **E-02** | Hodnoty na 100 g nesedí u vařených jídel | Pole `cooked_weight_g` (viz 7.5) |
| **E-03** | Recept obsahuje sám sebe → nekonečná rekurze a zamrznutí | Detekce cyklu množinou `visited` při výpočtu i při ukládání; nabídnout jen recepty, které daný recept neobsahují |
| **E-04** | Vejce se neváží v gramech, ale v kusech | Tabulka `food_portions` s převodem na gramy. Interně vždy gramy, kusy jsou jen zobrazení |
| **E-05** | Evropské obaly uvádějí kJ i kcal, někdy jen kJ | Ukládat kcal. Při importu, kde je jen kJ, převést: `kcal = kJ / 4,184` |
| **E-06** | Chyby ze zaokrouhlování — 30 položek zaokrouhlených na celé kcal dá za den odchylku desítek | Počítat v plné přesnosti, zaokrouhlovat **až při zobrazení** |
| **E-07** | Půlnoc a časová pásma. Večeře v 23:50 zapsaná jako UTC skončí v zítřku | `logged_on` je typ `DATE` v lokálním čase, nikdy timestamp v UTC |
| **E-08** | Smazaná potravina, na kterou odkazuje starý záznam v deníku | Soft delete + snapshot v deníku znamená, že historii to nerozbije. Smazaná potravina se jen přestane nabízet |
| **E-09** | Tři varianty „Rýže" v databázi | Při ukládání upozornit na podobný název (fuzzy match). Sloučení duplicit až v3 |
| **E-10** | **Prázdná aplikace první den.** Nemám žádné potraviny, takže zapsat snídani trvá 10 minut a přestanu to používat | Připravit CSV se 100–200 nejčastějšími surovinami a naimportovat **před** prvním použitím. Nepodceňovat — tady umírá většina osobních projektů |
| **E-11** | Kalorie z obalu vs. skutečnost | Neřešit, je to mimo dosah aplikace. Konzistence měření je důležitější než absolutní přesnost |
| **E-12** | **Povinná gramáž zabije zachycení.** Formulář, který u každé suroviny chce potravinu z databáze a číslo v gramech, se u babičky v kuchyni nedá vyplnit. Aplikace zůstane prázdná | `recipe_items.raw_text` je jediné povinné pole. `food_id` a `amount_g` jsou nullable. Tenhle bod je celý důvod, proč vypadá datový model tak, jak vypadá |
| **E-13** | Neúplná nutriční data vypadají jako úplná. Recept se 3 z 9 napojenými surovinami ukáže „712 kcal" a člověk tomu uvěří | Vždy zobrazit úplnost. Při úplnosti 0 nezobrazovat žádné číslo. Nikdy nedopočítávat chybějící suroviny odhadem |
| **E-14** | Snaha implementovat diktování přes Web Speech API. Podpora v Safari je nespolehlivá a výsledek horší než systémový | Nedělat to. Obyčejný `<textarea>` + systémová klávesnice, která diktování umí na obou platformách. Nulový kód, lepší výsledek |
| **E-15** | Displej zhasne uprostřed vaření, ruce od těsta | Screen Wake Lock API v režimu vaření. Nutný fallback, kde API chybí — a wake lock uvolnit při opuštění obrazovky, jinak se vybije baterie |
| **E-16** | Fotka pořízená bez signálu se ztratí | Uložit blob do IndexedDB hned, nahrát do Storage až přes outbox. Odkaz v UI míří na lokální blob, dokud nahrání neproběhne |
| **E-17** | Strukturování přepíše původní text. Rozdělím zachycený text na suroviny, něco se rozdělí špatně a původní znění je pryč | `recipes.raw_capture` se ukládá při zachycení a **nikdy se needituje** strukturováním. Vždy musí jít zobrazit „původní zápis" |
| **E-18** | Aplikace startuje pomalu, protože načítá celou databázi potravin | Obrazovka nového receptu nesmí záviset na ničem kromě Dexie. Potraviny se načítají líně, až když jsou potřeba |
| **E-19** | Recept od babičky uložený bez uvedení autora. Za pět let už nevím, od koho je | Pole `source` nabídnout hned na obrazovce zachycení, ne schované v „pokročilém nastavení" |

---

## 9. Roadmapa

Odhady jsou v „víkendech volného času", ne v člověkodnech.

### Fáze 0 — Základy (1 víkend)
- Založit repozitář, Vite + React + TS + Tailwind
- Vytvořit projekt v Supabase, nasadit schéma z 7.4
- Nasadit prázdnou appku na produkci a **ověřit, že jde nainstalovat na telefon**

*Cíl: prázdná appka na ploše telefonu. Zní to zbytečně, ale vyladit nasazení a PWA hned na začátku ušetří spoustu nervů později.*

### Fáze 1 — Kuchařka (2–3 víkendy) ★ tady vzniká celá hodnota aplikace

- Zachycení receptu: název, autor, jedno velké pole, fotka (R-01 až R-05)
- Seznam receptů, detail, editace, štítky (R-16)
- Fulltextové hledání přes všechno (R-20, R-21)
- Režim vaření (R-22)
- Offline zápis + synchronizace + export JSON (NF-3, N-01, N-05)

*Cíl: **mít v aplikaci prvních deset receptů a uvařit podle nich.** Žádné kalorie, žádné potraviny, žádný deník. Po téhle fázi je aplikace hotová v tom smyslu, že už bez ní nechci být.*

**Kontrola po Fázi 1:** vezmi telefon, zapni letový režim a zkus zapsat recept, který ti někdo diktuje nahlas. Když to trvá přes minutu nebo tě něco zastaví, oprav to dřív, než začneš Fázi 2.

### Fáze 2 — Nutriční nadstavba (2–3 víkendy)
- Databáze potravin: CRUD, hledání, import CSV (F-01 až F-04, F-08, F-10)
- Strukturování receptu na suroviny (R-11)
- Napojení surovin na potraviny + gramáž (R-12)
- Výpočet s ukazatelem úplnosti (R-30, R-31, R-32)
- Hmotnost po uvaření (R-15), domácí míry (F-06)

*Cíl: u pěti nejčastějších receptů vědět, kolik mají kalorií na porci.*

### Fáze 3 — Deník (2 víkendy)
- Denní přehled, přidávání položek, oblíbené (D-01 až D-07)
- Cíle (G-01), hmotnost (G-03, G-04)
- Statistiky (S-01, S-02)
- Sken čárového kódu (F-05)

*Dělat jen tehdy, když po tom po fázi 2 opravdu bude chuť. Klidně nikdy.*

### Fáze 4 — Až bude chuť
- Nákupní seznam z receptů — pravděpodobně užitečnější než celý deník
- Plánování jídelníčku na týden
- Podrecepty (R-17), poznámky z vaření (R-24), export receptu do PDF (R-25)
- Zvukové nahrávky (R-06), tmavý režim, připomínky

---

## 10. Otevřená rozhodnutí

1. **Rozdělovat zachycený text na suroviny automaticky?** Jednoduchá heuristika (řádek začínající číslem = surovina, prázdný řádek = předěl na postup) trefí možná 70 %. Doporučení: ano, ale vždy s ruční opravou a nikdy bez zachování `raw_capture`.
2. **Supabase, nebo úplně bez serveru?** Varianta „jen IndexedDB + ruční export" je o víkend rychlejší, ale hrozí ztráta dat (7.1) a nefunguje na dvou zařízeních. U receptů po babičce je ztráta dat citelnější než u kalorií. Doporučení: server hned.
3. **Sdílet recept ven?** Formálně je to ne-cíl, ale „pošli mi ten recept" přijde dřív nebo později. Nejlevnější odpověď: tlačítko, které recept vyexportuje jako čistý text do systémového sdílení. Žádné účty, žádné odkazy.
4. **Připravit `user_id` a RLS už teď?** Náklad ~1 hodina, ušetří pozdější migraci. Doporučení: ano.
5. **Kde vzít počáteční CSV potravin?** Až ve fázi 2. NutriDatabáze (pozor na licenci), USDA, nebo ručně sepsat 150 věcí, které opravdu jím.
6. **Co s recepty, které zůstanou navždy jen jako fotka?** Doporučení: nechat je být. Fotka kartičky je pořád nekonečně lepší než kartička ztracená v šuplíku.

---

## Příloha A — Kontrolní seznam po Fázi 1

Test se dělá **v letovém režimu**, na telefonu, ne na počítači.

- [ ] Aplikace jde nainstalovat na plochu a otevře se bez adresního řádku
- [ ] Od klepnutí na ikonu po kurzor v poli receptu uplyne méně než 2 s
- [ ] Recept jde uložit jen s názvem, bez čehokoliv dalšího
- [ ] Recept jde uložit celý bez signálu a po zapnutí sítě se sám nahraje
- [ ] Vyfocená kartička se uloží i offline a neztratí se po zavření aplikace
- [ ] Hledání „smetana" najde recept, který má smetanu jen v postupu
- [ ] V režimu vaření displej po dvou minutách nezhasne
- [ ] Původní zachycený text jde zobrazit i po rozdělení na suroviny
- [ ] RLS je zapnuté na všech tabulkách (ověřeno pokusem o čtení bez přihlášení)
- [ ] Export JSON stažen a **ověřeno, že import z něj obnoví data včetně fotek**

### Kontrolní seznam po Fázi 2

- [ ] Recept s uvařenou hmotností dává správné kcal/100 g (příklad z 7.5)
- [ ] Recept s polovinou napojených surovin ukazuje varování o úplnosti
- [ ] Recept bez jediné napojené suroviny neukazuje žádné číslo
- [ ] Napojení potraviny nepřepsalo původní text suroviny
