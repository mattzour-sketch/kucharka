import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { formatCzechDate } from '../../lib/date';
import { getRecipeItems, softDeleteRecipe } from './recipesRepo';

export default function RecipeDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  // undefined = načítá se, jinak { recipe, items } (recipe může být null)
  const data = useLiveQuery(async () => {
    if (!id) return { recipe: null, items: [] };
    const recipe = (await db.recipes.get(id)) ?? null;
    const items = recipe ? await getRecipeItems(id) : [];
    return { recipe, items };
  }, [id]);

  if (data === undefined) return null;
  const { recipe, items } = data;
  if (!recipe || recipe.deletedAt) return <NotFound />;

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('Opravdu smazat tenhle recept?')) return;
    await softDeleteRecipe(id);
    navigate('/', { replace: true });
  }

  const hasIngredients = items.length > 0;
  const hasSteps = Boolean(recipe.instructions && recipe.instructions.trim());
  // Starý recept z jednoho pole (bez položek i postupu) → zobraz původní text.
  const legacyText = !hasIngredients && !hasSteps ? (recipe.rawCapture ?? '').trim() : '';

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-2 py-2">
          <Link
            to="/"
            className="rounded-lg px-3 py-1.5 text-lg text-stone-500 transition hover:bg-stone-200/60"
            aria-label="Zpět na seznam"
          >
            ‹
          </Link>
          <Link
            to={`/recept/${recipe.id}/upravit`}
            className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
          >
            Upravit
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">{recipe.name || '(bez názvu)'}</h1>
        <p className="mt-1 text-sm text-stone-500">{formatCzechDate(recipe.capturedOn)}</p>

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
