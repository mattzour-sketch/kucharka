import { db, type ImportDraft } from '../../db';
import { buildOriginalNote } from '../../lib/originalNote';
import { addRecipeNote } from './recipeNotesRepo';
import { createRecipeWithContent, updateRecipeMeta, type RecipeContent } from './recipesRepo';

/**
 * Rozdělaný náhled vložení receptu (UC031, tabulka `importDrafts`). Jediný řádek
 * `id: 'current'` – stav zařízení (jako rozdělané vaření), přežije zavření appky.
 */

const DRAFT_ID = 'current';

export function getImportDraft(): Promise<ImportDraft | undefined> {
  return db.importDrafts.get(DRAFT_ID);
}

export async function saveImportDraft(draft: Omit<ImportDraft, 'id' | 'updatedAt'>): Promise<void> {
  await db.importDrafts.put({ ...draft, id: DRAFT_ID, updatedAt: new Date().toISOString() });
}

/** Smazání konceptu – lokální stav zařízení (jako `cookSessions`), pravidlo 7 se netýká. */
export async function clearImportDraft(): Promise<void> {
  await db.importDrafts.delete(DRAFT_ID);
}

/**
 * Uloží vložený recept v jedné transakci: recept + suroviny, porce, poznámka s originálem
 * vloženého textu (Rozhodnutí 2) a smazání konceptu. Buď vše, nebo nic.
 * `clearDraft: false` = koncept nechat (obrazovka ho nedokázala načíst, nesmí ho tedy ani smazat).
 */
export async function saveImportedRecipe(input: {
  content: RecipeContent;
  servings: number | null;
  originalText: string;
  clearDraft: boolean;
}): Promise<string> {
  return db.transaction('rw', [db.recipes, db.recipeItems, db.recipeNotes, db.importDrafts], async () => {
    const id = await createRecipeWithContent(input.content);
    if (input.servings != null && input.servings > 0) {
      await updateRecipeMeta(id, { servings: input.servings });
    }
    if (input.originalText.trim() !== '') {
      await addRecipeNote(id, buildOriginalNote(input.originalText));
    }
    if (input.clearDraft) await clearImportDraft();
    return id;
  });
}
