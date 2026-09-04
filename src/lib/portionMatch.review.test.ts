import { describe, expect, it } from 'vitest';
import { matchPortionInText } from './portionMatch';

/**
 * REVIEW testy pro OO5 (návrh míry z textu). Cíl: potvrdit, že matcher je
 * konzervativní (rule 2 – jen návrh, nikdy nepřepíše text) a zdokumentovat
 * hranice (skloňování s vypadavým „e", scoping na míry té potraviny).
 */

const portions = [
  { id: 'p-lzice', label: 'lžíce' },
  { id: 'p-hrnek', label: 'hrnek' },
];

describe('matchPortionInText – shody a scoping', () => {
  it('rozpozná základní tvar i skloňování se stejným kmenem', () => {
    expect(matchPortionInText('2 lžíce oleje', portions)).toEqual({ portionId: 'p-lzice', count: 2 });
    expect(matchPortionInText('1 lžíci soli', portions)).toEqual({ portionId: 'p-lzice', count: 1 });
    expect(matchPortionInText('3 lžic mouky', portions)).toEqual({ portionId: 'p-lzice', count: 3 });
  });

  it('zlomek i desetinné číslo', () => {
    expect(matchPortionInText('1/2 lžíce', portions)).toEqual({ portionId: 'p-lzice', count: 0.5 });
    expect(matchPortionInText('0,5 lžíce', portions)).toEqual({ portionId: 'p-lzice', count: 0.5 });
  });

  it('scoping: matchuje jen míry té potraviny (prázdný seznam → null)', () => {
    expect(matchPortionInText('2 lžíce oleje', [])).toBeNull();
    expect(matchPortionInText('2 stroužky česneku', portions)).toBeNull();
  });

  it('bez čísla nebo jen číslo → null', () => {
    expect(matchPortionInText('lžíce oleje', portions)).toBeNull();
    expect(matchPortionInText('2', portions)).toBeNull();
  });

  it('nesahá na vstupní text (rule 2 – čistá funkce)', () => {
    const input = '  2 lžíce oleje ';
    matchPortionInText(input, portions);
    expect(input).toBe('  2 lžíce oleje ');
  });
});

describe('matchPortionInText – dokumentované omezení (vypadavé „e")', () => {
  it('„hrnek" (nominativ) sedí', () => {
    expect(matchPortionInText('1 hrnek mouky', portions)).toEqual({ portionId: 'p-hrnek', count: 1 });
  });

  it('POZOR: „2 hrnky/hrnku" se NEshodí s mírou „hrnek" (kmen hrnk ≠ hrnek)', () => {
    // Vědomé omezení: matcher neřeší vypadavé „e". Důsledek: u těchto tvarů
    // se návrh míry nenabídne a spadne se na ruční výběr / gramáž. Není to
    // chyba výpočtu, jen chybějící pohodlí. Guard proti false-positive.
    expect(matchPortionInText('2 hrnky mouky', portions)).toBeNull();
    expect(matchPortionInText('2 hrnku mouky', portions)).toBeNull();
  });

  it('POZOR: matcher = shoda na první míru, ne na nejlepší; první výskyt vyhrává', () => {
    const dup = [
      { id: 'p1', label: 'lžíce' },
      { id: 'p2', label: 'lžíce' },
    ];
    expect(matchPortionInText('2 lžíce', dup)).toEqual({ portionId: 'p1', count: 2 });
  });
});
