import { describe, expect, it } from 'vitest';
import type { Food, RecipeItem } from '../../db';
import { planAutoLinks } from '../../lib/autoLink';
import { parseRecipeText } from '../../lib/parseRecipe';
import { IG_CINNAMON_ROLLS } from '../../lib/igSamples';
import { basicFoodSeeds } from './seedFoods';

// Párování proti CELÉ vestavěné databázi potravin – hlídá, že nové položky nepokazí
// výběr u běžných surovin (skutečné recepty uživatele).
const FOODS: Food[] = basicFoodSeeds().map((seed, index) => ({
  id: `seed${index}`,
  name: seed.name,
  basis: seed.basis ?? 'g',
  energyKcal: seed.kcal,
  proteinG: seed.protein,
  carbsG: seed.carbs,
  fatG: seed.fat,
  pieceGrams: seed.piece ?? null,
  source: 'import',
  isFavorite: false,
  createdAt: '2026-09-26T00:00:00.000Z',
  updatedAt: '2026-09-26T00:00:00.000Z',
}));

function linkedNames(lines: string[]): Record<string, string> {
  const items: RecipeItem[] = lines.map((rawText, index) => ({
    id: `i${index}`,
    recipeId: 'r',
    rawText,
    isSkipped: false,
    sortOrder: index,
  }));
  const plan = planAutoLinks({ items, foods: FOODS, portions: [], learned: new Map() });
  const result: Record<string, string> = {};
  for (const entry of plan) {
    const text = items.find((item) => item.id === entry.itemId)!.rawText;
    result[text] = entry.kind === 'skip' ? '(přeskočeno)' : FOODS.find((food) => food.id === entry.foodId)!.name;
  }
  return result;
}

describe('automatické napojení proti vestavěné databázi', () => {
  it('česká bábovka', () => {
    expect(
      linkedNames([
        '250 g hladké mouky',
        '200 g cukru',
        '4 vejce',
        '125 g másla',
        '250 ml mléka',
        '1 prášek do pečiva',
        '2 lžíce kakaa',
        'špetka soli',
      ]),
    ).toEqual({
      '250 g hladké mouky': 'Mouka pšeničná hladká',
      '200 g cukru': 'Cukr krystal',
      '4 vejce': 'Vejce slepičí',
      '125 g másla': 'Máslo',
      '250 ml mléka': 'Mléko polotučné',
      '1 prášek do pečiva': 'Prášek do pečiva',
      '2 lžíce kakaa': 'Kakao nesladké',
      'špetka soli': '(přeskočeno)',
    });
  });

  it('běžné suroviny českých receptů (dřívější chybná napárování)', () => {
    expect(
      linkedNames([
        '100 g strouhaného eidamu',
        '50 g parmazánu',
        '2 lžíce medu',
        '200 g rýže',
        '300 g těstovin',
        '500 g hovězího masa',
        '2 mrkve',
        '400 g krájených rajčat',
        '1 polévková lžíce medu nebo cukru',
        'trochu neutrálního oleje na orestování',
        '250 g špaget',
      ]),
    ).toEqual({
      '100 g strouhaného eidamu': 'Eidam 30 %',
      '50 g parmazánu': 'Parmezán',
      '2 lžíce medu': 'Med',
      '200 g rýže': 'Rýže dlouhozrnná (syrová)',
      '300 g těstovin': 'Těstoviny semolinové (syrové)',
      '500 g hovězího masa': 'Hovězí zadní',
      '2 mrkve': 'Mrkev',
      '400 g krájených rajčat': 'Rajčata krájená (konzerva)',
      '1 polévková lžíce medu nebo cukru': 'Med',
      'trochu neutrálního oleje na orestování': 'Olej řepkový',
      '250 g špaget': 'Těstoviny semolinové (syrové)',
    });
  });

  it('„1 polévková lžíce" je lžíce (odhad 15 g)', () => {
    const items: RecipeItem[] = [{ id: 'x', recipeId: 'r', rawText: '1 polévková lžíce medu', isSkipped: false, sortOrder: 0 }];
    const [entry] = planAutoLinks({ items, foods: FOODS, portions: [], learned: new Map() });
    expect(entry).toMatchObject({ kind: 'link', amountG: 15, estimated: true });
  });

  it('skořicové rolky z IG (anglicky)', () => {
    const lines = parseRecipeText(IG_CINNAMON_ROLLS).ingredients;
    expect(linkedNames(lines)).toMatchObject({
      '150g flour': 'Mouka pšeničná hladká',
      '100g greek yogurt': 'Jogurt řecký',
      '40g melted butter': 'Máslo',
      '1tsp baking powder': 'Prášek do pečiva',
      'Pinch salt': '(přeskočeno)',
      '75g cream cheese': 'Čerstvý sýr smetanový (Lučina)',
      '20g brown sugar': 'Hnědý cukr',
      '10g cinnamon': 'Skořice mletá',
      '45g casein vanilla protein powder': 'Protein prášek (kasein)',
    });
  });
});
