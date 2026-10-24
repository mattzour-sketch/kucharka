import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatCountdown } from '../../lib/duration';
import { primeAlarm, startAlarm, stopAlarm } from '../../lib/alarm';
import { isStaleTimer } from '../../lib/timers';
import { addTimer, getTimers, removeStaleTimers, removeTimer } from './timerRepo';
import Button from '../../components/ui/Button';
import { TAB_PATHS } from '../../components/TabLayout';

/**
 * Běžící časovače (§7) jako lišta dole na každé obrazovce – zvoní, i když z vaření
 * odskočíš na detail nebo jiný recept. Odpočet se dopočítává z cílového času, takže
 * sedí i po uspání. Zvoní, dokud doběhlý časovač nezastavíš. Bez časovačů nic
 * nevykreslí. Nový se spustí ťuknutím na čas v kroku, nebo `AdhocTimerForm`.
 */
export default function TimerDock() {
  const [now, setNow] = useState(() => Date.now());
  const { pathname } = useLocation();
  // Zapomenuté z minula se nezobrazí ani nezazvoní, ještě než je úklid smaže.
  const timers = (useLiveQuery(() => getTimers(), []) ?? []).filter(
    (timer) => !isStaleTimer(timer.endsAt, now),
  );

  useEffect(() => {
    void removeStaleTimers();
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

  // Na obrazovkách se spodní lištou sedí nad ní.
  const aboveTabs = TAB_PATHS.includes(pathname);
  const list = (
    <ul className="mx-auto flex w-full max-w-2xl flex-col gap-1.5">
      {timers.map((timer) => {
        const remaining = Date.parse(timer.endsAt) - now;
        const done = remaining <= 0;
        return (
          <li
            key={timer.id}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 shadow-sm ${
              done
                ? 'animate-pulse border-brand bg-amber-50 dark:bg-stone-800'
                : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900'
            }`}
          >
            <p className="min-w-0 truncate text-sm text-stone-500">{timer.label}</p>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={`text-xl font-semibold tabular-nums ${done ? 'text-brand-dark dark:text-amber-400' : ''}`}
              >
                {done ? 'Hotovo!' : formatCountdown(remaining)}
              </span>
              <Button role={done ? 'primary' : 'secondary'} onClick={() => void removeTimer(timer.id)}>
                {done ? 'Zastavit' : 'Zrušit'}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Místo pod obsahem, ať lišta nezakryje poslední řádky stránky. */}
      <div aria-hidden className="invisible px-3 pb-3 pt-1">
        {list}
      </div>
      <section
        aria-label="Časovače"
        className={`fixed inset-x-0 z-30 px-3 pb-3 pt-1 ${aboveTabs ? 'bottom-14' : 'bottom-0'}`}
      >
        {list}
      </section>
    </>
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
