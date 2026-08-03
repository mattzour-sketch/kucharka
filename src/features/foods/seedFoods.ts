import { db, type Food, type FoodBasis } from '../../db';
import { newId } from '../../lib/id';

/**
 * Startovní sada běžných potravin (E-10: „prázdná appka první den").
 * Hodnoty jsou na 100 g/ml, orientační podle běžných tabulek – po naimportování
 * se dají kdykoliv upravit. Import je idempotentní: co už podle názvu existuje,
 * se nepřidá.
 */

interface SeedFood {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  basis?: FoodBasis;
}

const BASIC_FOODS: SeedFood[] = [
  // Přílohy a obiloviny
  { name: 'Rýže dlouhozrnná (syrová)', kcal: 350, protein: 7, carbs: 78, fat: 1 },
  { name: 'Těstoviny semolinové (syrové)', kcal: 360, protein: 12, carbs: 72, fat: 1.5 },
  { name: 'Brambory', kcal: 77, protein: 2, carbs: 17, fat: 0.1 },
  { name: 'Ovesné vločky', kcal: 370, protein: 13, carbs: 60, fat: 7 },
  { name: 'Mouka pšeničná hladká', kcal: 364, protein: 10, carbs: 76, fat: 1 },
  { name: 'Chléb kmínový', kcal: 250, protein: 8, carbs: 48, fat: 3 },
  { name: 'Rohlík', kcal: 290, protein: 9, carbs: 56, fat: 3 },
  { name: 'Čočka (suchá)', kcal: 340, protein: 24, carbs: 52, fat: 1.5 },
  // Maso a ryby
  { name: 'Kuřecí prsa', kcal: 106, protein: 23, carbs: 0, fat: 1.5 },
  { name: 'Kuřecí stehno bez kůže', kcal: 120, protein: 20, carbs: 0, fat: 4.5 },
  { name: 'Vepřová kýta', kcal: 180, protein: 21, carbs: 0, fat: 10 },
  { name: 'Hovězí zadní', kcal: 190, protein: 21, carbs: 0, fat: 11 },
  { name: 'Mleté hovězí', kcal: 250, protein: 18, carbs: 0, fat: 20 },
  { name: 'Losos', kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { name: 'Šunka drůbeží', kcal: 110, protein: 16, carbs: 1, fat: 4.5 },
  // Mléčné a vejce
  { name: 'Vejce slepičí', kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { name: 'Mléko polotučné', kcal: 47, protein: 3.4, carbs: 4.8, fat: 1.5, basis: 'ml' },
  { name: 'Jogurt bílý', kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { name: 'Tvaroh polotučný', kcal: 130, protein: 18, carbs: 3.5, fat: 4.5 },
  { name: 'Eidam 30 %', kcal: 274, protein: 26, carbs: 0, fat: 17 },
  { name: 'Máslo', kcal: 740, protein: 0.8, carbs: 0.6, fat: 82 },
  { name: 'Smetana ke šlehání 33 %', kcal: 320, protein: 2.5, carbs: 3, fat: 33, basis: 'ml' },
  { name: 'Smetana na vaření 12 %', kcal: 127, protein: 3, carbs: 4, fat: 12, basis: 'ml' },
  // Tuky a sladidla
  { name: 'Olej řepkový', kcal: 884, protein: 0, carbs: 0, fat: 100, basis: 'ml' },
  { name: 'Cukr krystal', kcal: 400, protein: 0, carbs: 100, fat: 0 },
  { name: 'Med', kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  // Zelenina
  { name: 'Cibule', kcal: 40, protein: 1.1, carbs: 9, fat: 0.1 },
  { name: 'Česnek', kcal: 149, protein: 6, carbs: 33, fat: 0.5 },
  { name: 'Mrkev', kcal: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { name: 'Rajče', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name: 'Paprika', kcal: 31, protein: 1, carbs: 6, fat: 0.3 },
  { name: 'Brokolice', kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name: 'Cuketa', kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  // Ovoce
  { name: 'Jablko', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { name: 'Banán', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
];

export function basicFoodCount(): number {
  return BASIC_FOODS.length;
}

/** Přidá základní potraviny, které ještě podle názvu neexistují. Vrací počet přidaných. */
export async function seedBasicFoods(): Promise<number> {
  const existing = await db.foods.filter((food) => !food.deletedAt).toArray();
  const have = new Set(existing.map((food) => food.name.toLowerCase()));
  const now = new Date().toISOString();
  const toAdd: Food[] = BASIC_FOODS.filter((food) => !have.has(food.name.toLowerCase())).map(
    (food) => ({
      id: newId(),
      name: food.name,
      brand: null,
      barcode: null,
      basis: food.basis ?? 'g',
      energyKcal: food.kcal,
      proteinG: food.protein,
      carbsG: food.carbs,
      fatG: food.fat,
      source: 'import',
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }),
  );
  if (toAdd.length > 0) await db.foods.bulkAdd(toAdd);
  return toAdd.length;
}
