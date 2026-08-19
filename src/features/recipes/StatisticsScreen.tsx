import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { formatCzechDate, todayIso } from '../../lib/date';
import { formatNumber } from '../../lib/num';
import { computeCookingStats } from './cookingStats';

/** Statistiky vaření (§10) – přehled z historie. Dostupné z „Víc". */
export default function StatisticsScreen() {
  const data = useLiveQuery(async () => {
    const [logs, recipes] = await Promise.all([db.cookLogs.toArray(), db.recipes.toArray()]);
    return { logs, recipes };
  }, []);

  if (data === undefined) return null;
  const stats = computeCookingStats(data.logs, data.recipes, todayIso());

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-2 py-2">
          <Link
            to="/vic"
            className="rounded-lg px-3 py-1.5 text-lg text-stone-500 transition hover:bg-stone-200/60"
            aria-label="Zpět"
          >
            ‹
          </Link>
          <h1 className="text-sm font-medium text-stone-600">Statistiky</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {stats.totalCooks === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-stone-500">Zatím žádná historie vaření.</p>
            <p className="mt-1 text-sm text-stone-400">
              Uvař recept a dej „Hotovo", ať se sem něco zapíše.
            </p>
          </div>
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
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Nejčastěji vařené
              </h2>
              <ul className="mt-2 flex flex-col gap-2">
                {stats.top.map((item) => {
                  const row = (
                    <div className="flex items-baseline justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-xs text-stone-400">
                          naposledy {formatCzechDate(item.lastCookedOn)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-brand-dark">
                        {item.count}×
                      </span>
                    </div>
                  );
                  return (
                    <li key={item.recipeId}>
                      {item.exists ? (
                        <Link to={`/recept/${item.recipeId}`} className="block transition active:scale-[0.99]">
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {stats.neverCookedCount > 0 ? (
              <p className="mt-4 text-sm text-stone-400">
                Neuvařené recepty: {stats.neverCookedCount}
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-xs text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
