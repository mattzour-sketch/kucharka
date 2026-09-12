import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Recipe } from '../../db';
import RecipeCard from './RecipeCard';
import CollapsibleTags from './CollapsibleTags';
import { setRecipeFavorite } from './recipesRepo';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Logo from '../../components/ui/Logo';
import Button from '../../components/ui/Button';
import FilterChip from '../../components/ui/FilterChip';
import EmptyState from '../../components/ui/EmptyState';
import { RecipeGridSkeleton } from '../../components/ui/Loading';
import { isQuick } from '../../lib/prepTime';
import { matchesQuery, recipeHaystack } from '../../lib/search';

type SortKey = 'updated' | 'cooked' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  updated: 'Upravené',
  cooked: 'Uvařené',
  name: 'Název',
};

export default function RecipeListScreen() {
  const [sort, setSort] = useState<SortKey>('updated');
  const [favOnly, setFavOnly] = useState(false);
  const [quickOnly, setQuickOnly] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Recepty odznačené PŘI zapnutém filtru „Oblíbené" nezmizí hned (mis-tap) – zůstanou
  // matně vidět, dokud filtr nepřepnu, ať je stihnu vrátit dalším klikem.
  const [keepVisibleIds, setKeepVisibleIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  function toggleFavOnly() {
    setFavOnly((value) => !value);
    setKeepVisibleIds(new Set());
  }

  // Jedním ťuknutím zpět na plný seznam – vynuluje všechny filtry i hledání.
  // keepVisibleIds čistíme konzistentně s toggleFavOnly (interakce s UC028).
  function clearFilters() {
    setFavOnly(false);
    setQuickOnly(false);
    setActiveTag(null);
    setQuery('');
    setKeepVisibleIds(new Set());
  }

  function handleToggleFavorite(recipe: Recipe) {
    if (favOnly && recipe.isFavorite) {
      setKeepVisibleIds((prev) => new Set(prev).add(recipe.id));
    }
    void setRecipeFavorite(recipe.id, !recipe.isFavorite);
  }

  const data = useLiveQuery(async () => {
    const [all, logs, photos] = await Promise.all([
      db.recipes.toArray(),
      db.cookLogs.toArray(),
      db.recipePhotos.toArray(),
    ]);
    const recipes = all.filter((recipe) => !recipe.deletedAt);
    // Poslední uvaření podle nejnovějšího záznamu v historii (ISO timestamp řadí chronologicky).
    const lastCooked = new Map<string, string>();
    for (const log of logs) {
      const prev = lastCooked.get(log.recipeId);
      if (!prev || log.createdAt > prev) lastCooked.set(log.recipeId, log.createdAt);
    }
    // Obálka receptu = jeho nejstarší fotka.
    const coverByRecipe = new Map<string, Blob>();
    const coverAt = new Map<string, string>();
    for (const photo of photos) {
      const prev = coverAt.get(photo.recipeId);
      if (!prev || photo.createdAt < prev) {
        coverAt.set(photo.recipeId, photo.createdAt);
        coverByRecipe.set(photo.recipeId, photo.blob);
      }
    }
    return { recipes, lastCooked, coverByRecipe };
  }, []);

  const loading = data === undefined;
  const recipes = data?.recipes ?? [];
  const lastCooked = data?.lastCooked ?? new Map<string, string>();
  const coverByRecipe = data?.coverByRecipe ?? new Map<string, Blob>();

  const tagSet = new Set<string>();
  // Počet receptů na štítek (tag → count) pro řazení štítků podle použití.
  const tagCounts: Record<string, number> = {};
  for (const recipe of recipes)
    for (const tag of recipe.tags) {
      tagSet.add(tag);
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  const tags = [...tagSet].sort((a, b) => a.localeCompare(b, 'cs'));
  // Aktivní štítek, který mezitím zmizel (smazaný recept), filtr neblokuje.
  const tagFilter = activeTag && tags.includes(activeTag) ? activeTag : null;

  // Běží nějaký filtr nebo hledání? (whitespace-only dotaz nefiltruje – viz matchesQuery)
  const hasActiveFilter = favOnly || quickOnly || tagFilter !== null || query.trim().length > 0;

  const visible = recipes
    .filter((recipe) => (favOnly ? recipe.isFavorite || keepVisibleIds.has(recipe.id) : true))
    .filter((recipe) => (quickOnly ? isQuick(recipe.prepMinutes) : true))
    .filter((recipe) => (tagFilter ? recipe.tags.includes(tagFilter) : true))
    .filter((recipe) => matchesQuery(recipeHaystack(recipe), query))
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
      <ScreenHeader
        width="wide"
        title={
          <span className="flex items-center gap-2">
            <Logo className="h-6 w-6 text-brand dark:text-amber-400" />
            Kuchařka
          </span>
        }
        actions={
          <>
            <Button role="secondary" to="/vlozit">
              Vložit
            </Button>
            <Button role="primary" to="/novy">
              + Nový recept
            </Button>
          </>
        }
        below={
          recipes.length > 0 ? (
            <div className="flex items-center gap-2 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 focus-within:border-brand">
              <span className="text-stone-400" aria-hidden>
                🔍
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="hledat recept, surovinu, postup…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                  aria-label="Vymazat hledání"
                >
                  ×
                </button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-4">
        {loading ? (
          <RecipeGridSkeleton />
        ) : recipes.length === 0 ? (
          <EmptyState
            fill
            icon="🍲"
            title="Zatím žádné recepty"
            action={
              <Button role="primary" to="/novy">
                + Nový recept
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="rounded-full border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-2.5 py-1.5 text-sm font-medium text-stone-700 dark:text-stone-200 outline-none focus:border-brand"
                aria-label="Řazení"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
              <FilterChip
                active={favOnly}
                activeTone="amber"
                onClick={toggleFavOnly}
                aria-pressed={favOnly}
              >
                ★ Oblíbené
              </FilterChip>
              <FilterChip
                active={quickOnly}
                onClick={() => setQuickOnly((value) => !value)}
                aria-pressed={quickOnly}
              >
                ⚡ Rychlé
              </FilterChip>
              {hasActiveFilter ? (
                <Button role="ghost" onClick={clearFilters}>
                  ✕ Zrušit filtry
                </Button>
              ) : null}
              <Button
                role="secondary"
                disabled={visible.length === 0}
                onClick={() => {
                  // Náhodně z aktuálně zobrazených (respektuje filtr štítku i oblíbené).
                  const pick = visible[Math.floor(Math.random() * visible.length)];
                  if (pick) navigate(`/recept/${pick.id}`);
                }}
                aria-label="Co dnes? (náhodný recept)"
                title="Co dnes? (náhodný recept)"
              >
                <span aria-hidden>🎲</span>
                <span className="hidden sm:inline">Co dnes?</span>
              </Button>
            </div>

            <CollapsibleTags
              tags={tags}
              activeTag={tagFilter}
              counts={tagCounts}
              onToggleTag={(tag) => setActiveTag(tagFilter === tag ? null : tag)}
            />

            {visible.length === 0 ? (
              <EmptyState title={query.trim() ? 'Nic nenalezeno' : 'Nic neodpovídá filtru'} />
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((recipe) => (
                  <li key={recipe.id}>
                    <RecipeCard
                      recipe={recipe}
                      cover={coverByRecipe.get(recipe.id) ?? null}
                      onToggleFavorite={handleToggleFavorite}
                      dimmed={favOnly && !recipe.isFavorite}
                    />
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
