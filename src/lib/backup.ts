/**
 * Export a import celé kuchařky do jednoho JSON souboru (N-01, N-02).
 *
 * V lokální variantě (bez serveru) je tohle jediná záloha i způsob, jak přenést
 * data na jiné zařízení. Proto se exportují VŠECHNY tabulky, ne jen recepty –
 * ať je záloha kompletní i do budoucna.
 *
 * Čistá logika bez Dexie: serializace/parsování se dá testovat samostatně.
 */
import type {
  Food,
  FoodPortion,
  Goal,
  LogEntry,
  Recipe,
  RecipeItem,
  RecipeNote,
  WeightEntry,
} from '../db';

export const BACKUP_FORMAT = 'osobni-kucharka-backup';
export const BACKUP_VERSION = 1;

/** Fotka v záloze – blob je serializovaný jako data URL (base64). */
export interface PhotoBackup {
  id: string;
  recipeId: string;
  dataUrl: string;
  createdAt: string;
}

export interface BackupData {
  foods: Food[];
  foodPortions: FoodPortion[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  recipeNotes: RecipeNote[];
  logEntries: LogEntry[];
  goals: Goal[];
  weightEntries: WeightEntry[];
  photos: PhotoBackup[];
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: BackupData;
}

export function buildBackup(data: BackupData, now: Date = new Date()): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data,
  };
}

export function serializeBackup(data: BackupData, now?: Date): string {
  return JSON.stringify(buildBackup(data, now), null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Ověří obálku a vrátí data. Odmítne cizí JSON i zálohu z novější verze,
 * chybějící tabulky doplní jako prázdné.
 */
export function parseBackup(json: string): BackupData {
  const parsed: unknown = JSON.parse(json);

  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new Error('Tohle není záloha Osobní kuchařky.');
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    throw new Error('Záloha pochází z novější verze aplikace.');
  }

  const data = isRecord(parsed.data) ? parsed.data : {};
  return {
    foods: asArray<Food>(data.foods),
    foodPortions: asArray<FoodPortion>(data.foodPortions),
    recipes: asArray<Recipe>(data.recipes),
    recipeItems: asArray<RecipeItem>(data.recipeItems),
    recipeNotes: asArray<RecipeNote>(data.recipeNotes),
    logEntries: asArray<LogEntry>(data.logEntries),
    goals: asArray<Goal>(data.goals),
    weightEntries: asArray<WeightEntry>(data.weightEntries),
    photos: asArray<PhotoBackup>(data.photos),
  };
}
