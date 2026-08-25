import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * Filtr štítků (interaktivní) – jeden jazyk: neaktivní = neutrální okraj,
 * aktivní = plný brand (default) nebo amber tint (přepínač „Oblíbené").
 */
const BASE =
  'rounded-full px-3 py-1 text-xs font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 motion-reduce:active:scale-100 motion-reduce:transition-none';

const INACTIVE = 'border border-stone-200 text-stone-600 hover:border-stone-300';

const ACTIVE: Record<'brand' | 'amber', string> = {
  brand: 'border border-brand bg-brand text-white',
  amber: 'border border-amber-300 bg-amber-50 text-amber-600',
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
