import { db, type CookLog, type CookLogIngredient } from '../../db';
import { newId } from '../../lib/id';
import { todayIso } from '../../lib/date';
import { saveCookSession } from './cookSessionRepo';
import { nutritionFromData, perPortionFromResult } from '../nutrition/recipeNutrition';

/** Historie vaření (§10). Snímek dokončeného vaření, ne odkaz na recept. */

export interface NewCookLog {
  recipeId: string;
  recipeName: string;
  portions: number;
  ingredients: CookLogIngredient[];
  note: string | null;
  offItemIds: string[];
  amountOverrides: Record<string, string>;
  perPortion?: { kcal: number; protein: number; carbs: number; fat: number } | null;
  nutrition?: { connected: number; countable: number } | null;
}

export async function addCookLog(data: NewCookLog): Promise<void> {
  await db.cookLogs.add({
    id: newId(),
    ...data,
    cookedOn: todayIso(),
    createdAt: new Date().toISOString(),
  });
}

/** Záznamy receptu, nejnovější první. */
export async function getCookLogs(recipeId: string): Promise<CookLog[]> {
  const logs = await db.cookLogs.where('recipeId').equals(recipeId).sortBy('createdAt');
  return logs.reverse();
}

export async function deleteCookLog(id: string): Promise<void> {
  await db.cookLogs.delete(id);
}

/**
 * Dopočítá kalorie u starších záznamů, které je nemají (`perPortion == null`),
 * podle toho, jak se vařilo (vynechané suroviny se odečtou přes `offItemIds`).
 * Počítá se z AKTUÁLNÍHO napojení surovin receptu – nejlepší možný odhad, když
 * záznam sám nutriční hodnoty nenese. Uloží se jen když se podaří spočítat; co
 * spočítat nejde (nenapojené suroviny), zůstane prázdné a zkusí se zas příště.
 * Vrací počet doplněných záznamů.
 */
export async function backfillMissingNutrition(): Promise<number> {
  const logs = await db.cookLogs.toArray();
  const missing = logs.filter((log) => log.perPortion == null);
  if (missing.length === 0) return 0;

  const [foods, recipes, items] = await Promise.all([
    db.foods.toArray(),
    db.recipes.toArray(),
    db.recipeItems.toArray(),
  ]);
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  let filled = 0;
  for (const log of missing) {
    const result = nutritionFromData(
      log.recipeId,
      { foods, recipes, items },
      { skipItemIds: log.offItemIds },
    );
    const perPortion = perPortionFromResult(result, recipeById.get(log.recipeId)?.servings);
    if (!perPortion) continue; // stále nespočitatelné → necháme prázdné
    await db.cookLogs.update(log.id, {
      perPortion,
      nutrition: {
        connected: result.completeness.connected,
        countable: result.completeness.countable,
      },
    });
    filled += 1;
  }
  return filled;
}

/** „Uvařit znovu takhle" – předvyplní sezení vaření odchylkami z daného záznamu. */
export async function replayCookLog(log: CookLog): Promise<void> {
  await saveCookSession(log.recipeId, {
    checkedItemIds: [],
    offItemIds: log.offItemIds,
    amountOverrides: log.amountOverrides,
  });
}
