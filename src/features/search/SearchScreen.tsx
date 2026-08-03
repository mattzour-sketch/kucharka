import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { matchesQuery, recipeHaystack } from '../../lib/search';
import RecipeCard from '../recipes/RecipeCard';

/** Fulltextové hledání a filtr podle štítků (R-20, R-21). Hledá se lokálně. */
export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const recipes = useLiveQuery(async () => {
    const all = await db.recipes.toArray();
    return all
      .filter((recipe) => !recipe.deletedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (recipes ?? []).forEach((recipe) => recipe.tags.forEach((tag) => set.add(tag)));
    return [...set].sort((a, b) => a.localeCompare(b, 'cs'));
  }, [recipes]);

  const results = (recipes ?? []).filter((recipe) => {
    if (!matchesQuery(recipeHaystack(recipe), query)) return false;
    return activeTags.every((tag) =>
      recipe.tags.some((recipeTag) => recipeTag.toLowerCase() === tag.toLowerCase()),
    );
  });

  function toggleTag(tag: string) {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  const loading = recipes === undefined;

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight">Hledat</h1>
          <div className="mt-2 flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 focus-within:border-brand">
            <span className="text-stone-400" aria-hidden>
              🔍
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="název, surovina, postup…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-stone-400 hover:text-stone-600"
                aria-label="Vymazat hledání"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {allTags.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {allTags.map((tag) => {
              const active = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    active
                      ? 'bg-brand text-white'
                      : 'border border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        ) : null}

        {loading ? null : results.length === 0 ? (
          <p className="mt-10 text-center text-sm text-stone-400">
            Nic nenalezeno. Zkus jiné slovo nebo štítek.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {results.map((recipe) => (
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
