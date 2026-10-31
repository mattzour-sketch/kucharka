import type { CookLogIngredient } from '../db';

/**
 * Záznam vaření v historii na detailu: ukazují se jen odchylky od receptu (vynecháno,
 * nahrazeno, jiné množství). „Uvařit znovu takhle" má smysl jen tehdy, když se od
 * dnešního receptu něčím liší – odchylkami, nebo počtem porcí. Čistá logika.
 */
export interface CookLogView {
  deviations: CookLogIngredient[];
  canReplay: boolean;
}

export function cookLogView(
  ingredients: readonly CookLogIngredient[],
  portions: number,
  recipeServings: number | null | undefined,
): CookLogView {
  const deviations = ingredients.filter(
    (ingredient) => ingredient.off || ingredient.changed || Boolean(ingredient.replacedWith),
  );
  // Vaření bez zadaných porcí počítá od 1 (stejně jako CookingModeScreen).
  const baseServings = recipeServings && recipeServings > 0 ? recipeServings : 1;
  return { deviations, canReplay: deviations.length > 0 || portions !== baseServings };
}
