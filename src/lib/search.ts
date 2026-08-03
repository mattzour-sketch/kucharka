/**
 * Fulltextové hledání (R-20). Hledá se lokálně, bez ohledu na diakritiku:
 * „cesnek" najde „česnek". Navíc lehké odseknutí koncové samohlásky, aby sedělo
 * české skloňování: „smetana" najde „smetanou" (SPEC, Příloha A). Čistá logika.
 */
import type { Recipe } from '../db';

/** Odstraní diakritiku přes Unicode NFD (č→c, ř→r, á→a, ů→u, …). */
export function foldDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizeForSearch(text: string): string {
  return foldDiacritics(text).toLowerCase();
}

/** Kmen slova: odsekne koncové samohlásky (skloňování), ale jen když něco zbyde. */
function stem(token: string): string {
  const stripped = token.replace(/[aeiouy]+$/, '');
  return stripped.length >= 3 ? stripped : token;
}

/**
 * Vrátí true, když haystack obsahuje všechny tokeny dotazu (AND, nezávisle na
 * pořadí a diakritice). Token projde jako podřetězec, nebo když nějaké slovo
 * začíná jeho kmenem. Prázdný dotaz odpovídá všemu.
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const normalized = normalizeForSearch(haystack);
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  return tokens.every((token) => {
    if (normalized.includes(token)) return true;
    const tokenStem = stem(token);
    return words.some((word) => word.startsWith(tokenStem));
  });
}

/** Prohledávaný text receptu: název, suroviny i postup (přes rawCapture) a štítky. */
export function recipeHaystack(
  recipe: Pick<Recipe, 'name' | 'rawCapture' | 'instructions' | 'tags'>,
): string {
  return [recipe.name, recipe.rawCapture ?? '', recipe.instructions ?? '', recipe.tags.join(' ')].join(
    ' ',
  );
}
