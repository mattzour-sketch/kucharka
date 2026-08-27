import { describe, expect, it } from 'vitest';
import { parseIngredientLine } from './ingredientParse';

describe('parseIngredientLine', () => {
  it('rozpozná gramáž bez mezery mezi číslem a jednotkou', () => {
    expect(parseIngredientLine('40g másla')).toEqual({ amountG: 40, foodQuery: 'másla' });
  });

  it('rozpozná gramáž s mezerou a desetinnou čárkou', () => {
    expect(parseIngredientLine('0,5 kg mrkve')).toEqual({ amountG: 500, foodQuery: 'mrkve' });
  });

  it('převede dkg a ml na základní jednotku', () => {
    expect(parseIngredientLine('5 dkg sýra')).toEqual({ amountG: 50, foodQuery: 'sýra' });
    expect(parseIngredientLine('250 ml smetany')).toEqual({ amountG: 250, foodQuery: 'smetany' });
  });

  it('u nevažitelné jednotky (ks, lžíce, hrst) gramáž nehádá, ale dotaz odsekne', () => {
    expect(parseIngredientLine('2 ks vajec')).toEqual({ amountG: null, foodQuery: 'vajec' });
    expect(parseIngredientLine('1 lžíce oleje')).toEqual({ amountG: null, foodQuery: 'oleje' });
  });

  it('když za číslem není jednotka, ale rovnou surovina, nic se neodsekne navíc', () => {
    expect(parseIngredientLine('2 vejce')).toEqual({ amountG: null, foodQuery: 'vejce' });
    expect(parseIngredientLine('3 velké brambory')).toEqual({
      amountG: null,
      foodQuery: 'velké brambory',
    });
  });

  it('bez čísla vrátí celý text jako dotaz beze změny gramáže', () => {
    expect(parseIngredientLine('hrst hladké mouky')).toEqual({
      amountG: null,
      foodQuery: 'hrst hladké mouky',
    });
  });

  it('nikdy nemění raw_text, jen ho čte — čistá funkce bez vedlejších efektů', () => {
    const input = '  40g   másla  ';
    parseIngredientLine(input);
    expect(input).toBe('  40g   másla  ');
  });
});
