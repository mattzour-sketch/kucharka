import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { parseDecimal, formatNumber } from '../../lib/num';
import { nutritionFromData } from '../nutrition/recipeNutrition';
import NutritionSummary from '../nutrition/NutritionSummary';
import FoodPicker from '../foods/FoodPicker';
import { updateRecipeItemLink, updateRecipeMeta } from './recipesRepo';

/**
 * Doplnění nutričních hodnot k receptu (SPEC 6.6). Levý text suroviny je
 * nedotknutelný – napojení potraviny ho nikdy nepřepíše (E-17). Souhrn se
 * přepočítává živě a vždy přiznává úplnost (R-31, E-13).
 */
export default function RecipeNutritionScreen() {
  const { id } = useParams();

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const recipe = await db.recipes.get(id);
    if (!recipe) return { recipe: null, foods: [], recipes: [], items: [] };
    const [foods, recipes, items] = await Promise.all([
      db.foods.toArray(),
      db.recipes.toArray(),
      db.recipeItems.toArray(),
    ]);
    return { recipe, foods, recipes, items };
  }, [id]);

  const [pickingItemId, setPickingItemId] = useState<string | null>(null);
  const [servings, setServings] = useState('');
  const [cookedWeight, setCookedWeight] = useState('');
  const [grams, setGrams] = useState<Record<string, string>>({});
  const seededRef = useRef(false);

  useEffect(() => {
    if (!data || !data.recipe || seededRef.current) return;
    seededRef.current = true;
    setServings(data.recipe.servings != null ? String(data.recipe.servings) : '');
    setCookedWeight(data.recipe.cookedWeightG != null ? String(data.recipe.cookedWeightG) : '');
    const initial: Record<string, string> = {};
    for (const item of data.items) {
      if (item.recipeId === id) initial[item.id] = item.amountG != null ? String(item.amountG) : '';
    }
    setGrams(initial);
  }, [data, id]);

  if (data === undefined) return null;
  if (!data || !data.recipe || !id) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-stone-500">Recept nenalezen.</p>
        <Link to="/" className="text-sm font-medium text-brand">
          Zpět na seznam
        </Link>
      </div>
    );
  }

  const items = data.items
    .filter((item) => item.recipeId === id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const foodMap = new Map(data.foods.map((food) => [food.id, food]));
  const nutrition = nutritionFromData(id, {
    foods: data.foods,
    recipes: data.recipes,
    items: data.items,
  });

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-2 py-2">
          <Link
            to={`/recept/${id}`}
            className="rounded-lg px-3 py-1.5 text-lg text-stone-500 transition hover:bg-stone-200/60"
            aria-label="Zpět na recept"
          >
            ‹
          </Link>
          <span className="text-sm font-medium text-stone-600">Kalorie</span>
          <span className="w-9" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-stone-500">Porcí</span>
            <input
              value={servings}
              onChange={(event) => {
                setServings(event.target.value);
                void updateRecipeMeta(id, { servings: parseDecimal(event.target.value) });
              }}
              inputMode="decimal"
              placeholder="—"
              className="w-16 rounded-xl border border-stone-200 bg-white px-3 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-stone-500">Hmotnost po uvaření (g)</span>
            <input
              value={cookedWeight}
              onChange={(event) => {
                setCookedWeight(event.target.value);
                void updateRecipeMeta(id, { cookedWeightG: parseDecimal(event.target.value) });
              }}
              inputMode="decimal"
              placeholder="—"
              className="w-24 rounded-xl border border-stone-200 bg-white px-3 py-1.5 outline-none focus:border-brand"
            />
          </label>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => {
            const food = item.foodId ? foodMap.get(item.foodId) : undefined;
            const contribution =
              food && item.amountG != null ? (food.energyKcal * item.amountG) / 100 : null;
            return (
              <li key={item.id} className="rounded-2xl border border-stone-200 bg-white p-3">
                <p className="font-medium">{item.rawText}</p>

                {item.isSkipped ? (
                  <div className="mt-1 flex items-center justify-between text-sm text-stone-400">
                    <span>přeskočeno</span>
                    <button
                      type="button"
                      onClick={() => void updateRecipeItemLink(item.id, { isSkipped: false })}
                      className="font-medium text-brand"
                    >
                      vrátit
                    </button>
                  </div>
                ) : food ? (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-stone-600">→ {food.name}</span>
                    <input
                      value={grams[item.id] ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setGrams((prev) => ({ ...prev, [item.id]: value }));
                        void updateRecipeItemLink(item.id, { amountG: parseDecimal(value) });
                      }}
                      inputMode="decimal"
                      placeholder="g"
                      className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-right outline-none focus:border-brand"
                    />
                    <span className="w-16 text-right text-xs text-stone-400">
                      {contribution != null ? `${formatNumber(contribution)} kcal` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => void updateRecipeItemLink(item.id, { foodId: null })}
                      className="text-stone-400 hover:text-stone-600"
                      aria-label="Odpojit potravinu"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setPickingItemId(item.id)}
                      className="rounded-full bg-brand/10 px-3 py-1 font-medium text-brand-dark transition hover:bg-brand/20"
                    >
                      napojit potravinu
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateRecipeItemLink(item.id, { isSkipped: true })}
                      className="rounded-full px-3 py-1 text-stone-500 transition hover:bg-stone-100"
                    >
                      přeskočit
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {items.length === 0 ? (
          <p className="mt-6 text-sm text-stone-400">
            Recept nemá suroviny. Přidej je v úpravě receptu.
          </p>
        ) : null}

        <div className="mt-5">
          {nutrition.computable || nutrition.hasCycle ? (
            <NutritionSummary result={nutrition} />
          ) : (
            <p className="text-center text-sm text-stone-400">
              Napoj suroviny na potraviny a doplň gramáž, ať se spočítají kalorie.
            </p>
          )}
        </div>
      </main>

      {pickingItemId ? (
        <FoodPicker
          onSelect={(foodId) => {
            void updateRecipeItemLink(pickingItemId, { foodId, isSkipped: false });
            setPickingItemId(null);
          }}
          onClose={() => setPickingItemId(null)}
        />
      ) : null}
    </div>
  );
}
