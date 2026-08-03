import { db, type Food, type FoodBasis } from '../../db';
import { newId } from '../../lib/id';

/** Zápisy do potravin. Hodnoty jsou vždy na 100 g/ml podle `basis`. */

export interface FoodDraft {
  name: string;
  brand?: string | null;
  basis: FoodBasis;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export async function createFood(draft: FoodDraft): Promise<string> {
  const now = new Date().toISOString();
  const food: Food = {
    id: newId(),
    name: draft.name,
    brand: draft.brand ?? null,
    barcode: null,
    basis: draft.basis,
    energyKcal: draft.energyKcal,
    proteinG: draft.proteinG,
    carbsG: draft.carbsG,
    fatG: draft.fatG,
    source: 'custom',
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.foods.add(food);
  return food.id;
}

export async function updateFood(
  id: string,
  patch: Partial<Omit<Food, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.foods.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

/** Nikdy nemažeme natvrdo – jen `deletedAt` (E-08). Smazaná se přestane nabízet. */
export async function softDeleteFood(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.foods.update(id, { deletedAt: now, updatedAt: now });
}

export function getFood(id: string): Promise<Food | undefined> {
  return db.foods.get(id);
}
