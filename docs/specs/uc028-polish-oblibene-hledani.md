# UC028 — Polish dávka: oblíbené na kartě + revize hledání

Dvě drobnosti z uživatelské revize (dogfooding). Věc 1 má hotový draft v kódu a jen se revizně
potvrzuje. Věc 2 je **otevřená** — záměr se domýšlí, rozhodnutí nechává na uživateli (viz Otevřené
otázky). Spec je společný, protože obojí je „polish" téhož přehledu receptů.

## Kontext

- **Věc 1 — oblíbené na kartě.** Přepnout hvězdu „oblíbené" šlo dosud jen v detailu receptu
  (`RecipeDetailScreen`, `IconButton tone="favorite"`). Uživatel chce přepínat rovnou z karty
  v seznamu, bez otevírání a vracení se. Draft už je v `src/features/recipes/RecipeCard.tsx`.
- **Věc 2 — spodní lišta vs. hledání.** Uživatel doslova: „tlačítko dole v liště mi přijde
  zbytečné, protože vyhledávání už máme." Dnes je v liště 5 záložek (Recepty / Hledat / Nákup /
  Potraviny / Víc). Fulltext žije **jen** na záložce „Hledat" (`SearchScreen`) — přehled receptů
  (`RecipeListScreen`) hledací pole nemá, má jen řazení a filtry (oblíbené / rychlé / štítky).
  Pozor: fulltext přes suroviny a postup je cenný (pokrývá UC018) a **nesmí se ztratit**.
  Pozn.: „Hledat" byla samostatná záložka už od původního návrhu (`docs/SPEC.md`, sekce 6.1).

## User stories

**Věc 1**
- Jako uživatel prohlížející seznam receptů chci přepnout oblíbenost přímo z karty, abych kvůli
  jedné hvězdě nemusel otevírat detail a vracet se zpět.

**Věc 2** (znění závisí na rozhodnutí — viz Otevřené otázky)
- Jako uživatel hledající recept chci hledat rovnou v přehledu, abych nemusel přepínat na zvláštní
  záložku a měl hledání i filtry na jednom místě.

## Akceptační kritéria

**Věc 1 — hvězda na kartě** (potvrzení cílového chování draftu)
- [ ] Given seznam receptů, When ťuknu na hvězdu na kartě, Then se oblíbenost přepne a detail
      receptu se **neotevře** (klik nenaviguje).
- [ ] Given ťuknutí na hvězdu, When se stav přepne, Then se ikona hned překreslí
      (★ plná ↔ ☆ prázdná) bez znovunačtení obrazovky (live query).
- [ ] Given recept přepnutý na kartě, When otevřu jeho detail, Then je hvězda ve stejném stavu
      (a naopak) — jeden zdroj pravdy `recipe.isFavorite`.
- [ ] Given výsledky hledání (`SearchScreen` používá stejnou `RecipeCard`), When ťuknu na hvězdu,
      Then funguje stejně jako na seznamu.
- [ ] Given řazení „Naposledy upravené", When přepnu oblíbenost na kartě, Then se pořadí
      **nepřeskládá** (`setRecipeFavorite` záměrně nemění `updatedAt`).
- [ ] Given dotykové ovládání, Then je klikací plocha hvězdy alespoň ~36×36 px a nepřekrývá se
      s odznakem času přípravy (vlevo nahoře) ani nespouští odkaz na detail.
- [ ] Given tmavý režim, Then je hvězda (aktivní i neaktivní) čitelná nad fotkou obálky i nad
      barevným gradientem u receptu bez fotky.
- [ ] Given čtečka obrazovky, Then má hvězda popisek („Přidat do oblíbených" / „Odebrat
      z oblíbených") a stav (`aria-pressed`).

**Věc 2 — hledání** (guardrail platí vždy; zbytek je podmíněný rozhodnutím)
- [ ] Given **jakékoli** výsledné rozhodnutí, Then zůstane dostupný fulltext přes název + suroviny
      + postup (`recipeHaystack`, UC018) — žádná dnešní schopnost hledání nesmí zmizet.
- [ ] Given fulltext, Then dál funguje bez diakritiky a s kmenem skloňování (`matchesQuery`):
      „cesnek" najde „česnek", „smetana" najde „smetanou".
- [ ] _(podmíněné — pokud se hledání přidá do přehledu)_ Given přehled receptů, When píšu do
      hledacího pole, Then se mřížka filtruje na shody a respektuje aktivní filtry (oblíbené /
      rychlé / štítek) i zvolené řazení.
- [ ] _(podmíněné — pokud se ruší záložka „Hledat")_ Given odebraná záložka, When otevřu appku,
      Then je v liště 4 záložky a žádný odkaz ani uložená route `/hledat` neskončí ve slepé
      (fallback na přehled).

## Okrajové případy a chybové stavy

| Situace | Očekávané chování |
|---|---|
| Rychlé opakované ťukání na hvězdu | Poslední stav vyhrává, žádný race (zápisy Dexie sekvenční), žádné přeskládání seznamu. |
| Aktivní filtr „Oblíbené" a na kartě oblíbenost odeberu | Karta z filtrovaného seznamu ihned zmizí (live query). Očekávané, konzistentní s filtrem. Zvážit „Vrátit zpět" — viz Otevřené otázky. |
| Recept bez fotky (gradient placeholder) | Hvězda čitelná (tmavý overlay `bg-black/45` nad barvou). |
| Úzká karta (1 sloupec) s odznakem času přípravy | Čas vlevo nahoře, hvězda vpravo nahoře — nepřekrývají se. |
| Ťuknutí na hvězdu vs. celoplošný odkaz karty | Klik na hvězdu se nesmí probublat do navigace (hvězda je **sourozenec** `<Link>`, ne potomek). |
| Uložená záložka / historie prohlížeče na `/hledat` po zrušení route | Redirect na přehled, ne 404 (App má fallback `*` → `/`). |
| Hledání v přehledu bez shody | Prázdný stav „Nic nenalezeno" (dnes ho má jen `SearchScreen`; přehled má „Nic neodpovídá filtru"). |
| Autofocus hledacího pole v přehledu | Pravděpodobně **bez** autofocus, ať nekrade fokus a nerozbíjí rychlý vstup (`SearchScreen` dnes autofocus má). Potvrdit rozhodnutím. |

## Mimo rozsah

- Serverové/synchronní hledání, fuzzy/typo tolerance nad rámec dnešního kmene skloňování.
- Nové řazení ani nové typy filtrů.
- Změna datového modelu oblíbených (zůstává bool `isFavorite`).
- Hvězda oblíbené na dalších místech (např. v režimu vaření).
- Redesign spodní lišty nad rámec počtu záložek (ikony, pořadí, barvy).

## Předpoklady

**Věc 1**
- PŘEDPOKLAD: Draft v `RecipeCard.tsx` (hvězda jako `<button>` přes obálku vpravo nahoře) je
  zamýšlené umístění; nechce se jiné (např. hvězda u názvu v patičce karty).
- PŘEDPOKLAD: Dotyková plocha 36×36 px (`h-9 w-9`) stačí; nevyžaduje se 44 px (Apple HIG).
- PŘEDPOKLAD: Přepnutí oblíbené je tiché — bez potvrzení a (zatím) bez „Vrátit zpět", na rozdíl
  od mazání.
- PŘEDPOKLAD: Ve výsledcích hledání je hvězda na kartě taky (karta je sdílená), neskrývá se.
- PŘEDPOKLAD: Odstranění prefixu „★ " z názvu je jen zobrazovací; žádný recept nemá hvězdu jako
  součást skutečného názvu, takže se nic nepoškodí.

**Věc 2**
- PŘEDPOKLAD: „Hledání se nesmí ztratit" = zachovat fulltext přes suroviny/postup a filtr štítků;
  ne nutně zachovat samostatnou obrazovku `SearchScreen`.
- PŘEDPOKLAD: Záměr je snížit redundanci/počet záložek, ne přidat druhé hledání navíc.

## Otevřené otázky

Hlavně věc 2 — **záměrně nerozhoduju za tebe**, potřebuju od tebe potvrdit:

1. **(a) Myslel jsi vážně záložku „Hledat"?** Pozor na nesoulad: přehled receptů dnes hledací pole
   **nemá** — má jen řazení a filtry (oblíbené / rychlé / štítky). Fulltext přes název + suroviny +
   postup je jen na záložce „Hledat". Nešlo ti spíš o pocit, že filtry štítků v přehledu už jsou
   „hledání", a fulltext ti chybí přehlédnutím?
2. **(b) Přidat hledací pole přímo do přehledu a záložku „Hledat" zrušit** (5 → 4 záložky)? Nebo
   záložku nechat a jen sladit?
3. **(c) Přesunout do přehledu i filtr štítků ze `SearchScreen`**, nebo stačí prosté hledací pole?
   (Štítky v přehledu už jsou jako filtrovací chipy — přenos by je zdvojil, chce to sjednotit.)
4. **(d) Kam s hledacím polem v přehledu** — nad karty (druhý řádek pod řazením a filtry), nebo do
   hlavičky obrazovky (jako na „Potravinách" a „Hledat")?
5. **Věc 1:** Chceš u přepnutí oblíbené na kartě „Vrátit zpět" (jako u mazání), zvlášť když při
   aktivním filtru „Oblíbené" karta hned zmizí? Nebo je tiché přepnutí OK?

## Rozhodnutí (uživatel 2026-09-10) — platí pro návrh i implementaci

1. **Věc 1 — hvězda na kartě:** draft potvrzen. Bez undo. Zpětná vazba = vizuální
   výplň hvězdy (☆ prázdná → ★ plná amber); klik znovu odebere. Žádná undo lišta.
2. **Věc 2 — hledání do přehledu + zrušit záložku „Hledat":** do přehledu
   (`RecipeListScreen`) přidat hledací pole (řádek `below` v hlavičce, jako dnes
   `SearchScreen`), filtrovat přes stávající `matchesQuery(recipeHaystack(recipe), query)`
   — fulltext (název + suroviny + postup) se NESMÍ ztratit. Záložku „Hledat" ve spodní
   liště (`TabLayout`) zrušit (5 → 4). Route `/hledat` vyřešit (fallback `* → /` už je).
   Štítky zůstávají jako dnešní chipy v přehledu — neduplikovat filtr štítků ze SearchScreen.
   Osud `SearchScreen.tsx` (smazat vs. ponechat) rozhodne architekt.
