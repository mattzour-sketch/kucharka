/**
 * Nutriční výpočty (SPEC 7.5).
 *
 * Zásady, které se tu nesmí porušit:
 * - Do součtů se počítají JEN napojené položky. Chybějící se nedohadují.
 * - Úplnost se přiznává vždy; při nulové úplnosti se nevrací nulové součty
 *   jako platný výsledek, ale rozlišitelný stav „nelze spočítat".
 * - Uvnitř modulu se NIKDY nezaokrouhluje. Zaokrouhluje se až v komponentě.
 * - Podrecept se normalizuje na 100 g SVÉ finální hmotnosti.
 * - Cyklus receptů vyhodí chybu, nezacyklí se.
 *
 * Modul je záměrně oddělený od Dexie/DB: pracuje nad prostými objekty a nad
 * lookup rozhraním `NutritionSource`. Mapování z databázových typů se dělá jinde.
 */

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Nutriční hodnoty. U potraviny jsou vztažené na 100 g/ml, jinde absolutní. */
export type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Hodnoty potraviny na 100 g/ml. */
export type FoodValue = Nutrients;

/** Položka receptu pro výpočet – jen to, co výpočet potřebuje. */
export type CalcItem = {
  foodId?: string | null;
  subRecipeId?: string | null;
  amountG?: number | null;
  isSkipped?: boolean;
};

/** Recept pro výpočet – suroviny jsou vložené, ne v samostatné tabulce. */
export type CalcRecipe = {
  id: string;
  servings?: number | null;
  cookedWeightG?: number | null;
  items: CalcItem[];
};

/** Rozhraní pro dohledání potravin a podreceptů podle id. */
export type NutritionSource = {
  food(id: string): FoodValue;
  recipe(id: string): CalcRecipe;
};

export type Completeness = {
  /** Napojené položky (mají potravinu/podrecept i gramáž). */
  connected: number;
  /** Započitatelné položky (nejsou přeskočené). */
  countable: number;
  /** connected / countable; 0 když není co počítat. */
  ratio: number;
};

/**
 * Výsledek výpočtu receptu.
 * `computable: false` = ani jedna surovina není napojená → nelze spočítat.
 * Tenhle stav se NIKDY nezamění za „součty jsou nula" (SPEC 7.5, případ d).
 */
export type RecipeTotals =
  | { computable: false; completeness: Completeness }
  | {
      computable: true;
      totals: Nutrients;
      /** Součet gramáží napojených surovin. */
      rawWeight: number;
      /** cookedWeightG ?? rawWeight – jmenovatel pro hodnoty na 100 g. */
      finalWeight: number;
      completeness: Completeness;
    };

/** Zápis do deníku – vypočtený snapshot, ne odkaz (SPEC 7.5, E-01). */
export type LogEntryDraft = {
  loggedOn: string;
  meal: Meal;
  recipeId: string;
  amountG: number;
  displayName: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

function isCountable(item: CalcItem): boolean {
  return item.isSkipped !== true;
}

function isConnected(item: CalcItem): boolean {
  return (
    isCountable(item) &&
    (item.foodId != null || item.subRecipeId != null) &&
    item.amountG != null
  );
}

function scale(n: Nutrients, k: number): Nutrients {
  return {
    kcal: n.kcal * k,
    protein: n.protein * k,
    carbs: n.carbs * k,
    fat: n.fat * k,
  };
}

/** Úplnost napojení surovin (SPEC 7.5). Nepočítá se rekurzivně do podreceptů. */
export function completeness(recipe: CalcRecipe): Completeness {
  let countable = 0;
  let connected = 0;
  for (const item of recipe.items) {
    if (isCountable(item)) countable += 1;
    if (isConnected(item)) connected += 1;
  }
  return {
    connected,
    countable,
    ratio: countable === 0 ? 0 : connected / countable,
  };
}

/**
 * Celkové hodnoty receptu z napojených surovin.
 * `visited` slouží k detekci cyklu přes podrecepty (SPEC, E-03).
 */
export function recipeTotals(
  recipe: CalcRecipe,
  source: NutritionSource,
  visited: Set<string> = new Set(),
): RecipeTotals {
  if (visited.has(recipe.id)) {
    throw new Error(`Cyklická reference receptů: ${recipe.id}`);
  }
  visited.add(recipe.id);
  try {
    const totals: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    let rawWeight = 0;
    let connectedCount = 0;

    for (const item of recipe.items) {
      if (!isConnected(item)) continue;
      const amount = item.amountG as number;

      let per100: Nutrients;
      if (item.foodId != null) {
        per100 = source.food(item.foodId);
      } else {
        const sub = recipeTotals(source.recipe(item.subRecipeId as string), source, visited);
        // Podrecept bez napojených surovin nemá čím přispět – přeskočíme ho.
        if (!sub.computable) continue;
        per100 = scale(sub.totals, 100 / sub.finalWeight);
      }

      const factor = amount / 100;
      totals.kcal += per100.kcal * factor;
      totals.protein += per100.protein * factor;
      totals.carbs += per100.carbs * factor;
      totals.fat += per100.fat * factor;
      rawWeight += amount;
      connectedCount += 1;
    }

    const comp = completeness(recipe);
    if (connectedCount === 0) {
      return { computable: false, completeness: comp };
    }

    return {
      computable: true,
      totals,
      rawWeight,
      finalWeight: recipe.cookedWeightG ?? rawWeight,
      completeness: comp,
    };
  } finally {
    visited.delete(recipe.id);
  }
}

/** Hodnoty na 100 g finální hmotnosti. */
export function per100g(totals: Nutrients, finalWeight: number): Nutrients {
  return scale(totals, 100 / finalWeight);
}

/** Hodnoty na porci; `null` když počet porcí není zadaný (SPEC 7.5, případ e). */
export function perServing(totals: Nutrients, servings: number | null | undefined): Nutrients | null {
  if (servings == null || servings <= 0) return null;
  return scale(totals, 1 / servings);
}

/**
 * Zápis receptu do deníku (SPEC 7.5). Uloží se VÝSLEDEK, ne odkaz na recept,
 * aby pozdější úprava receptu nezměnila historii (E-01).
 * Recept bez napojených surovin do deníku zapsat nelze.
 */
export function logEntryFromRecipe(
  recipe: CalcRecipe & { name: string },
  grams: number,
  meal: Meal,
  day: string,
  source: NutritionSource,
): LogEntryDraft {
  const result = recipeTotals(recipe, source);
  if (!result.computable) {
    throw new Error('Recept nemá napojené suroviny, nelze spočítat zápis do deníku.');
  }

  const factor = grams / result.finalWeight;
  return {
    loggedOn: day,
    meal,
    recipeId: recipe.id,
    amountG: grams,
    displayName: recipe.name,
    energyKcal: result.totals.kcal * factor,
    proteinG: result.totals.protein * factor,
    carbsG: result.totals.carbs * factor,
    fatG: result.totals.fat * factor,
  };
}
