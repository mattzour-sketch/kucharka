import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { matchesQuery } from '../../lib/search';
import { formatNumber } from '../../lib/num';
import { basicFoodCount, seedBasicFoods } from './seedFoods';
import { rememberFoodsSearch } from './foodsReturn';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { RowsSkeleton } from '../../components/ui/Loading';
import { cardClass } from '../../components/ui/cardClass';
import Icon from '../../components/ui/Icon';
import SearchField from '../../components/ui/SearchField';

/** Seznam a hledání potravin (F-01). Potraviny slouží k napojení surovin receptů. */
export default function FoodsScreen() {
  // Hledání je v URL (?q=…), ať po uložení potraviny zůstane (viz foodsReturn).
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const search = params.toString();
  useEffect(() => rememberFoodsSearch(search), [search]);
  function setQuery(value: string) {
    setParams(value ? { q: value } : {}, { replace: true });
  }
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
  const trimmedQuery = query.trim();

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
            <Icon name="plus" className="-ml-0.5 h-4 w-4" />
            Nová
          </Button>
        }
        below={
          <SearchField value={query} onChange={setQuery} placeholder="hledat potravinu…" />
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-3">
        {message ? <p className="mb-3 text-sm font-medium text-stone-700 dark:text-stone-300">{message}</p> : null}

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
              ) : trimmedQuery ? (
                <Button role="primary" to={`/potraviny/nova?nazev=${encodeURIComponent(trimmedQuery)}`}>
                  + Založit „{trimmedQuery}“
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
                      <p className="truncate font-semibold">{food.name}</p>
                      {food.brand ? (
                        <p className="truncate text-xs text-stone-500 dark:text-stone-400">{food.brand}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <span className="font-bold tabular-nums">{formatNumber(food.energyKcal)} kcal</span>
                      <span className="block text-xs text-stone-500 dark:text-stone-400">na 100 {food.basis}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void handleSeed()}
              className="mx-auto mt-4 flex min-h-10 items-center text-sm font-semibold text-stone-600 transition hover:text-stone-900 dark:text-stone-300 dark:hover:text-white"
            >
              + Doplnit základní potraviny
            </button>
          </>
        )}
      </main>
    </div>
  );
}
