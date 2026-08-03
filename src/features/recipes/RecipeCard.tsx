import { Link } from 'react-router-dom';
import type { Recipe } from '../../db';
import { formatCzechDate } from '../../lib/date';

function snippet(text: string | null | undefined, max = 120): string {
  if (!text) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

/** Karta receptu v seznamu i ve výsledcích hledání. */
export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const preview = snippet(recipe.rawCapture);
  return (
    <Link
      to={`/recept/${recipe.id}`}
      className="block rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-stone-300 active:scale-[0.99]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="truncate font-medium">{recipe.name || '(bez názvu)'}</h2>
        <span className="shrink-0 text-xs text-stone-400">{formatCzechDate(recipe.capturedOn)}</span>
      </div>
      {recipe.tags.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {recipe.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand-dark">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {preview ? <p className="mt-2 line-clamp-2 text-sm text-stone-500">{preview}</p> : null}
    </Link>
  );
}
