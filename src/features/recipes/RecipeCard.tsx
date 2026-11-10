import { Link } from 'react-router-dom';
import type { Recipe } from '../../db';
import { formatRecentDate, toLocalIsoDate } from '../../lib/date';
import { formatPrepTime } from '../../lib/prepTime';
import { recipeSnippet } from '../../lib/recipeText';
import { updatedLabel } from '../../lib/recipeDates';
import { setRecipeFavorite } from './recipesRepo';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { cardClass } from '../../components/ui/cardClass';
import { cx } from '../../components/ui/cx';
import Icon from '../../components/ui/Icon';
import Tag from '../../components/ui/Tag';

/**
 * Karta receptu v seznamu. Jeden tvar pro všechny recepty: text vlevo (název se zarovná
 * pod sebe), fotka – když je – jako pruh přes celou výšku vpravo. Recept bez fotky nemá
 * žádnou náhradní dlaždici: většina receptů je diktovaný text a seznam musí držet rytmus.
 * `dimmed` = zůstává vidět matně (mis-tap ve filtru Oblíbené). `cookedAt` (jen při řazení
 * Uvařené) nahradí datum zapsání datem posledního vaření.
 */
export default function RecipeCard({
  recipe,
  cover,
  onToggleFavorite,
  dimmed = false,
  cookedAt,
  showUpdated = false,
  query = '',
}: {
  recipe: Recipe;
  cover?: Blob | null;
  onToggleFavorite?: (recipe: Recipe) => void;
  dimmed?: boolean;
  /** ISO timestamp posledního vaření; `null` = neuvařeno; `undefined` = ukázat datum zapsání. */
  cookedAt?: string | null;
  /** Ukázat „upraveno …" místo data zapsání (řazení Upravené). */
  showUpdated?: boolean;
  /** Hledaný text – úryvek začne řádky, kde se našel. */
  query?: string;
}) {
  const preview = recipeSnippet(recipe.rawCapture, undefined, query);
  const coverUrl = useObjectUrl(cover);
  const prepTime = recipe.prepMinutes ? formatPrepTime(recipe.prepMinutes) : null;
  const dateLabel =
    cookedAt === undefined
      ? showUpdated
        ? updatedLabel(recipe.updatedAt)
        : formatRecentDate(recipe.capturedOn)
      : cookedAt
        ? `uvařeno ${formatRecentDate(toLocalIsoDate(new Date(cookedAt)))}`
        : 'neuvařeno';

  return (
    <div className={cx('relative h-full transition-opacity', dimmed && 'opacity-50')}>
      <Link
        to={`/recept/${recipe.id}`}
        className={cardClass({
          padding: 'none',
          interactive: true,
          className: cx('flex h-full overflow-hidden', coverUrl && 'min-h-24'),
        })}
      >
        {/* Bez fotky nechává pravý okraj místo hvězdičce; s fotkou hvězdička leží na ní. */}
        <div className={cx('min-w-0 flex-1 py-3.5 pl-4', coverUrl ? 'pr-3' : 'pr-12')}>
          <h2 className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight">
            {recipe.name || '(bez názvu)'}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
            {prepTime ? (
              <span className="inline-flex items-center gap-1 font-semibold text-stone-700 dark:text-stone-200">
                <Icon name="clock" className="h-3.5 w-3.5" />
                {prepTime}
              </span>
            ) : null}
            {recipe.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            <span>{dateLabel}</span>
          </div>
          {preview ? (
            <p
              className={cx(
                'mt-1.5 text-sm text-stone-500 dark:text-stone-400',
                query.trim() ? 'line-clamp-2' : 'line-clamp-1',
              )}
            >
              {preview}
            </p>
          ) : null}
        </div>
        {coverUrl ? (
          <div className="relative w-28 shrink-0">
            <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          </div>
        ) : null}
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
        className="group absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90 focus-visible:outline-none motion-reduce:active:scale-100"
      >
        <span
          className={cx(
            'flex h-8 w-8 items-center justify-center rounded-full transition group-focus-visible:ring-2 group-focus-visible:ring-brand/50',
            coverUrl && 'bg-black/40 backdrop-blur-sm',
            recipe.isFavorite
              ? coverUrl
                ? 'text-amber-400'
                : 'text-amber-500'
              : coverUrl
                ? 'text-white'
                : 'text-stone-400 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300',
          )}
        >
          <Icon name="star" filled={recipe.isFavorite} className="h-5 w-5" />
        </span>
      </button>
    </div>
  );
}
