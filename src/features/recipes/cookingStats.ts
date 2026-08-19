import type { CookLog, Recipe } from '../../db';

/**
 * Statistiky vaření (§10) – čistě z historie (`cook_logs`). Nedopočítává nic
 * z receptů za běhu kromě aktuálního názvu pro zobrazení; čísla vychází ze
 * snímků, takže úprava receptu historii nezmění (viz pravidlo 5).
 */

export interface RecipeCookStat {
  recipeId: string;
  name: string;
  count: number;
  lastCookedOn: string;
  /** Recept ještě existuje (dá se otevřít). */
  exists: boolean;
}

export interface CookingStats {
  totalCooks: number;
  cooksThisMonth: number;
  distinctRecipes: number;
  /** Průměr kalorií na porci přes záznamy, co je mají; null, když žádný nemá. */
  avgPortionKcal: number | null;
  lastCookedOn: string | null;
  top: RecipeCookStat[];
  /** Kolik existujících receptů ještě nikdy nebylo uvařeno. */
  neverCookedCount: number;
}

type StatLog = Pick<CookLog, 'recipeId' | 'recipeName' | 'cookedOn' | 'perPortion'>;
type StatRecipe = Pick<Recipe, 'id' | 'name' | 'deletedAt'>;

export function computeCookingStats(
  logs: StatLog[],
  recipes: StatRecipe[],
  today: string,
  topLimit = 5,
): CookingStats {
  const liveRecipes = recipes.filter((recipe) => !recipe.deletedAt);
  const nameById = new Map(recipes.map((recipe) => [recipe.id, recipe.name]));
  const liveIds = new Set(liveRecipes.map((recipe) => recipe.id));

  const month = today.slice(0, 7); // „YYYY-MM"
  let cooksThisMonth = 0;
  let kcalSum = 0;
  let kcalCount = 0;
  let lastCookedOn: string | null = null;
  const byRecipe = new Map<string, { count: number; last: string; snapshotName: string }>();

  for (const log of logs) {
    if (log.cookedOn.slice(0, 7) === month) cooksThisMonth += 1;
    if (log.perPortion && Number.isFinite(log.perPortion.kcal)) {
      kcalSum += log.perPortion.kcal;
      kcalCount += 1;
    }
    if (!lastCookedOn || log.cookedOn > lastCookedOn) lastCookedOn = log.cookedOn;
    const agg = byRecipe.get(log.recipeId);
    if (agg) {
      agg.count += 1;
      if (log.cookedOn > agg.last) agg.last = log.cookedOn;
    } else {
      byRecipe.set(log.recipeId, { count: 1, last: log.cookedOn, snapshotName: log.recipeName });
    }
  }

  const top: RecipeCookStat[] = [...byRecipe.entries()]
    .map(([recipeId, agg]) => ({
      recipeId,
      name: nameById.get(recipeId) ?? (agg.snapshotName || '(smazaný recept)'),
      count: agg.count,
      lastCookedOn: agg.last,
      exists: liveIds.has(recipeId),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.lastCookedOn !== b.lastCookedOn) return b.lastCookedOn.localeCompare(a.lastCookedOn);
      return a.name.localeCompare(b.name, 'cs');
    })
    .slice(0, topLimit);

  const neverCookedCount = liveRecipes.filter((recipe) => !byRecipe.has(recipe.id)).length;

  return {
    totalCooks: logs.length,
    cooksThisMonth,
    distinctRecipes: byRecipe.size,
    avgPortionKcal: kcalCount > 0 ? kcalSum / kcalCount : null,
    lastCookedOn,
    top,
    neverCookedCount,
  };
}
