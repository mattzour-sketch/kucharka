import { formatNumber } from '../../lib/num';
import type { Nutrients } from '../../lib/nutrition';
import type { RecipeNutritionResult } from './recipeNutrition';

function macros(n: Nutrients): string {
  return `B ${formatNumber(n.protein)} · S ${formatNumber(n.carbs)} · T ${formatNumber(n.fat)} g`;
}

/**
 * Souhrn nutričních hodnot receptu. Vždy přiznává úplnost (R-31, E-13):
 * při neúplném napojení varuje, při nulovém nezobrazí žádné číslo.
 */
export default function NutritionSummary({ result }: { result: RecipeNutritionResult }) {
  if (result.hasCycle) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Recept obsahuje sám sebe – hodnoty nelze spočítat.
      </div>
    );
  }
  if (!result.computable || !result.total) return null;

  const { completeness: comp, total, perServing, per100g, finalWeight } = result;
  const partial = comp.ratio < 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      {partial ? (
        <p className="bg-amber-50 px-4 py-2 text-xs text-amber-700">
          ⚠ Orientační – spočítáno z {comp.connected} z {comp.countable} surovin
        </p>
      ) : null}
      <div className="divide-y divide-stone-100">
        {perServing ? (
          <Row label="Na porci" kcal={perServing.kcal} detail={macros(perServing)} primary />
        ) : null}
        {per100g ? (
          <Row label="Na 100 g" kcal={per100g.kcal} detail={macros(per100g)} primary={!perServing} />
        ) : null}
        <Row
          label="Celkem"
          kcal={total.kcal}
          detail={finalWeight ? `${formatNumber(finalWeight)} g` : ''}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  kcal,
  detail,
  primary = false,
}: {
  label: string;
  kcal: number;
  detail: string;
  primary?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <span className={`text-sm ${primary ? 'font-medium' : 'text-stone-500'}`}>{label}</span>
      <span className="text-right">
        <span className={primary ? 'text-lg font-semibold' : 'font-medium'}>
          {formatNumber(kcal)} kcal
        </span>
        {detail ? <span className="block text-xs text-stone-400">{detail}</span> : null}
      </span>
    </div>
  );
}
