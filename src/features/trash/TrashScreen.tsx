import { useLiveQuery } from 'dexie-react-hooks';
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
import { RowsSkeleton } from '../../components/ui/Loading';
import { cardClass } from '../../components/ui/cardClass';

/** Koš (§14): smazané recepty a potraviny, obnovení, vyprázdnění. */
export default function TrashScreen() {
  const recipes = useLiveQuery(() => listTrashedRecipes(), []);
  const foods = useLiveQuery(() => listTrashedFoods(), []);
  // Dokud data nedorazí, neukazuj „Koš je prázdný" – to je jen probliknutí, ne stav.
  const loading = recipes === undefined || foods === undefined;
  const recipeList = recipes ?? [];
  const foodList = foods ?? [];
  const empty = recipeList.length === 0 && foodList.length === 0;

  async function handleEmpty() {
    if (!window.confirm('Vyprázdnit koš? Obsah a fotky se nenávratně smažou.')) return;
    await emptyTrash();
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
                      <span className="min-w-0 truncate font-medium">{recipe.name}</span>
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
                      <span className="min-w-0 truncate font-medium">{food.name}</span>
                      <Button role="secondary" onClick={() => void restoreFood(food.id)}>
                        Obnovit
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="mt-8">
              <Button role="destructive" fullWidth onClick={() => void handleEmpty()}>
                Vyprázdnit koš
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
