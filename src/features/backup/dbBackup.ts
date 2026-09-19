import { db, type RecipePhoto } from '../../db';
import {
  computeRestoreImpact,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  type BackupData,
  type BackupSummary,
  type ParsedBackup,
  type PhotoBackup,
  type RestoreImpact,
} from '../../lib/backup';
import { writeLastBackupAt } from '../../lib/backupStatus';

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

/** Sesbírá VŠECHNY uživatelské tabulky do jednoho objektu (kompletní záloha včetně fotek). */
async function collectBackupData(): Promise<BackupData> {
  const [
    foods,
    foodPortions,
    recipes,
    recipeItems,
    recipeNotes,
    logEntries,
    goals,
    weightEntries,
    cookLogs,
    shoppingItems,
    rawPhotos,
  ] = await Promise.all([
    db.foods.toArray(),
    db.foodPortions.toArray(),
    db.recipes.toArray(),
    db.recipeItems.toArray(),
    db.recipeNotes.toArray(),
    db.logEntries.toArray(),
    db.goals.toArray(),
    db.weightEntries.toArray(),
    db.cookLogs.toArray(),
    db.shoppingItems.toArray(),
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
    cookLogs,
    shoppingItems,
    photos,
  };
}

/** Vyexportuje zálohu do JSON a zapíše „naposledy zálohováno" = teď. */
export async function exportBackupJson(): Promise<string> {
  const now = new Date();
  const json = serializeBackup(await collectBackupData(), now);
  writeLastBackupAt(now.toISOString());
  return json;
}

/** Náhled obnovy: obsah zálohy + dopad na aktuální data. Žádný zápis. */
export interface RestorePreview {
  parsed: ParsedBackup;
  summary: BackupSummary;
  impact: RestoreImpact;
  fileSize: number;
}

/**
 * 1. fáze obnovy: rozparsuje a ověří soubor (vyhodí čitelnou chybu), načte aktuální
 * DB a spočítá dopad (kolik receptů přibude / přepíše / mám novější, kolik smazaných
 * položek vaření a nákupu se vrátí). NIC nezapisuje – zápis až `applyRestore`.
 */
export async function prepareRestore(json: string, fileSize: number): Promise<RestorePreview> {
  const parsed = parseBackup(json);
  const [recipes, cookLogs, shoppingItems] = await Promise.all([
    db.recipes.toArray(),
    db.cookLogs.toArray(),
    db.shoppingItems.toArray(),
  ]);
  const impact = computeRestoreImpact(parsed.data, {
    recipes: recipes.map((recipe) => ({ id: recipe.id, updatedAt: recipe.updatedAt })),
    cookLogs: cookLogs.map((log) => ({ id: log.id })),
    shoppingItems: shoppingItems.map((item) => ({ id: item.id })),
  });
  return { parsed, summary: summarizeBackup(parsed), impact, fileSize };
}

/**
 * 2. fáze obnovy: zapíše data (merge/upsert podle id – nikdy nemaže). Volá se až po
 * potvrzení náhledu uživatelem. „Naposledy zálohováno" se nastaví na `exportedAt`
 * zálohy (data jsou ke dni té zálohy), ne na teď.
 */
export async function applyRestore(preview: RestorePreview): Promise<{ recipes: number }> {
  const { data, exportedAt } = preview.parsed;
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
    db.cookLogs,
    db.shoppingItems,
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
      db.cookLogs.bulkPut(data.cookLogs),
      db.shoppingItems.bulkPut(data.shoppingItems),
      db.recipePhotos.bulkPut(photos),
    ]);
  });

  // Obnova ≠ záloha: nastavíme datum té zálohy, ať po přenosu nesvítí „nezálohováno".
  if (exportedAt) writeLastBackupAt(exportedAt);
  return { recipes: data.recipes.length };
}
