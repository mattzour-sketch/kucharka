import { describe, expect, it } from 'vitest';
import type { Food, RecipeItem } from '../db';
import { bestFoodMatch, buildLearnedLinks, extractFoodQuery, learnedKey } from './foodMatch';

let counter = 0;
function food(name: string, extra: Partial<Food> = {}): Food {
  counter += 1;
  return {
    id: `f${counter}`,
    name,
    basis: 'g',
    energyKcal: 100,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    source: 'custom',
    isFavorite: false,
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z',
    ...extra,
  };
}

// Názvy jako ve vestavěné databázi (seedFoods.ts), v tomhle pořadí.
const FOODS = [
  food('Mouka pšeničná hladká'),
  food('Mouka pšeničná polohrubá'),
  food('Vanilkový cukr'),
  food('Cukr krystal'),
  food('Cukr moučkový'),
  food('Máslo přepuštěné (ghí)'),
  food('Máslo'),
  food('Máslové sušenky'),
  food('Vejce slepičí', { pieceGrams: 55 }),
  food('Mléko plnotučné', { basis: 'ml' }),
  food('Jogurt bílý'),
  food('Jogurt řecký'),
  food('Kakao nesladké'),
  food('Skořice'),
  food('Pečivo bílé'),
];
const byName = (name: string) => FOODS.find((item) => item.name === name);

describe('extractFoodQuery', () => {
  it('odsekne množství, jednotku i anglické „of"', () => {
    expect(extractFoodQuery('250 g hladké mouky')).toBe('hladké mouky');
    expect(extractFoodQuery('2 lžíce kakaa')).toBe('kakaa');
    expect(extractFoodQuery('100g of skyr yogurt')).toBe('skyr yogurt');
    expect(extractFoodQuery('1tsp baking powder')).toBe('baking powder');
    expect(extractFoodQuery('3–4 stroužky česneku')).toBe('česneku');
    expect(extractFoodQuery('4 vejce')).toBe('vejce');
  });

  it('poznámka za čárkou, pomlčkou nebo závorkou není název', () => {
    expect(extractFoodQuery('jedlá soda – malé množství, přesné množství není uvedeno')).toBe('jedlá soda');
    expect(extractFoodQuery('350 ml studené vody, případně trochu navíc')).toBe('studené vody');
    expect(extractFoodQuery('neutrální olej (rostlinný, avokádový)')).toBe('neutrální olej');
  });

  it('formát „název: množství" vrátí název', () => {
    expect(extractFoodQuery('Rice: 2 bowls (2 * 220g)')).toBe('Rice');
    expect(extractFoodQuery('Beef*: 250g')).toBe('Beef');
  });
});

describe('bestFoodMatch', () => {
  it('vybere nejbližší shodu, ne první nalezenou', () => {
    expect(bestFoodMatch('cukru', FOODS)).toBe(byName('Cukr krystal'));
    expect(bestFoodMatch('másla', FOODS)).toBe(byName('Máslo'));
    expect(bestFoodMatch('hladké mouky', FOODS)).toBe(byName('Mouka pšeničná hladká'));
    expect(bestFoodMatch('vejce', FOODS)).toBe(byName('Vejce slepičí'));
    expect(bestFoodMatch('kakaa', FOODS)).toBe(byName('Kakao nesladké'));
  });

  it('anglické názvy z IG přeloží', () => {
    expect(bestFoodMatch('flour', FOODS)).toBe(byName('Mouka pšeničná hladká'));
    expect(bestFoodMatch('greek yogurt', FOODS)).toBe(byName('Jogurt řecký'));
    expect(bestFoodMatch('cinnamon', FOODS)).toBe(byName('Skořice'));
    expect(bestFoodMatch('melted butter', FOODS)).toBe(byName('Máslo'));
  });

  it('když sedí míň než polovina slov, nenapáruje nic', () => {
    expect(bestFoodMatch('prášek do pečiva', FOODS)).toBeNull();
    expect(bestFoodMatch('casein vanilla protein', FOODS)).toBeNull();
    expect(bestFoodMatch('', FOODS)).toBeNull();
  });

  it('krátké slovo jen přesně: „sýr" nechytí „syrová"', () => {
    const pohanka = food('Pohanka (syrová)');
    const cottage = food('Cottage sýr');
    expect(bestFoodMatch('cream cheese', [pohanka])).toBeNull();
    expect(bestFoodMatch('sýr', [pohanka, cottage])).toBe(cottage);
  });

  it('smazanou potravinu nenabídne', () => {
    const deleted = food('Tvaroh', { deletedAt: '2026-09-01T00:00:00.000Z' });
    expect(bestFoodMatch('tvarohu', [deleted])).toBeNull();
  });
});

describe('naučená napojení', () => {
  function item(rawText: string, foodId: string | null): RecipeItem {
    return { id: rawText + foodId, recipeId: 'r', rawText, foodId, isSkipped: false, sortOrder: 0 };
  }

  it('klíč nezávisí na množství ani diakritice', () => {
    expect(learnedKey('200 g cukru')).toBe(learnedKey('50g Cukru'));
    expect(learnedKey('200 g cukru')).toBe('cukru');
  });

  it('vyhrává nejčastěji použitá potravina, smazaná se ignoruje', () => {
    const moučkový = byName('Cukr moučkový')!;
    const krystal = byName('Cukr krystal')!;
    const learned = buildLearnedLinks(
      [item('100 g cukru', moučkový.id), item('50 g cukru', moučkový.id), item('20 g cukru', krystal.id), item('mouka', null)],
      FOODS,
    );
    expect(learned.get('cukru')).toBe(moučkový.id);
    expect(learned.has('mouka')).toBe(false);
    expect(buildLearnedLinks([item('cukru', 'neexistuje')], FOODS).size).toBe(0);
  });

  it('při shodě vyhraje novější recept; recepty v koši se nepočítají', () => {
    const vanilkový = byName('Vanilkový cukr')!;
    const krystal = byName('Cukr krystal')!;
    const old = { ...item('200 g cukru', vanilkový.id), recipeId: 'old' };
    const fixed = { ...item('100 g cukru', krystal.id), recipeId: 'new' };
    const recipes = [
      { id: 'old', updatedAt: '2026-09-01T00:00:00.000Z', deletedAt: null },
      { id: 'new', updatedAt: '2026-09-20T00:00:00.000Z', deletedAt: null },
    ];
    expect(buildLearnedLinks([old, fixed], FOODS, recipes).get('cukru')).toBe(krystal.id);

    const trashed = [{ id: 'old', updatedAt: '2026-09-01T00:00:00.000Z', deletedAt: '2026-09-02T00:00:00.000Z' }];
    expect(buildLearnedLinks([old], FOODS, trashed).has('cukru')).toBe(false);
  });
});
