import { db } from '../../db';
import { parseBackup, serializeBackup, type BackupData } from '../../lib/backup';

/** Sesbírá všechny tabulky do jednoho objektu (kompletní záloha). */
async function collectBackupData(): Promise<BackupData> {
  const [foods, foodPortions, recipes, recipeItems, recipeNotes, logEntries, goals, weightEntries] =
    await Promise.all([
      db.foods.toArray(),
      db.foodPortions.toArray(),
      db.recipes.toArray(),
      db.recipeItems.toArray(),
      db.recipeNotes.toArray(),
      db.logEntries.toArray(),
      db.goals.toArray(),
      db.weightEntries.toArray(),
    ]);
  return { foods, foodPortions, recipes, recipeItems, recipeNotes, logEntries, goals, weightEntries };
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
  const tables = [
    db.foods,
    db.foodPortions,
    db.recipes,
    db.recipeItems,
    db.recipeNotes,
    db.logEntries,
    db.goals,
    db.weightEntries,
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
    ]);
  });
  return { recipes: data.recipes.length };
}
