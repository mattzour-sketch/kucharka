import { describe, expect, it } from 'vitest';
import { combineRawCapture, splitIngredientLines } from './recipeText';

describe('recipeText', () => {
  it('splitIngredientLines vyhodí prázdné řádky a ořeže mezery', () => {
    expect(splitIngredientLines('4 brambory\n\n  2 vejce \n')).toEqual(['4 brambory', '2 vejce']);
  });

  it('splitIngredientLines na prázdném vstupu vrátí prázdné pole', () => {
    expect(splitIngredientLines('   \n  ')).toEqual([]);
  });

  it('combineRawCapture spojí suroviny a postup prázdným řádkem', () => {
    expect(combineRawCapture('4 brambory\n2 vejce', 'Osmažit.')).toBe('4 brambory\n2 vejce\n\nOsmažit.');
  });

  it('combineRawCapture zvládne jen jednu část', () => {
    expect(combineRawCapture('4 brambory', '')).toBe('4 brambory');
    expect(combineRawCapture('', 'Osmažit.')).toBe('Osmažit.');
  });

  it('combineRawCapture vrátí null, když není nic', () => {
    expect(combineRawCapture('  ', '')).toBeNull();
  });
});
