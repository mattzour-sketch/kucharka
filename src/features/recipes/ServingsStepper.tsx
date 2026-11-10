import Icon from '../../components/ui/Icon';

const STEP_BUTTON =
  'flex h-10 w-10 items-center justify-center rounded-xl text-stone-700 transition hover:bg-stone-900/[0.08] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 dark:text-stone-200 dark:hover:bg-white/10 dark:focus-visible:ring-brand-light/60 motion-reduce:active:scale-100';

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
      <span className="text-sm font-medium text-stone-500 dark:text-stone-400">Porce</span>
      <div className="flex items-center rounded-xl bg-stone-900/[0.07] dark:bg-white/10">
        <button type="button" onClick={() => onStep(-1)} className={STEP_BUTTON} aria-label="Míň porcí">
          <Icon name="minus" className="h-4 w-4" />
        </button>
        <span className="min-w-[2ch] text-center text-base font-bold tabular-nums">{value}</span>
        <button type="button" onClick={() => onStep(1)} className={STEP_BUTTON} aria-label="Víc porcí">
          <Icon name="plus" className="h-4 w-4" />
        </button>
      </div>
      {base !== undefined && value !== base ? (
        <button
          type="button"
          onClick={() => onStep(base - value)}
          className="text-xs text-stone-500 transition hover:text-brand dark:text-stone-400 dark:hover:text-brand-light"
          aria-label={`Zpět na ${base}`}
        >
          z {base} · <span className="font-semibold text-brand dark:text-brand-light">zpět</span>
        </button>
      ) : null}
    </div>
  );
}
