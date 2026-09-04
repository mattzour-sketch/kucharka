import { describe, expect, it } from 'vitest';
import {
  convertAmountUnit,
  deriveInitialAmountValue,
  resolveAmount,
  unitOptionsForFood,
  type AmountUnitOption,
} from './amount';

const G: AmountUnitOption = { id: 'g', kind: 'g', label: 'g', gramsPerUnit: 1 };
const KS = (grams: number): AmountUnitOption => ({ id: 'ks', kind: 'ks', label: 'ks', gramsPerUnit: grams });
const P = (id: string, label: string, grams: number): AmountUnitOption => ({
  id,
  kind: 'portion',
  label,
  gramsPerUnit: grams,
});

describe('unitOptionsForFood', () => {
  it('bez kusu a bez měr nabídne jen g', () => {
    expect(unitOptionsForFood({ pieceGrams: null }, [])).toEqual([G]);
    expect(unitOptionsForFood(undefined, [])).toEqual([G]);
  });

  it('s hmotností kusu přidá ks', () => {
    expect(unitOptionsForFood({ pieceGrams: 60 }, [])).toEqual([G, KS(60)]);
  });

  it('přidá platné míry v pořadí a vynechá nevalidní', () => {
    const options = unitOptionsForFood({ pieceGrams: null }, [
      { id: 'a', label: 'lžíce', grams: 15 },
      { id: 'b', label: '', grams: 10 },
      { id: 'c', label: 'hrnek', grams: 0 },
      { id: 'd', label: 'plátek', grams: 20 },
    ]);
    expect(options).toEqual([G, P('a', 'lžíce', 15), P('d', 'plátek', 20)]);
  });
});

describe('resolveAmount', () => {
  it('g: prázdné → null, „0" → 0, číslo → gramy', () => {
    expect(resolveAmount({ unitId: 'g', raw: '' }, [G])).toEqual({ amountG: null, amountKs: null });
    expect(resolveAmount({ unitId: 'g', raw: '0' }, [G])).toEqual({ amountG: 0, amountKs: null });
    expect(resolveAmount({ unitId: 'g', raw: '30' }, [G])).toEqual({ amountG: 30, amountKs: null });
    expect(resolveAmount({ unitId: 'g', raw: '10,5' }, [G])).toEqual({ amountG: 10.5, amountKs: null });
  });

  it('ks: drží počet kusů a dopočte gramáž z hmotnosti kusu', () => {
    const opts = [G, KS(60)];
    expect(resolveAmount({ unitId: 'ks', raw: '2' }, opts)).toEqual({ amountKs: 2, amountG: 120 });
    expect(resolveAmount({ unitId: 'ks', raw: '' }, opts)).toEqual({ amountKs: null, amountG: null });
  });

  it('míra: gramáž = počet × míra, počet 0/prázdno → null (žádné falešné číslo)', () => {
    const opts = [G, P('a', 'lžíce', 15)];
    expect(resolveAmount({ unitId: 'a', raw: '2' }, opts)).toEqual({ amountG: 30, amountKs: null });
    expect(resolveAmount({ unitId: 'a', raw: '0,5' }, opts)).toEqual({ amountG: 7.5, amountKs: null });
    expect(resolveAmount({ unitId: 'a', raw: '0' }, opts)).toEqual({ amountG: null, amountKs: null });
    expect(resolveAmount({ unitId: 'a', raw: '' }, opts)).toEqual({ amountG: null, amountKs: null });
  });

  it('drží plnou přesnost bez předběžného zaokrouhlení', () => {
    const opts = [G, P('a', 'míra', 7)];
    expect(resolveAmount({ unitId: 'a', raw: '3' }, opts).amountG).toBe(21);
    expect(resolveAmount({ unitId: 'a', raw: '0,1' }, opts).amountG).toBeCloseTo(0.7, 10);
  });

  it('neznámá jednotka spadne na první volbu (g)', () => {
    expect(resolveAmount({ unitId: 'zzz', raw: '30' }, [G])).toEqual({ amountG: 30, amountKs: null });
  });
});

describe('convertAmountUnit', () => {
  it('g ↔ ks zachová fyzické gramy', () => {
    const opts = [G, KS(60)];
    expect(convertAmountUnit({ unitId: 'g', raw: '120' }, opts, 'ks')).toEqual({ unitId: 'ks', raw: '2' });
    expect(convertAmountUnit({ unitId: 'ks', raw: '2' }, opts, 'g')).toEqual({ unitId: 'g', raw: '120' });
  });

  it('g ↔ míra zachová fyzické gramy', () => {
    const opts = [G, P('a', 'lžíce', 15)];
    expect(convertAmountUnit({ unitId: 'g', raw: '30' }, opts, 'a')).toEqual({ unitId: 'a', raw: '2' });
    expect(convertAmountUnit({ unitId: 'a', raw: '2' }, opts, 'g')).toEqual({ unitId: 'g', raw: '30' });
  });

  it('prázdná hodnota zůstane prázdná při přepnutí', () => {
    const opts = [G, KS(60)];
    expect(convertAmountUnit({ unitId: 'g', raw: '' }, opts, 'ks')).toEqual({ unitId: 'ks', raw: '' });
  });
});

describe('deriveInitialAmountValue', () => {
  const opts = [G, P('p-lzice', 'lžíce', 15)];

  it('uložené ks → jednotka ks', () => {
    const o = [G, KS(60)];
    expect(deriveInitialAmountValue({ amountKs: 2, amountG: 120, rawText: '2 vejce' }, o)).toEqual({
      unitId: 'ks',
      raw: '2',
    });
  });

  it('gramáž sedící na míru z textu → ukáže míru', () => {
    expect(deriveInitialAmountValue({ amountG: 30, amountKs: null, rawText: '2 lžíce oleje' }, opts)).toEqual({
      unitId: 'p-lzice',
      raw: '2',
    });
  });

  it('gramáž nesedící na míru → holé gramy', () => {
    expect(deriveInitialAmountValue({ amountG: 31, amountKs: null, rawText: '2 lžíce oleje' }, opts)).toEqual({
      unitId: 'g',
      raw: '31',
    });
  });

  it('text bez míry → holé gramy', () => {
    expect(deriveInitialAmountValue({ amountG: 30, amountKs: null, rawText: 'olej' }, opts)).toEqual({
      unitId: 'g',
      raw: '30',
    });
  });

  it('nic uloženého → prázdné g', () => {
    expect(deriveInitialAmountValue({ amountG: null, amountKs: null, rawText: 'olej' }, opts)).toEqual({
      unitId: 'g',
      raw: '',
    });
  });
});
