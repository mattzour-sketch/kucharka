import type { ReactNode } from 'react';
import type { LinkProps } from 'react-router-dom';
import { cx } from './cx';
import { SCREEN_WIDTH, type ScreenWidth } from './layout';
import IconButton from './IconButton';

/**
 * Jediná horní lišta obrazovky ve dvou variantách. Sdílené pozadí, výška, blur a
 * vnitřní max-šířka; hlavička i `main` používají tentýž `width`.
 *
 * - `tab` – bez tlačítka zpět, titulek `h1` velký; volitelné `actions` vpravo a
 *   `below` (druhý řádek, typicky vyhledávací pole).
 * - `stack` – vlevo `‹`/`✕` (zpět/zavřít), titulek `h1` malý (volitelný), `actions` vpravo.
 */
interface ScreenHeaderProps {
  variant?: 'tab' | 'stack';
  width?: ScreenWidth;
  title?: ReactNode;
  actions?: ReactNode;
  /** Druhý řádek uvnitř stejného kontejneru (vyhledávací pole). */
  below?: ReactNode;
  // Jen stack:
  backTo?: LinkProps['to'];
  onBack?: () => void;
  /** Zavírací ✕ místo zpětného ‹ (formuláře). */
  closeIcon?: boolean;
  backLabel?: string;
}

const CHROME = 'sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur';

export default function ScreenHeader({
  variant = 'tab',
  width = 'narrow',
  title,
  actions,
  below,
  backTo,
  onBack,
  closeIcon = false,
  backLabel,
}: ScreenHeaderProps) {
  const isStack = variant === 'stack';
  const titleClass = isStack
    ? 'min-w-0 truncate text-sm font-medium text-stone-600'
    : 'text-xl font-semibold tracking-tight';
  const label = backLabel ?? (closeIcon ? 'Zavřít' : 'Zpět');

  return (
    <header className={CHROME}>
      <div className={cx('mx-auto px-4 py-3', SCREEN_WIDTH[width])}>
        <div className="flex items-center gap-2">
          {isStack && (backTo !== undefined || onBack) ? (
            <IconButton to={backTo} onClick={onBack} aria-label={label}>
              {closeIcon ? '✕' : '‹'}
            </IconButton>
          ) : null}
          {title != null ? <h1 className={titleClass}>{title}</h1> : null}
          {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
        </div>
        {below ? <div className="mt-2">{below}</div> : null}
      </div>
    </header>
  );
}
