import { describe, expect, it } from 'vitest';
import type { Recipe } from '../db';
import { foldDiacritics, matchesQuery, normalizeForSearch, recipeHaystack } from './search';

describe('search', () => {
  it('foldDiacritics odstraní českou diakritiku', () => {
    expect(foldDiacritics('žluťoučký kůň')).toBe('zlutoucky kun');
    expect(normalizeForSearch('Česnek')).toBe('cesnek');
  });

  it('matchesQuery ignoruje diakritiku v obou směrech', () => {
    expect(matchesQuery('Bramborák s česnekem', 'cesnek')).toBe(true);
    expect(matchesQuery('Kureci rizoto', 'kuřecí')).toBe(true);
  });

  it('matchesQuery je AND přes tokeny, nezávisle na pořadí', () => {
    expect(matchesQuery('Kuřecí rizoto se smetanou', 'rizoto kureci')).toBe(true);
    expect(matchesQuery('Kuřecí rizoto', 'rizoto hovezi')).toBe(false);
  });

  it('matchesQuery zvládne české skloňování přes kmen (SPEC Příloha A)', () => {
    expect(matchesQuery('zalít smetanou', 'smetana')).toBe(true);
    expect(matchesQuery('přidat česnek', 'cesneku')).toBe(true);
    expect(matchesQuery('nakrájet cibuli', 'cibule')).toBe(true);
  });

  it('prázdný dotaz odpovídá všemu', () => {
    expect(matchesQuery('cokoliv', '')).toBe(true);
    expect(matchesQuery('cokoliv', '   ')).toBe(true);
  });

  it('recipeHaystack pokrývá název, suroviny/postup i štítky', () => {
    const recipe: Pick<Recipe, 'name' | 'rawCapture' | 'instructions' | 'tags'> = {
      name: 'Rizoto',
      rawCapture: '400 g kuřecí prsa\n200 g rýže\n\nzalít smetanou',
      instructions: 'zalít smetanou',
      tags: ['rychlovka'],
    };
    expect(matchesQuery(recipeHaystack(recipe), 'smetana')).toBe(true);
    expect(matchesQuery(recipeHaystack(recipe), 'ryze')).toBe(true);
    expect(matchesQuery(recipeHaystack(recipe), 'rychlovka')).toBe(true);
  });
});
