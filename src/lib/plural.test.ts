import { describe, expect, it } from 'vitest';
import { czechPlural } from './plural';

describe('czechPlural', () => {
  it('vybírá tvar podle počtu (1 / 2–4 / 5+)', () => {
    const forms: [string, string, string] = ['recept', 'recepty', 'receptů'];
    expect(czechPlural(1, forms)).toBe('recept');
    expect(czechPlural(2, forms)).toBe('recepty');
    expect(czechPlural(4, forms)).toBe('recepty');
    expect(czechPlural(5, forms)).toBe('receptů');
    expect(czechPlural(0, forms)).toBe('receptů');
    expect(czechPlural(11, forms)).toBe('receptů');
  });
});
