import { db, type Recipe, type RecipeItem } from '../../db';
import { newId } from '../../lib/id';
import { todayIso } from '../../lib/date';
import { combineRawCapture } from '../../lib/recipeText';

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
      source: null,
      capturedOn: content.capturedOn || todayIso(),
      rawCapture: content.rawCapture,
      instructions: content.instructions,
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

export async function updateRecipeContent(id: string, content: RecipeContent): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', db.recipes, db.recipeItems, async () => {
    await db.recipes.update(id, {
      name: content.name,
      capturedOn: content.capturedOn,
      rawCapture: content.rawCapture,
      instructions: content.instructions,
      tags: content.tags,
      updatedAt: now,
    });

    // Zachovej id a napojení (food_id, amount_g, is_skipped) pro řádky, jejichž
    // text se nezměnil – jinak by úprava textu smazala napojení na potraviny.
    // Přiřazuje se podle raw_text, každá existující položka se použije nejvýš jednou.
    const existing = await db.recipeItems.where('recipeId').equals(id).toArray();
    const byText = new Map<string, RecipeItem[]>();
    for (const item of existing) {
      const list = byText.get(item.rawText) ?? [];
      list.push(item);
      byText.set(item.rawText, list);
    }
    const next: RecipeItem[] = content.ingredientLines.map((line, index) => {
      const reused = byText.get(line)?.shift();
      return reused
        ? { ...reused, sortOrder: index }
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
          };
    });
    const keptIds = new Set(next.map((item) => item.id));
    const removed = existing.filter((item) => !keptIds.has(item.id)).map((item) => item.id);
    if (removed.length > 0) await db.recipeItems.bulkDelete(removed);
    await db.recipeItems.bulkPut(next);
  });
}

/** Napojení suroviny na potravinu + gramáž, nebo přeskočení (R-12). */
export async function updateRecipeItemLink(
  itemId: string,
  patch: {
    foodId?: string | null;
    amountG?: number | null;
    amountKs?: number | null;
    isSkipped?: boolean;
  },
): Promise<void> {
  await db.recipeItems.update(itemId, patch);
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

/** Po změně jednotlivých položek srovná plnotextové zrcadlo `raw_capture`. */
async function syncRawCapture(recipeId: string): Promise<void> {
  const items = await db.recipeItems.where('recipeId').equals(recipeId).sortBy('sortOrder');
  const recipe = await db.recipes.get(recipeId);
  const ingredients = items.map((item) => item.rawText).join('\n');
  await db.recipes.update(recipeId, {
    rawCapture: combineRawCapture(ingredients, recipe?.instructions ?? ''),
    updatedAt: new Date().toISOString(),
  });
}

/** Přidá surovinu do receptu natrvalo (úprava z režimu vaření). */
export async function addRecipeItem(recipeId: string, rawText: string): Promise<void> {
  const text = rawText.trim();
  if (!text) return;
  await db.transaction('rw', db.recipes, db.recipeItems, async () => {
    const items = await db.recipeItems.where('recipeId').equals(recipeId).toArray();
    const nextOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
    await db.recipeItems.add({
      id: newId(),
      recipeId,
      rawText: text,
      foodId: null,
      subRecipeId: null,
      amountG: null,
      isSkipped: false,
      note: null,
      sortOrder: nextOrder,
    });
    await syncRawCapture(recipeId);
  });
}

export async function updateRecipeItemText(itemId: string, rawText: string): Promise<void> {
  const item = await db.recipeItems.get(itemId);
  if (!item) return;
  await db.transaction('rw', db.recipes, db.recipeItems, async () => {
    await db.recipeItems.update(itemId, { rawText: rawText.trim() });
    await syncRawCapture(item.recipeId);
  });
}

export async function deleteRecipeItem(itemId: string): Promise<void> {
  const item = await db.recipeItems.get(itemId);
  if (!item) return;
  await db.transaction('rw', db.recipes, db.recipeItems, async () => {
    await db.recipeItems.delete(itemId);
    await syncRawCapture(item.recipeId);
  });
}

/** Nikdy nemažeme natvrdo – jen `deletedAt` (soft delete, E-08). */
export async function softDeleteRecipe(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.recipes.update(id, { deletedAt: now, updatedAt: now });
}
