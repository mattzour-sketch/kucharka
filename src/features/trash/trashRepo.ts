import { db } from '../../db';

/**
 * Koš (§14). Staví na příznaku smazání (`deletedAt`), který v modelu už je.
 *
 * Náhrobek: „vyprázdnění" nesmaže řádek natvrdo, jen zahodí obsah a fotky
 * (uvolní místo) a nechá `deletedAt` = značku „tohle je smazané". Bez ní by
 * při budoucím přenosu mezi zařízeními (§13) druhé zařízení recept vzkřísilo.
 * Náhrobek poznáme podle prázdného názvu a do koše se už neukazuje.
 */

function isInTrash<T extends { deletedAt?: string | null; name: string }>(entity: T): boolean {
  return Boolean(entity.deletedAt) && entity.name.trim() !== '';
}

export function listTrashedRecipes() {
  return db.recipes
    .filter(isInTrash)
    .toArray()
    .then((recipes) => recipes.sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')));
}

export function listTrashedFoods() {
  return db.foods
    .filter(isInTrash)
    .toArray()
    .then((foods) => foods.sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')));
}

/** Obnovení receptu vrátí i potraviny, které používá, aby se nevrátil rozbitý (§14 [R]). */
export async function restoreRecipe(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', [db.recipes, db.recipeItems, db.foods], async () => {
    await db.recipes.update(id, { deletedAt: null, updatedAt: now });
    const items = await db.recipeItems.where('recipeId').equals(id).toArray();
    const foodIds = [...new Set(items.map((item) => item.foodId).filter((x): x is string => !!x))];
    for (const foodId of foodIds) {
      const food = await db.foods.get(foodId);
      if (food?.deletedAt) await db.foods.update(foodId, { deletedAt: null, updatedAt: now });
    }
  });
}

export async function restoreFood(id: string): Promise<void> {
  await db.foods.update(id, { deletedAt: null, updatedAt: new Date().toISOString() });
}

/** Vyprázdnění koše: zahodí obsah a fotky, ale ponechá náhrobek (viz výše). */
export async function emptyTrash(): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', [db.recipes, db.recipeItems, db.recipePhotos, db.foods], async () => {
    const recipes = await db.recipes.filter(isInTrash).toArray();
    for (const recipe of recipes) {
      await db.recipePhotos.where('recipeId').equals(recipe.id).delete();
      await db.recipeItems.where('recipeId').equals(recipe.id).delete();
      await db.recipes.update(recipe.id, {
        name: '',
        source: null,
        rawCapture: null,
        instructions: null,
        tags: [],
        photoUrl: null,
        audioUrl: null,
        servings: null,
        cookedWeightG: null,
        updatedAt: now,
      });
    }
    const foods = await db.foods.filter(isInTrash).toArray();
    for (const food of foods) {
      await db.foods.update(food.id, { name: '', brand: null, updatedAt: now });
    }
  });
}
