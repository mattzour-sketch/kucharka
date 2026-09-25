import { Link } from 'react-router-dom';
import type { Recipe } from '../../db';
import { formatCzechDate } from '../../lib/date';
import { formatPrepTime } from '../../lib/prepTime';
import { recipeSnippet } from '../../lib/recipeText';
import { setRecipeFavorite } from './recipesRepo';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { cardClass } from '../../components/ui/cardClass';
import { cx } from '../../components/ui/cx';
import Tag from '../../components/ui/Tag';

// Teplé, „jídelní" gradienty pro recept bez fotky – ať je seznam jednotný.
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

/** Malá dlaždice s písmenem pro recept bez fotky – drží barvu receptu, ale nezabírá místo. */
function LetterTile({ name }: { name: string }) {
  const [from, to] = gradientFor(name);
  const letter = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden
    >
      <span className="text-xl font-bold text-white/90">{letter}</span>
    </div>
  );
}

/**
 * Karta receptu v seznamu. S fotkou má obálku, bez fotky je kompaktní (dlaždice s písmenem),
 * ať se na mobil vejde víc receptů. `dimmed` = zůstává vidět matně (mis-tap ve filtru Oblíbené).
 */
export default function RecipeCard({
  recipe,
  cover,
  onToggleFavorite,
  dimmed = false,
}: {
  recipe: Recipe;
  cover?: Blob | null;
  onToggleFavorite?: (recipe: Recipe) => void;
  dimmed?: boolean;
}) {
  const preview = recipeSnippet(recipe.rawCapture);
  const coverUrl = useObjectUrl(cover);
  const prepTime = recipe.prepMinutes ? formatPrepTime(recipe.prepMinutes) : null;

  const body = (
    <>
      <h2 className="truncate font-medium">{recipe.name || '(bez názvu)'}</h2>
      <p className="mt-0.5 text-xs text-stone-400">
        {formatCzechDate(recipe.capturedOn)}
        {prepTime && !coverUrl ? ` · ⏱ ${prepTime}` : ''}
      </p>
      {recipe.tags.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {recipe.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ) : null}
      {preview ? <p className="mt-1.5 line-clamp-2 text-sm text-stone-500">{preview}</p> : null}
    </>
  );

  return (
    <div className={cx('relative transition-opacity', dimmed && 'opacity-50')}>
      <Link
        to={`/recept/${recipe.id}`}
        className={cardClass({ padding: 'none', interactive: true, className: 'block overflow-hidden' })}
      >
        {coverUrl ? (
          <>
            <div className="relative">
              <img src={coverUrl} alt="" className="h-32 w-full object-cover" loading="lazy" />
              {prepTime ? (
                <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
                  ⏱ {prepTime}
                </span>
              ) : null}
            </div>
            <div className="p-4">{body}</div>
          </>
        ) : (
          // Pravý okraj nechává místo hvězdičce.
          <div className="flex gap-3 p-3 pr-12">
            <LetterTile name={recipe.name || '?'} />
            <div className="min-w-0 flex-1">{body}</div>
          </div>
        )}
      </Link>
      <button
        type="button"
        onClick={() =>
          onToggleFavorite
            ? onToggleFavorite(recipe)
            : void setRecipeFavorite(recipe.id, !recipe.isFavorite)
        }
        aria-label={recipe.isFavorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
        aria-pressed={recipe.isFavorite}
        className={cx(
          'absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none transition active:scale-90 motion-reduce:active:scale-100',
          coverUrl && 'bg-black/45 backdrop-blur',
        )}
      >
        <span
          className={
            recipe.isFavorite ? 'text-amber-400' : coverUrl ? 'text-white/90' : 'text-stone-400 dark:text-stone-500'
          }
        >
          {recipe.isFavorite ? '★' : '☆'}
        </span>
      </button>
    </div>
  );
}
