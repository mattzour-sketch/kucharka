/**
 * Recept jako čitelný text pro sdílení (§11). Formát je zároveň vstup parseru
 * (§11 vložení ze schránky) – co appka vypíše, to umí i přečíst. Musí zůstat
 * čitelné člověku, takže žádné značky navíc.
 */

export interface RecipeTextInput {
  name: string;
  /** Řádky surovin tak, jak jsou právě vidět (po případném přeškálování). */
  ingredients: string[];
  instructions: string | null;
  /** Počet porcí k vypsání; null = nevypisovat. */
  portions?: number | null;
  /** Původní počet porcí, když je recept přeškálovaný (jinak null). */
  scaledFrom?: number | null;
}

export function buildRecipeText(input: RecipeTextInput): string {
  const lines: string[] = [input.name.trim() || 'Bez názvu'];

  if (input.portions != null) {
    const scaled =
      input.scaledFrom != null && input.scaledFrom !== input.portions
        ? ` (přepočteno z ${input.scaledFrom})`
        : '';
    lines.push(`Porce: ${input.portions}${scaled}`);
  }

  const ingredients = input.ingredients.filter((line) => line.trim() !== '');
  if (ingredients.length > 0) {
    lines.push('', 'Suroviny:');
    for (const ingredient of ingredients) lines.push(`- ${ingredient}`);
  }

  if (input.instructions && input.instructions.trim() !== '') {
    lines.push('', 'Postup:', input.instructions.trim());
  }

  return lines.join('\n');
}
