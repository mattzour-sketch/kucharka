import { describe, expect, it } from 'vitest';
import type { Food, Recipe, RecipeItem } from '../../db';
import { nutritionFromData } from './recipeNutrition';

function food(id: string, kcal: number, protein: number, carbs: number, fat: number): Food {
  return {
    id,
    name: id,
    basis: 'g',
    energyKcal: kcal,
    proteinG: protein,
    carbsG: carbs,
    fatG: fat,
    source: 'custom',
    isFavorite: false,
    createdAt: 't',
    updatedAt: 't',
  };
}

function recipe(partial: Partial<Recipe> & { id: string }): Recipe {
  return {
    name: partial.id,
    capturedOn: '2026-08-03',
    tags: [],
    isFavorite: false,
    createdAt: 't',
    updatedAt: 't',
    ...partial,
  };
}

function item(
  id: string,
  recipeId: string,
  sortOrder: number,
  patch: Partial<RecipeItem> = {},
): RecipeItem {
  return {
    id,
    recipeId,
    rawText: id,
    foodId: null,
    subRecipeId: null,
    amountG: null,
    isSkipped: false,
    sortOrder,
    ...patch,
  };
}

const foods = [
  food('chicken', 106, 21.5, 0, 2),
  food('rice', 350, 7, 78, 1),
  food('onion', 40, 1.1, 9, 0.1),
  food('oil', 884, 0, 0, 100),
];

describe('recipeNutrition', () => {
  it('spočítá rizoto podle SPEC 7.5 (na porci i na 100 g s uvařenou hmotností)', () => {
    const recipes = [recipe({ id: 'rizoto', servings: 4, cookedWeightG: 1500 })];
    const items = [
      item('i1', 'rizoto', 0, { foodId: 'chicken', amountG: 400 }),
      item('i2', 'rizoto', 1, { foodId: 'rice', amountG: 200 }),
      item('i3', 'rizoto', 2, { foodId: 'onion', amountG: 100 }),
      item('i4', 'rizoto', 3, { foodId: 'oil', amountG: 20 }),
    ];

    const result = nutritionFromData('rizoto', { foods, recipes, items });

    expect(result.computable).toBe(true);
    expect(result.completeness.ratio).toBe(1);
    expect(result.total?.kcal).toBeCloseTo(1340.8, 4);
    expect(result.perServing?.kcal).toBeCloseTo(335.2, 4);
    expect(Math.abs((result.per100g?.kcal ?? 0) - 89.39)).toBeLessThan(0.01);
    expect(result.finalWeight).toBe(1500);
  });

  it('částečně napojený recept hlásí úplnost a počítá jen z napojených', () => {
    const recipes = [recipe({ id: 'part', servings: null, cookedWeightG: null })];
    const items = [
      item('a', 'part', 0, { foodId: 'chicken', amountG: 400 }),
      item('b', 'part', 1, { foodId: 'rice', amountG: 200 }),
      item('c', 'part', 2), // nenapojeno
      item('d', 'part', 3, { isSkipped: true }), // koření
    ];

    const result = nutritionFromData('part', { foods, recipes, items });

    expect(result.computable).toBe(true);
    expect(result.completeness.connected).toBe(2);
    expect(result.completeness.countable).toBe(3);
    expect(result.total?.kcal).toBeCloseTo(1124, 4); // 424 + 700
  });

  it('bez napojených surovin není co počítat', () => {
    const recipes = [recipe({ id: 'empty' })];
    const items = [item('x', 'empty', 0), item('y', 'empty', 1)];

    const result = nutritionFromData('empty', { foods, recipes, items });

    expect(result.computable).toBe(false);
    expect(result.total).toBeNull();
  });
});
