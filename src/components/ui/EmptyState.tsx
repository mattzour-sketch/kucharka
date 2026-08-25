import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * Sdílený prázdný stav: shodné svislé umístění, nadpis, volitelný podřádek a CTA.
 * Rozdíl „prázdná DB" vs „prázdný výsledek" řeší volající jiným `title`/`description`.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  fill = false,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  fill?: boolean;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-2 py-16 text-center',
        fill && 'min-h-[50dvh]',
      )}
    >
      {icon != null ? (
        <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-3xl">
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-medium text-stone-700">{title}</h2>
      {description != null ? <p className="text-sm text-stone-400">{description}</p> : null}
      {action != null ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
