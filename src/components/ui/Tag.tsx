import type { ReactNode } from 'react';

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
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-dark dark:bg-brand/20 dark:text-amber-300">
      <span className="truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-brand-dark/60 transition hover:text-brand-dark dark:text-amber-300/70 dark:hover:text-amber-200"
          aria-label={removeLabel ?? 'Odebrat štítek'}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
