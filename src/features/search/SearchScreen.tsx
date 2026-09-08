import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { matchesQuery, recipeHaystack } from '../../lib/search';
import RecipeCard from '../recipes/RecipeCard';
import ScreenHeader from '../../components/ui/ScreenHeader';
import FilterChip from '../../components/ui/FilterChip';
import EmptyState from '../../components/ui/EmptyState';
import { RecipeGridSkeleton } from '../../components/ui/Loading';

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
      <ScreenHeader
        width="wide"
        title="Hledat"
        below={
          <div className="flex items-center gap-2 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 focus-within:border-brand">
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
                className="text-stone-400 hover:text-stone-600 dark:text-stone-300"
                aria-label="Vymazat hledání"
              >
                ×
              </button>
            ) : null}
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-4">
        {allTags.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <FilterChip
                key={tag}
                active={activeTags.includes(tag)}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </FilterChip>
            ))}
          </div>
        ) : null}

        {loading ? (
          <RecipeGridSkeleton />
        ) : results.length === 0 ? (
          <EmptyState
            title="Nic nenalezeno"
            description="Zkus jiné slovo nebo štítek."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
