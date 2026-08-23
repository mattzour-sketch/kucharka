import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { matchesQuery } from '../../lib/search';
import { formatNumber } from '../../lib/num';
import QuickFoodForm from './QuickFoodForm';

/** Vyhledání a výběr potraviny pro napojení suroviny (overlay). */
export default function FoodPicker({
  onSelect,
  onClose,
}: {
  onSelect: (foodId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const foods = useLiveQuery(async () => {
    const all = await db.foods.toArray();
    return all.filter((food) => !food.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, []);
  const loading = foods === undefined;
  const results = (foods ?? []).filter((food) =>
    matchesQuery(`${food.name} ${food.brand ?? ''}`, query),
  );
  const trimmedQuery = query.trim();
  const emptyDb = !loading && foods.length === 0;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white">
      <header className="border-b border-stone-200 p-3">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            placeholder="hledat potravinu…"
            className="min-w-0 flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
          >
            Zavřít
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {creating ? (
          <QuickFoodForm
            initialName={emptyDb ? '' : trimmedQuery}
            onCreated={(foodId) => onSelect(foodId)}
            onCancel={() => setCreating(false)}
          />
        ) : results.length === 0 ? (
          loading ? null : (
            <div className="mt-8 flex flex-col items-center gap-3 text-center text-sm text-stone-400">
              <p>{emptyDb ? 'Zatím žádná potravina.' : 'Nic nenalezeno.'}</p>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
              >
                {emptyDb ? 'Založit potravinu' : `Založit „${trimmedQuery}“`}
              </button>
            </div>
          )
        ) : (
          <ul className="flex flex-col gap-1.5">
            {results.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => onSelect(food.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 p-3 text-left transition hover:border-brand active:scale-[0.99]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{food.name}</span>
                    {food.brand ? (
                      <span className="block truncate text-xs text-stone-500">{food.brand}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm text-stone-500">
                    {formatNumber(food.energyKcal)} kcal / 100 {food.basis}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
