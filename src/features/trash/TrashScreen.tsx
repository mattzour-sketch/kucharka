import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatCzechDate, toLocalIsoDate } from '../../lib/date';
import {
  emptyTrash,
  listTrashedFoods,
  listTrashedRecipes,
  restoreFood,
  restoreRecipe,
} from './trashRepo';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { RowsSkeleton } from '../../components/ui/Loading';
import { cardClass } from '../../components/ui/cardClass';

/** „smazáno 12. 10. 2026" (deletedAt je ISO timestamp, den v lokálním čase). */
function deletedLabel(deletedAt: string | null | undefined): string {
  return deletedAt ? `smazáno ${formatCzechDate(toLocalIsoDate(new Date(deletedAt)))}` : '';
}

/** Koš (§14): smazané recepty a potraviny, obnovení, vyprázdnění. */
export default function TrashScreen() {
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [emptying, setEmptying] = useState(false);
  const recipes = useLiveQuery(() => listTrashedRecipes(), []);
  const foods = useLiveQuery(() => listTrashedFoods(), []);
  // Dokud data nedorazí, neukazuj „Koš je prázdný" – to je jen probliknutí, ne stav.
  const loading = recipes === undefined || foods === undefined;
  const recipeList = recipes ?? [];
  const foodList = foods ?? [];
  const empty = recipeList.length === 0 && foodList.length === 0;

  async function handleEmpty() {
    setEmptying(true);
    try {
      await emptyTrash();
    } finally {
      setEmptying(false);
      setConfirmEmpty(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <ScreenHeader variant="stack" width="narrow" backTo="/vic" title="Koš" />

      <main className="mx-auto max-w-2xl px-4 py-4">
        {loading ? (
          <RowsSkeleton />
        ) : empty ? (
          <EmptyState title="Koš je prázdný" />
        ) : (
          <>
            {recipeList.length > 0 ? (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Recepty
                </h2>
                <ul className="mt-2 flex flex-col gap-2">
                  {recipeList.map((recipe) => (
                    <li
                      key={recipe.id}
                      className={cardClass({
                        padding: 'panel',
                        className: 'flex items-center justify-between gap-3',
                      })}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{recipe.name}</span>
                        <span className="block text-xs text-stone-400">{deletedLabel(recipe.deletedAt)}</span>
                      </span>
                      <Button role="secondary" onClick={() => void restoreRecipe(recipe.id)}>
                        Obnovit
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {foodList.length > 0 ? (
              <section className="mt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Potraviny
                </h2>
                <ul className="mt-2 flex flex-col gap-2">
                  {foodList.map((food) => (
                    <li
                      key={food.id}
                      className={cardClass({
                        padding: 'panel',
                        className: 'flex items-center justify-between gap-3',
                      })}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{food.name}</span>
                        <span className="block text-xs text-stone-400">{deletedLabel(food.deletedAt)}</span>
                      </span>
                      <Button role="secondary" onClick={() => void restoreFood(food.id)}>
                        Obnovit
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="mt-8">
              <Button role="destructive" fullWidth onClick={() => setConfirmEmpty(true)}>
                Vyprázdnit koš
              </Button>
            </div>
          </>
        )}
      </main>

      <ConfirmDialog
        open={confirmEmpty}
        title="Vyprázdnit koš?"
        confirmLabel="Vyprázdnit"
        confirmRole="destructive"
        busy={emptying}
        onConfirm={() => void handleEmpty()}
        onCancel={() => setConfirmEmpty(false)}
      >
        Obsah a fotky se nenávratně smažou.
      </ConfirmDialog>
    </div>
  );
}
