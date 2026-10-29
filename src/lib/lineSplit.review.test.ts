import { describe, expect, it } from 'vitest';
import {
  proposeIngredientSplit,
  proposeStepSplit,
  splitIngredientLine,
  splitSentences,
} from './lineSplit';

/** Review: pravidlo 2 – rozdělení mění jen oddělovač a mezery, nic jiného. */

const INGREDIENT_LINES = [
  '200 g mouky, 2 vejce, špetka soli',
  '1,5 kg brambor, 0,5 l mléka',
  '200 g sýra (eidam, gouda), 2 vejce, sůl',
  '200 g mouky; 2 vejce; 3 lžíce cukru',
  '• 200 g mouky • 2 vejce • sůl',
  '2 vejce, , sůl,',
  '200 g mouky,2 vejce,3 lžíce cukru',
  '2,5 dl mléka,1,5 kg mouky, sůl',
  'Sůl, Pepř, KMÍN',
  '  200 g mouky ,  2 vejce ,  špetka soli  ',
  '100 g másla (změklého, ne rozpuštěného); 50 g cukru; 2 žloutky',
];

const strip = (text: string, separators: RegExp) => text.replace(separators, '');

describe('lineSplit – pravidlo 2 (znaky textu se nemění)', () => {
  it.each(INGREDIENT_LINES)('suroviny: mimo oddělovače a mezery znak po znaku stejné – %s', (line) => {
    const proposal = proposeIngredientSplit(line);
    const result = proposal?.text ?? line;
    // Odstraněné smějí být jen oddělovače `,;•` a bílé znaky – a jen ty na hloubce 0.
    expect(strip(result, /[\s,;•]/g)).toBe(strip(line, /[\s,;•]/g));
    // Čárky v závorkách a desetinné čárky zůstanou.
    for (const part of splitIngredientLine(line)) expect(line).toContain(part);
  });

  it.each([
    'Smíchej mouku s vejci. Nech 20 min odpočinout. Vyválej a peč na 180 °C.',
    '1. Smíchej mouku. 2. Peč 20 min. 3. Podávej!',
    'Přidej (cca. 2 lžíce) cukru. Pak peč. Podávej „Hned." Hotovo?',
    'Je to hotové? Ano! Podávej... Dobrou chuť.',
    'Peč na 180 °C 1.5 h. Pak vychladit. Nakrájej.',
  ])('postup: mimo mezery znak po znaku stejné, tečky zůstanou – %s', (line) => {
    const result = proposeStepSplit(line)?.text ?? line;
    expect(strip(result, /\s/g)).toBe(strip(line, /\s/g));
  });
});

describe('lineSplit – okrajové případy', () => {
  it('nadpis s mezerami na začátku se nedělí', () => {
    expect(proposeIngredientSplit('  # Na těsto, polevu, krém')).toBeNull();
  });

  it('odrážky na začátku řádku: žádná prázdná část', () => {
    expect(splitIngredientLine('• 200 g mouky • 2 vejce • sůl')).toEqual([
      '200 g mouky',
      '2 vejce',
      'sůl',
    ]);
  });

  it('čárka bez mezery mezi slovem a číslem je oddělovač, mezi číslicemi desetinná', () => {
    expect(splitIngredientLine('2,5 dl mléka,1,5 kg mouky, sůl')).toEqual([
      '2,5 dl mléka',
      '1,5 kg mouky',
      'sůl',
    ]);
  });

  it('„2 vejce, sůl" (jen jedna část s číslem) nabídku nespustí', () => {
    expect(proposeIngredientSplit('2 vejce, sůl')).toBeNull();
  });

  it('nedělí se automaticky: řádek, který nabídku nesplní, zůstane i s čárkou (P3-4)', () => {
    const text = '200 g mouky, 2 vejce, sůl\nsůl, pepř\n\n# Na krém, polevu';
    expect(proposeIngredientSplit(text)?.text).toBe(
      '200 g mouky\n2 vejce\nsůl\nsůl, pepř\n\n# Na krém, polevu',
    );
  });

  it('idempotence nad celým korpusem surovin', () => {
    for (const line of INGREDIENT_LINES) {
      const first = proposeIngredientSplit(line);
      if (first) expect(proposeIngredientSplit(first.text)).toBeNull();
    }
  });

  it('nezlomitelná mezera mezi větami se bere jako mezera', () => {
    expect(splitSentences('Rozpal pánev. Přidej máslo. Osmaž.')).toEqual([
      'Rozpal pánev.',
      'Přidej máslo.',
      'Osmaž.',
    ]);
  });

  it('zkratka uvnitř závorky („(cca. 2 lžíce)") věty nedělí', () => {
    expect(splitSentences('Přidej (cca. 2 lžíce) cukru. Pak peč. Podávej.')).toEqual([
      'Přidej (cca. 2 lžíce) cukru.',
      'Pak peč.',
      'Podávej.',
    ]);
  });

  it('zkratka s velkým písmenem na začátku věty („Např. Hera")', () => {
    expect(splitSentences('Vezmi tuk. Např. Hera. Pak peč.')).toEqual([
      'Vezmi tuk.',
      'Např. Hera.',
      'Pak peč.',
    ]);
  });

  it('postup: víceřádkové pole zachová prázdné řádky i pořadí', () => {
    const text = 'Krok jedna.\n\nA. B. C.\nPoslední krok.';
    expect(proposeStepSplit(text)).toEqual({
      text: 'Krok jedna.\n\nA.\nB.\nC.\nPoslední krok.',
      count: 5,
    });
  });
});
