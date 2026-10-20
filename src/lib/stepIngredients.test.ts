import { describe, expect, it } from 'vitest';
import { matchStepIngredients } from './stepIngredients';

const RISOTTO = [
  { id: 'ryze', rawText: '300 g rýže arborio' },
  { id: 'kure', rawText: '400 g kuřecí prsa' },
  { id: 'cibule', rawText: '1 cibule' },
  { id: 'maslo', rawText: '2 lžíce másla' },
  { id: 'parmazan', rawText: '50 g parmazánu' },
  { id: 'vyvar', rawText: '1 l vývaru' },
  { id: 'vino', rawText: '100 ml bílého vína' },
  { id: 'sul', rawText: 'Sůl, pepř' },
];

describe('suroviny zmíněné v kroku postupu', () => {
  it('rizoto: skloňované tvary najdou svou surovinu', () => {
    expect(
      matchStepIngredients(
        [
          'Cibuli osmahnout na másle 5 minut.',
          'Přidat rýži, zalít vínem.',
          'Postupně přilévat vývar a míchat asi 18 minut.',
          'Nakonec vmíchat parmazán.',
        ],
        RISOTTO,
      ),
    ).toEqual([['cibule', 'maslo'], ['ryze', 'vino'], ['vyvar'], ['parmazan']]);
  });

  it('přídavné jméno na -cí pozná své podstatné jméno (kuřecí prsa × kuře)', () => {
    expect(matchStepIngredients(['Kuře opéct zvlášť.'], RISOTTO)).toEqual([['kure']]);
  });

  it('pořadí výsledku drží pořadí surovin, ne pořadí v kroku', () => {
    expect(matchStepIngredients(['Zalít vínem a přisypat rýži.'], RISOTTO)).toEqual([['ryze', 'vino']]);
  });

  it('podobný začátek slova bez koncovky nestačí (maso ≠ máslem)', () => {
    const items = [{ id: 'maso', rawText: '500 g mletého masa' }];
    expect(matchStepIngredients(['Pánev vymazat máslem.'], items)).toEqual([[]]);
    expect(matchStepIngredients(['Maso osolit.'], items)).toEqual([['maso']]);
  });

  it('obecná přídavná jména surovinu neurčují (velká cibule × velký hrnec)', () => {
    const items = [{ id: 'cibule', rawText: '1 velká cibule' }];
    expect(matchStepIngredients(['Ve velkém hrnci přivést vodu k varu.'], items)).toEqual([[]]);
  });

  it('nadpisy sekcí a prázdné řádky se ignorují', () => {
    const items = [
      { id: 'h', rawText: '# Na těsto' },
      { id: 'mouka', rawText: '200 g hladké mouky' },
    ];
    expect(matchStepIngredients(['Na těsto smíchat mouku s vodou.'], items)).toEqual([['mouka']]);
  });

  it('slova za předložkou surovinu neurčují (prášek do pečiva × péct)', () => {
    const items = [
      { id: 'prasek', rawText: '1 prášek do pečiva' },
      { id: 'egg', rawText: '1 egg for egg wash' },
    ];
    expect(matchStepIngredients(['Péct do zlatova.', 'Chill for 10 mins.', 'Whisk the egg.'], items)).toEqual([
      [],
      [],
      ['egg'],
    ]);
  });

  it('bez diakritiky i s velkými písmeny', () => {
    const items = [{ id: 'smetana', rawText: '200 ml smetany' }];
    expect(matchStepIngredients(['ZALIT SMETANOU'], items)).toEqual([['smetana']]);
  });

  it('krátká slova (do 2 písmen) nic nespojí', () => {
    const items = [{ id: 'x', rawText: '1 ks' }];
    expect(matchStepIngredients(['Vše smíchat, ať je to hladké.'], items)).toEqual([[]]);
  });
});
