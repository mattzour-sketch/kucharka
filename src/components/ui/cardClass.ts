import { cx } from './cx';

/** Padding karty: panel = vzdušný blok, row = hustý řádek seznamu, none = bez. */
export type CardPadding = 'panel' | 'row' | 'none';

interface CardClassOptions {
  padding?: CardPadding;
  /** Klikací karta (Link/button): hover + jemný stisk. */
  interactive?: boolean;
  className?: string;
}

/**
 * Jediný zdroj vzhledu „karta" (řádek/dlaždice/panel). Vrací string, aby ho mohl
 * použít i `Link`/`<button>` (RecipeCard, řádek potraviny, odkazy ve „Víc").
 */
export function cardClass(options: CardClassOptions = {}): string {
  const { padding = 'panel', interactive = false, className } = options;
  return cx(
    'rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900',
    padding === 'panel' && 'p-4',
    padding === 'row' && 'p-3',
    interactive &&
      'transition hover:border-stone-300 hover:shadow-sm dark:hover:border-stone-700 active:scale-[0.99] motion-reduce:active:scale-100 motion-reduce:transition-none',
    className,
  );
}
