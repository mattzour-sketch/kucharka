import type { ReactNode } from 'react';
import Icon from './Icon';

/**
 * Štítek (display) – jedna podoba sdílená v RecipeCard, RecipeDetail a TagInput.
 * S `onRemove` přibude křížek (vstup štítků).
 */
export default function Tag({
  children,
  onRemove,
  removeLabel,
}: {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-stone-900/[0.07] px-1.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-white/10 dark:text-stone-300">
      <span className="truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-stone-400 transition hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200"
          aria-label={removeLabel ?? 'Odebrat štítek'}
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      ) : null}
    </span>
  );
}
