import { describe, expect, it } from 'vitest';
import { nutritionFromData } from './recipeNutrition';
import { resolveAmount, unitOptionsForFood } from '../../lib/amount';
import type { Food, Recipe, RecipeItem } from '../../db';

/**
 * REVIEW – integrace čisté logiky UC017 do nutričního výpočtu (bez DB/UI).
 * Řetězec: míra → resolveAmount → amountG na surovině → nutritionFromData.
 * Ověřuje AC C (dopočet kcal), rule 4 (míra bez potraviny nepočítá), rule 9
 * (žádná odchylka přes recept) a OO3/rule 5 (změna míry nemění uloženou gramáž).
 */

function food(partial: Partial<Food> & { id: string; energyKcal: number }): Food {
  return {
    name: partial.id,
    basis: 'g',
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    source: 'custom',
    isFavorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function recipe(partial: Partial<Recipe> & { id: string }): Recipe {
  return {
    name: partial.id,
    capturedOn: '2026-01-01',
    tags: [],
    isFavorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    servings: null,
    cookedWeightG: null,
    ...partial,
  };
}

function item(partial: Partial<RecipeItem> & { id: string; recipeId: string }): RecipeItem {
  return {
    rawText: partial.id,
    foodId: null,
    subRecipeId: null,
    amountG: null,
    amountKs: null,
    isSkipped: false,
    sortOrder: 0,
    ...partial,
  };
}

const OLEJ = food({ id: 'olej', energyKcal: 884, fatG: 100 });

describe('AC C – „2 lžíce" napojeného oleje se dopočte na kcal jako 30 g', () => {
  it('resolveAmount z míry → amountG → stejné kcal jako ruční gramáž', () => {
    const options = unitOptionsForFood(OLEJ, [{ id: 'p-lzice', label: 'lžíce', grams: 15 }]);
    const { amountG } = resolveAmount({ unitId: 'p-lzice', raw: '2' }, options);
    expect(amountG).toBe(30);

    const items = [item({ id: 'i1', recipeId: 'r1', foodId: 'olej', amountG })];
    const result = nutritionFromData('r1', { foods: [OLEJ], recipes: [recipe({ id: 'r1' })], items });
    expect(result.computable).toBe(true);
    expect(result.total?.kcal).toBeCloseTo(265.2, 10); // 884 × 30 / 100
    expect(result.completeness).toMatchObject({ connected: 1, countable: 1 });
  });
});

describe('rule 4 – míra v textu bez napojené potraviny nedá kcal', () => {
  it('surovina „2 lžíce oleje" bez foodId se nepočítá a snižuje úplnost', () => {
    const items = [
      item({ id: 'i1', recipeId: 'r1', rawText: '2 lžíce oleje', foodId: null, amountG: null }),
      item({ id: 'i2', recipeId: 'r1', rawText: 'olej', foodId: 'olej', amountG: 30 }),
    ];
    const result = nutritionFromData('r1', { foods: [OLEJ], recipes: [recipe({ id: 'r1' })], items });
    // jen napojená surovina přispívá; nenapojená „2 lžíce oleje" ne
    expect(result.total?.kcal).toBeCloseTo(265.2, 10);
    expect(result.completeness).toMatchObject({ connected: 1, countable: 2 });
  });
});

describe('rule 9 – přes celý recept žádná zaokrouhlovací odchylka', () => {
  it('30 surovin po 1 lžíci (7 g) potraviny 33 kcal/100 g → 69,3 kcal, ne 60', () => {
    const zelenina = food({ id: 'z', energyKcal: 33 });
    const options = unitOptionsForFood(zelenina, [{ id: 'p', label: 'lžíce', grams: 7 }]);
    const items: RecipeItem[] = [];
    for (let i = 0; i < 30; i += 1) {
      const { amountG } = resolveAmount({ unitId: 'p', raw: '1' }, options);
      items.push(item({ id: `i${i}`, recipeId: 'r1', foodId: 'z', amountG, sortOrder: i }));
    }
    const result = nutritionFromData('r1', { foods: [zelenina], recipes: [recipe({ id: 'r1' })], items });
    expect(result.total?.kcal).toBeCloseTo(69.3, 9);
    expect(result.finalWeight).toBe(210);
  });
});

describe('OO3 / rule 5 – změna míry potraviny nemění už uloženou surovinu', () => {
  it('uložené amountG (30) zůstává, i když se míra „lžíce" změní z 15 na 14 g', () => {
    // Uloženo dřív jako 2×15 = 30 g.
    const stored = [item({ id: 'i1', recipeId: 'r1', foodId: 'olej', amountG: 30 })];
    const before = nutritionFromData('r1', { foods: [OLEJ], recipes: [recipe({ id: 'r1' })], items: stored });

    // Míra se přenastaví na 14 g. Nové *nové* zadání by dalo 28 g, ale stará surovina
    // drží jen gramáž (OO2), takže výpočet z uložených dat se nesmí hnout.
    const newOptions = unitOptionsForFood(OLEJ, [{ id: 'p-lzice', label: 'lžíce', grams: 14 }]);
    expect(resolveAmount({ unitId: 'p-lzice', raw: '2' }, newOptions).amountG).toBe(28);

    const after = nutritionFromData('r1', { foods: [OLEJ], recipes: [recipe({ id: 'r1' })], items: stored });
    expect(after.total?.kcal).toBe(before.total?.kcal);
    expect(after.total?.kcal).toBeCloseTo(265.2, 10);
  });
});
