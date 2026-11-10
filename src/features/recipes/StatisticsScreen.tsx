import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { formatCzechDate, todayIso } from '../../lib/date';
import { formatNumber } from '../../lib/num';
import { computeCookingStats } from './cookingStats';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { cardClass } from '../../components/ui/cardClass';
import { ReadingSkeleton } from '../../components/ui/Loading';
import { SECTION_TITLE, LINK } from '../../components/ui/styles';
import { cx } from '../../components/ui/cx';

/** Statistiky vaření (§10) – přehled z historie. Dostupné z „Víc". */
export default function StatisticsScreen() {
  const data = useLiveQuery(async () => {
    const [logs, recipes] = await Promise.all([db.cookLogs.toArray(), db.recipes.toArray()]);
    return { logs, recipes };
  }, []);

  if (data === undefined) {
    return (
      <div className="min-h-dvh">
        <ScreenHeader variant="stack" width="narrow" backTo="/vic" title="Statistiky" />
        <main className="mx-auto max-w-2xl px-4 py-4">
          <ReadingSkeleton />
        </main>
      </div>
    );
  }
  const stats = computeCookingStats(data.logs, data.recipes, todayIso());

  return (
    <div className="min-h-dvh">
      <ScreenHeader variant="stack" width="narrow" backTo="/vic" title="Statistiky" />

      <main className="mx-auto max-w-2xl px-4 py-4">
        {stats.totalCooks === 0 ? (
          <EmptyState
            title="Zatím žádná historie vaření"
            description={'Uvař recept a dej „Hotovo", ať se sem něco zapíše.'}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Uvařeno celkem" value={String(stats.totalCooks)} />
              <Tile label="Tento měsíc" value={String(stats.cooksThisMonth)} />
              <Tile label="Různých receptů" value={String(stats.distinctRecipes)} />
              <Tile
                label="Ø kalorie/porce"
                value={stats.avgPortionKcal != null ? `${formatNumber(stats.avgPortionKcal)} kcal` : '—'}
              />
            </div>

            <section className="mt-6">
              <h2 className={SECTION_TITLE}>
                Nejčastěji vařené
              </h2>
              <ul className="mt-2 flex flex-col gap-2">
                {stats.top.map((item) => {
                  const row = (
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.name}</p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          naposledy {formatCzechDate(item.lastCookedOn)}
                        </p>
                      </div>
                      <span className="shrink-0 text-base font-bold tabular-nums">
                        {item.count}×
                      </span>
                    </div>
                  );
                  return (
                    <li key={item.recipeId}>
                      {item.exists ? (
                        <Link
                          to={`/recept/${item.recipeId}`}
                          className={cardClass({ padding: 'row', interactive: true, className: 'block' })}
                        >
                          {row}
                        </Link>
                      ) : (
                        <div className={cardClass({ padding: 'row' })}>{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {stats.neverCookedCount > 0 ? (
              <Link
                to="/?neuvarene=1"
                className={cx(LINK, 'mt-3 flex min-h-10 items-center text-sm')}
              >
                Neuvařené recepty: {stats.neverCookedCount} →
              </Link>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
    </Card>
  );
}
