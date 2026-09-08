# UC023 — Sekce surovin (na těsto / na náplň)

Z backlogu (`docs/specs/use-cases-navrhy.md`). Velikost 🟡, priorita střední. Návrh architekta
byl flagován kvůli reprezentaci skupin — vyřešeno **bez zásahu do modelu** (viz níže).

**Jako** uživatel se složitějšími recepty,
**chci** rozdělit suroviny do pojmenovaných skupin,
**abych** je četl po částech a neztrácel se v jednom dlouhém seznamu.

## Rozhodnutí o reprezentaci (architekt)
Skupina = **konvence `# ` na začátku řádku surovin** (jako markdown nadpis): „# Na těsto".
- **Žádná změna modelu ani migrace** — nadpis je obyčejný `recipe_items` řádek, jehož `raw_text`
  je doslova „# Na těsto" (pravidlo 1 i 2 plně zachované; nic se nepřepisuje).
- **Aditivní, opt-in, nulová regrese** — existující recepty nemají řádky začínající `# `, takže se
  nic nezmění. Konvence je explicitní (ne fragilní autodetekce dvojtečky apod.).
- Nadpis se pozná čistou funkcí `isIngredientHeading` (`src/lib/ingredientSection.ts`), zobrazí se
  přes `ingredientHeadingLabel` (bez značky).

## Akceptační kritéria
- [ ] Given řádek surovin „# Na těsto", Then se na detailu i ve vaření zobrazí jako **nadpis sekce**
  (ne odškrtávací surovina, bez odrážky); suroviny pod ním patří do skupiny až do dalšího nadpisu.
- [ ] Given nadpis sekce, Then se **nezapočítává do kalorií ani do úplnosti** „X z Y" (není surovina,
  pravidlo 4) a **nejde do nákupního seznamu**.
- [ ] Given vaření, Then nadpis **není odškrtávatelný** a nepočítá se do progresu (Suroviny x/y).
- [ ] Given recept bez nadpisů, Then se vše chová jako dnes (žádná regrese).
- [ ] `raw_text` nadpisu zůstává „# Na těsto" (round-trip v editoru beze změny, pravidlo 2).

## Řešení (soubory)
- `src/lib/ingredientSection.ts` (+ test) — `isIngredientHeading`, `ingredientHeadingLabel`.
- `src/features/nutrition/recipeNutrition.ts` — nadpis se v `itemToCalc` bere jako přeskočený
  (mimo výpočet i úplnost).
- `src/features/recipes/RecipeDetailScreen.tsx` — render nadpisů jako sekcí; vynechání z nákupu.
- `src/features/recipes/CookingModeScreen.tsx` — nadpis jako nekontrolovatelný label, mimo progres.
- `src/features/recipes/RecipeEditScreen.tsx` — příklad „# Na těsto" v placeholderu (učí konvenci).

## Mimo rozsah
- Drag-and-drop řazení skupin, sbalování sekcí, barevné odlišení. Vnořené podsekce.
- Strukturovaný editor řádků (zachycení zůstává prostý textarea — rychlost, pravidlo 1).
