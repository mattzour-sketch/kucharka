import { describe, expect, it } from 'vitest';
import type { Food, FoodPortion, RecipeItem } from '../db';
import { isNegligible, planAutoLinks, resolveAmountFromText } from './autoLink';

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

function item(rawText: string, extra: Partial<RecipeItem> = {}): RecipeItem {
  counter += 1;
  return { id: `i${counter}`, recipeId: 'r1', rawText, isSkipped: false, sortOrder: counter, ...extra };
}

const mouka = food('Mouka pšeničná hladká');
const cukr = food('Cukr krystal');
const vanilkovy = food('Vanilkový cukr');
const maslo = food('Máslo');
const vejce = food('Vejce slepičí', { pieceGrams: 55 });
const mleko = food('Mléko plnotučné', { basis: 'ml' });
const kakao = food('Kakao nesladké');
const olej = food('Olej řepkový');
const cesnek = food('Česnek', { pieceGrams: 5 });
const FOODS = [mouka, vanilkovy, cukr, maslo, vejce, mleko, kakao, olej, cesnek];
const lzicaOleje: FoodPortion = { id: 'p1', foodId: olej.id, label: 'lžíce', grams: 13 };

describe('isNegligible', () => {
  it('sůl, pepř, voda, špetka, „podle chuti" (česky i anglicky)', () => {
    for (const text of ['1 lžička soli', 'sůl', 'pepř', '350 ml studené vody', 'špetka muškátu', 'Pinch salt', 'Cinnamon, to taste', 'bylinky podle chuti']) {
      expect(isNegligible(text), text).toBe(true);
    }
  });

  it('běžné suroviny nepřeskočí', () => {
    for (const text of ['200 g cukru', '1 lžíce sójové omáčky', 'slanina', 'vodní kaštany']) {
      expect(isNegligible(text), text).toBe(false);
    }
  });
});

describe('resolveAmountFromText', () => {
  it('gramy a ml z textu', () => {
    expect(resolveAmountFromText('250 g hladké mouky', mouka, [])).toEqual({ amountG: 250, amountKs: null, estimated: false });
    expect(resolveAmountFromText('Beef*: 250g', maslo, [])).toEqual({ amountG: 250, amountKs: null, estimated: false });
  });

  it('kusy u potraviny s hmotností kusu', () => {
    expect(resolveAmountFromText('4 vejce', vejce, [])).toEqual({ amountG: 220, amountKs: 4, estimated: false });
    expect(resolveAmountFromText('3 stroužky česneku', cesnek, [])).toEqual({ amountG: 15, amountKs: 3, estimated: false });
  });

  it('míra potraviny má přednost před odhadem lžíce', () => {
    expect(resolveAmountFromText('2 lžíce oleje', olej, [lzicaOleje])).toEqual({ amountG: 26, amountKs: null, estimated: false });
  });

  it('lžíce a lžička bez míry potraviny = označený odhad', () => {
    expect(resolveAmountFromText('2 lžíce kakaa', kakao, [])).toEqual({ amountG: 30, amountKs: null, estimated: true });
    expect(resolveAmountFromText('1tsp baking powder', kakao, [])).toEqual({ amountG: 5, amountKs: null, estimated: true });
    expect(resolveAmountFromText('1 tablespoon of sweetener', cukr, [])).toEqual({ amountG: 15, amountKs: null, estimated: true });
  });

  it('bez čitelného množství nic nevymýšlí', () => {
    expect(resolveAmountFromText('hrst mouky', mouka, [])).toEqual({ amountG: null, amountKs: null, estimated: false });
    expect(resolveAmountFromText('2 hrnky mouky', mouka, [])).toEqual({ amountG: null, amountKs: null, estimated: false });
  });
});

describe('planAutoLinks', () => {
  it('bábovka: napáruje nejbližší potraviny s množstvím, sůl přeskočí, neznámé nechá', () => {
    const items = [
      item('250 g hladké mouky'),
      item('200 g cukru'),
      item('4 vejce'),
      item('125 g másla'),
      item('250 ml mléka'),
      item('1 prášek do pečiva'),
      item('2 lžíce kakaa'),
      item('špetka soli'),
    ];
    const plan = planAutoLinks({ items, foods: FOODS, portions: [], learned: new Map() });
    const byText = new Map(plan.map((entry) => [items.find((it) => it.id === entry.itemId)!.rawText, entry]));

    expect(byText.get('200 g cukru')).toMatchObject({ kind: 'link', foodId: cukr.id, amountG: 200 });
    expect(byText.get('125 g másla')).toMatchObject({ foodId: maslo.id, amountG: 125 });
    expect(byText.get('4 vejce')).toMatchObject({ foodId: vejce.id, amountG: 220, amountKs: 4 });
    expect(byText.get('2 lžíce kakaa')).toMatchObject({ foodId: kakao.id, amountG: 30, estimated: true });
    expect(byText.get('špetka soli')).toEqual({ itemId: expect.any(String), kind: 'skip' });
    expect(byText.has('1 prášek do pečiva')).toBe(false);
    expect(plan).toHaveLength(7);
  });

  it('nadpisy sekcí, přeskočené a už napojené suroviny nechá být', () => {
    const items = [
      item('# Na těsto'),
      item('200 g cukru', { isSkipped: true }),
      item('100 g mouky', { foodId: mouka.id, amountG: 100 }),
      item('50 g másla', { subRecipeId: 'r2' }),
    ];
    expect(planAutoLinks({ items, foods: FOODS, portions: [], learned: new Map() })).toEqual([]);
  });

  it('naučené napojení má přednost před hledáním podle názvu', () => {
    const items = [item('100 g cukru')];
    const learned = new Map([['cukru', vanilkovy.id]]);
    expect(planAutoLinks({ items, foods: FOODS, portions: [], learned })[0]).toMatchObject({ foodId: vanilkovy.id });
  });

  it('anglický recept z IG', () => {
    const items = [item('150g flour'), item('40g melted butter'), item('1tsp baking powder'), item('Pinch salt')];
    const plan = planAutoLinks({ items, foods: FOODS, portions: [], learned: new Map() });
    expect(plan.map((entry) => (entry.kind === 'link' ? entry.foodId : 'skip'))).toEqual([mouka.id, maslo.id, 'skip']);
  });
});
