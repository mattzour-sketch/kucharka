import type { MouseEventHandler, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from './cx';

/** Role „icon": čtvercová klikací plocha. Jediná role s velikostí (tap-targety v řádcích). */
type IconSize = 'md' | 'sm';
type IconTone = 'neutral' | 'favorite' | 'danger';

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-full transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 dark:focus-visible:ring-brand-light/60 motion-reduce:active:scale-100 motion-reduce:transition-none';

const SIZE: Record<IconSize, string> = {
  md: 'h-10 w-10 text-lg',
  sm: 'h-8 w-8 text-base',
};

interface IconButtonProps {
  size?: IconSize;
  tone?: IconTone;
  /** Jen pro `tone='favorite'`: aktivní (oblíbené) = plná amber. */
  active?: boolean;
  to?: LinkProps['to'];
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  'aria-label': string;
  'aria-pressed'?: boolean;
  children: ReactNode;
}

function toneClass(tone: IconTone, active: boolean): string {
  if (tone === 'favorite') {
    return active
      ? 'text-amber-500'
      : 'text-stone-400 hover:bg-stone-900/[0.06] hover:text-stone-600 dark:text-stone-500 dark:hover:bg-white/10 dark:hover:text-stone-300';
  }
  if (tone === 'danger') return 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40';
  return 'text-stone-600 hover:bg-stone-900/[0.06] dark:text-stone-300 dark:hover:bg-white/10';
}

export default function IconButton({
  size = 'md',
  tone = 'neutral',
  active = false,
  to,
  onClick,
  children,
  ...aria
}: IconButtonProps) {
  const cls = cx(BASE, SIZE[size], toneClass(tone, active));
  if (to !== undefined) {
    return (
      <Link to={to} className={cls} onClick={onClick} {...aria}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} {...aria}>
      {children}
    </button>
  );
}
