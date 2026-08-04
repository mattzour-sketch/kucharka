/** Počítadlo porcí (−/+). `onStep` dostane delta; rodič drží stav funkčně. */
export default function ServingsStepper({
  value,
  onStep,
}: {
  value: number;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-400">Porce</span>
      <div className="flex items-center rounded-full border border-stone-200 bg-white">
        <button
          type="button"
          onClick={() => onStep(-1)}
          className="px-3 py-1 text-lg leading-none text-stone-500 transition hover:text-brand"
          aria-label="Míň porcí"
        >
          −
        </button>
        <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onStep(1)}
          className="px-3 py-1 text-lg leading-none text-stone-500 transition hover:text-brand"
          aria-label="Víc porcí"
        >
          +
        </button>
      </div>
    </div>
  );
}
