import { describe, expect, it } from 'vitest';
import type { RecipeItem } from '../db';
import { pairEditedLines, textSimilarity } from './itemPairing';

function item(id: string, rawText: string, sortOrder: number, foodId: string | null = null): RecipeItem {
  return { id, recipeId: 'r', rawText, foodId, isSkipped: false, sortOrder };
}

const ids = (paired: (RecipeItem | null)[]) => paired.map((entry) => entry?.id ?? null);

describe('pairEditedLines', () => {
  const existing = [
    item('a', '200 g mouky', 0, 'mouka'),
    item('b', '2 vejce', 1, 'vejce'),
    item('c', '100 g másla', 2, 'maslo'),
  ];

  it('stejný text se spáruje jako dřív, i při změně pořadí', () => {
    expect(ids(pairEditedLines(existing, ['2 vejce', '200 g mouky', '100 g másla']))).toEqual(['b', 'a', 'c']);
  });

  it('změna množství (stejná potravina) nechá napojení', () => {
    expect(ids(pairEditedLines(existing, ['250 g mouky', '3 vejce', '100 g másla']))).toEqual(['a', 'b', 'c']);
  });

  it('oprava překlepu nechá napojení', () => {
    const typo = [item('a', '200 g mukoy', 0, 'mouka')];
    expect(ids(pairEditedLines(typo, ['200 g mouky']))).toEqual(['a']);
  });

  it('úplně jiná surovina je nová položka; smazaná zmizí', () => {
    expect(ids(pairEditedLines(existing, ['200 g mouky', '1 lžička skořice']))).toEqual(['a', null]);
  });

  it('každá položka nejvýš jednou (dvakrát stejná surovina)', () => {
    const twice = [item('a', 'špetka soli', 0), item('b', 'špetka soli', 1)];
    expect(ids(pairEditedLines(twice, ['špetka soli', 'špetka soli', 'špetka soli']))).toEqual(['a', 'b', null]);
  });

  it('nadpis sekce jen s nadpisem', () => {
    const withHeading = [item('h', '# Na těsto', 0), item('a', '200 g mouky', 1, 'mouka')];
    expect(ids(pairEditedLines(withHeading, ['# Na těstíčko', '200 g mouky']))).toEqual(['h', 'a']);
    expect(ids(pairEditedLines([item('h', '# Mouka', 0)], ['200 g mouky']))).toEqual([null]);
  });
});

describe('textSimilarity', () => {
  it('překlep je podobný, jiná surovina ne', () => {
    expect(textSimilarity('200 g mukoy', '200 g mouky')).toBeGreaterThan(0.75);
    expect(textSimilarity('200 g mouky', '1 lžička skořice')).toBeLessThan(0.5);
  });
});
