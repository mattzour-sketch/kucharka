import { isIngredientHeading } from './ingredientSection';

/**
 * Práce s textem receptu při rozdělení na suroviny a postup (R-11).
 * Čistá logika, testovatelná bez UI i DB.
 */

/** Rozdělí text surovin na neprázdné řádky — jedna surovina = jeden řádek. */
export function splitIngredientLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Plnotextové znění receptu (suroviny + postup) jako zrcadlo pro náhled
 * v seznamu, export a sdílení. Vrací null, když není co spojit.
 */
export function combineRawCapture(ingredients: string, instructions: string): string | null {
  return [ingredients.trim(), instructions.trim()].filter(Boolean).join('\n\n') || null;
}

/**
 * Úryvek receptu pro kartu v seznamu: bez nadpisů sekcí surovin („# Sauce", UC023),
 * řádky spojené mezerou, zkrácený na `max` znaků.
 */
export function recipeSnippet(rawCapture: string | null | undefined, max = 120): string {
  if (!rawCapture) return '';
  const flat = rawCapture
    .split('\n')
    .filter((line) => !isIngredientHeading(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}
