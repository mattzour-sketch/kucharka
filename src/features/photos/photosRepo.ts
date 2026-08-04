import { db, type RecipePhoto } from '../../db';
import { newId } from '../../lib/id';

/** Fotky receptu jako bloby v IndexedDB (R-04, E-16). */

export async function addRecipePhoto(recipeId: string, blob: Blob): Promise<string> {
  const photo: RecipePhoto = {
    id: newId(),
    recipeId,
    blob,
    createdAt: new Date().toISOString(),
  };
  await db.recipePhotos.add(photo);
  return photo.id;
}

export function getRecipePhotos(recipeId: string): Promise<RecipePhoto[]> {
  return db.recipePhotos.where('recipeId').equals(recipeId).sortBy('createdAt');
}

/**
 * Fotky jsou lokální bloby (nesynchronizují se), takže je mažeme natvrdo –
 * soft delete tu nedává smysl a blob by jinak zbytečně zabíral místo.
 */
export async function deleteRecipePhoto(id: string): Promise<void> {
  await db.recipePhotos.delete(id);
}
