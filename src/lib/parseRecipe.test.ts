import { describe, expect, it } from 'vitest';
import { buildRecipeText } from './shareText';
import { parseRecipeText } from './parseRecipe';

describe('parseRecipe', () => {
  it('přečte formát, který appka sama vypisuje (round-trip se sdílením)', () => {
    const text = buildRecipeText({
      name: 'Rizoto',
      portions: 4,
      ingredients: ['400 g kuřecí prsa', '200 g rýže'],
      instructions: 'Orestovat.\nZalít vodou.',
    });
    expect(parseRecipeText(text)).toEqual({
      name: 'Rizoto',
      servings: 4,
      ingredients: ['400 g kuřecí prsa', '200 g rýže'],
      instructions: 'Orestovat.\nZalít vodou.',
    });
  });

  it('u přeškálovaného vezme cílový počet porcí, ne původní', () => {
    const text = 'Rizoto\nPorce: 6 (přepočteno z 4)\n\nSuroviny:\n- 600 g rýže';
    const parsed = parseRecipeText(text);
    expect(parsed.servings).toBe(6);
    expect(parsed.ingredients).toEqual(['600 g rýže']);
  });

  it('běžný text: prázdný řádek dělí suroviny od postupu', () => {
    const text = 'Bramborák\n4 brambory\n2 vejce\nhrst mouky\n\nNastrouhat, osmažit.';
    expect(parseRecipeText(text)).toEqual({
      name: 'Bramborák',
      servings: null,
      ingredients: ['4 brambory', '2 vejce', 'hrst mouky'],
      instructions: 'Nastrouhat, osmažit.',
    });
  });

  it('běžný text bez prázdného řádku: odrážky = suroviny, zbytek postup', () => {
    const text = 'Guláš\n- 500 g hovězího\n- 2 cibule\nOsmažit maso.\nPřidat cibuli.';
    expect(parseRecipeText(text)).toEqual({
      name: 'Guláš',
      servings: null,
      ingredients: ['500 g hovězího', '2 cibule'],
      instructions: 'Osmažit maso.\nPřidat cibuli.',
    });
  });
});
