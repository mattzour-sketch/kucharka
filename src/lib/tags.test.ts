import { describe, expect, it } from 'vitest';
import { addTag, normalizeTag, removeTag } from './tags';

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
