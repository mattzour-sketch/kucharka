import { describe, expect, it } from 'vitest';
import type { CookLog, Recipe, ShoppingItem } from '../db';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  computeRestoreImpact,
  parseBackup,
  summarizeBackup,
  type BackupData,
} from './backup';

/**
 * Doplňkové hrany k backup.test.ts (review UC030): přísné porovnání `updatedAt`
 * v computeRestoreImpact a nezávislost present-flagů v parseBackup. Kdyby se
 * porovnání změnilo na `>=` nebo se present-flagy svázaly, tyhle testy spadnou.
 */

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

describe('computeRestoreImpact – hrany porovnání updatedAt', () => {
  it('stejné updatedAt → přepíše, ale NEhlásí „mám novější" (přísné >, ne >=)', () => {
    const backup = emptyData();
    backup.recipes.push(makeRecipe('r1', '2026-08-05T00:00:00.000Z'));

    const impact = computeRestoreImpact(backup, {
      recipes: [{ id: 'r1', updatedAt: '2026-08-05T00:00:00.000Z' }],
      cookLogs: [],
      shoppingItems: [],
    });

    expect(impact.recipes).toEqual({ added: 0, overwritten: 1, newerInDb: 0 });
  });

  it('záloha novější než DB → přepíše bez varování (newerInDb=0)', () => {
    const backup = emptyData();
    backup.recipes.push(makeRecipe('r1', '2026-08-10T00:00:00.000Z'));

    const impact = computeRestoreImpact(backup, {
      recipes: [{ id: 'r1', updatedAt: '2026-08-01T00:00:00.000Z' }],
      cookLogs: [],
      shoppingItems: [],
    });

    expect(impact.recipes).toEqual({ added: 0, overwritten: 1, newerInDb: 0 });
  });

  it('prázdná záloha i prázdná DB → samé nuly', () => {
    const impact = computeRestoreImpact(emptyData(), { recipes: [], cookLogs: [], shoppingItems: [] });
    expect(impact).toEqual({
      recipes: { added: 0, overwritten: 0, newerInDb: 0 },
      cookLogsRevived: 0,
      shoppingItemsRevived: 0,
    });
  });

  it('položky vaření/nákupu, které v DB už jsou, se nepočítají jako vzkříšené', () => {
    const backup = emptyData();
    backup.cookLogs.push(makeCookLog('c1'));
    backup.shoppingItems.push(makeShoppingItem('s1'));

    const impact = computeRestoreImpact(backup, {
      recipes: [],
      cookLogs: [{ id: 'c1' }],
      shoppingItems: [{ id: 's1' }],
    });

    expect(impact.cookLogsRevived).toBe(0);
    expect(impact.shoppingItemsRevived).toBe(0);
  });
});

describe('parseBackup – present flagy jsou nezávislé', () => {
  it('v2 s cookLogs, ale bez shoppingItems → smíšené present flagy', () => {
    const json = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: '2026-09-01T00:00:00.000Z',
      data: { cookLogs: [] }, // shoppingItems v souboru chybí
    });

    const parsed = parseBackup(json);

    expect(parsed.present).toEqual({ cookLogs: true, shoppingItems: false });
    expect(parsed.data.cookLogs).toEqual([]);
    expect(parsed.data.shoppingItems).toEqual([]);
  });

  it('cookLogs jako ne-pole (poškozené) → present=false a data prázdné pole', () => {
    const json = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      data: { cookLogs: { broken: true }, shoppingItems: [makeShoppingItem('s1')] },
    });

    const parsed = parseBackup(json);

    expect(parsed.present.cookLogs).toBe(false);
    expect(parsed.data.cookLogs).toEqual([]);
    expect(parsed.present.shoppingItems).toBe(true);
    expect(parsed.data.shoppingItems).toHaveLength(1);
  });

  it('summarizeBackup u smíšených flagů rozliší „neobsahuje" jen u chybějící tabulky', () => {
    const json = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      data: { cookLogs: [makeCookLog('c1')] }, // shoppingItems chybí
    });

    const summary = summarizeBackup(parseBackup(json));

    expect(summary.cookLogs).toBe(1);
    expect(summary.hasCookLogs).toBe(true);
    expect(summary.shoppingItems).toBe(0);
    expect(summary.hasShoppingItems).toBe(false);
  });
});
