import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatCountdown } from '../../lib/duration';
import { primeAlarm, startAlarm, stopAlarm } from '../../lib/alarm';
import { addTimer, getTimers, removeTimer } from './timerRepo';
import Button from '../../components/ui/Button';

/**
 * Běžící časovače v režimu vaření (§7). Odpočet se dopočítává z cílového času,
 * takže sedí i po uspání. Zvoní, dokud doběhlý časovač nezastavíš. Bez časovačů
 * nezabírá místo – nový se spustí ťuknutím na čas v kroku, nebo `AdhocTimerForm`.
 */
export default function CookingTimers() {
  const timers = useLiveQuery(() => getTimers(), []) ?? [];
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const anyExpired = timers.some((timer) => Date.parse(timer.endsAt) <= now);
  useEffect(() => {
    if (anyExpired) startAlarm();
    else stopAlarm();
    return () => stopAlarm();
  }, [anyExpired]);

  if (timers.length === 0) return null;

  return (
    <section className="mb-4">
      <ul className="flex flex-col gap-2">
        {timers.map((timer) => {
          const remaining = Date.parse(timer.endsAt) - now;
          const done = remaining <= 0;
          return (
            <li
              key={timer.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${
                done ? 'animate-pulse border-brand bg-brand/10' : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-stone-500">{timer.label}</p>
                <p
                  className={`text-2xl font-semibold tabular-nums ${done ? 'text-brand-dark dark:text-amber-400' : ''}`}
                >
                  {done ? 'Hotovo!' : formatCountdown(remaining)}
                </p>
              </div>
              <Button role="secondary" onClick={() => void removeTimer(timer.id)}>
                {done ? 'Zastavit' : 'Zrušit'}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Vlastní časovač v minutách (dole na obrazovce vaření, ať nezabírá místo nahoře). */
export function AdhocTimerForm() {
  const [minutes, setMinutes] = useState('');

  function addAdhoc() {
    const value = Number(minutes.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    primeAlarm();
    void addTimer('Časovač', Math.round(value * 60));
    setMinutes('');
  }

  return (
    <div className="mt-8 flex items-center gap-2 text-sm text-stone-500">
      <span>Vlastní časovač</span>
      <input
        value={minutes}
        onChange={(event) => setMinutes(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') addAdhoc();
        }}
        inputMode="decimal"
        placeholder="—"
        aria-label="Minuty"
        className="w-16 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-sm outline-none focus:border-brand"
      />
      <span>min</span>
      <Button role="secondary" onClick={addAdhoc}>
        Spustit
      </Button>
    </div>
  );
}
