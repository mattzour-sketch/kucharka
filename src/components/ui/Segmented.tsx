import type { ReactNode } from 'react';
import { cx } from './cx';

/** Segmentovaný přepínač (na porci/celý, g/ml) – jedna sdílená podoba. */
interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={cx(
        'inline-flex rounded-[10px] bg-stone-900/[0.07] p-0.5 text-xs font-semibold dark:bg-white/10',
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cx(
              'min-h-8 rounded-lg px-3 py-1 transition',
              selected
                ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-600 dark:text-white'
                : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
