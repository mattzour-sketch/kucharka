import { cx } from './cx';
import { convertAmountUnit, type AmountUnitOption, type AmountValue } from '../../lib/amount';
import { FIELD_SM } from './styles';

/**
 * Sdílený výběr množství suroviny (UC017): číselné pole + řízení jednotky.
 * Řízení se odvíjí od nabídky (finální rozhodnutí):
 * - jen „g" → statický text „g",
 * - „g" + „ks" (bez měr) → dnešní cyklické tlačítko (nulová regrese horké cesty),
 * - jakmile je aspoň jedna míra → kompaktní `<select>`.
 *
 * Komponenta je čistě controlled: nedrží stav, nezapisuje do DB a NEzobrazuje
 * gramáž/kcal. Dopočet a readout si dělá volající přes `resolveAmount`, protože se
 * místo od místa liší (živý zápis na Kaloriích vs. draft ve vaření).
 */
export default function AmountPicker({
  options,
  value,
  onChange,
}: {
  options: AmountUnitOption[];
  value: AmountValue;
  onChange: (next: AmountValue) => void;
}) {
  const hasPortions = options.some((option) => option.kind === 'portion');
  const currentId = options.some((option) => option.id === value.unitId)
    ? value.unitId
    : (options[0]?.id ?? 'g');
  const current = options.find((option) => option.id === currentId);

  const numberField = (
    <input
      value={value.raw}
      onChange={(event) => onChange({ ...value, raw: event.target.value })}
      inputMode="decimal"
      placeholder={current?.label ?? 'g'}
      className={cx(FIELD_SM, 'h-9 w-16 px-2 text-right font-semibold tabular-nums')}
      aria-label="Množství"
    />
  );

  if (hasPortions) {
    return (
      <>
        {numberField}
        <select
          value={currentId}
          onChange={(event) => onChange(convertAmountUnit(value, options, event.target.value))}
          className={cx(FIELD_SM, 'h-9 max-w-[6.5rem] shrink-0 pl-1.5 pr-1 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-200')}
          aria-label="Jednotka"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </>
    );
  }

  const ks = options.find((option) => option.kind === 'ks');
  if (ks) {
    const toId = currentId === 'ks' ? 'g' : 'ks';
    return (
      <>
        {numberField}
        <button
          type="button"
          onClick={() => onChange(convertAmountUnit(value, options, toId))}
          className={cx(FIELD_SM, 'h-9 w-9 shrink-0 text-xs font-semibold text-stone-700 dark:text-stone-200')}
          aria-label="Přepnout jednotku g/ks"
        >
          {current?.label ?? 'g'}
        </button>
      </>
    );
  }

  return (
    <>
      {numberField}
      <span className="w-9 text-center text-xs text-stone-500 dark:text-stone-400">g</span>
    </>
  );
}
