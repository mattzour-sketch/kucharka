/**
 * Export a import celé kuchařky do jednoho JSON souboru (N-01, N-02).
 *
 * V lokální variantě (bez serveru) je tohle jediná záloha i způsob, jak přenést
 * data na jiné zařízení. Proto se exportují VŠECHNY uživatelské tabulky, ne jen
 * recepty – ať je záloha kompletní i do budoucna.
 *
 * Čistá logika bez Dexie: serializace, parsování i výpočet dopadu obnovy se dají
 * testovat samostatně (DB obal je v features/backup/dbBackup.ts).
 */
import type {
  CookLog,
  Food,
  FoodPortion,
  Goal,
  LogEntry,
  Recipe,
  RecipeItem,
  RecipeNote,
  ShoppingItem,
  WeightEntry,
} from '../db';

export const BACKUP_FORMAT = 'osobni-kucharka-backup';
/** v2: přidány `cookLogs` (historie vaření §10) a `shoppingItems` (nákup). v1 se čte tolerantně. */
export const BACKUP_VERSION = 2;

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
  logEntries: LogEntry[]; // fáze 3 – dnes prázdné, dopředná kompatibilita
  goals: Goal[]; // fáze 2/3 – dtto
  weightEntries: WeightEntry[]; // fáze 2/3 – dtto
  cookLogs: CookLog[]; // §10 historie vaření
  shoppingItems: ShoppingItem[]; // nákupní seznam
  photos: PhotoBackup[];
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: BackupData;
}

/**
 * Výsledek parsování: obálka (`version`, `exportedAt`) + data + info, které nově
 * přidané tabulky soubor fakticky obsahoval. `present` odlišuje „nula záznamů" od
 * „tuhle tabulku soubor nemá" (stará v1 záloha) – kvůli shrnutí obnovy (bod 14).
 */
export interface ParsedBackup {
  version: number;
  exportedAt: string | null;
  data: BackupData;
  present: { cookLogs: boolean; shoppingItems: boolean };
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
 * Ověří obálku a vrátí data + obálku. Odmítne poškozený soubor, cizí JSON i zálohu
 * z novější verze; chybějící tabulky doplní jako prázdné (kompatibilita v1 → v2).
 * Hlášky říkají, co s tím (bod 15).
 */
export function parseBackup(json: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Soubor nejde přečíst – je nejspíš poškozený nebo to není JSON záloha.');
  }

  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new Error('Tohle není záloha Osobní kuchařky. Vyber JSON soubor, který jsi z ní exportoval.');
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    throw new Error('Záloha je z novější verze aplikace. Aktualizuj Osobní kuchařku a zkus obnovu znovu.');
  }

  const data = isRecord(parsed.data) ? parsed.data : {};
  return {
    version: parsed.version,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    present: {
      cookLogs: Array.isArray(data.cookLogs),
      shoppingItems: Array.isArray(data.shoppingItems),
    },
    data: {
      foods: asArray<Food>(data.foods),
      foodPortions: asArray<FoodPortion>(data.foodPortions),
      recipes: asArray<Recipe>(data.recipes),
      recipeItems: asArray<RecipeItem>(data.recipeItems),
      recipeNotes: asArray<RecipeNote>(data.recipeNotes),
      logEntries: asArray<LogEntry>(data.logEntries),
      goals: asArray<Goal>(data.goals),
      weightEntries: asArray<WeightEntry>(data.weightEntries),
      cookLogs: asArray<CookLog>(data.cookLogs),
      shoppingItems: asArray<ShoppingItem>(data.shoppingItems),
      photos: asArray<PhotoBackup>(data.photos),
    },
  };
}

/**
 * Shrnutí obsahu zálohy (počty + obálka). Čistá funkce nad výsledkem `parseBackup`.
 * `hasCookLogs`/`hasShoppingItems` = zda soubor tabulku vůbec obsahoval (v1 ji nemá) –
 * ať shrnutí umí napsat „neobsahuje" místo „0" (bod 14).
 */
export interface BackupSummary {
  recipes: number;
  recipeItems: number;
  foods: number;
  photos: number;
  cookLogs: number;
  shoppingItems: number;
  hasCookLogs: boolean;
  hasShoppingItems: boolean;
  exportedAt: string | null;
  version: number;
}

export function summarizeBackup(parsed: ParsedBackup): BackupSummary {
  const { data } = parsed;
  return {
    recipes: data.recipes.length,
    recipeItems: data.recipeItems.length,
    foods: data.foods.length,
    photos: data.photos.length,
    cookLogs: data.cookLogs.length,
    shoppingItems: data.shoppingItems.length,
    hasCookLogs: parsed.present.cookLogs,
    hasShoppingItems: parsed.present.shoppingItems,
    exportedAt: parsed.exportedAt,
    version: parsed.version,
  };
}

/**
 * Plný dopad obnovy (bod 10): porovná zálohu s aktuální DB podle `id`.
 * - recepty: kolik přibude nových, kolik přepíše existující a z toho kolik má
 *   uživatel novější než záloha (`updatedAt`).
 * - vaření/nákup: kolik položek ze zálohy v DB není → tolik merge „vrátí" (obě
 *   tabulky se mažou natvrdo, upsert je vzkřísí – přijatý důsledek merge režimu).
 * Čistá funkce – bere hotová pole, ať jde testovat bez Dexie.
 */
export interface RestoreImpact {
  recipes: { added: number; overwritten: number; newerInDb: number };
  cookLogsRevived: number;
  shoppingItemsRevived: number;
}

export interface RestoreCurrent {
  recipes: Pick<Recipe, 'id' | 'updatedAt'>[];
  cookLogs: Pick<CookLog, 'id'>[];
  shoppingItems: Pick<ShoppingItem, 'id'>[];
}

/** Kolik položek ze zálohy v DB (podle `id`) není → tolik se merge obnovou „vrátí". */
function countRevived(backup: { id: string }[], currentIds: Set<string>): number {
  let revived = 0;
  for (const row of backup) if (!currentIds.has(row.id)) revived += 1;
  return revived;
}

export function computeRestoreImpact(backup: BackupData, current: RestoreCurrent): RestoreImpact {
  const currentRecipeUpdatedAt = new Map(current.recipes.map((recipe) => [recipe.id, recipe.updatedAt]));
  let added = 0;
  let overwritten = 0;
  let newerInDb = 0;
  for (const recipe of backup.recipes) {
    const dbUpdatedAt = currentRecipeUpdatedAt.get(recipe.id);
    if (dbUpdatedAt === undefined) {
      added += 1;
    } else {
      overwritten += 1;
      // ISO timestampy jdou porovnat lexikograficky.
      if (dbUpdatedAt > recipe.updatedAt) newerInDb += 1;
    }
  }
  return {
    recipes: { added, overwritten, newerInDb },
    cookLogsRevived: countRevived(backup.cookLogs, new Set(current.cookLogs.map((log) => log.id))),
    shoppingItemsRevived: countRevived(
      backup.shoppingItems,
      new Set(current.shoppingItems.map((item) => item.id)),
    ),
  };
}
