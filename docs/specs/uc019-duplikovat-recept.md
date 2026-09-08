# UC019 — Duplikovat recept

Malá samostatná funkce z backlogu (`docs/specs/use-cases-navrhy.md`). Velikost 🟢, priorita
vysoká, návrh architekta: ne. Pravidla CLAUDE.md: 1 (surovina = volný text), 2 (`raw_text` se
nepřepisuje), 3 (uložit jen s názvem), 7 (soft delete).

**Jako** uživatel, který vaří varianty („guláš, ale ostrý"),
**chci** z receptu udělat samostatnou kopii,
**abych** nezačínal od nuly a jen upravil, co je jinak.

## Zjištěný stav v kódu
- `recipesRepo.ts` má `createRecipeWithContent` / `getRecipeItems`; recept = `recipes` + `recipeItems`.
- Historie vaření (`cookLogs`), poznámky (`recipeNotes`), fotky (`recipePhotos`) jsou samostatné
  tabulky klíčované `recipeId` — kopie je NEpřebírá.
- Detail (`RecipeDetailScreen.tsx`) má dole akce Sdílet / Smazat; edit je `/recept/:id/upravit`.

## Akceptační kritéria

- [ ] Given recept, When dám „Duplikovat", Then vznikne **nový samostatný** recept se stejnými
  surovinami, postupem i štítky a otevře se k úpravě (`/recept/<nový>/upravit`); originál se nezmění.
- [ ] Kopie přebírá napojení surovin (`foodId` / `subRecipeId` / `amountG` / `amountKs` / `isSkipped`
  / `note`) i pořadí; `raw_text` beze změny (pravidlo 2).
- [ ] Kopie **nepřebírá** historii vaření, poznámky, fotky ani oblíbenost (`isFavorite = false`);
  má odlišitelný název „<název> (kopie)".
- [ ] Úprava kopie nemění originál (samostatná id položek i receptu).

## Mimo rozsah
- Kopírování historie/poznámek/fotek. Hromadné duplikování. Přejmenování při kopii (jen „(kopie)").

## Řešení (návrh architekta přeskočen — přímočaré)
- `recipesRepo.ts`: čistá `buildRecipeCopy(recipe, items, now, genId)` (nové id receptu i položek,
  `name+" (kopie)"`, `isFavorite=false`, `capturedOn` = dnešek, reset `sortOrder`) + `duplicateRecipe(id)`
  (načte, zavolá čistou funkci, zapíše v transakci, vrátí nové id). Čistá funkce má test.
- `RecipeDetailScreen.tsx`: akce „Duplikovat recept" dole → `duplicateRecipe` → navigace na úpravu kopie.
