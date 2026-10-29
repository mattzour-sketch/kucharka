import { describe, expect, it } from 'vitest';
import {
  ingredientSplitLabel,
  proposeIngredientSplit,
  proposeStepSplit,
  splitIngredientLine,
  splitSentences,
  stepSplitLabel,
} from './lineSplit';

describe('splitIngredientLine', () => {
  it('čárky: oddělovač a okolní mezery zmizí, jinak text znak po znaku', () => {
    expect(splitIngredientLine('200 g mouky, 2 vejce, špetka soli')).toEqual([
      '200 g mouky',
      '2 vejce',
      'špetka soli',
    ]);
  });

  it('desetinná čárka mezi číslicemi bez mezery není oddělovač', () => {
    expect(splitIngredientLine('1,5 kg brambor, 0,5 l mléka')).toEqual([
      '1,5 kg brambor',
      '0,5 l mléka',
    ]);
  });

  it('uvnitř závorek se nedělí', () => {
    expect(splitIngredientLine('200 g sýra (eidam, gouda), 2 vejce')).toEqual([
      '200 g sýra (eidam, gouda)',
      '2 vejce',
    ]);
  });

  it('neuzavřená závorka dál nedělí, přebytečná uzavírací nevadí', () => {
    expect(splitIngredientLine('200 g sýra (eidam, gouda, 2 vejce')).toEqual([
      '200 g sýra (eidam, gouda, 2 vejce',
    ]);
    expect(splitIngredientLine('sůl) , 2 vejce, 3 lžíce cukru')).toEqual([
      'sůl)',
      '2 vejce',
      '3 lžíce cukru',
    ]);
  });

  it('středník a odrážka dělí jako čárka', () => {
    expect(splitIngredientLine('200 g mouky; 2 vejce')).toEqual(['200 g mouky', '2 vejce']);
    expect(splitIngredientLine('• 200 g mouky • 2 vejce • sůl')).toEqual([
      '200 g mouky',
      '2 vejce',
      'sůl',
    ]);
  });

  it('koncová a zdvojená čárka nedělají prázdné části', () => {
    expect(splitIngredientLine('2 vejce, , sůl,')).toEqual(['2 vejce', 'sůl']);
  });

  it('spojka „a" ani pomlčka nejsou oddělovač', () => {
    expect(splitIngredientLine('sůl a pepř')).toEqual(['sůl a pepř']);
    expect(splitIngredientLine('sůl - pepř / kmín')).toEqual(['sůl - pepř / kmín']);
  });

  it.each([
    '200 g mouky, 2 vejce, špetka soli',
    '1,5 kg brambor, 0,5 l mléka, sůl',
    'mrkev, celer, petržel, cibule',
    '2 lžíce oleje, 1 cibule',
  ])('invariant: spojení částí „, " vrátí původní řádek: %s', (line) => {
    expect(splitIngredientLine(line).join(', ')).toBe(line);
  });

  it('invariant i s nepravidelnými mezerami kolem čárek', () => {
    const line = '200 g mouky ,2 vejce ,  špetka soli';
    expect(splitIngredientLine(line).join(', ')).toBe(line.replace(/\s*,\s*/g, ', '));
  });
});

describe('proposeIngredientSplit', () => {
  it('jeden řádek se třemi surovinami → tři řádky', () => {
    expect(proposeIngredientSplit('200 g mouky, 2 vejce, špetka soli')).toEqual({
      text: '200 g mouky\n2 vejce\nšpetka soli',
      count: 3,
    });
  });

  it('dvě části, obě s číslem → nabídka', () => {
    expect(proposeIngredientSplit('1,5 kg brambor, 0,5 l mléka')).toEqual({
      text: '1,5 kg brambor\n0,5 l mléka',
      count: 2,
    });
    expect(proposeIngredientSplit('200 g mouky; 2 vejce')?.text).toBe('200 g mouky\n2 vejce');
  });

  it.each([
    'sůl a pepř',
    'sůl, pepř',
    '2 vejce, sůl',
    '200 g sýra (eidam, gouda)',
    '2 vejce, , sůl,',
  ])('bez nabídky: %s', (text) => {
    expect(proposeIngredientSplit(text)).toBeNull();
  });

  it('nadpis sekce se nikdy nedělí', () => {
    expect(proposeIngredientSplit('# Na těsto, polevu, krém')).toBeNull();
  });

  it('dělí jen řádek, který splňuje podmínku; ostatní řádky i prázdné zůstanou', () => {
    const text = '# Těsto\n  sůl, pepř\n\n200 g mouky, 2 vejce, špetka soli\n1 l mléka';
    expect(proposeIngredientSplit(text)).toEqual({
      text: '# Těsto\n  sůl, pepř\n\n200 g mouky\n2 vejce\nšpetka soli\n1 l mléka',
      count: 5,
    });
  });

  it('idempotence: výsledek už nic nenabídne', () => {
    const first = proposeIngredientSplit(
      '200 g sýra (eidam, gouda), 2 vejce, 1,5 l mléka; sůl • pepř',
    );
    expect(first).not.toBeNull();
    expect(proposeIngredientSplit(first?.text ?? '')).toBeNull();
  });

  it('prázdné pole a jen mezery → nic', () => {
    expect(proposeIngredientSplit('')).toBeNull();
    expect(proposeIngredientSplit('   \n  ')).toBeNull();
  });
});

describe('splitSentences', () => {
  it('věty si nechají svou tečku', () => {
    expect(
      splitSentences('Smíchej mouku s vejci. Nech 20 min odpočinout. Vyválej a peč na 180 °C.'),
    ).toEqual(['Smíchej mouku s vejci.', 'Nech 20 min odpočinout.', 'Vyválej a peč na 180 °C.']);
  });

  it('za zkratkami se nedělí', () => {
    expect(splitSentences('Přidej cca. 2 lžíce, např. Hery. Pak peč.')).toEqual([
      'Přidej cca. 2 lžíce, např. Hery.',
      'Pak peč.',
    ]);
    expect(splitSentences('Použij tzv. Vodní lázeň, tj. Hrnec. Resp. Mísu.')).toEqual([
      'Použij tzv. Vodní lázeň, tj. Hrnec.',
      'Resp. Mísu.',
    ]);
  });

  it('tečka za samotným číslem (pořadí) není konec věty', () => {
    expect(splitSentences('1. Smíchej mouku. 2. Peč 20 min.')).toEqual([
      '1. Smíchej mouku.',
      '2. Peč 20 min.',
    ]);
  });

  it('desetinná tečka bez mezery věty nedělí', () => {
    expect(splitSentences('Peč na 180 °C 1.5 h. Pak vychladit.')).toEqual([
      'Peč na 180 °C 1.5 h.',
      'Pak vychladit.',
    ]);
  });

  it('vykřičník, otazník a uzavírací závorka nebo uvozovka', () => {
    expect(splitSentences('Nepřipal to! Hotovo? Asi ano (zkus „vidličkou.“) Podávej.')).toEqual([
      'Nepřipal to!',
      'Hotovo?',
      'Asi ano (zkus „vidličkou.“)',
      'Podávej.',
    ]);
  });

  it('další věta musí začít velkým písmenem nebo číslicí (ne závorkou)', () => {
    expect(splitSentences('Hotovo? (Asi ano.) Podávej.')).toEqual([
      'Hotovo? (Asi ano.)',
      'Podávej.',
    ]);
  });

  it('za tečkou malé písmeno → bez dělení', () => {
    expect(splitSentences('Smíchej. pak peč. a podávej.')).toEqual([
      'Smíchej. pak peč. a podávej.',
    ]);
  });
});

describe('proposeStepSplit', () => {
  it('tři věty → tři kroky', () => {
    expect(
      proposeStepSplit('Smíchej mouku s vejci. Nech 20 min odpočinout. Vyválej a peč na 180 °C.'),
    ).toEqual({
      text: 'Smíchej mouku s vejci.\nNech 20 min odpočinout.\nVyválej a peč na 180 °C.',
      count: 3,
    });
  });

  it('dvě věty → bez nabídky', () => {
    expect(proposeStepSplit('Rozpal pánev. Přidej máslo.')).toBeNull();
    expect(proposeStepSplit('Přidej cca. 2 lžíce, např. Hery. Pak peč.')).toBeNull();
  });

  it('počet = všechny kroky v poli po rozdělení; ostatní řádky beze změny', () => {
    const text = 'Předehřej troubu.\n\nSmíchej. Nech stát. Peč.\nPodávej. Hned.';
    expect(proposeStepSplit(text)).toEqual({
      text: 'Předehřej troubu.\n\nSmíchej.\nNech stát.\nPeč.\nPodávej. Hned.',
      count: 5,
    });
  });

  it('idempotence', () => {
    const first = proposeStepSplit('1. Smíchej mouku. 2. Peč 20 min. 3. Podávej!');
    expect(first?.text).toBe('1. Smíchej mouku.\n2. Peč 20 min.\n3. Podávej!');
    expect(proposeStepSplit(first?.text ?? '')).toBeNull();
  });

  it('prázdné pole a jen mezery → nic', () => {
    expect(proposeStepSplit('')).toBeNull();
    expect(proposeStepSplit('  \n ')).toBeNull();
  });
});

describe('popisky nabídky', () => {
  it('suroviny: 2–4 „suroviny", 5+ „surovin"', () => {
    expect(ingredientSplitLabel(2)).toBe('Rozdělit na 2 suroviny');
    expect(ingredientSplitLabel(3)).toBe('Rozdělit na 3 suroviny');
    expect(ingredientSplitLabel(5)).toBe('Rozdělit na 5 surovin');
    expect(ingredientSplitLabel(12)).toBe('Rozdělit na 12 surovin');
  });

  it('kroky: 2–4 „kroky", 5+ „kroků"', () => {
    expect(stepSplitLabel(3)).toBe('Rozdělit na 3 kroky');
    expect(stepSplitLabel(4)).toBe('Rozdělit na 4 kroky');
    expect(stepSplitLabel(5)).toBe('Rozdělit na 5 kroků');
  });
});

describe('výkon (dlouhý vstup nezdrží psaní)', () => {
  it.each([
    ['5000 znaků s čárkami', 'a,'.repeat(2500)],
    ['5000 znaků bez mezer s tečkami', 'a.'.repeat(2500)],
    ['5000 otevíracích závorek', '('.repeat(5000)],
    ['5000 teček a mezer', '. '.repeat(2500)],
    ['dlouhé slovo před tečkami', `${'x'.repeat(4000)}. A. B. C.`],
  ])('%s', (_name, text) => {
    const start = performance.now();
    proposeIngredientSplit(text);
    proposeStepSplit(text);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
