import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import RecipeCard from './RecipeCard';

export default function RecipeListScreen() {
  // updatedAt není v Dexie indexu, takže řadíme v JS (ISO timestamp řadí
  // lexikograficky = chronologicky). Naposledy upravené nahoře.
  const recipes = useLiveQuery(async () => {
    const all = await db.recipes.toArray();
    return all
      .filter((recipe) => !recipe.deletedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, []);
  const loading = recipes === undefined;
  const visible = recipes ?? [];

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight">Recepty</h1>
          <Link
            to="/novy"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
          >
            + Nový recept
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {loading ? null : visible.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((recipe) => (
              <li key={recipe.id}>
                <RecipeCard recipe={recipe} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-3xl">
        🍲
      </div>
      <h2 className="text-lg font-medium">Zatím žádné recepty</h2>
      <Link
        to="/novy"
        className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
      >
        + Nový recept
      </Link>
    </div>
  );
}
