# Osobní kuchařka

Osobní PWA na sbírku vlastních receptů, která umí i počítat kalorie — v tomhle
pořadí. Hlavní úloha: **zachytit diktovaný recept do 60 sekund, offline.**
Kalorie jsou nepovinná nadstavba na později.

Plná specifikace: [`docs/SPEC.md`](docs/SPEC.md). Pravidla projektu: [`CLAUDE.md`](CLAUDE.md).

> **Stav: Fáze 0 — nasaditelný základ.** Kostra, databázové schéma, nutriční
> výpočetní modul s testy a instalovatelná prázdná PWA. Zachycení receptů,
> hledání a deník přijdou v dalších fázích (SPEC, sekce 9).

## Stack

TypeScript (strict) · React 18 · Vite · Tailwind CSS · Dexie.js (IndexedDB) ·
Supabase (Postgres + Auth) · vite-plugin-pwa · Vitest

## Požadavky

- Node.js 20+ (vyvíjeno na 22)
- npm

## Instalace

```bash
npm install
cp .env.example .env   # doplň hodnoty ze Supabase
```

## Vývoj

```bash
npm run dev       # vývojový server na http://localhost:5173
npm run build     # tsc --noEmit + produkční build do dist/
npm run preview   # náhled produkčního buildu
npm run test      # Vitest (jednorázově)
npm run lint      # ESLint + tsc --noEmit
npm run format    # Prettier
```

## Struktura

```
docs/SPEC.md                 plná specifikace
supabase/migrations/         verzované SQL migrace (0001_init.sql)
src/
  db/index.ts                Dexie schéma (zrcadlí tabulky ze SPEC 7.4)
  lib/nutrition.ts           výpočty úplnosti, hodnot a zápisu do deníku
  lib/nutrition.test.ts      testy výpočtů (SPEC 7.5, případy a–h)
  features/recipes/          obrazovky receptů
public/icons/                ikony PWA (placeholdery 192 a 512 px)
```

## Databáze (Supabase)

Schéma je ve `supabase/migrations/`. Migrace se verzují v repozitáři, neklikají
se ručně v konzoli (CLAUDE.md).

```bash
# jednorázově
npm i -g supabase
supabase login
supabase link --project-ref <ref-tvého-projektu>

# nasazení migrace
supabase db push
```

RLS je zapnutá na všech tabulkách; v klientovi smí být **jen anon klíč**.

## Nasazení na Cloudflare Pages

1. Nahraj repozitář na GitHub/GitLab.
2. Cloudflare Pages → **Create a project** → připoj repozitář.
3. Build nastavení:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 nebo vyšší (proměnná `NODE_VERSION`)
4. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
5. Deploy. HTTPS je automaticky — bez něj nefunguje instalace PWA ani kamera.

Po nasazení otevři web na telefonu a přes menu prohlížeče zvol **Přidat na
plochu**. Aplikace se otevře na celou obrazovku bez adresního řádku a naběhne
i offline.

## Proměnné prostředí

| Proměnná                 | K čemu                                  |
| ------------------------ | --------------------------------------- |
| `VITE_SUPABASE_URL`      | URL Supabase projektu                   |
| `VITE_SUPABASE_ANON_KEY` | veřejný anon klíč (nikdy service_role!) |
