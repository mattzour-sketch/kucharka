import { describe, expect, it } from 'vitest';
import { planPortionChanges, type PortionDraft } from './foodPortionsRepo';
import type { FoodPortion } from '../../db';

/**
 * REVIEW testy pro čistý `planPortionChanges` (commit editoru měr). Cíl: OO7
 * (validace + dedup), rule 3 (nevalidní řádek nezablokuje – jen se zahodí) a
 * bezpečnost mazání (existující míra, která zmizí z draftů, jde do remove =
 * soft delete v `reconcilePortions`).
 */

function portion(id: string, label: string, grams: number): FoodPortion {
  return { id, foodId: 'f1', label, grams, deletedAt: null };
}

describe('planPortionChanges – validace a rule 3', () => {
  it('nevalidní řádky (prázdný název / 0 / záporné / null gramáž) se jen zahodí, nezablokují', () => {
    const drafts: PortionDraft[] = [
      { label: '', grams: 10 },
      { label: '   ', grams: 10 },
      { label: 'a', grams: null },
      { label: 'b', grams: 0 },
      { label: 'c', grams: -5 },
      { label: 'lžíce', grams: 15 }, // jediný validní
    ];
    expect(planPortionChanges([], drafts)).toEqual({
      add: [{ label: 'lžíce', grams: 15 }],
      update: [],
      remove: [],
    });
  });
});

describe('planPortionChanges – OO7 dedup (case/diakritika-insensitive)', () => {
  it('nové duplicity: první vyhrává, druhá se zahodí', () => {
    const drafts: PortionDraft[] = [
      { label: 'Lžíce', grams: 15 },
      { label: 'lžíce', grams: 99 },
      { label: 'LŽÍCE', grams: 1 },
    ];
    expect(planPortionChanges([], drafts)).toEqual({
      add: [{ label: 'Lžíce', grams: 15 }],
      update: [],
      remove: [],
    });
  });

  it('POZOR: dvě existující míry stejného názvu (vzniklé mimo editor) → druhá se při uložení tiše smaže', () => {
    // Editor načte obě (listPortions nededuplikuje), ale plan dedupe: p1 zůstane,
    // p2 spadne do remove. Tichý úklid duplicit, které umí založit inline „+ míra"
    // (addPortion dedup neřeší). Locknuto jako doklad chování.
    const existing = [portion('p1', 'lžíce', 15), portion('p2', 'lžíce', 20)];
    const drafts: PortionDraft[] = [
      { id: 'p1', label: 'lžíce', grams: 15 },
      { id: 'p2', label: 'lžíce', grams: 20 },
    ];
    const plan = planPortionChanges(existing, drafts);
    expect(plan.remove).toEqual(['p2']);
    expect(plan.add).toEqual([]);
    expect(plan.update).toEqual([]);
  });
});

describe('planPortionChanges – update vs. beze změny vs. remove', () => {
  it('změna gramáže i názvu → update; shodný řádek → prázdný plán', () => {
    const existing = [portion('p1', 'lžíce', 15)];
    expect(planPortionChanges(existing, [{ id: 'p1', label: 'lžíce', grams: 14 }])).toEqual({
      add: [],
      update: [{ id: 'p1', label: 'lžíce', grams: 14 }],
      remove: [],
    });
    expect(planPortionChanges(existing, [{ id: 'p1', label: 'lžíce', grams: 15 }])).toEqual({
      add: [],
      update: [],
      remove: [],
    });
  });

  it('ořez bílých znaků v názvu se nepočítá jako změna', () => {
    const existing = [portion('p1', 'lžíce', 15)];
    expect(planPortionChanges(existing, [{ id: 'p1', label: '  lžíce  ', grams: 15 }])).toEqual({
      add: [],
      update: [],
      remove: [],
    });
  });

  it('existující míra chybějící v draftech (nebo zneplatněná prázdným názvem) → remove', () => {
    const existing = [portion('p1', 'lžíce', 15), portion('p2', 'hrnek', 250)];
    expect(planPortionChanges(existing, [{ id: 'p1', label: 'lžíce', grams: 15 }]).remove).toEqual(['p2']);
    expect(
      planPortionChanges(existing, [
        { id: 'p1', label: 'lžíce', grams: 15 },
        { id: 'p2', label: '', grams: 250 },
      ]).remove,
    ).toEqual(['p2']);
  });

  it('draft s neznámým id (míra už neexistuje) se bere jako nový add, nezmizí', () => {
    // Chrání proti tiché ztrátě: kdyby se id nenašlo, řádek nesmí propadnout.
    const plan = planPortionChanges([], [{ id: 'ghost', label: 'lžíce', grams: 15 }]);
    expect(plan.add).toEqual([{ label: 'lžíce', grams: 15 }]);
    expect(plan.remove).toEqual([]);
  });
});
