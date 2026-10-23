/**
 * Počítadlo porcí (−/+). `onStep` dostane delta; rodič drží stav funkčně.
 * `base` = porce, na které je recept napsaný: když se od nich počet liší, je vidět
 * „z 3 · zpět" (množství jsou přepočtená) a ťuknutím se vrátí původní počet.
 */
export default function ServingsStepper({
  value,
  base,
  onStep,
}: {
  value: number;
  base?: number;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-400">Porce</span>
      <div className="flex items-center rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
        <button
          type="button"
          onClick={() => onStep(-1)}
          className="px-3 py-1 text-lg leading-none text-stone-500 transition hover:text-brand dark:text-amber-400"
          aria-label="Míň porcí"
        >
          −
        </button>
        <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onStep(1)}
          className="px-3 py-1 text-lg leading-none text-stone-500 transition hover:text-brand dark:text-amber-400"
          aria-label="Víc porcí"
        >
          +
        </button>
      </div>
      {base !== undefined && value !== base ? (
        <button
          type="button"
          onClick={() => onStep(base - value)}
          className="text-xs text-stone-400 transition hover:text-brand dark:hover:text-amber-400"
          aria-label={`Zpět na ${base}`}
        >
          z {base} · <span className="font-medium text-brand dark:text-amber-400">zpět</span>
        </button>
      ) : null}
    </div>
  );
}
