import { describe, expect, it } from 'vitest';
import { parseDecimal, round } from './num';

describe('num', () => {
  it('parseDecimal přijme tečku i českou čárku', () => {
    expect(parseDecimal('10.5')).toBe(10.5);
    expect(parseDecimal('10,5')).toBe(10.5);
    expect(parseDecimal(' 400 ')).toBe(400);
  });

  it('parseDecimal vrátí null pro prázdné a nevalidní', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });

  it('round zaokrouhlí na daný počet míst', () => {
    expect(round(89.3866, 2)).toBe(89.39);
    expect(round(335.2, 0)).toBe(335);
  });
});
