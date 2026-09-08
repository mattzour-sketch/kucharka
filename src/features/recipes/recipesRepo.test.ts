import { describe, expect, it } from 'vitest';
import type { Recipe, RecipeItem } from '../../db';
import { buildRecipeCopy } from './recipesRepo';

function recipe(patch: Partial<Recipe> & { id: string }): Recipe {
  return {
    name: 'Guláš',
    capturedOn: '2026-01-01',
    rawCapture: 'syrová data',
    instructions: 'vař',
    servings: 4,
    cookedWeightG: 1200,
    tags: ['oběd'],
    isFavorite: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...patch,
  };
}

function item(id: string, sortOrder: number, patch: Partial<RecipeItem> = {}): RecipeItem {
  return {
    id,
    recipeId: 'orig',
    rawText: id,
    foodId: null,
    subRecipeId: null,
    amountG: null,
    amountKs: null,
    isSkipped: false,
    note: null,
    sortOrder,
    ...patch,
  };
}

function counter() {
  let n = 0;
  return () => `new-${++n}`;
}

describe('buildRecipeCopy', () => {
  it('vytvoří samostatnou kopii s novým id, názvem „(kopie)" a bez oblíbenosti', () => {
    const orig = recipe({ id: 'orig' });
    const { recipe: copy } = buildRecipeCopy(orig, [], '2026-09-07T10:00:00.000Z', counter());
    expect(copy.id).toBe('new-1');
    expect(copy.name).toBe('Guláš (kopie)');
    expect(copy.isFavorite).toBe(false);
    expect(copy.deletedAt).toBeNull();
    expect(copy.capturedOn).toBe('2026-09-07');
    // převzatý obsah
    expect(copy.instructions).toBe('vař');
    expect(copy.servings).toBe(4);
    expect(copy.tags).toEqual(['oběd']);
  });

  it('zkopíruje položky s novými id, novým recipeId a zachovaným napojením/textem', () => {
    const orig = recipe({ id: 'orig' });
    const items = [
      item('a', 0, { rawText: '200 g hovězí', foodId: 'beef', amountG: 200 }),
      item('b', 1, { rawText: 'bešamel', subRecipeId: 'bes', amountG: 250 }),
    ];
    const { recipe: copy, items: copied } = buildRecipeCopy(orig, items, '2026-09-07T10:00:00.000Z', counter());
    expect(copied).toHaveLength(2);
    expect(copied.every((it) => it.recipeId === copy.id)).toBe(true);
    expect(copied.map((it) => it.id)).toEqual(['new-2', 'new-3']); // new-1 = recept
    expect(copied[0]).toMatchObject({ rawText: '200 g hovězí', foodId: 'beef', amountG: 200 });
    expect(copied[1]).toMatchObject({ rawText: 'bešamel', subRecipeId: 'bes', amountG: 250 });
  });

  it('nemění originál (recept ani položky)', () => {
    const orig = recipe({ id: 'orig' });
    const items = [item('a', 0)];
    buildRecipeCopy(orig, items, '2026-09-07T10:00:00.000Z', counter());
    expect(orig.id).toBe('orig');
    expect(orig.isFavorite).toBe(true);
    expect(items[0].recipeId).toBe('orig');
  });

  it('recept bez názvu dostane „(kopie)"', () => {
    const { recipe: copy } = buildRecipeCopy(recipe({ id: 'x', name: '' }), [], '2026-09-07T10:00:00.000Z', counter());
    expect(copy.name).toBe('(kopie)');
  });
});
