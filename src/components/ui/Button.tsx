import type { MouseEventHandler, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from './cx';

/** Uzavřená sada rolí tlačítek. Rádius i velikost jsou pevné na roli. */
export type ButtonRole = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'tint';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-40 disabled:pointer-events-none motion-reduce:active:scale-100 motion-reduce:transition-none';

const ROLE: Record<ButtonRole, string> = {
  primary: 'bg-brand text-white shadow-sm hover:bg-brand-dark px-4 py-2 text-sm',
  secondary:
    'border border-stone-300 text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800 px-4 py-2 text-sm',
  ghost: 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 px-4 py-2 text-sm',
  destructive: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 px-4 py-2 text-sm',
  tint: 'bg-brand/10 text-brand-dark hover:bg-brand/20 dark:bg-brand/20 dark:text-amber-300 dark:hover:bg-brand/30 px-3 py-1.5 text-sm',
};

interface ButtonProps {
  role?: ButtonRole;
  /** Jediný povolený modifikátor velikosti (+ stav `disabled`). */
  fullWidth?: boolean;
  /** Když je zadané, renderuje se `<Link>` místo `<button>`. */
  to?: LinkProps['to'];
  type?: 'button' | 'submit' | 'reset';
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  title?: string;
}

export default function Button({
  role = 'primary',
  fullWidth = false,
  to,
  type = 'button',
  onClick,
  disabled = false,
  className,
  children,
  ...aria
}: ButtonProps) {
  const cls = cx(BASE, ROLE[role], fullWidth && 'w-full', className);
  // Disabled odkaz nedává smysl → padáme na `<button disabled>`.
  if (to !== undefined && !disabled) {
    return (
      <Link to={to} className={cls} onClick={onClick} {...aria}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} {...aria}>
      {children}
    </button>
  );
}
