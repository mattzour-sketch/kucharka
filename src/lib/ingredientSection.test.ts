import { describe, expect, it } from 'vitest';
import { ingredientHeadingLabel, isIngredientHeading } from './ingredientSection';

describe('isIngredientHeading', () => {
  it('řádek „# …" je nadpis', () => {
    expect(isIngredientHeading('# Na těsto')).toBe(true);
    expect(isIngredientHeading('  # Na náplň  ')).toBe(true);
  });

  it('běžná surovina nadpis není', () => {
    expect(isIngredientHeading('200 g mouky')).toBe(false);
    expect(isIngredientHeading('sůl')).toBe(false);
  });

  it('„#" bez mezery/textu nadpis není (žádná falešná shoda)', () => {
    expect(isIngredientHeading('#hashtag')).toBe(false);
    expect(isIngredientHeading('#')).toBe(false);
    expect(isIngredientHeading('# ')).toBe(false);
  });
});

describe('ingredientHeadingLabel', () => {
  it('odsekne značku a vrátí čistý nadpis', () => {
    expect(ingredientHeadingLabel('# Na těsto')).toBe('Na těsto');
    expect(ingredientHeadingLabel('#   Na náplň')).toBe('Na náplň');
  });

  it('u nenadpisu vrátí původní text', () => {
    expect(ingredientHeadingLabel('200 g mouky')).toBe('200 g mouky');
  });
});
