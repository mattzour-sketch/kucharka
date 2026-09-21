import { db, type RecipePhoto } from '../../db';
import {
  computeRestoreImpact,
  parseBackup,
  serializeBackup,
  type BackupData,
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

/**
 * Vyexportuje zálohu do JSON. „Naposledy zálohováno" NEzapisuje – to udělá volající
 * až po úspěšném stažení souboru (jinak by status tvrdil zálohu, kterou uživatel nedostal).
 */
export async function exportBackupJson(): Promise<{ json: string; exportedAt: string }> {
  const now = new Date();
  const json = serializeBackup(await collectBackupData(), now);
  return { json, exportedAt: now.toISOString() };
}

/** Náhled obnovy: obsah zálohy + dopad na aktuální data. Žádný zápis. */
export interface RestorePreview {
  parsed: ParsedBackup;
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
  // U vaření/nákupu potřebujeme jen id → primaryKeys() je vezmou z indexu bez načtení
  // celých (tučných) řádků. U receptů toArray() musí být (potřebujeme updatedAt).
  const [recipes, cookLogIds, shoppingItemIds] = await Promise.all([
    db.recipes.toArray(),
    db.cookLogs.toCollection().primaryKeys(),
    db.shoppingItems.toCollection().primaryKeys(),
  ]);
  const impact = computeRestoreImpact(parsed.data, { recipes, cookLogIds, shoppingItemIds });
  return { parsed, impact, fileSize };
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

  // Rozsah transakce = všechny tabulky (jeden zdroj místo ručního seznamu, který by se
  // mohl rozejít s bulkPut níž). Širší zámek u jednorázové obnovy nevadí.
  await db.transaction('rw', db.tables, async () => {
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
