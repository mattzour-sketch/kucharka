import { db, type CookLog, type CookLogIngredient } from '../../db';
import { newId } from '../../lib/id';
import { todayIso } from '../../lib/date';
import { saveCookSession } from './cookSessionRepo';

/** Historie vaření (§10). Snímek dokončeného vaření, ne odkaz na recept. */

export interface NewCookLog {
  recipeId: string;
  recipeName: string;
  portions: number;
  ingredients: CookLogIngredient[];
  note: string | null;
  offItemIds: string[];
  amountOverrides: Record<string, string>;
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

/** „Uvařit znovu takhle" – předvyplní sezení vaření odchylkami z daného záznamu. */
export async function replayCookLog(log: CookLog): Promise<void> {
  await saveCookSession(log.recipeId, {
    checkedItemIds: [],
    offItemIds: log.offItemIds,
    amountOverrides: log.amountOverrides,
  });
}
