import { db, type RecipePhoto } from '../../db';
import { parseBackup, serializeBackup, type BackupData, type PhotoBackup } from '../../lib/backup';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** Sesbírá všechny tabulky do jednoho objektu (kompletní záloha včetně fotek). */
async function collectBackupData(): Promise<BackupData> {
  const [foods, foodPortions, recipes, recipeItems, recipeNotes, logEntries, goals, weightEntries, rawPhotos] =
    await Promise.all([
      db.foods.toArray(),
      db.foodPortions.toArray(),
      db.recipes.toArray(),
      db.recipeItems.toArray(),
      db.recipeNotes.toArray(),
      db.logEntries.toArray(),
      db.goals.toArray(),
      db.weightEntries.toArray(),
      db.recipePhotos.toArray(),
    ]);
  const photos: PhotoBackup[] = await Promise.all(
    rawPhotos.map(async (photo) => ({
      id: photo.id,
      recipeId: photo.recipeId,
      dataUrl: await blobToDataUrl(photo.blob),
      createdAt: photo.createdAt,
    })),
  );
  return {
    foods,
    foodPortions,
    recipes,
    recipeItems,
    recipeNotes,
    logEntries,
    goals,
    weightEntries,
    photos,
  };
}

export async function exportBackupJson(): Promise<string> {
  return serializeBackup(await collectBackupData());
}

/**
 * Obnova ze zálohy. Zapisuje přes `bulkPut` (upsert podle id), takže obnova
 * nikdy nezahodí novější lokální data – jen doplní/přepíše podle id.
 */
export async function importBackupJson(json: string): Promise<{ recipes: number }> {
  const data = parseBackup(json);
  const photos: RecipePhoto[] = await Promise.all(
    data.photos.map(async (photo) => ({
      id: photo.id,
      recipeId: photo.recipeId,
      blob: await dataUrlToBlob(photo.dataUrl),
      createdAt: photo.createdAt,
    })),
  );

  const tables = [
    db.foods,
    db.foodPortions,
    db.recipes,
    db.recipeItems,
    db.recipeNotes,
    db.logEntries,
    db.goals,
    db.weightEntries,
    db.recipePhotos,
  ];
  await db.transaction('rw', tables, async () => {
    await Promise.all([
      db.foods.bulkPut(data.foods),
      db.foodPortions.bulkPut(data.foodPortions),
      db.recipes.bulkPut(data.recipes),
      db.recipeItems.bulkPut(data.recipeItems),
      db.recipeNotes.bulkPut(data.recipeNotes),
      db.logEntries.bulkPut(data.logEntries),
      db.goals.bulkPut(data.goals),
      db.weightEntries.bulkPut(data.weightEntries),
      db.recipePhotos.bulkPut(photos),
    ]);
  });
  return { recipes: data.recipes.length };
}
