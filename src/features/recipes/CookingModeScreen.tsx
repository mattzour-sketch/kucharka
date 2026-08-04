import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { scaleQuantityText } from '../../lib/scale';
import { useWakeLock } from '../../hooks/useWakeLock';
import { getRecipeItems } from './recipesRepo';
import ServingsStepper from './ServingsStepper';

/**
 * Režim vaření (R-22, 6.3): větší písmo, displej nezhasíná (wake lock),
 * suroviny jdou odškrtávat klepnutím. Odškrtnutí je dočasné, neukládá se.
 */
export default function CookingModeScreen() {
  const { id } = useParams();
  const data = useLiveQuery(async () => {
    if (!id) return { recipe: null, items: [] };
    const recipe = (await db.recipes.get(id)) ?? null;
    const items = recipe ? await getRecipeItems(id) : [];
    return { recipe, items };
  }, [id]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [targetServings, setTargetServings] = useState<number | null>(null);
  useEffect(() => setTargetServings(null), [id]);
  useWakeLock();

  if (data === undefined) return null;
  const { recipe, items } = data;
  if (!recipe || recipe.deletedAt) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-stone-500">Recept nenalezen.</p>
        <Link to="/" className="text-sm font-medium text-brand">
          Zpět na seznam
        </Link>
      </div>
    );
  }

  const steps = (recipe.instructions ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const baseServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  const targetPortions = targetServings ?? baseServings;
  const scaleFactor = targetPortions / baseServings;

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-2 py-2">
          <Link
            to={`/recept/${recipe.id}`}
            className="rounded-lg px-3 py-1.5 text-lg text-stone-500 transition hover:bg-stone-100"
            aria-label="Zpět na recept"
          >
            ‹
          </Link>
          <span className="truncate text-sm font-medium text-stone-600">{recipe.name}</span>
          <span className="w-9" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {items.length > 0 ? (
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
                Suroviny
              </h2>
              <ServingsStepper
                value={targetPortions}
                onStep={(delta) =>
                  setTargetServings((prev) => Math.max(1, (prev ?? baseServings) + delta))
                }
              />
            </div>
            <ul className="mt-2">
              {items.map((item) => {
                const isChecked = checked[item.id] ?? false;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setChecked((prev) => ({ ...prev, [item.id]: !isChecked }))}
                      className="flex w-full items-center gap-3 rounded-xl py-3 text-left text-lg transition active:bg-stone-100"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                          isChecked
                            ? 'border-brand bg-brand text-white'
                            : 'border-stone-300 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span className={isChecked ? 'text-stone-400 line-through' : ''}>
                        {scaleQuantityText(item.rawText, scaleFactor)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {steps.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Postup</h2>
            <ol className="mt-2 space-y-4">
              {steps.map((step, index) => (
                <li key={index} className="flex gap-3 text-lg leading-relaxed">
                  <span className="shrink-0 font-semibold text-brand">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {items.length === 0 && steps.length === 0 ? (
          <p className="mt-6 text-stone-400">Recept zatím nemá suroviny ani postup.</p>
        ) : null}
      </main>
    </div>
  );
}
