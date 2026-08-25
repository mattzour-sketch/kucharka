import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { matchesQuery } from '../../lib/search';
import { formatNumber } from '../../lib/num';
import { basicFoodCount, seedBasicFoods } from './seedFoods';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { RowsSkeleton } from '../../components/ui/Loading';
import { cardClass } from '../../components/ui/cardClass';

/** Seznam a hledání potravin (F-01). Potraviny slouží k napojení surovin receptů. */
export default function FoodsScreen() {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const foods = useLiveQuery(async () => {
    const all = await db.foods.toArray();
    return all.filter((food) => !food.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, []);

  const loading = foods === undefined;
  const results = (foods ?? []).filter((food) =>
    matchesQuery(`${food.name} ${food.brand ?? ''}`, query),
  );
  const emptyDb = !loading && foods.length === 0;

  async function handleSeed() {
    const added = await seedBasicFoods();
    setMessage(added > 0 ? `Přidáno ${added} potravin.` : 'Základní potraviny už tam jsou.');
  }

  return (
    <div>
      <ScreenHeader
        width="wide"
        title="Potraviny"
        actions={
          <Button role="primary" to="/potraviny/nova">
            + Nová
          </Button>
        }
        below={
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="hledat potravinu…"
            className="w-full rounded-full border border-stone-200 bg-white px-4 py-2 text-sm outline-none placeholder:text-stone-400 focus:border-brand"
          />
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-4">
        {message ? <p className="mb-3 text-sm text-brand-dark">{message}</p> : null}

        {loading ? (
          <RowsSkeleton />
        ) : results.length === 0 ? (
          <EmptyState
            title={emptyDb ? 'Zatím žádné potraviny' : 'Nic nenalezeno'}
            action={
              emptyDb ? (
                <Button role="primary" onClick={() => void handleSeed()}>
                  Přidat základní potraviny ({basicFoodCount()})
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((food) => (
                <li key={food.id}>
                  <Link
                    to={`/potraviny/${food.id}/upravit`}
                    className={cardClass({
                      padding: 'row',
                      interactive: true,
                      className: 'flex items-center justify-between gap-3',
                    })}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{food.name}</p>
                      {food.brand ? (
                        <p className="truncate text-xs text-stone-500">{food.brand}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <span className="font-medium">{formatNumber(food.energyKcal)} kcal</span>
                      <span className="block text-xs text-stone-400">na 100 {food.basis}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void handleSeed()}
              className="mx-auto mt-4 block text-sm font-medium text-stone-500 hover:text-stone-700"
            >
              + Doplnit základní potraviny
            </button>
          </>
        )}
      </main>
    </div>
  );
}
