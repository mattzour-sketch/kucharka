# UC025 — Tmavý režim

Z backlogu (`docs/specs/use-cases-navrhy.md`). Velikost 🟡, priorita nižší, **návrh architekta: ANO**
(průřezový motiv + rozhodnutí, kam s předvolbou vs pravidlo 6). Spec psán ručně (BA agent přeskočen
kvůli limitům); otevřené otázky dole jdou architektovi + uživateli.

**Jako** uživatel, co večer vaří u sporáku,
**chci** přepnout appku do tmavého motivu,
**abych** mě bílá obrazovka neoslňovala do očí.

## Zjištěný stav v kódu (ověřeno)
- Motiv je dnes **natvrdo světlý**: Tailwind třídy `stone-*` (šedé), `brand`/`brand-dark`
  (amber-700 `#b45309`), `amber-*` (varování, oblíbené), `bg-white`, `text-red-*` — roztroušené
  po ~15 obrazovkách i ve sdílených `src/components/ui/` (Button, Card, ScreenHeader, IconButton,
  FilterChip, Segmented, EmptyState, Loading, cardClass…).
- `tailwind.config` nemá nastavené `darkMode`. `index.html` má `<meta name="theme-color" content="#b45309">`.
- **Předvolby appky se nikde neukládají** — není settings/preferences tabulka. Pravidlo 6 zakazuje
  `localStorage`/`sessionStorage` pro **data aplikace**; předvolba vzhledu je per-zařízení UI, ne
  data (nesynchronizuje se) — ale rozhodnutí, kam ji uložit, je citlivé (viz Otevřená otázka 2).
- Sdílené `ui/` komponenty centralizují velkou část barev — což nahrává tokenizaci (CSS proměnné).

## Akceptační kritéria
- [ ] Given systémová předvolba tmavá a uživatel nic nenastavil, When appku otevřu, Then je tmavá
  (výchozí = `prefers-color-scheme`).
- [ ] Given přepínač světlý/tmavý (příp. i „systém"), When zvolím tmavý, Then se appka přepne
  a volba **přežije znovuotevření**.
- [ ] Given načtení appky s uloženou tmavou volbou, Then se tmavý motiv aplikuje **bez bliknutí**
  světlého (žádný FOUC) — tj. synchronně před prvním vykreslením.
- [ ] Motiv je **konzistentní napříč všemi obrazovkami** i sdílenými `ui/` komponentami, včetně
  varovných stavů (amber „Orientační"), „bez kalorií", historie, prázdných stavů, overlayů (picker,
  fotka) a `theme-color` meta.
- [ ] Kontrast v tmavém režimu je čitelný (text/pozadí, brand akcenty); nic „nezmizí" na tmavém.

## Mimo rozsah
- Víc motivů než světlý/tmavý; ladění konkrétních odstínů „na přání". Automatické přepínání podle
  denní doby. Změna značkové barvy.

## Otevřené otázky (architekt + uživatel)
1. **Strategie motivu:** tokenizace přes **CSS proměnné** (`:root` světlé / `.dark` tmavé, Tailwind
   `theme.extend.colors` mapované na `var(--…)`) vs. rozsypané **Tailwind `dark:` varianty** po všech
   třídách. První je čistší a míň invazivní u sdílených `ui/` komponent, ale je to refaktor barev;
   druhé je mechanické, ale nabobtná každou třídu. Rozhodne architekt.
2. **Kam s předvolbou vs pravidlo 6:** `localStorage` (synchronní → bez FOUC, ale poruší literu
   pravidla 6) vs. Dexie (drží literu pravidla 6, ale async → hrozí FOUC, nutný fallback na
   `prefers-color-scheme` do načtení) vs. jen následovat systém bez uložení (nulová perzistence).
   **Pravidlo 6 je invariant — změnu je nutné navrhnout uživateli, ne rozhodnout sám.**
3. **Kolik stavů přepínače:** dva (světlý/tmavý) nebo tři (systém/světlý/tmavý)? Tři jsou
   přívětivější (default = systém), ale o krok víc UI.
