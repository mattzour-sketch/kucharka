import { db, type CookSession } from '../../db';

/** Rozdělané vaření (§6): odškrtnuté suroviny přežijí odchod z appky. */

export function getCookSession(recipeId: string): Promise<CookSession | undefined> {
  return db.cookSessions.get(recipeId);
}

export async function saveCookSession(recipeId: string, checkedItemIds: string[]): Promise<void> {
  await db.cookSessions.put({ recipeId, checkedItemIds, updatedAt: new Date().toISOString() });
}

export async function clearCookSession(recipeId: string): Promise<void> {
  await db.cookSessions.delete(recipeId);
}
