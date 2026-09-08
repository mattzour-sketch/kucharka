import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatCountdown } from '../../lib/duration';
import { primeAlarm, startAlarm, stopAlarm } from '../../lib/alarm';
import { addTimer, getTimers, removeTimer } from './timerRepo';
import Button from '../../components/ui/Button';

/**
 * Panel časovačů v režimu vaření (§7). Odpočet se dopočítává z cílového času,
 * takže sedí i po uspání. Zvoní, dokud doběhlý časovač nezastavíš.
 */
export default function CookingTimers() {
  const timers = useLiveQuery(() => getTimers(), []) ?? [];
  const [now, setNow] = useState(() => Date.now());
  const [minutes, setMinutes] = useState('');

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

  function addAdhoc() {
    const value = Number(minutes.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    primeAlarm();
    void addTimer('Časovač', Math.round(value * 60));
    setMinutes('');
  }

  return (
    <section className="mb-4">
      {timers.length > 0 ? (
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
                    className={`text-2xl font-semibold tabular-nums ${done ? 'text-brand-dark' : ''}`}
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
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <input
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') addAdhoc();
          }}
          inputMode="decimal"
          placeholder="min"
          className="w-20 rounded-full border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
        <Button role="secondary" onClick={addAdhoc}>
          + Časovač
        </Button>
      </div>
    </section>
  );
}
