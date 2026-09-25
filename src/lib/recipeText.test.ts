import { describe, expect, it } from 'vitest';
import { combineRawCapture, recipeSnippet, splitIngredientLines } from './recipeText';

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

describe('recipeSnippet', () => {
  it('vynechá nadpisy sekcí a spojí řádky mezerou', () => {
    expect(recipeSnippet('Rice: 2 bowls\n# Sauce\nGinger: 1 knob\n\n1. Slice the beef.')).toBe(
      'Rice: 2 bowls Ginger: 1 knob 1. Slice the beef.',
    );
  });

  it('„#" uvnitř textu a hashtag bez mezery nejsou nadpis', () => {
    expect(recipeSnippet('200 g mouky #bezlepku\n#tip')).toBe('200 g mouky #bezlepku #tip');
  });

  it('zkrátí na max znaků s trojtečkou, prázdný vstup → ""', () => {
    expect(recipeSnippet('a'.repeat(130))).toBe(`${'a'.repeat(120)}…`);
    expect(recipeSnippet(null)).toBe('');
    expect(recipeSnippet('# Jen nadpis')).toBe('');
  });
});
