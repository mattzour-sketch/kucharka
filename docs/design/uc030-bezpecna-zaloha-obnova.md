# Návrh: UC030 — Bezpečná a kompletní JSON záloha a obnova

## Co řešíme

Spec: [`docs/specs/uc030-bezpecna-zaloha-obnova.md`](../specs/uc030-bezpecna-zaloha-obnova.md),
závazná sekce **Rozhodnutí (uživatel 2026-09-13)**.
Zpevnit jedinou pojistku proti ztrátě dat: doplnit zálohu o chybějící tabulky, přidat potvrzovací
shrnutí PŘED zápisem a zviditelnit „naposledy zálohováno" — bez nové závislosti a bez změny Dexie schématu.

Rozhodnutí uživatele beru jako mandát, nerozhoduju je znovu. Otevřený prostor byl jen v tom, **jak**
je technicky provést: tvar parse vrstvy, rozdělení obnovy na dvě fáze, minimální dialog, kam s UI.

## Zvažované varianty

Směr je daný Rozhodnutím. Níže jsou varianty **dílčích** technických rozhodnutí v jeho rámci.

### 1) Jak propustit obálku (`exportedAt`) z parse vrstvy do shrnutí

Dnes `parseBackup` vrací jen `BackupData` a obálku (`format`/`version`/`exportedAt`) zahodí. Shrnutí
ji potřebuje.

| Varianta | Pro | Proti |
|---|---|---|
| **`parseBackup` vrací `ParsedBackup { version, exportedAt, data }`** (zvoleno) | Jeden zdroj pravdy pro validaci i obálku; přesně to, co dvoufázová obnova potřebuje | Změní návratový typ jediného volajícího (`dbBackup.ts`) + testu — malý, ohraničený zásah |
| Nová `parseBackupEnvelope()` vedle `parseBackup()` | Nic neláme | Dvě funkce dělají skoro totéž, duplikace validace obálky |
| Obálku číst v komponentě druhým `JSON.parse` | `parseBackup` beze změny | Parsuje se dvakrát, validace obálky uniká z čisté vrstvy do UI |

### 2) Rozdělení obnovy na „shrnutí" a „zápis"

| Varianta | Pro | Proti |
|---|---|---|
| **`prepareRestore(json)` → `RestorePreview` (bez DB) + `applyRestore(preview)` (zápis)** (zvoleno) | Čistá hranice: co se nezapisuje, se nedotkne DB; zápis je jediné místo, kam vede „Potvrdit"; těžká konverze fotek až po potvrzení | Dvě funkce místo jedné; `RestorePreview` chvíli drží data v paměti (stejně už drží text souboru) |
| `importBackupJson(json, { dryRun })` s jedním vstupem | Jedna funkce | Dva režimy v jedné cestě = snadné omylem zapsat; dvakrát parsuje |
| Parse v komponentě, repo jen `applyRestore(data)` | Repo tenké | Validace/summary logika uniká do UI, hůř se testuje |

### 3) Potvrzovací dialog (v `ui/` žádný není)

| Varianta | Pro | Proti |
|---|---|---|
| **Nová generická `ConfirmDialog` v `ui/` (Tailwind + `createPortal`, a11y)** (zvoleno) | Unese bohaté shrnutí (počty, velikost, datum), tmavý režim, fokus/Esc; primitivum použitelné i jinde | Nová komponenta (~50 ř.); fokus-management je „fiddly" |
| `window.confirm(text)` (jako `TrashScreen`) | Nula kódu | Neunese strukturované shrnutí, needitovatelný vzhled, nekonzistentní s tmavým režimem — spec vyžaduje shrnutí |
| Inline blok bez portálu v `BackupSection` | Bez portálu | Riziko ořezu `overflow`/`z-index` v kartě; a11y bych stejně psal ručně |

`createPortal` je z `react-dom` (žádná nová závislost, viz CLAUDE.md).

### 4) Kam s UI zálohy

| Varianta | Pro | Proti |
|---|---|---|
| **Vyčlenit `BackupSection.tsx` do `src/features/backup/`** (zvoleno) | Přibývá stav (preview, dialog, poslední záloha, stárnutí) — `SettingsScreen` zůstane tenká kompozice, jako `CollapsibleTags` v UC029 | Jeden nový soubor + přesun dnešní sekce |
| Nechat vše inline v `SettingsScreen` | Beze změny struktury | Sekce zálohy by ~zdvojnásobila obrazovku, míchá 4 stavy |

## Zvolené řešení

1. **Kompletní záloha.** `BackupData` rozšířit o `cookLogs` a `shoppingItems`; `collectBackupData` je
   sesbírá; `applyRestore` je zapíše (upsert) v jedné transakci **se správnými tabulkami**. Data
   fáze 2/3 (`logEntries`/`goals`/`weightEntries`) **zůstávají** ve formátu. `BACKUP_VERSION` → 2,
   `parseBackup` dál tolerantně čte v1 (chybějící tabulky = `[]`).
2. **Bezpečná obnova (merge/upsert, jako dnes).** Tok rozdělit: `prepareRestore` (parse + validace +
   shrnutí, **bez zápisu**) → dialog se shrnutím → na „Obnovit" `applyRestore` (konverze fotek + zápis).
   Zrušení = `applyRestore` se nezavolá → DB beze změny. Shrnutí počítá **čistá** funkce
   `summarizeBackup` nad `ParsedBackup` (testovatelné bez Dexie).
3. **„Naposledy zálohováno"** = malý helper `lib/backupStatus.ts` à la `theme.ts` (localStorage, ISO,
   try/catch). Nastaví ho **úspěšný EXPORT**, ne obnova. Řádek v „Víc" + jemná tečka, když je záloha
   starší než 30 dní. Prázdný stav „Zatím nezálohováno". Relativní čas počítá čistá funkce v `date.ts`.
4. **persist:** beze změny — jen dnešní zobrazení stavu v „Úložiště".

Proč takhle: veškerá testovatelná logika (rozšířený formát, shrnutí, relativní čas) je v **čisté
vrstvě** (`lib/`), kterou umí pokrýt dnešní node testy bez Dexie; DB a prohlížečové API (fotky, zápis,
localStorage) zůstávají v tenkých, ručně ověřovaných obalech, přesně jako dnes.

## Dopad na kód

### `src/lib/backup.ts` — čistá vrstva (jádro změny)

- `BACKUP_VERSION` `1` → `2`.
- Import typů `CookLog`, `ShoppingItem` z `../db`.
- `BackupData` rozšířit o dvě pole (aditivně):

```ts
export interface BackupData {
  foods: Food[];
  foodPortions: FoodPortion[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  recipeNotes: RecipeNote[];
  logEntries: LogEntry[];      // fáze 3 – dnes prázdné, dopředná kompatibilita
  goals: Goal[];               // fáze 2/3 – dtto
  weightEntries: WeightEntry[];// fáze 2/3 – dtto
  cookLogs: CookLog[];         // NOVĚ (§10 historie vaření)
  shoppingItems: ShoppingItem[]; // NOVĚ (nákupní seznam)
  photos: PhotoBackup[];
}
```

- **Parse vrací obálku** (varianta 1A). Nový typ + změna návratu:

```ts
export interface ParsedBackup {
  version: number;
  exportedAt: string | null;   // z obálky; null u ručně upraveného souboru bez pole
  data: BackupData;
}

export function parseBackup(json: string): ParsedBackup { /* … */ }
```

  Validace obálky (cizí `format` → „Tohle není záloha…", `version > BACKUP_VERSION` → „…novější
  verze…") a `asArray` fallback **beze změny logiky**, jen se přidají `cookLogs`/`shoppingItems` do
  `data` a `exportedAt` (typeof string ? : null) do výsledku.

- **Shrnutí = čistá funkce** (jádro „bezpečné obnovy"):

```ts
export interface BackupSummary {
  recipes: number;
  recipeItems: number;   // „suroviny / položky receptů"
  foods: number;         // potraviny (fáze 2) – v UI jen když > 0
  photos: number;
  cookLogs: number;      // záznamy vaření
  shoppingItems: number; // položky nákupu
  exportedAt: string | null;
}

export function summarizeBackup(parsed: ParsedBackup): BackupSummary { /* jen .length + exportedAt */ }
```

  (Velikost souboru do `BackupSummary` **nepatří** — je to vlastnost souboru, ne dat; doplní se až
  ve `RestorePreview`, viz níže.)

### `src/features/backup/dbBackup.ts` — DB obal (tenký, netestovaný jako dnes)

- `collectBackupData`: přidat `db.cookLogs.toArray()` a `db.shoppingItems.toArray()` do `Promise.all`
  a do vráceného objektu. `exportBackupJson` beze změny (jede přes `collectBackupData`).
- **Nahradit `importBackupJson` dvojicí** (dvoufázová obnova):

```ts
export interface RestorePreview {
  parsed: ParsedBackup;      // fotky drží jako dataUrl; blob až v applyRestore
  summary: BackupSummary;
  sizeBytes: number;         // velikost souboru pro shrnutí
}
export interface RestoreResult {
  recipes: number; photos: number; cookLogs: number; shoppingItems: number;
}

// FÁZE A – nezapisuje, jen parse + validace + shrnutí (může vyhodit chybu → žádný dialog)
export function prepareRestore(json: string, sizeBytes: number): RestorePreview {
  const parsed = parseBackup(json);           // validace obálky/verze zde
  return { parsed, summary: summarizeBackup(parsed), sizeBytes };
}

// FÁZE B – volá se AŽ po potvrzení; jediné místo se zápisem
export async function applyRestore(preview: RestorePreview): Promise<RestoreResult> {
  const { data } = preview.parsed;
  const photos = /* dataUrl → blob, jako dnes */;
  const tables = [ /* … dnešních 9 … */, db.cookLogs, db.shoppingItems ]; // POZOR: doplnit obě!
  await db.transaction('rw', tables, async () => {
    await Promise.all([
      /* … dnešních 9 bulkPut … */,
      db.cookLogs.bulkPut(data.cookLogs),
      db.shoppingItems.bulkPut(data.shoppingItems),
      db.recipePhotos.bulkPut(photos),
    ]);
  });
  return { recipes: data.recipes.length, photos: photos.length,
           cookLogs: data.cookLogs.length, shoppingItems: data.shoppingItems.length };
}
```

  Kritické: nové tabulky musí být **v poli `tables` i v `bulkPut`** — jinak Dexie transakci odmítne.
  Konverze fotek zůstává v `applyRestore` (těžký base64 → blob se dělá až po „Obnovit", ne při shrnutí).

### `src/lib/backupStatus.ts` — NOVÝ, per-zařízení stav (vzor `theme.ts`)

Vědomá výjimka z pravidla 6 (jako motiv): je to fakt o zařízení, ne obsah kuchařky, do zálohy nepatří.
Hlavička souboru to musí explicitně říct + odkaz na Rozhodnutí 2026-09-13.

```ts
export const LAST_BACKUP_KEY = 'kucharka-last-backup';
export function readLastBackupAt(): string | null { /* try/catch → null */ }
export function writeLastBackupAt(iso: string): void { /* try/catch, jinak no-op */ }
```

  Čte se v UI (sync, jako `readThemePref`), zapisuje se **jen po úspěšném exportu**. Prahová logika
  („starší než 30 dní") a formát „před X dny" jsou v `date.ts` (čisté, testovatelné) — tady jen I/O.

### `src/lib/date.ts` — přidat relativní čas (dnes neexistuje)

```ts
/** Celé kalendářní dny mezi `iso` a `now` v LOKÁLNÍM čase (ne UTC – E-07/pravidlo 8). */
export function daysSince(iso: string, now?: Date): number;
/** „dnes" | „včera" | „před N dny" z lokálního času. */
export function formatRelativeDays(iso: string, now?: Date): string;
```

  Výpočet přes `toLocalIsoDate` obou konců + rozdíl (aby DST neposunul den). Práh stárnutí zálohy je
  `daysSince(last) > 30`.

### `src/components/ui/ConfirmDialog.tsx` — NOVÝ minimální dialog

Generický shell (překrytí + a11y), obsah předává volající jako `children`. Žádná nová závislost
(`createPortal` z `react-dom`). Skica (ne produkční kód):

```tsx
interface ConfirmDialogProps {
  title: string;
  confirmLabel?: string;   // default „Potvrdit"
  cancelLabel?: string;    // default „Zrušit"
  confirmRole?: ButtonRole;// default „primary" (merge NIC nemaže → ne destructive)
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;     // tělo = shrnutí
}
// role="dialog" aria-modal="true" aria-labelledby={titleId}
// překrytí: fixed inset-0 bg-black/40; panel: cardClass, max-w-sm, dark: OK
// a11y: Esc → onCancel; klik na pozadí → onCancel; fokus na „Zrušit" po otevření
//       (bezpečná volba); vrácení fokusu na spouštěč po zavření
// motion-reduce: bez animace (konvence appky)
```

Pozn.: `window.confirm` v `TrashScreen` vědomě **nenahrazuju** (mimo rozsah), ale `ConfirmDialog` je
navržený tak, aby to šlo později.

### `src/features/backup/BackupSection.tsx` — NOVÝ (přesun + rozšíření UI)

Vezme dnešní sekci „Záloha dat" ze `SettingsScreen` a přidá tři věci:

- **Export**: `handleExport` po `downloadTextFile` zavolá `writeLastBackupAt(new Date().toISOString())`
  a aktualizuje stav „naposledy zálohováno".
- **Obnova (dvoufázová)**: výběr souboru → `text = await file.text()` → `prepareRestore(text, file.size)`
  v `try/catch`. Úspěch → `setPreview(preview)` (zobrazí `ConfirmDialog`). Chyba → zpráva, žádný dialog,
  žádný zápis. „Obnovit" v dialogu → `await applyRestore(preview)` → zpráva „Obnoveno: X receptů,
  Y fotek, …" → `setPreview(null)`. „Zrušit"/Esc → `setPreview(null)` (DB beze změny).
- **Řádek „naposledy zálohováno"**: `readLastBackupAt()` → `formatRelativeDays`; prázdné → „Zatím
  nezálohováno"; `daysSince > 30` → jemná amber tečka (`h-2 w-2 rounded-full bg-amber-500`) vedle textu.

Shrnutí v těle dialogu (dl s počty, velikost přes lokální `formatFileSize`, datum přes `formatCzechDate`
z `exportedAt`; když `exportedAt == null` → „datum neznámé"). Řádek „foods" jen když `> 0`.

### `src/features/settings/SettingsScreen.tsx`

- Sekci „Záloha dat" (ř. 75–101) nahradit `<BackupSection />`. Odstranit tím uvolněné importy
  (`exportBackupJson`/`importBackupJson`, `downloadTextFile`, `todayIso`, `fileRef`, `handleExport`,
  `handleImportFile`, část `message`). Zbytek („Vzhled", „Úložiště" s persist/usage, odkazy, „O aplikaci")
  **beze změny**.

### `src/lib/backup.test.ts` + `src/lib/date.test.ts` — rozšířit (viz Testy)

## Změny datového modelu

- **Formát zálohy (`BackupData`)**: aditivně `+cookLogs: CookLog[]`, `+shoppingItems: ShoppingItem[]`.
  `BACKUP_VERSION` `1 → 2`.
- **Dexie schéma: BEZ ZMĚNY.** Tabulky `cookLogs` (v5) i `shoppingItems` (v6) už v `db/index.ts`
  existují. **Žádný `version()` bump, žádná migrace.** Mění se jen KTERÉ tabulky záloha sbírá/zapisuje.
- **Kompatibilita v1 → v2**: `parseBackup` doplní chybějící `cookLogs`/`shoppingItems` jako `[]`
  (dnešní `asArray` chování). v1 soubor (`version:1 ≤ 2`) projde. Naopak v2 soubor **starší build**
  (verze 1) odmítne jako „novější verzi" — očekávaný signál dopředné nekompatibility.
- **localStorage klíč** `kucharka-last-backup` (ISO string) — per zařízení, nesynchronizuje se, do
  zálohy nepatří.

## Plán implementace

Pořadí tak, aby po každém kroku šla appka spustit (`npm run dev`) a `npm run lint` prošel.

1. **`lib/backup.ts`** — bump verze, rozšířit `BackupData`, `parseBackup` → `ParsedBackup`,
   `summarizeBackup`. Upravit `backup.test.ts` na nový tvar návratu.
   *Hotovo, když:* `npm run test` u backup + date je zelený (viz Testy), `tsc --noEmit` prochází.
2. **`lib/date.ts`** — `daysSince`, `formatRelativeDays` + testy.
   *Hotovo, když:* testy relativního času zelené (dnes/včera/před N dny/práh 30).
3. **`features/backup/dbBackup.ts`** — `collectBackupData` +2 tabulky; nahradit `importBackupJson`
   za `prepareRestore` + `applyRestore` (obě nové tabulky v `tables` i `bulkPut`).
   *Hotovo, když:* `tsc --noEmit` prochází; export/obnova z UI (dočasně napojená) proběhne.
4. **`lib/backupStatus.ts`** — read/write dle vzoru `theme.ts` (try/catch, hlavička s výjimkou pr. 6).
   *Hotovo, když:* `tsc` prochází; ruční zápis/čtení v prohlížeči funguje, v soukromém režimu nespadne.
5. **`components/ui/ConfirmDialog.tsx`** — generický dialog (portal, a11y, tmavý režim).
   *Hotovo, když:* Esc/klik na pozadí/„Zrušit" volají `onCancel`; fokus na „Zrušit" po otevření;
   čitelný v tmavém režimu.
6. **`features/backup/BackupSection.tsx`** — složit export (+`writeLastBackupAt`), dvoufázovou obnovu
   s dialogem, řádek „naposledy zálohováno" + tečka > 30 dní.
   *Hotovo, když:* výběr platné zálohy ukáže shrnutí PŘED zápisem; „Zrušit" nezapíše; „Obnovit" zapíše
   a ukáže co; poškozený soubor → chyba bez dialogu; po exportu se řádek přepne na „dnes".
7. **`features/settings/SettingsScreen.tsx`** — nahradit sekci za `<BackupSection />`, uklidit importy.
   *Hotovo, když:* „Víc" vypadá jako dřív + řádek „naposledy zálohováno"; ostatní sekce beze změny.
8. **Ověření** — `npm run lint` + `npm run test` + `npm run build`; ruční průchod (viz Rizika/QA).

## Testy

Prostředí je `node` bez fake-indexeddb (viz `vitest.config.ts`) → testuje se **čistá vrstva**; DB
a prohlížečové API (fotky blob⇄dataUrl, zápis, localStorage) se ověřují ručně, jako dnes.

**`src/lib/backup.test.ts` (rozšířit):**
- `emptyData()` doplnit o `cookLogs: []`, `shoppingItems: []`.
- Round-trip: vzorek `cookLogs` + `shoppingItems` → `serializeBackup` → `parseBackup` → počty i obsah
  sedí (AC „round-trip beze ztráty" na úrovni formátu).
- v1 → v2 kompatibilita: `{format, version:1, data:{}}` → `parseBackup` nevyhodí a `cookLogs`/
  `shoppingItems` jsou `[]`.
- Obálka: `parseBackup(serializeBackup(data, date)).exportedAt` == ISO; `version` == 2.
- Zachovat: cizí `format` / novější verze / nevalidní JSON → `toThrow` (upravit na nový návratový tvar).

**`src/lib/backup.test.ts` — `summarizeBackup`:**
- Počty (recipes/recipeItems/foods/photos/cookLogs/shoppingItems) odpovídají vstupu; prázdná data → 0.
- `exportedAt` se propíše; chybějící → `null`.

**`src/lib/date.test.ts` (rozšířit):**
- `formatRelativeDays`: 0 → „dnes", 1 → „včera", 2 → „před 2 dny", 40 → „před 40 dny"; večerní hrana
  (lokální složky, ne UTC).
- `daysSince`: práh 30 (30 = ne-staré, 31 = staré).

**Ručně (prohlížeč, mimo unit testy):** fotky data URL ⇄ blob round-trip; „Zrušit" nezapíše (DB
bitově stejná); „Obnovit" zapíše počty dle shrnutí; poškozený/prázdný soubor → chyba bez dialogu;
tmavý režim dialogu; export přepne „naposledy zálohováno" na „dnes". Integrační round-trip přes Dexie
by chtěl `fake-indexeddb` (nová dev-závislost → schválení, mimo tuhle dávku).

## Rizika a co může selhat

- **Zapomenutá tabulka v transakci.** `applyRestore` musí mít `cookLogs`+`shoppingItems` v `tables`
  **i** `bulkPut`; jinak Dexie shodí celou obnovu. Ošetřeno v plánu, ověřit ručně.
- **Vzkříšení tvrdě smazaných (pravidlo 7).** `cookLogs` i `shoppingItems` se dnes mažou natvrdo
  (`.delete`/`.bulkDelete`/`.clear`, bez `deletedAt`). Merge/upsert staré zálohy je proto **vzkřísí**.
  Je to přijaté (Rozhodnutí #3: jen merge) a shrnutí před zápisem to napovídá; dialog to řekne větou
  „Doplní a přepíše záznamy se stejným id, nic nesmaže." **Skutečná náprava = soft-delete i pro tyto
  tabulky (bump schématu, širší zásah) — vědomě mimo rozsah.**
- **Změna návratového typu `parseBackup`.** Láme 1 volajícího + test. Blast radius ověřen (grep):
  jen `dbBackup.ts` a `backup.test.ts`. Nízké riziko, ale musí se upravit obojí naráz.
- **Velká záloha (hodně fotek).** Base64 nafoukne soubor; shrnutí (jen `.length`) je levné, těžká
  konverze je až po „Obnovit". `file.text()` a držení `parsed` v paměti u velmi velkých záloh může
  špičkovat paměť — akceptovatelné pro fázi 1, případný limit je mimo rozsah (spec).
- **`BACKUP_VERSION` → 2 a dopředná kompatibilita.** v2 soubor neotevře starší build (jednouživatelská
  appka — po nasazení updatu neproblém, ale stojí za zmínku).
- **Fokus/scroll v dialogu na mobilu.** Ruční a11y (portal, fokus, Esc) je nejnáchylnější místo;
  ověřit klávesnici i dotyk, `motion-reduce`.

## Místa, kde jsem rozhodoval (a nebyl si 100% jistý)

- **„Suroviny/položek" ve shrnutí = `recipeItems`** (položky receptů), plus „Potraviny" (`foods`) jen
  když `> 0`. Spec píše „surovin/položek" nejednoznačně; tohle je pro obnovu kuchařky nejčtenější.
  Copy k potvrzení.
- **Vyčlenění `BackupSection.tsx`** místo inline v `SettingsScreen` (viz varianta 4) — přidané logiky
  je dost; kdyby uživatel chtěl minimalizovat počet souborů, jde nechat inline.
- **Fokus po otevření dialogu na „Zrušit"** (bezpečná, nedestruktivní volba), ne na „Obnovit".

## Co tento návrh vědomě neřeší

- **„Nahradit vše"** (replace) — Rozhodnutí #3: jen merge.
- **Soft-delete pro `cookLogs`/`shoppingItems`** (pravé řešení vzkříšení) — samostatný, širší úkol
  (bump schématu).
- **Zálohování `cookSessions`/`timers`** — efemérní stav (Rozhodnutí #2).
- **Vypuštění `logEntries`/`goals`/`weightEntries`** z formátu — zůstávají (Rozhodnutí #1, otázka 4).
- **Tlačítko „Zapnout trvalé úložiště"** ani nová vysvětlení persist — jen dnešní zobrazení (Rozh. #7).
- **Náhrada `window.confirm` v `TrashScreen`** za `ConfirmDialog` — mimo rozsah (dialog je připravený).
- **Tečka/odznak na tabu „Víc"** — stárnutí se ukazuje jen řádkem v sekci (Rozh. #6: žádný banner).
- **Ověření obnovitelnosti (SPEC 7.8)** — mimo dávku (otázka 9); shrnutí ho částečně supluje.
- **Integrační testy přes Dexie** — vyžadovaly by `fake-indexeddb` (nová závislost, schválení).
