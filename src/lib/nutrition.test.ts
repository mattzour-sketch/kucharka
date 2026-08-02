import { describe, expect, it } from 'vitest';
import {
  completeness,
  logEntryFromRecipe,
  per100g,
  perServing,
  recipeTotals,
  type CalcRecipe,
  type FoodValue,
  type NutritionSource,
} from './nutrition';

/** Postaví lookup ze slovníků potravin a receptů. */
function makeSource(
  foods: Record<string, FoodValue>,
  recipes: Record<string, CalcRecipe> = {},
): NutritionSource {
  return {
    food: (id) => {
      const f = foods[id];
      if (!f) throw new Error(`Neznámá potravina: ${id}`);
      return f;
    },
    recipe: (id) => {
      const r = recipes[id];
      if (!r) throw new Error(`Neznámý recept: ${id}`);
      return r;
    },
  };
}

/** Tolerance dle zadání (0,01 kcal). */
function near(actual: number, expected: number, tol = 0.01): void {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

const foods: Record<string, FoodValue> = {
  chicken: { kcal: 106, protein: 21.5, carbs: 0, fat: 2 },
  rice: { kcal: 350, protein: 7, carbs: 78, fat: 1 },
  onion: { kcal: 40, protein: 1.1, carbs: 9, fat: 0.1 },
  oil: { kcal: 884, protein: 0, carbs: 0, fat: 100 },
};

/** Kuřecí rizoto ze SPEC 7.5. */
function rizoto(cookedWeightG: number | null): CalcRecipe {
  return {
    id: 'rizoto',
    servings: 4,
    cookedWeightG,
    items: [
      { foodId: 'chicken', amountG: 400 },
      { foodId: 'rice', amountG: 200 },
      { foodId: 'onion', amountG: 100 },
      { foodId: 'oil', amountG: 20 },
    ],
  };
}

describe('nutrition', () => {
  it('a) plně napojený recept s uvařenou hmotností', () => {
    const r = rizoto(1500);

    expect(completeness(r).ratio).toBe(1);

    const t = recipeTotals(r, makeSource(foods));
    expect(t.computable).toBe(true);
    if (!t.computable) return;

    near(t.totals.kcal, 1340.8);
    expect(t.finalWeight).toBe(1500);

    const porce = perServing(t.totals, r.servings);
    expect(porce).not.toBeNull();
    near(porce!.kcal, 335.2);

    near(per100g(t.totals, t.finalWeight).kcal, 89.39); // 1340,8 / 1500 × 100
  });

  it('b) bez uvařené hmotnosti se použije součet surovin (720 g)', () => {
    const t = recipeTotals(rizoto(null), makeSource(foods));
    if (!t.computable) throw new Error('má být computable');

    expect(t.rawWeight).toBe(720);
    expect(t.finalWeight).toBe(720);
    near(per100g(t.totals, t.finalWeight).kcal, 186.22);
  });

  it('c) 3 z 5 napojené + jedna přeskočená → úplnost 3/4, součty jen ze tří', () => {
    const r: CalcRecipe = {
      id: 'castecny',
      servings: null,
      cookedWeightG: null,
      items: [
        { foodId: 'chicken', amountG: 400 },
        { foodId: 'rice', amountG: 200 },
        { foodId: 'onion', amountG: 100 },
        {}, // zachyceno, ale nenapojeno
        { isSkipped: true }, // koření – nepočítá se do úplnosti
      ],
    };

    const c = completeness(r);
    expect(c.countable).toBe(4);
    expect(c.connected).toBe(3);
    expect(c.ratio).toBeCloseTo(0.75, 10);

    const t = recipeTotals(r, makeSource(foods));
    if (!t.computable) throw new Error('má být computable');
    near(t.totals.kcal, 1164); // 424 + 700 + 40
    expect(t.rawWeight).toBe(700);
  });

  it('d) žádná napojená surovina → nelze spočítat (ne nulové součty)', () => {
    const r: CalcRecipe = { id: 'prazdny', items: [{}, {}, {}] };

    expect(completeness(r).ratio).toBe(0);

    const t = recipeTotals(r, makeSource(foods));
    expect(t.computable).toBe(false);
    // Zásadní: výsledek NENÍ { kcal: 0 } vydávané za platné číslo.
    expect('totals' in t).toBe(false);
  });

  it('e) bez počtu porcí – na porci nedostupné, celkem i na 100 g ano', () => {
    const r = rizoto(1500);
    r.servings = null;

    const t = recipeTotals(r, makeSource(foods));
    if (!t.computable) throw new Error('má být computable');

    expect(perServing(t.totals, r.servings)).toBeNull();
    near(t.totals.kcal, 1340.8);
    near(per100g(t.totals, t.finalWeight).kcal, 89.39);
  });

  it('f) podrecept se normalizuje na 100 g své finální hmotnosti', () => {
    const foodsF: Record<string, FoodValue> = {
      butter: { kcal: 700, protein: 0, carbs: 0, fat: 78 },
      milk: { kcal: 50, protein: 3.4, carbs: 5, fat: 1.5 },
      cheese: { kcal: 350, protein: 25, carbs: 1, fat: 27 },
    };
    const besamel: CalcRecipe = {
      id: 'besamel',
      servings: null,
      cookedWeightG: null,
      items: [
        { foodId: 'butter', amountG: 100 }, // 700 kcal
        { foodId: 'milk', amountG: 400 }, // 200 kcal
      ],
    };
    const lasagne: CalcRecipe = {
      id: 'lasagne',
      servings: null,
      cookedWeightG: null,
      items: [
        { subRecipeId: 'besamel', amountG: 250 }, // 250/100 × 180 = 450 kcal
        { foodId: 'cheese', amountG: 100 }, // 350 kcal
      ],
    };
    const src = makeSource(foodsF, { besamel });

    const sub = recipeTotals(besamel, src);
    if (!sub.computable) throw new Error('podrecept má být computable');
    near(sub.totals.kcal, 900);
    expect(sub.finalWeight).toBe(500);
    near(per100g(sub.totals, sub.finalWeight).kcal, 180); // 900 / 500 × 100

    const t = recipeTotals(lasagne, src);
    if (!t.computable) throw new Error('má být computable');
    near(t.totals.kcal, 800); // 450 z bešamelu + 350 ze sýra
    expect(t.rawWeight).toBe(350);
  });

  it('g) recept, který přímo i nepřímo obsahuje sám sebe → chyba, ne zacyklení', () => {
    // nepřímý cyklus a → b → a
    const a: CalcRecipe = { id: 'a', items: [{ subRecipeId: 'b', amountG: 100 }] };
    const b: CalcRecipe = { id: 'b', items: [{ subRecipeId: 'a', amountG: 100 }] };
    expect(() => recipeTotals(a, makeSource({}, { a, b }))).toThrow(/Cyklick/);

    // přímý cyklus s → s
    const s: CalcRecipe = { id: 's', items: [{ subRecipeId: 's', amountG: 100 }] };
    expect(() => recipeTotals(s, makeSource({}, { s }))).toThrow(/Cyklick/);
  });

  it('h) zápis 340 g rizota do deníku → snapshot 303,91 kcal a display_name', () => {
    const r = { ...rizoto(1500), name: 'Kuřecí rizoto' };
    const entry = logEntryFromRecipe(r, 340, 'lunch', '2026-08-02', makeSource(foods));

    near(entry.energyKcal, 303.91); // 1340,8 × 340 / 1500
    expect(entry.displayName).toBe('Kuřecí rizoto');
    expect(entry.loggedOn).toBe('2026-08-02');
    expect(entry.amountG).toBe(340);
    expect(entry.meal).toBe('lunch');
  });
});
