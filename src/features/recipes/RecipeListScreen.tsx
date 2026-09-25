import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Recipe } from '../../db';
import RecipeCard from './RecipeCard';
import { setRecipeFavorite } from './recipesRepo';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Logo from '../../components/ui/Logo';
import Button from '../../components/ui/Button';
import FilterChip from '../../components/ui/FilterChip';
import EmptyState from '../../components/ui/EmptyState';
import { RecipeGridSkeleton } from '../../components/ui/Loading';
import { isQuick } from '../../lib/prepTime';
import { matchesQuery, recipeHaystack } from '../../lib/search';
import { orderFilterTags } from '../../lib/tags';

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
  // Stabilní ref (i prázdný fallback), ať navazující useMemo nepřepočítává při každém renderu.
  const recipes = useMemo(() => data?.recipes ?? [], [data]);
  const lastCooked = data?.lastCooked ?? new Map<string, string>();
  const coverByRecipe = data?.coverByRecipe ?? new Map<string, Blob>();

  // Štítky a jejich četnost (tag → count, pro řazení podle použití) počítáme jen při změně
  // receptů – jinak by se pole i mapa tvořily při každém renderu a memoizace v CollapsibleTags
  // by se nikdy netrefila.
  const { tags, tagCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const recipe of recipes) for (const tag of recipe.tags) counts[tag] = (counts[tag] ?? 0) + 1;
    const sorted = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'cs'));
    return { tags: sorted, tagCounts: counts };
  }, [recipes]);
  // Aktivní štítek, který mezitím zmizel (smazaný recept), filtr neblokuje.
  const tagFilter = activeTag && tags.includes(activeTag) ? activeTag : null;
  const orderedTags = useMemo(() => orderFilterTags(tags, tagFilter, tagCounts), [tags, tagFilter, tagCounts]);

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
            {/* Řazení, filtry, náhodný recept a štítky v jednom řádku: na mobilu se posouvá do
                strany (od kraje ke kraji), na desktopu se zalomí. */}
            <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="rounded-full border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-200 outline-none focus:border-brand"
                aria-label="Řazení"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
              {hasActiveFilter ? (
                <FilterChip active={false} onClick={clearFilters}>
                  ✕ Zrušit
                </FilterChip>
              ) : null}
              <FilterChip
                active={false}
                onClick={() => {
                  // Náhodně z aktuálně zobrazených (respektuje filtr štítku i oblíbené).
                  const pick = visible[Math.floor(Math.random() * visible.length)];
                  if (pick) navigate(`/recept/${pick.id}`);
                }}
                aria-label="Co dnes? (náhodný recept)"
              >
                🎲 Co dnes?
              </FilterChip>
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
              {orderedTags.length > 0 ? (
                <span className="h-4 w-px bg-stone-200 dark:bg-stone-700" aria-hidden />
              ) : null}
              {orderedTags.map((tag) => (
                <FilterChip
                  key={tag}
                  active={tag === tagFilter}
                  onClick={() => setActiveTag(tagFilter === tag ? null : tag)}
                  aria-pressed={tag === tagFilter}
                >
                  {tag}
                </FilterChip>
              ))}
            </div>

            {visible.length === 0 ? (
              <EmptyState title={query.trim() ? 'Nic nenalezeno' : 'Nic neodpovídá filtru'} />
            ) : (
              <ul className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
