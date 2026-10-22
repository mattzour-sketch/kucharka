import { db, type RecipePhoto } from '../../db';
import { newId } from '../../lib/id';
import { PHOTO_MAX_BYTES } from '../../lib/photoSize';
import { shrinkPhoto } from './shrinkPhoto';

/** Fotky receptu jako bloby v IndexedDB (R-04, E-16). */

/** Fotka se před uložením zmenší, ať nenafukuje úložiště ani zálohu. */
export async function addRecipePhoto(recipeId: string, blob: Blob): Promise<string> {
  const photo: RecipePhoto = {
    id: newId(),
    recipeId,
    blob: await shrinkPhoto(blob),
    createdAt: new Date().toISOString(),
  };
  await db.recipePhotos.add(photo);
  return photo.id;
}

/**
 * Jednorázově zmenší fotky uložené dřív v plné velikosti (a fotky z obnovené
 * starší zálohy). Bere jen soubory nad limit a z nich jen ty s delší stranou nad
 * 1600 px, takže už zmenšenou fotku znovu nepřekóduje. Vrací počet zmenšených fotek.
 */
export async function shrinkStoredPhotos(): Promise<number> {
  const heavyIds = await db.recipePhotos
    .filter((photo) => photo.blob.size > PHOTO_MAX_BYTES)
    .primaryKeys();

  let shrunk = 0;
  // Po jedné – v paměti je vždy jen jedna velká fotka.
  for (const id of heavyIds) {
    const photo = await db.recipePhotos.get(id);
    if (!photo) continue;
    const blob = await shrinkPhoto(photo.blob, { recompressHeavy: false });
    if (blob === photo.blob) continue;
    await db.recipePhotos.update(id, { blob });
    shrunk += 1;
  }
  return shrunk;
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

/** Vrátit zpět smazání – uloží fotku i s blobem přesně tak, jak byla. */
export async function restoreRecipePhoto(photo: RecipePhoto): Promise<void> {
  await db.recipePhotos.put(photo);
}
