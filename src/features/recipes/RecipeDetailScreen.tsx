import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { formatCzechDate } from '../../lib/date';
import { nutritionFromData } from '../nutrition/recipeNutrition';
import NutritionSummary from '../nutrition/NutritionSummary';
import { softDeleteRecipe } from './recipesRepo';

export default function RecipeDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    if (!id) return { recipe: null, items: [], foods: [], recipes: [], allItems: [] };
    const recipe = (await db.recipes.get(id)) ?? null;
    if (!recipe) return { recipe: null, items: [], foods: [], recipes: [], allItems: [] };
    const [foods, recipes, allItems] = await Promise.all([
      db.foods.toArray(),
      db.recipes.toArray(),
      db.recipeItems.toArray(),
    ]);
    const items = allItems
      .filter((item) => item.recipeId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { recipe, items, foods, recipes, allItems };
  }, [id]);

  if (data === undefined) return null;
  const { recipe, items } = data;
  if (!recipe || recipe.deletedAt || !id) return <NotFound />;

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('Opravdu smazat tenhle recept?')) return;
    await softDeleteRecipe(id);
    navigate('/', { replace: true });
  }

  const nutrition = nutritionFromData(id, {
    foods: data.foods,
    recipes: data.recipes,
    items: data.allItems,
  });
  const hasIngredients = items.length > 0;
  const hasSteps = Boolean(recipe.instructions && recipe.instructions.trim());
  const legacyText = !hasIngredients && !hasSteps ? (recipe.rawCapture ?? '').trim() : '';

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-2 py-2">
          <Link
            to="/"
            className="rounded-lg px-3 py-1.5 text-lg text-stone-500 transition hover:bg-stone-200/60"
            aria-label="Zpět na seznam"
          >
            ‹
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to={`/recept/${recipe.id}/upravit`}
              className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
            >
              Upravit
            </Link>
            <Link
              to={`/recept/${recipe.id}/varit`}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
            >
              Vařit
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">{recipe.name || '(bez názvu)'}</h1>
        <p className="mt-1 text-sm text-stone-500">{formatCzechDate(recipe.capturedOn)}</p>

        {recipe.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs text-brand-dark"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {hasIngredients ? (
          <section className="mt-5">
            {nutrition.computable || nutrition.hasCycle ? (
              <div className="mb-2">
                <NutritionSummary result={nutrition} />
              </div>
            ) : null}
            <Link
              to={`/recept/${recipe.id}/kalorie`}
              className="inline-block text-sm font-medium text-brand"
            >
              {nutrition.computable ? 'Upravit kalorie' : 'Spočítat kalorie →'}
            </Link>
          </section>
        ) : null}

        {hasIngredients ? (
          <section className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Suroviny
            </h2>
            <ul className="mt-2 space-y-1">
              {items.map((item) => (
                <li key={item.id} className="flex gap-2 leading-relaxed">
                  <span className="mt-0.5 text-brand">•</span>
                  <span>{item.rawText}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasSteps ? (
          <section className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Postup</h2>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{recipe.instructions}</p>
          </section>
        ) : null}

        {legacyText ? (
          <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
            <p className="whitespace-pre-wrap leading-relaxed">{legacyText}</p>
          </div>
        ) : null}

        {!hasIngredients && !hasSteps && !legacyText ? (
          <p className="mt-5 text-stone-400">Zatím bez obsahu. Klepni na „Upravit".</p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleDelete()}
          className="mt-8 w-full rounded-xl py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.99]"
        >
          Smazat recept
        </button>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-stone-500">Recept nenalezen.</p>
      <Link to="/" className="text-sm font-medium text-brand">
        Zpět na seznam
      </Link>
    </div>
  );
}
