import type { ReactNode } from 'react';
import Button from '../../components/ui/Button';

/**
 * Řádek popisku pole (Suroviny / Postup) s nenápadnou nabídkou rozdělení vpravo.
 * Výška řádku je pevná podle tlačítka, takže objevení nabídky při psaní nic neposune.
 */
export default function FieldLabelWithSplit({
  children,
  htmlFor,
  splitLabel,
  onSplit,
}: {
  children: ReactNode;
  htmlFor?: string;
  splitLabel: string | null;
  onSplit: () => void;
}) {
  return (
    <div className="mt-2 flex h-9 items-center justify-between gap-2">
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-wide text-stone-400"
      >
        {children}
      </label>
      {splitLabel ? (
        <Button role="ghost" onClick={onSplit}>
          {splitLabel}
        </Button>
      ) : null}
    </div>
  );
}
