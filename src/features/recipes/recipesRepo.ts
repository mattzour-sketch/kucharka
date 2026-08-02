import { db, type Recipe } from '../../db';
import { newId } from '../../lib/id';
import { todayIso } from '../../lib/date';

/**
 * Zápisy do receptů. Jediné povinné pole je `name` (i prázdný řetězec projde –
 * koncept se ukládá průběžně, název se doplní až při uložení). `rawCapture` je
 * původní zachycený text; automaticky se nikdy nepřepisuje (E-17).
 */

export interface RecipeDraft {
  name: string;
  source?: string | null;
  capturedOn?: string;
  rawCapture?: string | null;
}

export async function createRecipe(draft: RecipeDraft): Promise<string> {
  const now = new Date().toISOString();
  const recipe: Recipe = {
    id: newId(),
    name: draft.name,
    source: draft.source ?? null,
    capturedOn: draft.capturedOn || todayIso(),
    rawCapture: draft.rawCapture ?? null,
    tags: [],
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.recipes.add(recipe);
  return recipe.id;
}

export async function updateRecipe(
  id: string,
  patch: Partial<Omit<Recipe, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.recipes.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

/** Nikdy nemažeme natvrdo – jen `deletedAt` (soft delete, E-08). */
export async function softDeleteRecipe(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.recipes.update(id, { deletedAt: now, updatedAt: now });
}
