import { cx } from './cx';

/** Padding karty: panel = vzdušný blok, row = hustý řádek seznamu, none = bez. */
export type CardPadding = 'panel' | 'row' | 'none';

interface CardClassOptions {
  padding?: CardPadding;
  /** Klikací karta (Link/button): hover + jemný stisk. */
  interactive?: boolean;
  /** warn = jantarový okraj (něco chybí, např. gramy u suroviny na Kaloriích). */
  tone?: 'default' | 'warn';
  className?: string;
}

/**
 * Jediný zdroj vzhledu „karta" (řádek/dlaždice/panel). Vrací string, aby ho mohl
 * použít i `Link`/`<button>` (RecipeCard, řádek potraviny, odkazy ve „Víc").
 */
export function cardClass(options: CardClassOptions = {}): string {
  const { padding = 'panel', interactive = false, tone = 'default', className } = options;
  return cx(
    // Plocha místo obrysu: karta je tónovaná dlaždice na bílé stránce (v tmavém o stupeň světlejší).
    'rounded-2xl bg-stone-100 dark:bg-stone-900',
    tone === 'warn' && 'ring-1 ring-inset ring-amber-400 dark:ring-amber-700',
    padding === 'panel' && 'p-4',
    padding === 'row' && 'p-3',
    interactive &&
      'transition hover:bg-stone-200/70 dark:hover:bg-stone-800 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 dark:focus-visible:ring-brand-light/60 motion-reduce:active:scale-100 motion-reduce:transition-none',
    className,
  );
}
