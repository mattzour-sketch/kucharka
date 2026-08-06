import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  emptyTrash,
  listTrashedFoods,
  listTrashedRecipes,
  restoreFood,
  restoreRecipe,
} from './trashRepo';

/** Koš (§14): smazané recepty a potraviny, obnovení, vyprázdnění. */
export default function TrashScreen() {
  const recipes = useLiveQuery(() => listTrashedRecipes(), []) ?? [];
  const foods = useLiveQuery(() => listTrashedFoods(), []) ?? [];
  const empty = recipes.length === 0 && foods.length === 0;

  async function handleEmpty() {
    if (!window.confirm('Vyprázdnit koš? Obsah a fotky se nenávratně smažou.')) return;
    await emptyTrash();
  }

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
          <span className="text-sm font-medium text-stone-600">Koš</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {empty ? (
          <p className="mt-10 text-center text-sm text-stone-400">Koš je prázdný.</p>
        ) : (
          <>
            {recipes.length > 0 ? (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Recepty
                </h2>
                <ul className="mt-2 flex flex-col gap-2">
                  {recipes.map((recipe) => (
                    <li
                      key={recipe.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4"
                    >
                      <span className="min-w-0 truncate font-medium">{recipe.name}</span>
                      <button
                        type="button"
                        onClick={() => void restoreRecipe(recipe.id)}
                        className="shrink-0 rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
                      >
                        Obnovit
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {foods.length > 0 ? (
              <section className="mt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Potraviny
                </h2>
                <ul className="mt-2 flex flex-col gap-2">
                  {foods.map((food) => (
                    <li
                      key={food.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4"
                    >
                      <span className="min-w-0 truncate font-medium">{food.name}</span>
                      <button
                        type="button"
                        onClick={() => void restoreFood(food.id)}
                        className="shrink-0 rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
                      >
                        Obnovit
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <button
              type="button"
              onClick={() => void handleEmpty()}
              className="mt-8 w-full rounded-xl py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.99]"
            >
              Vyprázdnit koš
            </button>
          </>
        )}
      </main>
    </div>
  );
}
