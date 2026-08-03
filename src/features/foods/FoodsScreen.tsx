import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { matchesQuery } from '../../lib/search';
import { formatNumber } from '../../lib/num';

/** Seznam a hledání potravin (F-01). Potraviny slouží k napojení surovin receptů. */
export default function FoodsScreen() {
  const [query, setQuery] = useState('');
  const foods = useLiveQuery(async () => {
    const all = await db.foods.toArray();
    return all.filter((food) => !food.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, []);

  const loading = foods === undefined;
  const results = (foods ?? []).filter((food) =>
    matchesQuery(`${food.name} ${food.brand ?? ''}`, query),
  );

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight">Potraviny</h1>
            <Link
              to="/potraviny/nova"
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
            >
              + Nová
            </Link>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="hledat potravinu…"
            className="mt-2 w-full rounded-full border border-stone-200 bg-white px-4 py-2 text-sm outline-none placeholder:text-stone-400 focus:border-brand"
          />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {loading ? null : results.length === 0 ? (
          <p className="mt-10 text-center text-sm text-stone-400">
            {foods && foods.length === 0
              ? 'Zatím žádné potraviny. Přidej první, ať jde napojit na suroviny.'
              : 'Nic nenalezeno.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {results.map((food) => (
              <li key={food.id}>
                <Link
                  to={`/potraviny/${food.id}/upravit`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-stone-300 active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{food.name}</p>
                    {food.brand ? <p className="truncate text-xs text-stone-500">{food.brand}</p> : null}
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <span className="font-medium">{formatNumber(food.energyKcal)} kcal</span>
                    <span className="block text-xs text-stone-400">na 100 {food.basis}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
