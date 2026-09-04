import { describe, expect, it } from 'vitest';
import { planPortionChanges, type PortionDraft } from './foodPortionsRepo';
import type { FoodPortion } from '../../db';

function portion(id: string, label: string, grams: number): FoodPortion {
  return { id, foodId: 'f1', label, grams, deletedAt: null };
}

describe('planPortionChanges', () => {
  it('nový validní řádek → add', () => {
    const plan = planPortionChanges([], [{ label: 'lžíce', grams: 15 }]);
    expect(plan).toEqual({ add: [{ label: 'lžíce', grams: 15 }], update: [], remove: [] });
  });

  it('změněná gramáž/název existující míry → update', () => {
    const existing = [portion('p1', 'lžíce', 15)];
    const drafts: PortionDraft[] = [{ id: 'p1', label: 'lžíce', grams: 14 }];
    expect(planPortionChanges(existing, drafts)).toEqual({
      add: [],
      update: [{ id: 'p1', label: 'lžíce', grams: 14 }],
      remove: [],
    });
  });

  it('beze změny → prázdný plán', () => {
    const existing = [portion('p1', 'lžíce', 15)];
    const drafts: PortionDraft[] = [{ id: 'p1', label: 'lžíce', grams: 15 }];
    expect(planPortionChanges(existing, drafts)).toEqual({ add: [], update: [], remove: [] });
  });

  it('existující míra chybějící v draftech → remove', () => {
    const existing = [portion('p1', 'lžíce', 15), portion('p2', 'hrnek', 250)];
    const drafts: PortionDraft[] = [{ id: 'p1', label: 'lžíce', grams: 15 }];
    expect(planPortionChanges(existing, drafts)).toEqual({ add: [], update: [], remove: ['p2'] });
  });

  it('smazaný název u existující míry ji zneplatní → remove', () => {
    const existing = [portion('p1', 'lžíce', 15)];
    const drafts: PortionDraft[] = [{ id: 'p1', label: '  ', grams: 15 }];
    expect(planPortionChanges(existing, drafts)).toEqual({ add: [], update: [], remove: ['p1'] });
  });

  it('nevalidní nový řádek (prázdný název / nekladná gramáž) se zahodí', () => {
    const drafts: PortionDraft[] = [
      { label: '', grams: 10 },
      { label: 'lžíce', grams: null },
      { label: 'hrnek', grams: 0 },
      { label: 'plátek', grams: -5 },
    ];
    expect(planPortionChanges([], drafts)).toEqual({ add: [], update: [], remove: [] });
  });

  it('duplicitní název (bez ohledu na velikost/diakritiku) – první vyhrává', () => {
    const drafts: PortionDraft[] = [
      { label: 'Lžíce', grams: 15 },
      { label: 'lžíce', grams: 99 },
    ];
    expect(planPortionChanges([], drafts)).toEqual({ add: [{ label: 'Lžíce', grams: 15 }], update: [], remove: [] });
  });

  it('ořízne bílé znaky v názvu', () => {
    expect(planPortionChanges([], [{ label: '  lžíce  ', grams: 15 }])).toEqual({
      add: [{ label: 'lžíce', grams: 15 }],
      update: [],
      remove: [],
    });
  });
});
