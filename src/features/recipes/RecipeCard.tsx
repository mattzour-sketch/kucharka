import { Link } from 'react-router-dom';
import type { Recipe } from '../../db';
import { formatCzechDate } from '../../lib/date';
import { useObjectUrl } from '../../hooks/useObjectUrl';

function snippet(text: string | null | undefined, max = 120): string {
  if (!text) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

// Teplé, „jídelní" gradienty pro obálku receptu bez fotky – ať je mřížka jednotná.
const COVER_GRADIENTS: readonly [string, string][] = [
  ['#f59e0b', '#b45309'], // amber
  ['#ea9250', '#a3521c'], // terakota
  ['#8aa87b', '#4f6b47'], // šalvěj
  ['#b98a5e', '#6f4518'], // hnědá
  ['#cf7071', '#8c3b41'], // tlumená červená
  ['#c9a227', '#7c5e12'], // hořčicová
];

function gradientFor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}

function CoverPlaceholder({ name }: { name: string }) {
  const [from, to] = gradientFor(name);
  const letter = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <div
      className="flex h-32 w-full items-center justify-center"
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden
    >
      <span className="text-4xl font-bold text-white/85">{letter}</span>
    </div>
  );
}

/** Karta receptu v seznamu i ve výsledcích hledání. */
export default function RecipeCard({ recipe, cover }: { recipe: Recipe; cover?: Blob | null }) {
  const preview = snippet(recipe.rawCapture);
  const coverUrl = useObjectUrl(cover);
  return (
    <Link
      to={`/recept/${recipe.id}`}
      className="block overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-sm active:scale-[0.99]"
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" className="h-32 w-full object-cover" loading="lazy" />
      ) : (
        <CoverPlaceholder name={recipe.name || '?'} />
      )}
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate font-medium">
            {recipe.isFavorite ? <span className="text-amber-500">★ </span> : null}
            {recipe.name || '(bez názvu)'}
          </h2>
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
      </div>
    </Link>
  );
}
