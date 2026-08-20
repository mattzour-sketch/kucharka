import { db, type CookSession, type CookReplacement } from '../../db';

/**
 * Sezení vaření (§6, §8): odškrtnuté suroviny + odchylky (vypnuté / změněné
 * množství / náhrady). Přežije odchod z appky; jedno sezení na recept.
 */

export interface CookSessionState {
  checkedItemIds: string[];
  offItemIds: string[];
  amountOverrides: Record<string, string>;
  replacements?: Record<string, CookReplacement>;
  doneStepIndices?: number[];
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
    replacements: state.replacements ?? {},
    doneStepIndices: state.doneStepIndices ?? [],
    updatedAt: new Date().toISOString(),
  });
}

export async function clearCookSession(recipeId: string): Promise<void> {
  await db.cookSessions.delete(recipeId);
}
