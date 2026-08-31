import { db, type RecipeNote } from '../../db';
import { newId } from '../../lib/id';
import { todayIso } from '../../lib/date';

/**
 * Trvalé poznámky k receptu (UC020, tabulka `recipe_notes`). Na rozdíl od poznámky
 * u konkrétního vaření (historie) se váží k receptu samotnému a přežívají napříč
 * vařeními. Volný text s datem; víc poznámek na recept.
 */

export function getRecipeNotes(recipeId: string): Promise<RecipeNote[]> {
  return db.recipeNotes.where('recipeId').equals(recipeId).sortBy('notedOn');
}

export async function addRecipeNote(recipeId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  await db.recipeNotes.add({ id: newId(), recipeId, notedOn: todayIso(), body: text });
}

export async function deleteRecipeNote(id: string): Promise<void> {
  await db.recipeNotes.delete(id);
}

/** Vrátit zpět smazání – vrátí přesně tu samou poznámku. */
export async function restoreRecipeNote(note: RecipeNote): Promise<void> {
  await db.recipeNotes.put(note);
}
