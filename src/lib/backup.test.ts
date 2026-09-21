import { describe, expect, it } from 'vitest';
import type { CookLog, Recipe, ShoppingItem } from '../db';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  computeRestoreImpact,
  parseBackup,
  serializeBackup,
  type BackupData,
} from './backup';

function emptyData(): BackupData {
  return {
    foods: [],
    foodPortions: [],
    recipes: [],
    recipeItems: [],
    recipeNotes: [],
    logEntries: [],
    goals: [],
    weightEntries: [],
    cookLogs: [],
    shoppingItems: [],
    photos: [],
  };
}

function makeRecipe(id: string, updatedAt: string): Recipe {
  return {
    id,
    name: `Recept ${id}`,
    capturedOn: '2026-08-02',
    tags: [],
    isFavorite: false,
    createdAt: '2026-08-02T18:00:00.000Z',
    updatedAt,
  };
}

function makeCookLog(id: string): CookLog {
  return {
    id,
    recipeId: 'r1',
    recipeName: 'Recept',
    cookedOn: '2026-08-02',
    portions: 4,
    ingredients: [],
    note: null,
    offItemIds: [],
    amountOverrides: {},
    createdAt: '2026-08-02T18:00:00.000Z',
  };
}

function makeShoppingItem(id: string): ShoppingItem {
  return { id, text: 'mouka', checked: false, createdAt: '2026-08-02T18:00:00.000Z', sortOrder: 0 };
}

describe('backup – round-trip a formát', () => {
  it('round-trip zachová recept, historii vaření i nákup', () => {
    const data = emptyData();
    data.recipes.push(makeRecipe('r1', '2026-08-02T18:00:00.000Z'));
    data.cookLogs.push(makeCookLog('c1'));
    data.shoppingItems.push(makeShoppingItem('s1'));

    const restored = parseBackup(serializeBackup(data));

    expect(restored.data.recipes).toHaveLength(1);
    expect(restored.data.recipes[0]).toEqual(data.recipes[0]);
    expect(restored.data.cookLogs).toEqual(data.cookLogs);
    expect(restored.data.shoppingItems).toEqual(data.shoppingItems);
    expect(restored.present).toEqual({ cookLogs: true, shoppingItems: true });
  });

  it('obálka nese formát, verzi a čas exportu', () => {
    const json = serializeBackup(emptyData(), new Date('2026-08-02T10:00:00.000Z'));
    const obj = JSON.parse(json);
    expect(obj.format).toBe(BACKUP_FORMAT);
    expect(obj.version).toBe(BACKUP_VERSION);
    expect(obj.exportedAt).toBe('2026-08-02T10:00:00.000Z');
  });
});

describe('backup – odmítnutí vadného souboru', () => {
  it('odmítne cizí JSON', () => {
    expect(() => parseBackup('{"format":"neco-jineho"}')).toThrow(/není záloha/);
  });

  it('odmítne nevalidní JSON', () => {
    expect(() => parseBackup('tohle není json')).toThrow();
  });

  it('odmítne zálohu z novější verze', () => {
    const json = JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, data: {} });
    expect(() => parseBackup(json)).toThrow(/novější verze/);
  });
});

describe('backup – kompatibilita v1 → v2', () => {
  it('stará v1 záloha bez cookLogs/shoppingItems projde jako prázdné a present=false', () => {
    const v1 = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { recipes: [makeRecipe('r1', '2026-01-01T00:00:00.000Z')] },
    });
    const parsed = parseBackup(v1);
    expect(parsed.data.recipes).toHaveLength(1);
    expect(parsed.data.cookLogs).toEqual([]);
    expect(parsed.data.shoppingItems).toEqual([]);
    expect(parsed.present).toEqual({ cookLogs: false, shoppingItems: false });
  });
});

describe('computeRestoreImpact', () => {
  it('rozliší nové, přepsané a novější-v-DB recepty', () => {
    const backup = emptyData();
    backup.recipes.push(makeRecipe('r1', '2026-08-01T00:00:00.000Z')); // starší než v DB
    backup.recipes.push(makeRecipe('r2', '2026-08-01T00:00:00.000Z')); // v DB není → nový

    const impact = computeRestoreImpact(backup, {
      recipes: [{ id: 'r1', updatedAt: '2026-08-10T00:00:00.000Z' }], // r1 mám novější
      cookLogIds: [],
      shoppingItemIds: [],
    });

    expect(impact.recipes).toEqual({ added: 1, overwritten: 1, newerInDb: 1 });
  });

  it('spočítá, kolik smazaných položek vaření a nákupu se vrátí', () => {
    const backup = emptyData();
    backup.cookLogs.push(makeCookLog('c1'), makeCookLog('c2'));
    backup.shoppingItems.push(makeShoppingItem('s1'));

    const impact = computeRestoreImpact(backup, {
      recipes: [],
      cookLogIds: ['c1'], // c2 v DB není → přibude
      shoppingItemIds: [], // s1 v DB není → přibude
    });

    expect(impact.cookLogsRevived).toBe(1);
    expect(impact.shoppingItemsRevived).toBe(1);
  });
});
