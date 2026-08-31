import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import RecipeCard from './RecipeCard';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Logo from '../../components/ui/Logo';
import Button from '../../components/ui/Button';
import FilterChip from '../../components/ui/FilterChip';
import EmptyState from '../../components/ui/EmptyState';
import { RecipeGridSkeleton } from '../../components/ui/Loading';

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
      <ScreenHeader
        width="wide"
        title={
          <span className="flex items-center gap-2">
            <Logo className="h-6 w-6 text-brand" />
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
                className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 outline-none focus:border-brand"
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
                onClick={() => setFavOnly((value) => !value)}
                aria-pressed={favOnly}
              >
                ★ Oblíbené
              </FilterChip>
            </div>

            {tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <FilterChip
                    key={tag}
                    active={tagFilter === tag}
                    onClick={() => setActiveTag(tagFilter === tag ? null : tag)}
                  >
                    {tag}
                  </FilterChip>
                ))}
              </div>
            ) : null}

            {visible.length === 0 ? (
              <EmptyState title="Nic neodpovídá filtru" />
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((recipe) => (
                  <li key={recipe.id}>
                    <RecipeCard recipe={recipe} cover={coverByRecipe.get(recipe.id) ?? null} />
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
