import { useState } from 'react';
import Button from './Button';
import { parseDecimal } from '../../lib/num';
import { ABSURD_GRAMS, COMMON_PORTION_LABELS, PORTION_DATALIST_ID } from './portionLabels';
import { FIELD_SM } from './styles';
import { cx } from './cx';

/** Sdílený `<datalist>` s běžnými názvy měr. `id` používají inputy přes `list=`. */
export function PortionNameDatalist() {
  return (
    <datalist id={PORTION_DATALIST_ID}>
      {COMMON_PORTION_LABELS.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
}

/**
 * Inline založení domácí míry přímo u suroviny (UC017) – ať se kvůli jedné míře
 * nemusí odskakovat do editoru potraviny. Uloží míru k potravině a vybere ji.
 */
export default function AddPortionInline({
  onAdd,
  onClose,
}: {
  onAdd: (label: string, grams: number) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [grams, setGrams] = useState('');
  const parsedGrams = parseDecimal(grams);
  const valid = label.trim() !== '' && parsedGrams != null && parsedGrams > 0;
  const absurd = parsedGrams != null && parsedGrams > ABSURD_GRAMS;

  function submit() {
    if (!valid || parsedGrams == null) return;
    onAdd(label.trim(), parsedGrams);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          list={PORTION_DATALIST_ID}
          placeholder="míra (lžíce)"
          className={cx(FIELD_SM, 'h-9 min-w-0 flex-1 px-2 text-sm')}
        />
        <input
          value={grams}
          onChange={(event) => setGrams(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          inputMode="decimal"
          placeholder="g"
          className={cx(FIELD_SM, 'h-9 w-16 px-2 text-right text-sm tabular-nums')}
          aria-label="Gramů na 1 míru"
        />
        <Button role="tint" onClick={submit} disabled={!valid}>
          Přidat
        </Button>
        <Button role="ghost" onClick={onClose}>
          Zavřít
        </Button>
      </div>
      {absurd ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{parsedGrams} g na jednu míru, fakt?</p>
      ) : null}
      <PortionNameDatalist />
    </div>
  );
}
