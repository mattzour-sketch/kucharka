import { db, type CookReplacement, type Food, type Recipe, type RecipeItem } from '../../db';
import {
  completeness,
  per100g,
  perServing,
  recipeTotals,
  type CalcItem,
  type CalcRecipe,
  type Completeness,
  type FoodValue,
  type NutritionSource,
  type Nutrients,
} from '../../lib/nutrition';

/**
 * Adaptér mezi Dexie a čistým nutričním modulem (`lib/nutrition.ts`).
 * `nutritionFromData` je čistá funkce nad načtenými poli (testovatelná bez DB),
 * `computeRecipeNutrition` jen dotáhne data z Dexie a zavolá ji.
 */

export interface RecipeNutritionResult {
  completeness: Completeness;
  computable: boolean;
  hasCycle: boolean;
  total: Nutrients | null;
  per100g: Nutrients | null;
  perServing: Nutrients | null;
  finalWeight: number | null;
}

function foodToValue(food: Food): FoodValue {
  return { kcal: food.energyKcal, protein: food.proteinG, carbs: food.carbsG, fat: food.fatG };
}

function itemToCalc(item: RecipeItem, skip: Set<string>): CalcItem {
  return {
    foodId: item.foodId,
    subRecipeId: item.subRecipeId,
    amountG: item.amountG,
    isSkipped: item.isSkipped || skip.has(item.id),
  };
}

/** `skipItemIds` = položky vynechané při vaření (§8/§10) – nepočítají se do součtu. */
export function nutritionFromData(
  recipeId: string,
  data: { foods: Food[]; recipes: Recipe[]; items: RecipeItem[] },
  options: { skipItemIds?: string[] } = {},
): RecipeNutritionResult {
  const foodMap = new Map(data.foods.map((food) => [food.id, food]));
  const recipeMap = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));
  const skip = new Set(options.skipItemIds ?? []);
  const itemsByRecipe = new Map<string, RecipeItem[]>();
  for (const item of data.items) {
    const list = itemsByRecipe.get(item.recipeId) ?? [];
    list.push(item);
    itemsByRecipe.set(item.recipeId, list);
  }

  function toCalc(id: string): CalcRecipe {
    const recipe = recipeMap.get(id);
    if (!recipe) throw new Error(`Neznámý recept: ${id}`);
    const items = (itemsByRecipe.get(id) ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: recipe.id,
      servings: recipe.servings,
      cookedWeightG: recipe.cookedWeightG,
      items: items.map((item) => itemToCalc(item, skip)),
    };
  }

  const source: NutritionSource = {
    food: (id) => {
      const food = foodMap.get(id);
      if (!food) throw new Error(`Neznámá potravina: ${id}`);
      return foodToValue(food);
    },
    recipe: (id) => toCalc(id),
  };

  const calc = toCalc(recipeId);
  const comp = completeness(calc);
  const notComputable: RecipeNutritionResult = {
    completeness: comp,
    computable: false,
    hasCycle: false,
    total: null,
    per100g: null,
    perServing: null,
    finalWeight: null,
  };

  try {
    const result = recipeTotals(calc, source);
    if (!result.computable) return notComputable;
    return {
      completeness: comp,
      computable: true,
      hasCycle: false,
      total: result.totals,
      per100g: per100g(result.totals, result.finalWeight),
      perServing: perServing(result.totals, calc.servings),
      finalWeight: result.finalWeight,
    };
  } catch {
    // cyklická reference podreceptů (E-03)
    return { ...notComputable, hasCycle: true };
  }
}

/**
 * Založí náhrady (§8) do výpočtu: vloží je jako syntetické položky receptu a
 * vrátí id původních surovin, které se místo nich mají přeskočit. Náhrada bez
 * napojení potraviny se počítá jako nenapojená položka (sníží úplnost, R-4).
 */
export function applyReplacements(
  items: RecipeItem[],
  recipeId: string,
  replacements: Record<string, CookReplacement> | undefined,
): { items: RecipeItem[]; replacedIds: string[] } {
  const entries = Object.entries(replacements ?? {});
  if (entries.length === 0) return { items, replacedIds: [] };
  const synthetic: RecipeItem[] = entries.map(([originalId, replacement], index) => ({
    id: `repl:${originalId}`,
    recipeId,
    rawText: replacement.text,
    foodId: replacement.foodId ?? null,
    subRecipeId: null,
    amountG: replacement.amountG ?? null,
    amountKs: replacement.amountKs ?? null,
    isSkipped: false,
    sortOrder: 100000 + index,
  }));
  return { items: [...items, ...synthetic], replacedIds: entries.map(([id]) => id) };
}

/**
 * Kalorie na porci ze spočítaného výsledku. Dělí počtem porcí; když není zadaný,
 * bereme 1 (= celý recept), stejně jako režim vaření. Bez napojených surovin null (R-4).
 * Používá režim vaření i dopočet historie, ať dávají shodné číslo.
 */
export function perPortionFromResult(
  result: RecipeNutritionResult,
  servings: number | null | undefined,
): Nutrients | null {
  if (!result.total) return null;
  const base = servings != null && servings > 0 ? servings : 1;
  return {
    kcal: result.total.kcal / base,
    protein: result.total.protein / base,
    carbs: result.total.carbs / base,
    fat: result.total.fat / base,
  };
}

export async function computeRecipeNutrition(recipeId: string): Promise<RecipeNutritionResult> {
  const [foods, recipes, items] = await Promise.all([
    db.foods.toArray(),
    db.recipes.toArray(),
    db.recipeItems.toArray(),
  ]);
  return nutritionFromData(recipeId, { foods, recipes, items });
}
