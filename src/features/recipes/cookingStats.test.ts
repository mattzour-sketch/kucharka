import { describe, expect, it } from 'vitest';
import type { CookLog, Recipe } from '../../db';
import { computeCookingStats } from './cookingStats';

function log(recipeId: string, recipeName: string, cookedOn: string, kcal?: number): CookLog {
  return {
    id: `${recipeId}-${cookedOn}`,
    recipeId,
    recipeName,
    cookedOn,
    portions: 1,
    ingredients: [],
    note: null,
    offItemIds: [],
    amountOverrides: {},
    perPortion: kcal != null ? { kcal, protein: 0, carbs: 0, fat: 0 } : null,
    createdAt: `${cookedOn}T12:00:00.000Z`,
  };
}

function recipe(id: string, name: string, deleted = false): Recipe {
  return {
    id,
    name,
    capturedOn: '2026-08-01',
    tags: [],
    isFavorite: false,
    createdAt: 't',
    updatedAt: 't',
    deletedAt: deleted ? 't' : null,
  };
}

describe('computeCookingStats', () => {
  it('prázdná historie: nuly, žádný průměr, všechny recepty neuvařené', () => {
    const stats = computeCookingStats([], [recipe('a', 'A'), recipe('b', 'B')], '2026-08-19');
    expect(stats.totalCooks).toBe(0);
    expect(stats.cooksThisMonth).toBe(0);
    expect(stats.distinctRecipes).toBe(0);
    expect(stats.avgPortionKcal).toBeNull();
    expect(stats.lastCookedOn).toBeNull();
    expect(stats.top).toEqual([]);
    expect(stats.neverCookedCount).toBe(2);
  });

  it('počítá celkem, tento měsíc, různé recepty a poslední uvaření', () => {
    const logs = [
      log('a', 'A', '2026-08-10'),
      log('a', 'A', '2026-08-18'),
      log('b', 'B', '2026-07-30'), // minulý měsíc
    ];
    const stats = computeCookingStats(logs, [recipe('a', 'A'), recipe('b', 'B')], '2026-08-19');
    expect(stats.totalCooks).toBe(3);
    expect(stats.cooksThisMonth).toBe(2);
    expect(stats.distinctRecipes).toBe(2);
    expect(stats.lastCookedOn).toBe('2026-08-18');
    expect(stats.neverCookedCount).toBe(0);
  });

  it('řadí nejčastěji vařené podle počtu a používá aktuální název receptu', () => {
    const logs = [
      log('a', 'Starý název', '2026-08-01'),
      log('a', 'Starý název', '2026-08-05'),
      log('b', 'B', '2026-08-06'),
    ];
    const stats = computeCookingStats(logs, [recipe('a', 'Guláš'), recipe('b', 'B')], '2026-08-19');
    expect(stats.top[0]).toMatchObject({ recipeId: 'a', name: 'Guláš', count: 2, exists: true });
    expect(stats.top[1]).toMatchObject({ recipeId: 'b', count: 1 });
  });

  it('průměruje kalorie porce jen z záznamů, co je mají', () => {
    const logs = [log('a', 'A', '2026-08-10', 500), log('a', 'A', '2026-08-11', 300), log('a', 'A', '2026-08-12')];
    const stats = computeCookingStats(logs, [recipe('a', 'A')], '2026-08-19');
    expect(stats.avgPortionKcal).toBe(400); // (500 + 300) / 2, prázdný se nepočítá
  });

  it('smazaný recept se počítá do historie, jméno vezme ze snímku, nejde otevřít', () => {
    const logs = [log('gone', 'Zmizelý', '2026-08-10')];
    const stats = computeCookingStats(logs, [recipe('gone', 'Zmizelý', true)], '2026-08-19');
    expect(stats.totalCooks).toBe(1);
    expect(stats.neverCookedCount).toBe(0);
    expect(stats.top[0]).toMatchObject({ name: 'Zmizelý', exists: false });
  });
});
