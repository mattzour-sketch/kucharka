import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { formatCzechDate } from '../../lib/date';
import { softDeleteRecipe } from './recipesRepo';

export default function RecipeDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  // undefined = načítá se, null = nenalezeno, jinak recept
  const recipe = useLiveQuery(
    async () => (id ? ((await db.recipes.get(id)) ?? null) : null),
    [id],
  );

  if (recipe === undefined) return null;
  if (recipe === null || recipe.deletedAt) return <NotFound />;

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('Opravdu smazat tenhle recept?')) return;
    await softDeleteRecipe(id);
    navigate('/', { replace: true });
  }

  const hasBody = Boolean(recipe.rawCapture && recipe.rawCapture.trim());

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

        <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
          {hasBody ? (
            <p className="whitespace-pre-wrap leading-relaxed">{recipe.rawCapture}</p>
          ) : (
            <p className="text-stone-400">
              Zatím bez textu. Klepni na „Upravit" a přidej suroviny a postup.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleDelete()}
          className="mt-6 w-full rounded-xl py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.99]"
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
