import { describe, expect, it } from 'vitest';
import {
  convertAmountUnit,
  deriveInitialAmountValue,
  resolveAmount,
  unitOptionsForFood,
  type AmountUnitOption,
} from './amount';

/**
 * REVIEW testy (UC017) – nezávislé na produkčních testech. Cíl: chytit regrese
 * dnešního g/ks toku, přesnost (pravidlo 9), rule 4 (prázdný/0 počet) a hraniční
 * chování `deriveInitialAmountValue`. Nesahá do produkčního kódu.
 */

const G: AmountUnitOption = { id: 'g', kind: 'g', label: 'g', gramsPerUnit: 1 };
const KS = (grams: number): AmountUnitOption => ({ id: 'ks', kind: 'ks', label: 'ks', gramsPerUnit: grams });
const P = (id: string, label: string, grams: number): AmountUnitOption => ({
  id,
  kind: 'portion',
  label,
  gramsPerUnit: grams,
});

describe('regrese dnešního g/ks toku (rizika 1)', () => {
  it('potravina bez měr a bez kusu nabídne přesně [g]', () => {
    expect(unitOptionsForFood({ pieceGrams: null }, [])).toEqual([G]);
    expect(unitOptionsForFood(undefined, [])).toEqual([G]);
  });

  it('potravina s pieceGrams (bez měr) nabídne přesně [g, ks] – žádná míra navíc', () => {
    const options = unitOptionsForFood({ pieceGrams: 60 }, []);
    expect(options).toEqual([G, KS(60)]);
    expect(options.some((o) => o.kind === 'portion')).toBe(false);
  });

  it('resolveAmount pro g je bajt-identické s dneškem (amountKs vždy null)', () => {
    expect(resolveAmount({ unitId: 'g', raw: '30' }, [G])).toEqual({ amountG: 30, amountKs: null });
    expect(resolveAmount({ unitId: 'g', raw: '0' }, [G])).toEqual({ amountG: 0, amountKs: null });
    expect(resolveAmount({ unitId: 'g', raw: '' }, [G])).toEqual({ amountG: null, amountKs: null });
    // desetinná čárka (český vstup)
    expect(resolveAmount({ unitId: 'g', raw: '12,5' }, [G])).toEqual({ amountG: 12.5, amountKs: null });
  });

  it('resolveAmount pro ks drží počet i dopočet gramáže z hmotnosti kusu (beze změny)', () => {
    const opts = [G, KS(60)];
    expect(resolveAmount({ unitId: 'ks', raw: '2' }, opts)).toEqual({ amountKs: 2, amountG: 120 });
    expect(resolveAmount({ unitId: 'ks', raw: '1,5' }, opts)).toEqual({ amountKs: 1.5, amountG: 90 });
    expect(resolveAmount({ unitId: 'ks', raw: '' }, opts)).toEqual({ amountKs: null, amountG: null });
  });
});

describe('rule 4 – prázdný / nulový / záporný počet u míry → žádné falešné kcal', () => {
  const opts = [G, P('a', 'lžíce', 15)];
  it('počet 0 nebo prázdno → amountG null', () => {
    expect(resolveAmount({ unitId: 'a', raw: '0' }, opts)).toEqual({ amountG: null, amountKs: null });
    expect(resolveAmount({ unitId: 'a', raw: '' }, opts)).toEqual({ amountG: null, amountKs: null });
    expect(resolveAmount({ unitId: 'a', raw: '   ' }, opts)).toEqual({ amountG: null, amountKs: null });
  });
  it('záporný počet u míry → amountG null (nedá zápornou gramáž)', () => {
    expect(resolveAmount({ unitId: 'a', raw: '-2' }, opts)).toEqual({ amountG: null, amountKs: null });
  });
});

describe('pravidlo 9 – plná přesnost, žádné pre-rounding při násobení mírou', () => {
  it('součet 30 položek z míry nesmí nasčítat zaokrouhlovací odchylku', () => {
    // 1 lžíce = 7 g, potravina 33 kcal/100 g → 1 položka = 2,31 kcal
    const opts = [G, P('a', 'lžíce', 7)];
    let totalKcal = 0;
    let totalG = 0;
    for (let i = 0; i < 30; i += 1) {
      const { amountG } = resolveAmount({ unitId: 'a', raw: '1' }, opts);
      expect(amountG).toBe(7); // přesně 7, ne 7.0000001, ne zaokrouhleno
      totalG += amountG as number;
      totalKcal += (33 * (amountG as number)) / 100;
    }
    expect(totalG).toBe(210);
    // 30 × 2,31 = 69,3 – kdyby se zaokrouhlovalo po položce (2 kcal), vyšlo by 60
    expect(totalKcal).toBeCloseTo(69.3, 10);
  });

  it('desetinný počet × míra drží přesnost', () => {
    const opts = [G, P('a', 'míra', 7)];
    expect(resolveAmount({ unitId: 'a', raw: '0,1' }, opts).amountG).toBeCloseTo(0.7, 12);
    expect(resolveAmount({ unitId: 'a', raw: '3' }, opts).amountG).toBe(21);
  });
});

describe('koexistence pieceGrams + pojmenované míry (hraniční bod 9)', () => {
  it('jeden picker nabídne g, ks i každou míru', () => {
    const options = unitOptionsForFood({ pieceGrams: 50 }, [
      { id: 'p1', label: 'lžíce', grams: 15 },
      { id: 'p2', label: 'hrnek', grams: 250 },
    ]);
    expect(options.map((o) => o.id)).toEqual(['g', 'ks', 'p1', 'p2']);
    expect(resolveAmount({ unitId: 'ks', raw: '2' }, options)).toEqual({ amountKs: 2, amountG: 100 });
    expect(resolveAmount({ unitId: 'p2', raw: '2' }, options)).toEqual({ amountG: 500, amountKs: null });
  });

  it('uložené ks zůstane „ks" i když potravina má navíc míry', () => {
    const options = unitOptionsForFood({ pieceGrams: 50 }, [{ id: 'p1', label: 'lžíce', grams: 15 }]);
    expect(
      deriveInitialAmountValue({ amountKs: 2, amountG: 100, rawText: '2 vejce' }, options),
    ).toEqual({ unitId: 'ks', raw: '2' });
  });
});

describe('deriveInitialAmountValue – gate na shodu s textem (false-positive nízko)', () => {
  const opts = [G, P('p', 'lžíce', 15)];

  it('gramáž přesně na počet×míru → ukáže míru', () => {
    expect(deriveInitialAmountValue({ amountG: 30, amountKs: null, rawText: '2 lžíce oleje' }, opts)).toEqual({
      unitId: 'p',
      raw: '2',
    });
  });

  it('gramáž mimo toleranci (>0,5 g) → holé gramy', () => {
    expect(deriveInitialAmountValue({ amountG: 30.6, amountKs: null, rawText: '2 lžíce oleje' }, opts)).toEqual({
      unitId: 'g',
      raw: '30.6',
    });
  });

  it('text bez rozpoznané míry → holé gramy i když číselně vychází', () => {
    // 30 g = 2×15, ale text „olej" nemá počet ani název míry → nesmí předstírat míru
    expect(deriveInitialAmountValue({ amountG: 30, amountKs: null, rawText: 'olej' }, opts)).toEqual({
      unitId: 'g',
      raw: '30',
    });
  });

  it('POZOR (dokumentace tolerance): amountG 30,4 se shodí na „2 lžíce" (diff 0,4 < 0,5)', () => {
    // Uvnitř tolerance se ukáže míra, i když uložená gramáž je 30,4 (ne 30).
    // Data se nemění dokud uživatel nesáhne; případné re-uložení by posunulo o <0,5 g.
    expect(deriveInitialAmountValue({ amountG: 30.4, amountKs: null, rawText: '2 lžíce oleje' }, opts)).toEqual({
      unitId: 'p',
      raw: '2',
    });
  });

  it('nic uloženého → prázdné g', () => {
    expect(deriveInitialAmountValue({ amountG: null, amountKs: null, rawText: 'olej' }, opts)).toEqual({
      unitId: 'g',
      raw: '',
    });
  });
});

describe('convertAmountUnit – zachování fyzických gramů + dokumentace driftu', () => {
  it('g ↔ míra zachová gramy, když dělení vyjde přesně', () => {
    const opts = [G, P('a', 'lžíce', 15)];
    expect(convertAmountUnit({ unitId: 'g', raw: '30' }, opts, 'a')).toEqual({ unitId: 'a', raw: '2' });
    expect(convertAmountUnit({ unitId: 'a', raw: '2' }, opts, 'g')).toEqual({ unitId: 'g', raw: '30' });
  });

  it('POZOR (stejný drift jako dnešní g↔ks): nedělitelný převod zaokrouhlí zobrazený počet', () => {
    // 15 g / 7 g na míru = 2,142857… → zobrazí 2,14 → re-resolve dá 14,98 g, ne 15.
    const opts = [G, P('a', 'míra7', 7)];
    const converted = convertAmountUnit({ unitId: 'g', raw: '15' }, opts, 'a');
    expect(converted).toEqual({ unitId: 'a', raw: '2.14' });
    const back = resolveAmount(converted, opts);
    expect(back.amountG).toBeCloseTo(14.98, 10);
    expect(back.amountG).not.toBe(15);
  });
});

describe('OO7 – dedup: unitOptionsForFood NEdeduplikuje stejné názvy (mezera)', () => {
  it('dvě míry stejného názvu → dvě volby (dedup je jen v editoru, ne při stavbě voleb / addPortion)', () => {
    // Dokumentuje reálnou mezeru: inline „+ míra" (addPortion) ani unitOptionsForFood
    // dedup neřeší, takže v pickeru můžou být dvě „lžíce". OO7 slibuje jednu.
    const options = unitOptionsForFood({ pieceGrams: null }, [
      { id: 'p1', label: 'lžíce', grams: 15 },
      { id: 'p2', label: 'lžíce', grams: 20 },
    ]);
    expect(options.filter((o) => o.label === 'lžíce')).toHaveLength(2);
  });
});
