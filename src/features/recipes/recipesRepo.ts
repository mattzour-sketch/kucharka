import { db, type Recipe, type RecipeItem } from '../../db';
import { newId } from '../../lib/id';
import { todayIso } from '../../lib/date';
import { resolveAmountFromText, type AutoLinkEntry } from '../../lib/autoLink';
import { pairEditedLines } from '../../lib/itemPairing';

/**
 * Zápisy do receptů. Recept má dvě části: suroviny (řádky → `recipe_items`,
 * každý s `raw_text`) a postup (`recipes.instructions`). `raw_capture` je
 * plnotextové zrcadlo obou částí (pro náhled, export, sdílení).
 *
 * Jediné povinné pole je `name` (i prázdný řetězec projde – koncept se ukládá
 * průběžně, název se doplní až při uložení).
 */

export interface RecipeContent {
  name: string;
  capturedOn: string;
  /** Neprázdné řádky surovin. */
  ingredientLines: string[];
  instructions: string | null;
  rawCapture: string | null;
  tags: string[];
  /** Doba přípravy v minutách (nepovinné). */
  prepMinutes: number | null;
  /**
   * Od koho recept je („@autor", UC031). Zapisuje se jen při založení; `updateRecipeContent`
   * ho nepřepisuje, takže editace (která pole nemá) zdroj nesmaže.
   */
  source?: string | null;
  /** Počet porcí (nepovinné). Chybí = při úpravě se stávající hodnota nemění. */
  servings?: number | null;
}

function buildItems(recipeId: string, lines: string[]): RecipeItem[] {
  return lines.map((line, index) => ({
    id: newId(),
    recipeId,
    rawText: line,
    foodId: null,
    subRecipeId: null,
    amountG: null,
    isSkipped: false,
    note: null,
    sortOrder: index,
  }));
}

export async function createRecipeWithContent(content: RecipeContent): Promise<string> {
  const id = newId();
  const now = new Date().toISOString();
  await db.transaction('rw', db.recipes, db.recipeItems, async () => {
    const recipe: Recipe = {
      id,
      name: content.name,
      source: content.source?.trim() || null,
      capturedOn: content.capturedOn || todayIso(),
      rawCapture: content.rawCapture,
      instructions: content.instructions,
      prepMinutes: content.prepMinutes,
      servings: content.servings ?? null,
      tags: content.tags,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.recipes.add(recipe);
    if (content.ingredientLines.length > 0) {
      await db.recipeItems.bulkAdd(buildItems(id, content.ingredientLines));
    }
  });
  return id;
}

/**
 * Čistá kopie receptu i jeho položek (UC019). Nová id, `isFavorite=false`, název „… (kopie)",
 * `capturedOn` = den kopie. Napojení surovin (food/subrecept/gramáž/míra) i `raw_text` se
 * přenášejí beze změny (pravidlo 2). Historie/poznámky/fotky (jiné tabulky) se NEkopírují.
 */
export function buildRecipeCopy(
  recipe: Recipe,
  items: RecipeItem[],
  now: string,
  genId: () => string,
): { recipe: Recipe; items: RecipeItem[] } {
  const newRecipeId = genId();
  const copiedRecipe: Recipe = {
    ...recipe,
    id: newRecipeId,
    name: recipe.name ? `${recipe.name} (kopie)` : '(kopie)',
    isFavorite: false,
    capturedOn: now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const copiedItems: RecipeItem[] = items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, id: genId(), recipeId: newRecipeId, sortOrder: index }));
  return { recipe: copiedRecipe, items: copiedItems };
}

/** Vytvoří samostatnou kopii receptu i položek (UC019). Vrací id kopie, nebo null. */
export async function duplicateRecipe(id: string): Promise<string | null> {
  const recipe = await db.recipes.get(id);
  if (!recipe) return null;
  const items = await db.recipeItems.where('recipeId').equals(id).sortBy('sortOrder');
  const copy = buildRecipeCopy(recipe, items, new Date().toISOString(), newId);
  await db.transaction('rw', db.recipes, db.recipeItems, async () => {
    await db.recipes.add(copy.recipe);
    if (copy.items.length > 0) await db.recipeItems.bulkAdd(copy.items);
  });
  return copy.recipe.id;
}

export async function updateRecipeContent(id: string, content: RecipeContent): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', [db.recipes, db.recipeItems, db.foods, db.foodPortions], async () => {
    await db.recipes.update(id, {
      name: content.name,
      capturedOn: content.capturedOn,
      rawCapture: content.rawCapture,
      instructions: content.instructions,
      prepMinutes: content.prepMinutes,
      ...(content.servings !== undefined ? { servings: content.servings } : {}),
      tags: content.tags,
      updatedAt: now,
    });

    // Zachovej id a napojení (food_id, amount_g, is_skipped) i u upravených řádků – oprava
    // překlepu nebo množství nesmí odpojit potravinu (lib/itemPairing). U upraveného řádku
    // s potravinou se množství přečte z nového textu; když v něm není, zůstane původní.
    const existing = await db.recipeItems.where('recipeId').equals(id).toArray();
    const paired = pairEditedLines(existing, content.ingredientLines);
    const next: RecipeItem[] = [];
    for (const [index, line] of content.ingredientLines.entries()) {
      const reused = paired[index];
      if (reused && reused.rawText !== line && reused.foodId) {
        const food = await db.foods.get(reused.foodId);
        const portions = await db.foodPortions.where('foodId').equals(reused.foodId).toArray();
        const amount = food ? resolveAmountFromText(line, food, portions) : null;
        next.push({
          ...reused,
          rawText: line,
          sortOrder: index,
          ...(amount && amount.amountG != null ? { amountG: amount.amountG, amountKs: amount.amountKs } : {}),
        });
        continue;
      }
      next.push(
        reused
          ? { ...reused, rawText: line, sortOrder: index }
          : {
              id: newId(),
              recipeId: id,
              rawText: line,
              foodId: null,
              subRecipeId: null,
              amountG: null,
              isSkipped: false,
              note: null,
              sortOrder: index,
            },
      );
    }
    const keptIds = new Set(next.map((item) => item.id));
    const removed = existing.filter((item) => !keptIds.has(item.id)).map((item) => item.id);
    if (removed.length > 0) await db.recipeItems.bulkDelete(removed);
    await db.recipeItems.bulkPut(next);
  });
}

/**
 * „Zahodit změny" v úpravě receptu: vrátí recept i suroviny přesně do stavu při otevření
 * úprav (včetně `updatedAt` a napojení). Položky přidané během úpravy zmizí stejně jako
 * při běžném uložení úpravy.
 */
export async function restoreRecipeSnapshot(recipe: Recipe, items: readonly RecipeItem[]): Promise<void> {
  await db.transaction('rw', db.recipes, db.recipeItems, async () => {
    await db.recipes.put(recipe);
    const keep = new Set(items.map((item) => item.id));
    const current = await db.recipeItems.where('recipeId').equals(recipe.id).primaryKeys();
    const added = current.filter((key) => !keep.has(key));
    if (added.length > 0) await db.recipeItems.bulkDelete(added);
    await db.recipeItems.bulkPut([...items]);
  });
}

/** Stav napojení suroviny – záloha pro „Vrátit" po automatickém napojení. */
export type ItemLinkSnapshot = Pick<
  RecipeItem,
  'id' | 'foodId' | 'subRecipeId' | 'amountG' | 'amountKs' | 'isSkipped'
>;

/**
 * Uloží plán automatického napojení (lib/autoLink) v jedné transakci a vrátí zálohu
 * původního stavu dotčených surovin. `raw_text` se nemění (pravidlo 2).
 */
export async function applyAutoLinks(plan: readonly AutoLinkEntry[]): Promise<ItemLinkSnapshot[]> {
  return db.transaction('rw', db.recipeItems, async () => {
    const before = await db.recipeItems.bulkGet(plan.map((entry) => entry.itemId));
    const snapshot: ItemLinkSnapshot[] = before
      .filter((item): item is RecipeItem => item !== undefined)
      .map(({ id, foodId, subRecipeId, amountG, amountKs, isSkipped }) => ({
        id,
        foodId: foodId ?? null,
        subRecipeId: subRecipeId ?? null,
        amountG: amountG ?? null,
        amountKs: amountKs ?? null,
        isSkipped,
      }));
    for (const entry of plan) {
      await db.recipeItems.update(
        entry.itemId,
        entry.kind === 'skip'
          ? { isSkipped: true }
          : { foodId: entry.foodId, subRecipeId: null, amountG: entry.amountG, amountKs: entry.amountKs, isSkipped: false },
      );
    }
    return snapshot;
  });
}

/** Vrátí napojení surovin do stavu ze zálohy (Vrátit po automatickém napojení). */
export async function restoreItemLinks(snapshot: readonly ItemLinkSnapshot[]): Promise<void> {
  await db.transaction('rw', db.recipeItems, async () => {
    for (const { id, ...link } of snapshot) await db.recipeItems.update(id, link);
  });
}

/** Napojení suroviny na potravinu NEBO podrecept + gramáž, nebo přeskočení (R-12, UC016). */
export async function updateRecipeItemLink(
  itemId: string,
  patch: {
    foodId?: string | null;
    subRecipeId?: string | null;
    amountG?: number | null;
    amountKs?: number | null;
    isSkipped?: boolean;
  },
): Promise<void> {
  // Potravina a podrecept se vylučují (zrcadlí SQL `at_most_one_target`): napojení
  // jednoho vynuluje druhé. Podrecept je jen v gramech (UC016, rozhodnutí 1), tak
  // s ním padá i `amountKs`. Odpojení (null) projde beze změny.
  const normalized = { ...patch };
  if (typeof patch.foodId === 'string') {
    normalized.subRecipeId = null;
  } else if (typeof patch.subRecipeId === 'string') {
    normalized.foodId = null;
    normalized.amountKs = null;
  }
  await db.recipeItems.update(itemId, normalized);
}

/** Počet porcí a hmotnost po uvaření (R-14, R-15). */
export async function updateRecipeMeta(
  id: string,
  patch: { servings?: number | null; cookedWeightG?: number | null },
): Promise<void> {
  await db.recipes.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

export function getRecipeItems(recipeId: string): Promise<RecipeItem[]> {
  return db.recipeItems.where('recipeId').equals(recipeId).sortBy('sortOrder');
}

/** Přepne oblíbenost receptu. Záměrně nemění `updatedAt`, ať se recept
 * nepřeskládá v řazení „naposledy upravené". */
export async function setRecipeFavorite(id: string, isFavorite: boolean): Promise<void> {
  await db.recipes.update(id, { isFavorite });
}

/** Nikdy nemažeme natvrdo – jen `deletedAt` (soft delete, E-08). */
export async function softDeleteRecipe(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.recipes.update(id, { deletedAt: now, updatedAt: now });
}
