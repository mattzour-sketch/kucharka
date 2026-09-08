import type { MouseEventHandler, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from './cx';

/** Role „icon": čtvercová klikací plocha. Jediná role s velikostí (tap-targety v řádcích). */
type IconSize = 'md' | 'sm';
type IconTone = 'neutral' | 'favorite' | 'danger';

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-lg transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 motion-reduce:active:scale-100 motion-reduce:transition-none';

const SIZE: Record<IconSize, string> = {
  md: 'h-9 w-9 text-lg',
  sm: 'h-7 w-7 text-base',
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
      : 'text-stone-300 hover:text-stone-500 dark:text-stone-600 dark:hover:text-stone-400';
  }
  if (tone === 'danger') return 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40';
  return 'text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800/60';
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
