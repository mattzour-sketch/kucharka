import { cx } from './cx';
import { convertAmountUnit, type AmountUnitOption, type AmountValue } from '../../lib/amount';

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
      className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-right outline-none focus:border-brand"
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
          className="max-w-[6.5rem] shrink-0 rounded-lg border border-stone-200 bg-white py-1 pl-1.5 pr-1 text-xs font-medium text-stone-600 outline-none focus:border-brand"
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
          className="w-8 shrink-0 rounded-lg border border-stone-200 py-1 text-xs font-medium text-stone-600"
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
      <span className={cx('w-8 text-center text-xs text-stone-400')}>g</span>
    </>
  );
}
