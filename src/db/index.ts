import Dexie, { type Table } from 'dexie';
import type { Meal } from '../lib/nutrition';

/**
 * Lokální databáze (Dexie/IndexedDB) – zdroj pravdy pro UI (SPEC 7.3).
 *
 * Zrcadlí tabulky ze SPEC 7.4, ale bez cizích klíčů (ty IndexedDB nemá) a
 * v camelCase (idiomatické pro TypeScript a shodné s pseudokódem v SPEC 7.5).
 * SQL migrace používá snake_case; mapování mezi nimi řeší až sync vrstva (Fáze 1).
 *
 * Fáze 0 = jen definice schématu. Žádná synchronizace, žádný outbox.
 *
 * Invarianty (CLAUDE.md): jediná povinná pole jsou recipes.name a
 * recipe_items.raw_text; food_id, sub_recipe_id i amount_g jsou nepovinné.
 */

/** ISO timestamp, např. „2026-08-02T18:30:00.000Z". */
export type IsoTimestamp = string;
/** Lokální datum bez času, „YYYY-MM-DD" (SPEC E-07). */
export type IsoDate = string;

export type FoodBasis = 'g' | 'ml';
export type FoodSource = 'custom' | 'openfoodfacts' | 'nutridatabaze' | 'usda' | 'import';

export interface Food {
  id: string;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  /** Zda jsou hodnoty na 100 g nebo 100 ml. */
  basis: FoodBasis;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG?: number | null;
  satfatG?: number | null;
  fiberG?: number | null;
  saltG?: number | null;
  /** Hmotnost 1 kusu v gramech (§2). Umožní zadat surovinu v „ks" a spočítat kcal. */
  pieceGrams?: number | null;
  source: FoodSource;
  sourceRef?: string | null;
  isFavorite: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  deletedAt?: IsoTimestamp | null;
}

/** Domácí míry: „1 ks", „1 lžíce" → gramy (SPEC E-04). */
export interface FoodPortion {
  id: string;
  foodId: string;
  label: string;
  grams: number;
}

export interface Recipe {
  id: string;
  /** Jediné povinné pole receptu. */
  name: string;
  source?: string | null;
  capturedOn: IsoDate;
  /** Původní zachycený text. NIKDY se nepřepisuje strukturováním (E-17). */
  rawCapture?: string | null;
  instructions?: string | null;
  /** Nepovinné. Ne default 1, ne not null. */
  servings?: number | null;
  /** Zvážená hmotnost po uvaření; null = použij součet surovin (E-02). */
  cookedWeightG?: number | null;
  photoUrl?: string | null;
  audioUrl?: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  deletedAt?: IsoTimestamp | null;
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  /** „hrst hladký mouky" – zdroj pravdy, jediné povinné pole položky (E-12). */
  rawText: string;
  /** Nepovinné napojení. */
  foodId?: string | null;
  /** Nepovinné napojení na podrecept. */
  subRecipeId?: string | null;
  /** Nepovinná gramáž (zdroj pravdy pro výpočet; u „ks" dopočtená z hmotnosti kusu). */
  amountG?: number | null;
  /** Počet kusů, když je surovina zadaná v „ks" (§9); jinak null. */
  amountKs?: number | null;
  /** Koření, voda – nepočítá se do úplnosti. */
  isSkipped: boolean;
  note?: string | null;
  sortOrder: number;
}

/** Poznámky z jednotlivých vaření (R-24). */
export interface RecipeNote {
  id: string;
  recipeId: string;
  notedOn: IsoDate;
  body: string;
}

/** Zápis v deníku – snapshot spočítaný v okamžiku zápisu (E-01). */
export interface LogEntry {
  id: string;
  loggedOn: IsoDate;
  meal: Meal;
  foodId?: string | null;
  recipeId?: string | null;
  amountG: number;
  displayName: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  deletedAt?: IsoTimestamp | null;
}

export interface Goal {
  id: string;
  validFrom: IsoDate;
  energyKcal: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

export interface WeightEntry {
  id: string;
  measuredOn: IsoDate;
  weightKg: number;
}

/**
 * Fotka jako podklad receptu (R-04). V lokální variantě žije obrázek jako blob
 * přímo v IndexedDB (E-16: uložit hned, žádné nahrávání na server).
 */
export interface RecipePhoto {
  id: string;
  recipeId: string;
  blob: Blob;
  createdAt: IsoTimestamp;
}

/**
 * §8 náhrada suroviny pro jedno vaření (jogurt → tvaroh). Volitelně napojená na
 * potravinu (+ gramáž/ks), aby se přepočítaly kalorie té porce. Klíčem je id
 * původní suroviny receptu, kterou nahrazuje.
 */
export interface CookReplacement {
  /** Čím se nahrazuje, jak se zobrazí (např. „tvaroh"). */
  text: string;
  foodId?: string | null;
  /** Gramáž náhrady – zdroj pravdy pro kcal (u „ks" dopočtená z hmotnosti kusu). */
  amountG?: number | null;
  amountKs?: number | null;
}

/**
 * Rozdělané vaření (§6): které suroviny jsou odškrtnuté. Stav sezení – přežije
 * odchod z appky a návrat. Po delší době appka nabídne pokračovat/začít znovu.
 */
export interface CookSession {
  recipeId: string;
  checkedItemIds: string[];
  /** §8 odchylky: vypnuté suroviny (dnes je nedávám). */
  offItemIds?: string[];
  /** §8 odchylky: změněné množství suroviny pro tohle vaření (volný text). */
  amountOverrides?: Record<string, string>;
  /** §8 náhrady: čím se která surovina pro tohle vaření nahradila. */
  replacements?: Record<string, CookReplacement>;
  /** Hotové kroky postupu (indexy) – průběh vaření. */
  doneStepIndices?: number[];
  updatedAt: IsoTimestamp;
}

/**
 * Časovač vaření (§7). Ukládá se CÍLOVÝ čas (`endsAt`), ne zbývající sekundy –
 * přežije uspání i restart, odpočet se dopočítá z aktuálního času.
 */
export interface Timer {
  id: string;
  label: string;
  endsAt: IsoTimestamp;
  createdAt: IsoTimestamp;
}

/** Surovina v záznamu vaření (snímek – jak se reálně vařilo). */
export interface CookLogIngredient {
  text: string;
  off: boolean;
  changed: boolean;
  /** §8 náhrada: čím se surovina nahradila (např. „tvaroh"); jinak null. */
  replacedWith?: string | null;
}

/**
 * Záznam dokončeného vaření (§10). Snímek, ne odkaz – recept se v čase mění,
 * ale záznam zůstává pravdivý. Nese i syrové odchylky pro „uvařit znovu takhle".
 */
export interface CookLog {
  id: string;
  recipeId: string;
  recipeName: string;
  cookedOn: IsoDate;
  portions: number;
  ingredients: CookLogIngredient[];
  note: string | null;
  offItemIds: string[];
  amountOverrides: Record<string, string>;
  /** §8 náhrady použité při tomhle vaření (pro zobrazení, přepočet a „uvařit znovu"). */
  replacements?: Record<string, CookReplacement>;
  /** Kalorie té varianty na porci (vypnuté suroviny odečtené, §9/§10); null = nešlo spočítat. */
  perPortion?: { kcal: number; protein: number; carbs: number; fat: number } | null;
  /** Úplnost výpočtu té varianty (napojené / započitatelné suroviny). */
  nutrition?: { connected: number; countable: number } | null;
  createdAt: IsoTimestamp;
}

export class KucharkaDB extends Dexie {
  foods!: Table<Food, string>;
  foodPortions!: Table<FoodPortion, string>;
  recipes!: Table<Recipe, string>;
  recipeItems!: Table<RecipeItem, string>;
  recipeNotes!: Table<RecipeNote, string>;
  logEntries!: Table<LogEntry, string>;
  goals!: Table<Goal, string>;
  weightEntries!: Table<WeightEntry, string>;
  recipePhotos!: Table<RecipePhoto, string>;
  cookSessions!: Table<CookSession, string>;
  timers!: Table<Timer, string>;
  cookLogs!: Table<CookLog, string>;

  constructor() {
    super('kucharka');
    // Indexují se jen pole, přes která se opravdu dotazuje/filtruje.
    // `*tags` = multi-entry index pro filtr podle štítků (R-21).
    this.version(1).stores({
      foods: 'id, name, barcode, isFavorite, deletedAt',
      foodPortions: 'id, foodId',
      recipes: 'id, name, source, capturedOn, isFavorite, deletedAt, *tags',
      recipeItems: 'id, recipeId, foodId, subRecipeId, sortOrder',
      recipeNotes: 'id, recipeId, notedOn',
      logEntries: 'id, loggedOn, meal, recipeId, foodId, deletedAt',
      goals: 'id, validFrom',
      weightEntries: 'id, measuredOn',
    });
    // v2: fotky receptů jako bloby v IndexedDB (R-04). Blob se neindexuje.
    this.version(2).stores({
      recipePhotos: 'id, recipeId, createdAt',
    });
    // v3: rozdělané vaření (§6), klíč = recipeId (jedno sezení na recept).
    this.version(3).stores({
      cookSessions: 'recipeId, updatedAt',
    });
    // v4: časovače vaření (§7).
    this.version(4).stores({
      timers: 'id, endsAt',
    });
    // v5: historie vaření (§10).
    this.version(5).stores({
      cookLogs: 'id, recipeId, createdAt',
    });
  }
}

export const db = new KucharkaDB();
