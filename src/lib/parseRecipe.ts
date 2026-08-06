import { foldDiacritics } from './search';

/**
 * Rozebrání vloženého textu na recept (§11). Primárně čte formát, který appka
 * sama vypisuje (sekce „Suroviny:" / „Postup:"), a jako záloha zvládne i běžně
 * nakopírovaný recept (heuristika – nedokonalé, ale vždy se ukáže náhled k úpravě).
 * Suroviny zůstávají volný text (řádky), na potraviny se nepárují.
 */

export interface ParsedRecipe {
  name: string;
  servings: number | null;
  ingredients: string[];
  instructions: string | null;
}

function norm(text: string): string {
  return foldDiacritics(text).toLowerCase().trim().replace(/:+$/, '');
}

function isIngredientMarker(line: string): boolean {
  return /^(suroviny|ingredience)$/.test(norm(line));
}

function isInstructionMarker(line: string): boolean {
  return /^(postup|priprava|instrukce|navod)$/.test(norm(line));
}

function isServingsLine(line: string): boolean {
  return norm(line).includes('porc') && /\d/.test(line);
}

function parseServings(lines: string[]): number | null {
  for (const line of lines) {
    if (isServingsLine(line)) {
      const match = line.match(/\d+/);
      if (match) return Number(match[0]);
    }
  }
  return null;
}

function stripBullet(line: string): string {
  return line.replace(/^\s*[-•*·—]\s*/, '').trim();
}

export function parseRecipeText(text: string): ParsedRecipe {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd());
  const firstNonEmpty = lines.find((line) => line.trim() !== '') ?? '';
  const name = firstNonEmpty.trim();
  const servings = parseServings(lines);

  const ingredientIdx = lines.findIndex(isIngredientMarker);
  const instructionIdx = lines.findIndex(isInstructionMarker);

  // 1) Podle značek (formát, který appka sama vypisuje)
  if (ingredientIdx !== -1) {
    const end = instructionIdx > ingredientIdx ? instructionIdx : lines.length;
    const ingredients = lines
      .slice(ingredientIdx + 1, end)
      .map(stripBullet)
      .filter((line) => line !== '' && !isServingsLine(line));
    const instructions =
      instructionIdx !== -1 ? lines.slice(instructionIdx + 1).join('\n').trim() || null : null;
    return { name, servings, ingredients, instructions };
  }

  // 2) Bez značek: po názvu odděl suroviny od postupu prázdným řádkem,
  //    nebo (bez prázdného řádku) podle odrážek.
  const body = lines.slice(lines.indexOf(firstNonEmpty) + 1).filter((line) => !isServingsLine(line));
  while (body.length > 0 && body[0].trim() === '') body.shift();

  const blankAt = body.findIndex((line) => line.trim() === '');
  let ingredientLines: string[];
  let instructionLines: string[];
  if (blankAt !== -1) {
    ingredientLines = body.slice(0, blankAt);
    instructionLines = body.slice(blankAt + 1);
  } else {
    const firstProse = body.findIndex((line) => !/^\s*[-•*·—]/.test(line));
    if (firstProse > 0) {
      ingredientLines = body.slice(0, firstProse);
      instructionLines = body.slice(firstProse);
    } else {
      ingredientLines = body;
      instructionLines = [];
    }
  }

  return {
    name,
    servings,
    ingredients: ingredientLines.map(stripBullet).filter((line) => line !== ''),
    instructions: instructionLines.join('\n').trim() || null,
  };
}
