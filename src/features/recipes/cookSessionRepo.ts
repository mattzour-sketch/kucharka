import { db, type CookSession } from '../../db';

/**
 * Sezení vaření (§6, §8): odškrtnuté suroviny + odchylky (vypnuté / změněné
 * množství). Přežije odchod z appky; jedno sezení na recept.
 */

export interface CookSessionState {
  checkedItemIds: string[];
  offItemIds: string[];
  amountOverrides: Record<string, string>;
}

export function getCookSession(recipeId: string): Promise<CookSession | undefined> {
  return db.cookSessions.get(recipeId);
}

export async function saveCookSession(recipeId: string, state: CookSessionState): Promise<void> {
  await db.cookSessions.put({
    recipeId,
    checkedItemIds: state.checkedItemIds,
    offItemIds: state.offItemIds,
    amountOverrides: state.amountOverrides,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearCookSession(recipeId: string): Promise<void> {
  await db.cookSessions.delete(recipeId);
}
