import { describe, expect, it } from 'vitest';
import { matchPortionInText } from './portionMatch';

const portions = [
  { id: 'p-lzice', label: 'lžíce' },
  { id: 'p-hrnek', label: 'hrnek' },
  { id: 'p-platek', label: 'plátek' },
];

describe('matchPortionInText', () => {
  it('rozpozná „2 lžíce oleje" → míra lžíce, počet 2', () => {
    expect(matchPortionInText('2 lžíce oleje', portions)).toEqual({ portionId: 'p-lzice', count: 2 });
  });

  it('sedí i na skloňovaný tvar se stejným kmenem („1 lžíci", „3 lžic")', () => {
    expect(matchPortionInText('1 lžíci soli', portions)).toEqual({ portionId: 'p-lzice', count: 1 });
    expect(matchPortionInText('3 lžic mouky', portions)).toEqual({ portionId: 'p-lzice', count: 3 });
  });

  it('desetinný i zlomkový počet', () => {
    expect(matchPortionInText('0,5 lžíce medu', portions)).toEqual({ portionId: 'p-lzice', count: 0.5 });
    expect(matchPortionInText('1/2 lžíce oleje', portions)).toEqual({ portionId: 'p-lzice', count: 0.5 });
  });

  it('bez čísla vrátí null', () => {
    expect(matchPortionInText('lžíce oleje', portions)).toBeNull();
  });

  it('když slovo za číslem není žádná z měr, vrátí null (žádná falešná shoda)', () => {
    expect(matchPortionInText('2 stroužky česneku', portions)).toBeNull();
    expect(matchPortionInText('2 velké lžíce mouky', portions)).toBeNull();
  });

  it('nezamění „lžíce" za „lžička" (konzervativní shoda na kmen, ne prefix)', () => {
    const p = [{ id: 'p-lzicka', label: 'lžička' }];
    expect(matchPortionInText('2 lžíce oleje', p)).toBeNull();
  });

  it('bez měr vrátí null', () => {
    expect(matchPortionInText('2 lžíce oleje', [])).toBeNull();
  });

  it('nemění vstupní text (čistá funkce)', () => {
    const input = '  2 lžíce oleje ';
    matchPortionInText(input, portions);
    expect(input).toBe('  2 lžíce oleje ');
  });
});
