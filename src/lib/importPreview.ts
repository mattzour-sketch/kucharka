import type { ParsedRecipe } from './parseRecipe';
import { isIngredientHeading } from './ingredientSection';
import { czechPlural } from './plural';
import { splitIngredientLines } from './recipeText';

/**
 * Editovatelný náhled na obrazovce „Vložit recept" (UC031). Hodnoty polí jsou texty
 * přesně tak, jak je uživatel vidí; na čísla se převádí až při uložení. Čistá logika.
 */
export interface ImportPreview {
  name: string;
  servings: string;
  prepMinutes: string;
  source: string;
  ingredients: string;
  instructions: string;
}

const PREVIEW_FIELDS: (keyof ImportPreview)[] = [
  'name',
  'servings',
  'prepMinutes',
  'source',
  'ingredients',
  'instructions',
];

export function previewFromParsed(parsed: ParsedRecipe): ImportPreview {
  return {
    name: parsed.name,
    servings: parsed.servings != null ? String(parsed.servings) : '',
    prepMinutes: parsed.prepMinutes != null ? String(parsed.prepMinutes) : '',
    source: parsed.source ?? '',
    ingredients: parsed.ingredients.join('\n'),
    instructions: parsed.instructions ?? '',
  };
}

/** Liší se náhled od stavu hned po posledním „Rozebrat"? → před přepsáním se zeptat. */
export function isPreviewEdited(current: ImportPreview, parsedAs: ImportPreview): boolean {
  return PREVIEW_FIELDS.some((field) => current[field] !== parsedAs[field]);
}

/** Náhradní název při prázdném poli: „Recept od @autor", když je zdroj; jinak „Vložený recept". */
export function fallbackImportName(source: string): string {
  const trimmed = source.trim();
  return trimmed ? `Recept od ${trimmed}` : 'Vložený recept';
}

const RAW_NAME_MAX_LENGTH = 80;

/**
 * Název pro „Uložit bez rozebrání" (UC031b): první řádek s písmenem, zkrácený na 80 znaků.
 * Text se jinak nijak neupravuje – celý jde do postupu, jak byl vložený.
 */
export function rawImportName(text: string): string {
  const line = text.split(/\r?\n/).find((candidate) => /\p{L}/u.test(candidate));
  const name = line?.trim().slice(0, RAW_NAME_MAX_LENGTH).trimEnd() ?? '';
  return name || fallbackImportName('');
}

/**
 * Souhrn náhledu „12 surovin (1 sekce) · 8 kroků". Nadpisy sekcí (UC023) se počítají
 * zvlášť, kroky stejně jako v režimu vaření (neprázdné řádky postupu).
 */
export function previewSummary(ingredients: string, instructions: string): string {
  const lines = splitIngredientLines(ingredients);
  const sections = lines.filter(isIngredientHeading).length;
  const items = lines.length - sections;
  const steps = instructions
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;

  const itemsText = `${items} ${czechPlural(items, ['surovina', 'suroviny', 'surovin'])}`;
  const sectionsText =
    sections > 0 ? ` (${sections} ${czechPlural(sections, ['sekce', 'sekce', 'sekcí'])})` : '';
  const stepsText = `${steps} ${czechPlural(steps, ['krok', 'kroky', 'kroků'])}`;
  return `${itemsText}${sectionsText} · ${stepsText}`;
}
