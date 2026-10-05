import { db, type RecipeNote } from '../../db';
import { newId } from '../../lib/id';
import { todayIso } from '../../lib/date';

/**
 * Trvalé poznámky k receptu (UC020, tabulka `recipe_notes`). Na rozdíl od poznámky
 * u konkrétního vaření (historie) se váží k receptu samotnému a přežívají napříč
 * vařeními. Volný text s datem; víc poznámek na recept.
 */

export async function getRecipeNotes(recipeId: string): Promise<RecipeNote[]> {
  const notes = await db.recipeNotes.where('recipeId').equals(recipeId).sortBy('notedOn');
  return notes.filter((note) => !note.deletedAt);
}

export async function addRecipeNote(recipeId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  await db.recipeNotes.add({ id: newId(), recipeId, notedOn: todayIso(), body: text });
}

/** Soft delete (pravidlo 7): smazaná poznámka se nevrátí ani po obnově starší zálohy. */
export async function deleteRecipeNote(id: string): Promise<void> {
  await db.recipeNotes.update(id, { deletedAt: new Date().toISOString() });
}

/** Vrátit zpět smazání – vrátí přesně tu samou poznámku (bez `deletedAt`). */
export async function restoreRecipeNote(note: RecipeNote): Promise<void> {
  await db.recipeNotes.put(note);
}
