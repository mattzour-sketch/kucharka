import { describe, expect, it } from 'vitest';
import { addTag, normalizeTag, orderFilterTags, removeTag } from './tags';

describe('tags', () => {
  it('normalizeTag ořeže a sjednotí mezery', () => {
    expect(normalizeTag('  po   babičce ')).toBe('po babičce');
  });

  it('addTag přidá nový štítek', () => {
    expect(addTag(['snídaně'], 'rychlovka')).toEqual(['snídaně', 'rychlovka']);
  });

  it('addTag nepřidá duplicitu bez ohledu na velikost písmen', () => {
    expect(addTag(['Rychlovka'], 'rychlovka')).toEqual(['Rychlovka']);
  });

  it('addTag ignoruje prázdný vstup', () => {
    expect(addTag(['snídaně'], '   ')).toEqual(['snídaně']);
  });

  it('removeTag odebere štítek', () => {
    expect(removeTag(['snídaně', 'rychlovka'], 'snídaně')).toEqual(['rychlovka']);
  });
});

// Převzato z review testů UC029 (dřív přes render CollapsibleTags).
describe('orderFilterTags', () => {
  it('aktivní první i s nejnižším počtem, pak počet sestupně, při shodě localeCompare(cs)', () => {
    const tags = ['avokádo', 'brambory', 'cuketa', 'dýně', 'eidam', 'fazole', 'guláš'];
    const counts = { avokádo: 1, brambory: 9, cuketa: 9, dýně: 2, eidam: 5, fazole: 3, guláš: 7 };
    expect(orderFilterTags(tags, 'avokádo', counts)).toEqual([
      'avokádo',
      'brambory',
      'cuketa',
      'guláš',
      'eidam',
      'fazole',
      'dýně',
    ]);
  });

  it('bez aktivního štítku řadí čistě podle počtu, shoda abecedně', () => {
    expect(orderFilterTags(['losos', 'kuře', 'tofu'], null, { losos: 2, kuře: 2, tofu: 5 })).toEqual([
      'tofu',
      'kuře',
      'losos',
    ]);
  });

  it('chybějící počet = 0; aktivní štítek, který mezi štítky není, se nepřidá', () => {
    expect(orderFilterTags(['beta', 'alfa'], null, {})).toEqual(['alfa', 'beta']);
    expect(orderFilterTags(['alfa'], 'zmizelý', {})).toEqual(['alfa']);
  });
});
