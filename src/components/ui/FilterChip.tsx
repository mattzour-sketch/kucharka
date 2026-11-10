import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * Filtr štítků (interaktivní) – jeden jazyk: neaktivní = neutrální výplň,
 * aktivní = plný brand (default) nebo amber tint (přepínač „Oblíbené"). Výška 36 px
 * kvůli palci; jediný prvek s plně kulatým rohem („pilulka" = filtr, ne tlačítko).
 */
const BASE =
  'inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 dark:focus-visible:ring-brand-light/60 motion-reduce:active:scale-100 motion-reduce:transition-none';

const INACTIVE =
  'bg-stone-900/[0.06] text-stone-700 hover:bg-stone-900/[0.1] dark:bg-white/10 dark:text-stone-200 dark:hover:bg-white/[0.16]';

const ACTIVE: Record<'brand' | 'amber', string> = {
  brand: 'bg-brand text-white dark:bg-brand-bright',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
};

export default function FilterChip({
  active,
  activeTone = 'brand',
  onClick,
  children,
  ...aria
}: {
  active: boolean;
  activeTone?: 'brand' | 'amber';
  onClick: () => void;
  children: ReactNode;
  'aria-pressed'?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(BASE, active ? ACTIVE[activeTone] : INACTIVE)}
      {...aria}
    >
      {children}
    </button>
  );
}
