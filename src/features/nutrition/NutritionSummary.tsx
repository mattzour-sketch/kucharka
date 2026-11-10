import { formatNumber } from '../../lib/num';
import type { Nutrients } from '../../lib/nutrition';
import type { RecipeNutritionResult } from './recipeNutrition';
import { cardClass } from '../../components/ui/cardClass';

function macros(n: Nutrients): string {
  return `B ${formatNumber(n.protein)} · S ${formatNumber(n.carbs)} · T ${formatNumber(n.fat)} g`;
}

/**
 * Souhrn nutričních hodnot receptu. Vždy přiznává úplnost (R-31, E-13):
 * při neúplném napojení varuje, při nulovém nezobrazí žádné číslo.
 *
 * `compact` (detail receptu) = jedno velké číslo a ostatní hodnoty na řádku pod ním,
 * ať souhrn neodsouvá suroviny. Bez něj (obrazovka Kalorie) plná tabulka po řádcích.
 */
export default function NutritionSummary({
  result,
  compact = false,
}: {
  result: RecipeNutritionResult;
  compact?: boolean;
}) {
  if (result.hasCycle) {
    return (
      <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
        Recept obsahuje sám sebe – hodnoty nelze spočítat.
      </div>
    );
  }
  if (!result.computable || !result.total) return null;

  const { completeness: comp, total, perServing, per100g, finalWeight } = result;
  const partial = comp.ratio < 1;
  const warning = partial ? (
    <p className="flex items-center gap-1.5 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
      <span aria-hidden>⚠</span>
      <span>Orientační – spočítáno z {comp.connected} z {comp.countable} surovin</span>
    </p>
  ) : null;

  if (compact) {
    const main = perServing
      ? { label: 'Na porci', value: perServing }
      : per100g
        ? { label: 'Na 100 g', value: per100g }
        : null;
    return (
      <div className={cardClass({ padding: 'none', className: 'overflow-hidden' })}>
        {warning}
        {main ? (
          <div className="flex items-end justify-between gap-4 px-4 pb-2.5 pt-3">
            <div>
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{main.label}</p>
              <p className="flex items-baseline gap-1.5">
                <span className="text-[2rem] font-bold leading-none tracking-tight tabular-nums">
                  {formatNumber(main.value.kcal)}
                </span>
                <span className="text-sm font-semibold text-stone-500 dark:text-stone-400">kcal</span>
              </p>
            </div>
            <p className="pb-0.5 text-sm font-medium tabular-nums text-stone-700 dark:text-stone-200">
              {macros(main.value)}
            </p>
          </div>
        ) : null}
        <p className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-t border-stone-900/[0.07] px-4 py-2 text-xs tabular-nums text-stone-500 dark:border-white/10 dark:text-stone-400">
          {perServing && per100g ? <span>Na 100 g {formatNumber(per100g.kcal)} kcal</span> : null}
          <span>
            Celkem {formatNumber(total.kcal)} kcal
            {finalWeight ? ` · ${formatNumber(finalWeight)} g` : ''}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass({ padding: 'none', className: 'overflow-hidden' })}>
      {warning}
      <div className="divide-y divide-stone-900/[0.07] dark:divide-white/10">
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
      <span className={`text-sm ${primary ? 'font-semibold' : 'text-stone-500 dark:text-stone-400'}`}>{label}</span>
      <span className="text-right tabular-nums">
        <span className={primary ? 'text-lg font-bold' : 'font-semibold'}>
          {formatNumber(kcal)} kcal
        </span>
        {detail ? <span className="block text-xs text-stone-500 dark:text-stone-400">{detail}</span> : null}
      </span>
    </div>
  );
}
