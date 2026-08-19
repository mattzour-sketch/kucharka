import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import RecipeCard from './RecipeCard';

type SortKey = 'updated' | 'cooked' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  updated: 'Naposledy upravené',
  cooked: 'Naposledy uvařené',
  name: 'Podle názvu',
};

export default function RecipeListScreen() {
  const [sort, setSort] = useState<SortKey>('updated');
  const [favOnly, setFavOnly] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    const [all, logs] = await Promise.all([db.recipes.toArray(), db.cookLogs.toArray()]);
    const recipes = all.filter((recipe) => !recipe.deletedAt);
    // Poslední uvaření podle nejnovějšího záznamu v historii (ISO timestamp řadí chronologicky).
    const lastCooked = new Map<string, string>();
    for (const log of logs) {
      const prev = lastCooked.get(log.recipeId);
      if (!prev || log.createdAt > prev) lastCooked.set(log.recipeId, log.createdAt);
    }
    return { recipes, lastCooked };
  }, []);

  const loading = data === undefined;
  const recipes = data?.recipes ?? [];
  const lastCooked = data?.lastCooked ?? new Map<string, string>();

  const tagSet = new Set<string>();
  for (const recipe of recipes) for (const tag of recipe.tags) tagSet.add(tag);
  const tags = [...tagSet].sort((a, b) => a.localeCompare(b, 'cs'));
  // Aktivní štítek, který mezitím zmizel (smazaný recept), filtr neblokuje.
  const tagFilter = activeTag && tags.includes(activeTag) ? activeTag : null;

  const visible = recipes
    .filter((recipe) => (favOnly ? recipe.isFavorite : true))
    .filter((recipe) => (tagFilter ? recipe.tags.includes(tagFilter) : true))
    .sort((a, b) => {
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '', 'cs');
      if (sort === 'cooked') {
        const la = lastCooked.get(a.id) ?? '';
        const lb = lastCooked.get(b.id) ?? '';
        if (la !== lb) return lb.localeCompare(la);
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight">Recepty</h1>
          <div className="flex items-center gap-2">
            <Link
              to="/vlozit"
              className="rounded-full border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
            >
              Vložit
            </Link>
            <Link
              to="/novy"
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
            >
              + Nový recept
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4">
        {loading ? null : recipes.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 outline-none focus:border-brand"
                aria-label="Řazení"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setFavOnly((value) => !value)}
                aria-pressed={favOnly}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  favOnly
                    ? 'border-amber-300 bg-amber-50 text-amber-600'
                    : 'border-stone-300 text-stone-700 hover:bg-stone-100'
                }`}
              >
                ★ Oblíbené
              </button>
            </div>

            {tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = tagFilter === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTag(active ? null : tag)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                        active
                          ? 'bg-brand text-white'
                          : 'bg-brand/10 text-brand-dark hover:bg-brand/20'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {visible.length === 0 ? (
              <p className="mt-8 text-center text-sm text-stone-400">Nic neodpovídá filtru.</p>
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((recipe) => (
                  <li key={recipe.id}>
                    <RecipeCard recipe={recipe} />
                  </li>
                ))}
              </ul>
            )}
          </>
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
