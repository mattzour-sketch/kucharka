import { isIngredientHeading } from './ingredientSection';
import { matchesQuery } from './search';

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

/** Číslo kroku na začátku řádku postupu („1. ", „2) ", „Krok 3: ") – ne „1.5 kg" ani „2 vejce". */
const STEP_NUMBER_RE = /^(?:(?:krok|step)\s*)?\d{1,2}\s*[.):]\s+/i;

/**
 * Kroky pro režim vaření: neprázdné řádky postupu bez vlastního čísla na začátku
 * (vaření čísluje samo; „1. Banány…" by vedle kolečka „1" bylo dvakrát). Jen zobrazení,
 * text receptu se nemění (pravidlo 2).
 */
export function cookingSteps(instructions: string | null | undefined): string[] {
  return (instructions ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(STEP_NUMBER_RE, '') || line);
}

const SNIPPET_SEPARATOR = ' · ';

/**
 * Úryvek receptu pro kartu v seznamu: bez nadpisů sekcí surovin („# Sauce", UC023),
 * řádky oddělené „ · ", zkrácený na `max` znaků. S dotazem hledání jdou napřed řádky,
 * ve kterých se něco našlo („3 stroužky česneku"), ať je vidět proč.
 */
export function recipeSnippet(rawCapture: string | null | undefined, max = 120, query = ''): string {
  if (!rawCapture) return '';
  const lines = rawCapture
    .split('\n')
    .filter((line) => !isIngredientHeading(line))
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const hits = tokens.length > 0 ? lines.filter((line) => tokens.some((token) => matchesQuery(line, token))) : [];
  const ordered = hits.length > 0 ? [...hits, ...lines.filter((line) => !hits.includes(line))] : lines;
  const flat = ordered.join(SNIPPET_SEPARATOR);
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}
