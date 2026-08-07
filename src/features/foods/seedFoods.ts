import { db, type Food, type FoodBasis } from '../../db';
import { newId } from '../../lib/id';

/**
 * Startovní sada běžných potravin (§9, E-10: „prázdná appka první den").
 * Hodnoty jsou na 100 g/ml, ORIENTAČNÍ podle běžných tabulek složení – po
 * naimportování se dají kdykoliv upravit. Nejsou převzaté z konkrétní licencované
 * databáze (vlastní odhady z obecně známých hodnot), takže bez licenčního omezení.
 * Import je idempotentní: co už podle názvu existuje, se nepřidá.
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
  // Přílohy, obiloviny, pečivo
  { name: 'Rýže dlouhozrnná (syrová)', kcal: 350, protein: 7, carbs: 78, fat: 1 },
  { name: 'Rýže basmati (syrová)', kcal: 350, protein: 8, carbs: 78, fat: 1 },
  { name: 'Rýže natural (syrová)', kcal: 360, protein: 7, carbs: 76, fat: 2.5 },
  { name: 'Těstoviny semolinové (syrové)', kcal: 360, protein: 12, carbs: 72, fat: 1.5 },
  { name: 'Těstoviny celozrnné (syrové)', kcal: 340, protein: 13, carbs: 64, fat: 2.5 },
  { name: 'Kuskus (suchý)', kcal: 376, protein: 13, carbs: 77, fat: 1 },
  { name: 'Bulgur (suchý)', kcal: 342, protein: 12, carbs: 76, fat: 1.3 },
  { name: 'Jáhly (suché)', kcal: 378, protein: 11, carbs: 73, fat: 4 },
  { name: 'Pohanka (syrová)', kcal: 343, protein: 13, carbs: 72, fat: 3.4 },
  { name: 'Ovesné vločky', kcal: 370, protein: 13, carbs: 60, fat: 7 },
  { name: 'Kroupy (suché)', kcal: 350, protein: 10, carbs: 73, fat: 1.5 },
  { name: 'Krupice pšeničná', kcal: 355, protein: 12, carbs: 73, fat: 1 },
  { name: 'Brambory', kcal: 77, protein: 2, carbs: 17, fat: 0.1 },
  { name: 'Batáty', kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { name: 'Mouka pšeničná hladká', kcal: 364, protein: 10, carbs: 76, fat: 1 },
  { name: 'Mouka pšeničná polohrubá', kcal: 364, protein: 10, carbs: 76, fat: 1 },
  { name: 'Mouka celozrnná pšeničná', kcal: 340, protein: 13, carbs: 72, fat: 2 },
  { name: 'Strouhanka', kcal: 380, protein: 12, carbs: 72, fat: 4 },
  { name: 'Chléb kmínový', kcal: 250, protein: 8, carbs: 48, fat: 3 },
  { name: 'Chléb žitný', kcal: 250, protein: 8, carbs: 48, fat: 3 },
  { name: 'Rohlík', kcal: 290, protein: 9, carbs: 56, fat: 3 },
  { name: 'Bageta', kcal: 270, protein: 9, carbs: 53, fat: 2 },
  { name: 'Toastový chléb', kcal: 265, protein: 8, carbs: 49, fat: 4 },
  { name: 'Müsli', kcal: 360, protein: 9, carbs: 64, fat: 8 },
  { name: 'Cornflakes', kcal: 378, protein: 7, carbs: 84, fat: 1 },
  // Luštěniny
  { name: 'Čočka (suchá)', kcal: 340, protein: 24, carbs: 52, fat: 1.5 },
  { name: 'Červená čočka (suchá)', kcal: 345, protein: 24, carbs: 56, fat: 1.5 },
  { name: 'Fazole bílé (suché)', kcal: 330, protein: 21, carbs: 50, fat: 1.5 },
  { name: 'Fazole červené (suché)', kcal: 335, protein: 22, carbs: 50, fat: 1.5 },
  { name: 'Cizrna (suchá)', kcal: 364, protein: 19, carbs: 61, fat: 6 },
  { name: 'Hrách (suchý)', kcal: 340, protein: 23, carbs: 60, fat: 1.5 },
  { name: 'Sója (suchá)', kcal: 400, protein: 36, carbs: 30, fat: 20 },
  // Maso a uzeniny
  { name: 'Kuřecí prsa', kcal: 106, protein: 23, carbs: 0, fat: 1.5 },
  { name: 'Kuřecí stehno bez kůže', kcal: 120, protein: 20, carbs: 0, fat: 4.5 },
  { name: 'Krůtí prsa', kcal: 105, protein: 24, carbs: 0, fat: 1 },
  { name: 'Vepřová kýta', kcal: 180, protein: 21, carbs: 0, fat: 10 },
  { name: 'Vepřová panenka', kcal: 143, protein: 21, carbs: 0, fat: 6 },
  { name: 'Vepřová plec', kcal: 210, protein: 18, carbs: 0, fat: 15 },
  { name: 'Vepřový bůček', kcal: 520, protein: 9, carbs: 0, fat: 53 },
  { name: 'Hovězí zadní', kcal: 190, protein: 21, carbs: 0, fat: 11 },
  { name: 'Hovězí svíčková', kcal: 130, protein: 21, carbs: 0, fat: 5 },
  { name: 'Mleté hovězí', kcal: 250, protein: 18, carbs: 0, fat: 20 },
  { name: 'Mleté vepřové', kcal: 270, protein: 17, carbs: 0, fat: 23 },
  { name: 'Slanina', kcal: 540, protein: 12, carbs: 0, fat: 53 },
  { name: 'Šunka drůbeží', kcal: 110, protein: 16, carbs: 1, fat: 4.5 },
  { name: 'Šunka vepřová', kcal: 105, protein: 18, carbs: 1, fat: 3.5 },
  { name: 'Klobása', kcal: 300, protein: 13, carbs: 2, fat: 27 },
  { name: 'Párek', kcal: 260, protein: 11, carbs: 2, fat: 23 },
  { name: 'Salám Vysočina', kcal: 440, protein: 16, carbs: 1, fat: 41 },
  // Ryby a mořské plody
  { name: 'Losos', kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { name: 'Pstruh', kcal: 120, protein: 20, carbs: 0, fat: 4 },
  { name: 'Treska', kcal: 82, protein: 18, carbs: 0, fat: 0.7 },
  { name: 'Makrela', kcal: 205, protein: 19, carbs: 0, fat: 14 },
  { name: 'Tuňák v konzervě (ve vlastní šťávě)', kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { name: 'Sardinky v oleji', kcal: 220, protein: 25, carbs: 0, fat: 13 },
  { name: 'Krevety', kcal: 99, protein: 24, carbs: 0, fat: 0.3 },
  // Mléčné a vejce
  { name: 'Vejce slepičí', kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { name: 'Vaječný bílek', kcal: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  { name: 'Vaječný žloutek', kcal: 322, protein: 16, carbs: 3.6, fat: 27 },
  { name: 'Mléko polotučné', kcal: 47, protein: 3.4, carbs: 4.8, fat: 1.5, basis: 'ml' },
  { name: 'Mléko plnotučné', kcal: 62, protein: 3.3, carbs: 4.7, fat: 3.5, basis: 'ml' },
  { name: 'Smetana ke šlehání 33 %', kcal: 320, protein: 2.5, carbs: 3, fat: 33, basis: 'ml' },
  { name: 'Smetana na vaření 12 %', kcal: 127, protein: 3, carbs: 4, fat: 12, basis: 'ml' },
  { name: 'Zakysaná smetana 15 %', kcal: 160, protein: 3, carbs: 3.5, fat: 15 },
  { name: 'Jogurt bílý', kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { name: 'Jogurt řecký', kcal: 133, protein: 9, carbs: 4, fat: 9 },
  { name: 'Tvaroh měkký polotučný', kcal: 130, protein: 18, carbs: 3.5, fat: 4.5 },
  { name: 'Cottage sýr', kcal: 98, protein: 12, carbs: 3, fat: 4 },
  { name: 'Eidam 30 %', kcal: 274, protein: 26, carbs: 0, fat: 17 },
  { name: 'Gouda', kcal: 356, protein: 25, carbs: 0, fat: 28 },
  { name: 'Mozzarella', kcal: 253, protein: 18, carbs: 1, fat: 19 },
  { name: 'Parmezán', kcal: 392, protein: 36, carbs: 3, fat: 25 },
  { name: 'Niva', kcal: 350, protein: 20, carbs: 2, fat: 29 },
  { name: 'Máslo', kcal: 740, protein: 0.8, carbs: 0.6, fat: 82 },
  { name: 'Sádlo', kcal: 900, protein: 0, carbs: 0, fat: 100 },
  { name: 'Margarín', kcal: 720, protein: 0, carbs: 1, fat: 80 },
  // Tuky, oleje, sladidla
  { name: 'Olej řepkový', kcal: 884, protein: 0, carbs: 0, fat: 100, basis: 'ml' },
  { name: 'Olej slunečnicový', kcal: 884, protein: 0, carbs: 0, fat: 100, basis: 'ml' },
  { name: 'Olej olivový', kcal: 884, protein: 0, carbs: 0, fat: 100, basis: 'ml' },
  { name: 'Cukr krystal', kcal: 400, protein: 0, carbs: 100, fat: 0 },
  { name: 'Cukr moučkový', kcal: 400, protein: 0, carbs: 100, fat: 0 },
  { name: 'Hnědý cukr', kcal: 380, protein: 0, carbs: 98, fat: 0 },
  { name: 'Med', kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  { name: 'Javorový sirup', kcal: 260, protein: 0, carbs: 67, fat: 0 },
  { name: 'Kakao nesladké', kcal: 350, protein: 20, carbs: 25, fat: 14 },
  // Zelenina
  { name: 'Cibule', kcal: 40, protein: 1.1, carbs: 9, fat: 0.1 },
  { name: 'Červená cibule', kcal: 40, protein: 1.1, carbs: 9, fat: 0.1 },
  { name: 'Česnek', kcal: 149, protein: 6, carbs: 33, fat: 0.5 },
  { name: 'Pórek', kcal: 61, protein: 1.5, carbs: 14, fat: 0.3 },
  { name: 'Mrkev', kcal: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { name: 'Petržel kořen', kcal: 75, protein: 3, carbs: 17, fat: 0.6 },
  { name: 'Celer bulva', kcal: 42, protein: 1.5, carbs: 9, fat: 0.3 },
  { name: 'Řapíkatý celer', kcal: 16, protein: 0.7, carbs: 3, fat: 0.2 },
  { name: 'Rajče', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name: 'Rajčata loupaná (konzerva)', kcal: 30, protein: 1.3, carbs: 6, fat: 0.2 },
  { name: 'Rajčatový protlak', kcal: 82, protein: 4, carbs: 19, fat: 0.5 },
  { name: 'Passata (rajčatová)', kcal: 35, protein: 1.5, carbs: 6, fat: 0.3 },
  { name: 'Paprika červená', kcal: 31, protein: 1, carbs: 6, fat: 0.3 },
  { name: 'Paprika zelená', kcal: 20, protein: 0.9, carbs: 4.6, fat: 0.2 },
  { name: 'Cuketa', kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  { name: 'Lilek', kcal: 25, protein: 1, carbs: 6, fat: 0.2 },
  { name: 'Okurka', kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { name: 'Brokolice', kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name: 'Květák', kcal: 25, protein: 1.9, carbs: 5, fat: 0.3 },
  { name: 'Zelí bílé', kcal: 25, protein: 1.3, carbs: 6, fat: 0.1 },
  { name: 'Kysané zelí', kcal: 19, protein: 0.9, carbs: 4, fat: 0.1 },
  { name: 'Špenát', kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { name: 'Salát hlávkový', kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  { name: 'Ředkvička', kcal: 16, protein: 0.7, carbs: 3.4, fat: 0.1 },
  { name: 'Žampiony', kcal: 22, protein: 3, carbs: 3.3, fat: 0.3 },
  { name: 'Kukuřice (konzerva)', kcal: 86, protein: 3, carbs: 19, fat: 1.2 },
  { name: 'Hrášek zelený (mražený)', kcal: 81, protein: 5, carbs: 14, fat: 0.4 },
  { name: 'Fazolové lusky', kcal: 31, protein: 1.8, carbs: 7, fat: 0.1 },
  { name: 'Dýně hokaido', kcal: 40, protein: 1, carbs: 9, fat: 0.1 },
  { name: 'Řepa červená', kcal: 43, protein: 1.6, carbs: 10, fat: 0.2 },
  { name: 'Avokádo', kcal: 160, protein: 2, carbs: 9, fat: 15 },
  // Ovoce
  { name: 'Jablko', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { name: 'Hruška', kcal: 57, protein: 0.4, carbs: 15, fat: 0.1 },
  { name: 'Banán', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { name: 'Pomeranč', kcal: 47, protein: 0.9, carbs: 12, fat: 0.1 },
  { name: 'Mandarinka', kcal: 53, protein: 0.8, carbs: 13, fat: 0.3 },
  { name: 'Citron', kcal: 29, protein: 1.1, carbs: 9, fat: 0.3 },
  { name: 'Jahody', kcal: 32, protein: 0.7, carbs: 8, fat: 0.3 },
  { name: 'Borůvky', kcal: 57, protein: 0.7, carbs: 14, fat: 0.3 },
  { name: 'Maliny', kcal: 52, protein: 1.2, carbs: 12, fat: 0.7 },
  { name: 'Hroznové víno', kcal: 69, protein: 0.7, carbs: 18, fat: 0.2 },
  { name: 'Broskev', kcal: 39, protein: 0.9, carbs: 10, fat: 0.3 },
  { name: 'Meruňka', kcal: 48, protein: 1.4, carbs: 11, fat: 0.4 },
  { name: 'Švestky', kcal: 46, protein: 0.7, carbs: 11, fat: 0.3 },
  { name: 'Ananas', kcal: 50, protein: 0.5, carbs: 13, fat: 0.1 },
  { name: 'Kiwi', kcal: 61, protein: 1.1, carbs: 15, fat: 0.5 },
  { name: 'Meloun vodní', kcal: 30, protein: 0.6, carbs: 8, fat: 0.2 },
  { name: 'Rozinky', kcal: 299, protein: 3, carbs: 79, fat: 0.5 },
  { name: 'Datle sušené', kcal: 282, protein: 2.5, carbs: 75, fat: 0.4 },
  // Ořechy a semínka
  { name: 'Vlašské ořechy', kcal: 654, protein: 15, carbs: 14, fat: 65 },
  { name: 'Mandle', kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { name: 'Lískové ořechy', kcal: 628, protein: 15, carbs: 17, fat: 61 },
  { name: 'Kešu', kcal: 553, protein: 18, carbs: 30, fat: 44 },
  { name: 'Arašídy', kcal: 567, protein: 26, carbs: 16, fat: 49 },
  { name: 'Slunečnicová semínka', kcal: 584, protein: 21, carbs: 20, fat: 51 },
  { name: 'Dýňová semínka', kcal: 559, protein: 30, carbs: 11, fat: 49 },
  { name: 'Chia semínka', kcal: 486, protein: 17, carbs: 42, fat: 31 },
  { name: 'Lněná semínka', kcal: 534, protein: 18, carbs: 29, fat: 42 },
  { name: 'Sezam', kcal: 573, protein: 18, carbs: 23, fat: 50 },
  { name: 'Kokos strouhaný', kcal: 660, protein: 7, carbs: 24, fat: 64 },
  // Tekutiny, základy, koření
  { name: 'Kokosové mléko', kcal: 200, protein: 2, carbs: 3, fat: 21, basis: 'ml' },
  { name: 'Sójová omáčka', kcal: 60, protein: 8, carbs: 6, fat: 0, basis: 'ml' },
  { name: 'Ocet', kcal: 20, protein: 0, carbs: 0.6, fat: 0, basis: 'ml' },
  { name: 'Kečup', kcal: 100, protein: 1.2, carbs: 24, fat: 0.2 },
  { name: 'Hořčice', kcal: 66, protein: 4, carbs: 5, fat: 4 },
  { name: 'Majonéza', kcal: 680, protein: 1, carbs: 2, fat: 75 },
  { name: 'Droždí čerstvé', kcal: 105, protein: 12, carbs: 12, fat: 2 },
  { name: 'Sůl', kcal: 0, protein: 0, carbs: 0, fat: 0 },
  // Sladké
  { name: 'Čokoláda hořká', kcal: 546, protein: 8, carbs: 46, fat: 38 },
  { name: 'Čokoláda mléčná', kcal: 535, protein: 8, carbs: 59, fat: 30 },
  { name: 'Lískooříšková pomazánka', kcal: 539, protein: 6, carbs: 57, fat: 31 },
  { name: 'Marmeláda', kcal: 250, protein: 0.5, carbs: 62, fat: 0 },
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
