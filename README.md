# Osobní kuchařka

Osobní PWA na sbírku vlastních receptů, která umí i počítat kalorie — v tomhle
pořadí. Hlavní úloha: **zachytit diktovaný recept do 60 sekund, offline.**
Kalorie jsou nepovinná nadstavba na později.

Plná specifikace: [`docs/SPEC.md`](docs/SPEC.md). Pravidla projektu: [`CLAUDE.md`](CLAUDE.md).

> **Varianta bez serveru.** Data žijí lokálně v prohlížeči (IndexedDB přes Dexie),
> žádný účet, žádná synchronizace. Zálohou i přenosem na jiné zařízení je
> **export/import JSON** (obrazovka „Víc"). Server se dá kdykoli později dolepit —
> datový model i migrace `supabase/migrations/0001_init.sql` na to jsou připravené,
> zatím jsou nečinné.

## Stav

- **Fáze 0** — kostra, schéma, nutriční modul s testy, instalovatelná PWA. ✅
- **Fáze 1 (session 1)** — zachycení receptu, seznam, detail, editace, průběžné
  ukládání konceptu, export/import zálohy, trvalé úložiště. ✅
- Další: hledání a režim vaření (session 2), pak nutriční nadstavba (Fáze 2).

## Stack

TypeScript (strict) · React 18 · Vite · React Router · Tailwind CSS ·
Dexie.js (IndexedDB) · dexie-react-hooks · vite-plugin-pwa · Vitest

## Požadavky

- Node.js 20+ (vyvíjeno na 22) a npm

## Příkazy

```bash
npm install
npm run dev       # vývojový server na http://localhost:5173
npm run build     # tsc --noEmit + produkční build do dist/
npm run preview   # náhled produkčního buildu
npm run test      # Vitest
npm run lint      # ESLint + tsc --noEmit
npm run format    # Prettier
```

## Struktura

```
docs/SPEC.md                 plná specifikace
supabase/migrations/         verzované SQL migrace (nečinné, pro budoucí server)
src/
  db/index.ts                Dexie schéma (zrcadlí tabulky ze SPEC 7.4)
  lib/
    nutrition.ts             výpočty úplnosti, hodnot a zápisu do deníku
    date.ts                  lokální datum (E-07), český formát
    backup.ts                serializace/parsování zálohy (export/import)
    storage.ts               žádost o trvalé úložiště
  features/
    recipes/                 zachycení, seznam, detail, editace
    backup/                  export/import nad Dexie
    settings/                obrazovka „Víc"
public/icons/                ikony PWA (placeholdery 192 a 512 px)
public/_redirects            SPA fallback pro Cloudflare Pages
```

## Záloha dat

Data jsou jen v prohlížeči. Na obrazovce **Víc**:

- **Exportovat do souboru** stáhne `kucharka-RRRR-MM-DD.json` se všemi recepty.
  Ulož si ho na Disk/Dropbox — to je tvoje záloha.
- **Obnovit ze zálohy** načte takový soubor zpátky (upsert podle id, novější
  lokální data nezahodí).

Aplikace si navíc při startu řekne o trvalé úložiště, ať prohlížeč data nemaže.

## Nasazení na Cloudflare Pages

1. Nahraj repozitář na GitHub/GitLab.
2. Cloudflare Pages → **Create a project** → připoj repozitář.
3. Build nastavení:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** proměnná `NODE_VERSION` = `20` (nebo vyšší)
4. Deploy. HTTPS je automaticky — bez něj nefunguje instalace PWA.

Žádné proměnné prostředí nejsou potřeba (běží bez serveru). Soubor
`public/_redirects` zajistí, že fungují i přímé odkazy na podstránky.

Po nasazení otevři web na telefonu a přes menu prohlížeče zvol **Přidat na
plochu**. Aplikace se otevře na celou obrazovku bez adresního řádku a naběhne
i offline.
