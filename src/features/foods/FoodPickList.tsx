import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { matchesQuery } from '../../lib/search';
import { formatNumber } from '../../lib/num';
import QuickFoodForm from './QuickFoodForm';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { RowsSkeleton } from '../../components/ui/Loading';
import { cardClass } from '../../components/ui/cardClass';

/**
 * Tělo výběru potraviny (hledání + rychlé založení + seznam). `query` řídí rodič
 * (společné hledací pole s `LinkPickerem`/`FoodPickerem`), aby se logika nekopírovala.
 */
export default function FoodPickList({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (foodId: string) => void;
}) {
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

  if (creating) {
    return (
      <QuickFoodForm
        initialName={emptyDb ? '' : trimmedQuery}
        onCreated={(foodId) => onSelect(foodId)}
        onCancel={() => setCreating(false)}
      />
    );
  }
  if (loading) return <RowsSkeleton />;
  if (results.length === 0) {
    return (
      <EmptyState
        title={emptyDb ? 'Zatím žádná potravina' : 'Nic nenalezeno'}
        action={
          <Button role="primary" onClick={() => setCreating(true)}>
            {emptyDb ? 'Založit potravinu' : `Založit „${trimmedQuery}“`}
          </Button>
        }
      />
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {results.map((food) => (
        <li key={food.id}>
          <button
            type="button"
            onClick={() => onSelect(food.id)}
            className={cardClass({
              padding: 'row',
              interactive: true,
              className: 'flex w-full items-center justify-between gap-3 text-left',
            })}
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
  );
}
