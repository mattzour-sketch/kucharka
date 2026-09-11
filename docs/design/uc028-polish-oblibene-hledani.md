# Návrh: Polish – oblíbené na kartě + hledání do přehledu

Spec: `docs/specs/uc028-polish-oblibene-hledani.md` (sekce „Rozhodnutí" závazná).
Architekta psal parťák (agent padl na limit) na základě jeho průzkumu + must-fixů user-advocate.

## Věc 1 — hvězda „oblíbené" na kartě
- Draft v `RecipeCard.tsx` potvrzen (button = sourozenec `<Link>`, 36×36, `bg-black/45` blur,
  aria, ☆→★ amber, `setRecipeFavorite` nemění `updatedAt`). „★ " prefix už odebraný.
- **MUST-FIX (user-advocate): tichý mizící mis-tap ve filtru „Oblíbené".** Když je zapnutý filtr
  Oblíbené a odznačím hvězdu, karta hned a potichu zmizí. Řešení bez undo lišty: v `RecipeListScreen`
  držet `keepVisibleIds: Set<string>` — recept odznačený PŘI zapnutém filtru zůstane v `visible`
  (vykreslený **matně**, `opacity-50`), dokud filtr nepřepnu. Klik na hvězdu znovu = zpět oblíbený.
  `keepVisibleIds` se vyprázdní při přepnutí filtru Oblíbené. `RecipeCard` dostane volitelný
  `onToggleFavorite?(recipe)` callback (jinak fallback na `setRecipeFavorite`); dimming řídí `dimmed` prop.

## Věc 2 — hledání do přehledu, zrušit záložku „Hledat"
- `RecipeListScreen`: `query` state + hledací pole ve `ScreenHeader` `below` slotu (vzhled jako dnešní
  `SearchScreen`: kulaté pole, 🔍, **× na smazání**), **bez autofocus** (nechceme klávesnici při
  otevření appky). Filtr `visible` rozšířit o `matchesQuery(recipeHaystack(recipe), query)`
  (`src/lib/search.ts`) — fulltext (název + suroviny + postup + štítky) zůstává (UC018).
- **MUST-FIX (user-advocate): prázdný stav „kam zmizely recepty".** Když `query` neprázdné a nic
  nesedí → hláška **„Nic nenalezeno"** (ne „Nic neodpovídá filtru"); × v poli je úniková cesta zpět.
  Když je prázdno kvůli filtrům (bez query) → dnešní „Nic neodpovídá filtru".
- „🎲 Co dnes?" bere z `visible` → nově automaticky respektuje i napsaný text (zadarmo).
- Štítky zůstávají jako dnešní chipy v přehledu (single-tag). Multi-tag AND ze `SearchScreen` se
  vědomě neopakuje (drobná ztráta, uživatel ji nežádal).
- `TabLayout`: odebrat záložku **Hledat** (Recepty / Nákup / Potraviny / Víc = 4).
- `App.tsx`: odebrat route `/hledat` + import `SearchScreen`. **Smazat** `src/features/search/SearchScreen.tsx`
  (přehled ho plně nahradí; fallback `* → /` zabrání 404 na staré odkazy).

## Pořadí implementace
1. `RecipeCard.tsx`: `onToggleFavorite?` + `dimmed?` prop (draft hvězdy zůstává).
2. `RecipeListScreen.tsx`: query state + `below` hledací pole (× , bez autofocus) + `matchesQuery`
   do `visible`; `keepVisibleIds` (mis-tap) + dimming; rozlišení prázdného stavu (query vs filtr).
3. `TabLayout.tsx`: pryč záložka Hledat.
4. `App.tsx`: pryč route `/hledat` + import; smazat `SearchScreen.tsx`.
5. `npm run lint` + `npm run test` + build; ověřit naživo (hledání, hvězda, mis-tap, dark).

## Co se NEmění / rizika
- `recipeHaystack`/`matchesQuery` beze změny (fulltext neztratíme). Žádná nová závislost, žádná DB
  změna. Dark režim: hledací pole i dimming musí být čitelné (ověřit). Riziko: zapomenutý filtr +
  text tiše vyprázdní seznam → řeší rozlišený prázdný stav + × + viditelné chipy.
