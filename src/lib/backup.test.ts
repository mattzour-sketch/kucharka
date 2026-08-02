import { describe, expect, it } from 'vitest';
import type { Recipe } from '../db';
import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, serializeBackup, type BackupData } from './backup';

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
  };
}

const recipe: Recipe = {
  id: 'r1',
  name: 'Babiččin bramborák',
  source: 'babička Marie',
  capturedOn: '2026-08-02',
  rawCapture: '4 velký brambory\n2 vejce\nhrst mouky',
  tags: [],
  isFavorite: false,
  createdAt: '2026-08-02T18:00:00.000Z',
  updatedAt: '2026-08-02T18:00:00.000Z',
};

describe('backup', () => {
  it('round-trip zachová recept beze změny', () => {
    const data = emptyData();
    data.recipes.push(recipe);

    const json = serializeBackup(data);
    const restored = parseBackup(json);

    expect(restored.recipes).toHaveLength(1);
    expect(restored.recipes[0]).toEqual(recipe);
  });

  it('obálka nese formát, verzi a čas exportu', () => {
    const json = serializeBackup(emptyData(), new Date('2026-08-02T10:00:00.000Z'));
    const obj = JSON.parse(json);
    expect(obj.format).toBe(BACKUP_FORMAT);
    expect(obj.version).toBe(BACKUP_VERSION);
    expect(obj.exportedAt).toBe('2026-08-02T10:00:00.000Z');
  });

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

  it('chybějící tabulky doplní jako prázdné', () => {
    const json = JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, data: {} });
    const data = parseBackup(json);
    expect(data.recipes).toEqual([]);
    expect(data.foods).toEqual([]);
    expect(data.logEntries).toEqual([]);
  });
});
