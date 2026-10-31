import { describe, expect, it } from 'vitest';
import { combineRawCapture, cookingSteps, recipeSnippet, splitIngredientLines } from './recipeText';

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
  it('vynechá nadpisy sekcí a oddělí řádky „ · "', () => {
    expect(recipeSnippet('Rice: 2 bowls\n# Sauce\nGinger: 1 knob\n\n1. Slice the beef.')).toBe(
      'Rice: 2 bowls · Ginger: 1 knob · 1. Slice the beef.',
    );
  });

  it('„#" uvnitř textu a hashtag bez mezery nejsou nadpis', () => {
    expect(recipeSnippet('200 g mouky #bezlepku\n#tip')).toBe('200 g mouky #bezlepku · #tip');
  });

  it('zkrátí na max znaků s trojtečkou, prázdný vstup → ""', () => {
    expect(recipeSnippet('a'.repeat(130))).toBe(`${'a'.repeat(120)}…`);
    expect(recipeSnippet(null)).toBe('');
    expect(recipeSnippet('# Jen nadpis')).toBe('');
  });

  it('s dotazem jdou napřed řádky, kde se něco našlo (bez diakritiky, kmen)', () => {
    const raw = '800 g brambor\n2 vejce\n3 stroužky česneku\nmajoránka';
    expect(recipeSnippet(raw, 120, 'cesnek')).toBe(
      '3 stroužky česneku · 800 g brambor · 2 vejce · majoránka',
    );
    expect(recipeSnippet(raw, 120, 'vejce majoranka')).toBe(
      '2 vejce · majoránka · 800 g brambor · 3 stroužky česneku',
    );
    expect(recipeSnippet(raw, 120, 'xyz')).toBe(recipeSnippet(raw));
  });
});

describe('cookingSteps', () => {
  it('neprázdné řádky bez vlastního čísla kroku', () => {
    expect(cookingSteps('1. Banány rozmačkej.\n\n2) Přidej máslo.\nKrok 3: Peč.\nStep 4. Serve.')).toEqual([
      'Banány rozmačkej.',
      'Přidej máslo.',
      'Peč.',
      'Serve.',
    ]);
  });

  it('množství na začátku číslo kroku není', () => {
    expect(cookingSteps('2 vejce rozšlehej\n1.5 kg brambor uvař\n10 min odpočinout')).toEqual([
      '2 vejce rozšlehej',
      '1.5 kg brambor uvař',
      '10 min odpočinout',
    ]);
  });

  it('samotné číslo zůstane, prázdný postup → []', () => {
    expect(cookingSteps('1.')).toEqual(['1.']);
    expect(cookingSteps(null)).toEqual([]);
  });
});
