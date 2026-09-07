import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { matchesQuery } from '../../lib/search';
import { formatNumber } from '../../lib/num';
import { nutritionFromData } from '../nutrition/recipeNutrition';
import EmptyState from '../../components/ui/EmptyState';
import { RowsSkeleton } from '../../components/ui/Loading';
import { cardClass } from '../../components/ui/cardClass';

/**
 * Výběr receptu jako podreceptu (UC016): nesmazané recepty bez aktuálního
 * (self-exclude), řazené dle názvu, s `kcal / 100 g` (u nespočitatelných „bez kalorií").
 * `query` řídí rodič (`LinkPicker`). Bez inline zakládání receptu.
 */
export default function RecipePickList({
  currentRecipeId,
  query,
  onSelect,
}: {
  currentRecipeId: string;
  query: string;
  onSelect: (subRecipeId: string) => void;
}) {
  const data = useLiveQuery(async () => {
    const [recipes, foods, items] = await Promise.all([
      db.recipes.toArray(),
      db.foods.toArray(),
      db.recipeItems.toArray(),
    ]);
    return { recipes, foods, items };
  }, []);

  if (data === undefined) return <RowsSkeleton />;

  const candidates = data.recipes
    .filter((recipe) => !recipe.deletedAt && recipe.id !== currentRecipeId)
    .filter((recipe) => matchesQuery(recipe.name, query))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));

  if (candidates.length === 0) {
    return <EmptyState title="Žádný recept" description="Napojit jde jen existující recept." />;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {candidates.map((recipe) => {
        const per100 = nutritionFromData(recipe.id, {
          foods: data.foods,
          recipes: data.recipes,
          items: data.items,
        }).per100g;
        return (
          <li key={recipe.id}>
            <button
              type="button"
              onClick={() => onSelect(recipe.id)}
              className={cardClass({
                padding: 'row',
                interactive: true,
                className: 'flex w-full items-center justify-between gap-3 text-left',
              })}
            >
              <span className="min-w-0 block truncate font-medium">{recipe.name}</span>
              <span className="shrink-0 text-sm text-stone-500">
                {per100 ? `${formatNumber(per100.kcal)} kcal / 100 g` : 'bez kalorií'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
