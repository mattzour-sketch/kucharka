import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Timer } from '../../db';
import { formatCountdown } from '../../lib/duration';
import { primeAlarm, startAlarm, stopAlarm } from '../../lib/alarm';
import { isTimerGone, timerState, type TimerState } from '../../lib/timers';
import {
  addTimer,
  getTimers,
  removeGoneTimers,
  removeTimer,
  restoreTimers,
  silenceTimer,
  snoozeTimer,
} from './timerRepo';
import Button from '../../components/ui/Button';
import { useUndo } from '../../components/undoContext';
import { TAB_PATHS } from '../../components/TabLayout';

const ROW_CLASS: Record<TimerState, string> = {
  running: 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900',
  ringing: 'animate-pulse border-brand bg-amber-50 dark:bg-stone-800',
  silenced: 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900',
};

/**
 * Běžící časovače (§7) jako lišta dole na každé obrazovce – zvoní, i když z vaření
 * odskočíš na detail nebo jiný recept. Odpočet se dopočítává z cílového času, takže
 * sedí i po uspání. Zvoní, dokud doběhlý časovač nezastavíš. Zastavený zůstane ještě
 * chvíli jako tiché „Hotovo" s „+5 min", pak zmizí sám. Bez časovačů nic nevykreslí.
 * Nový se spustí ťuknutím na čas v kroku, nebo `AdhocTimerForm`.
 */
export default function TimerDock() {
  const [now, setNow] = useState(() => Date.now());
  const { pathname } = useLocation();
  const { showUndo, setBottomInset } = useUndo();
  const sectionRef = useRef<HTMLElement | null>(null);
  const allTimers = useLiveQuery(() => getTimers(), []);
  // Zapomenuté z minula a zastavené po lhůtě se nezobrazí ani nezazvoní, ještě než je úklid smaže.
  const timers = (allTimers ?? []).filter((timer) => !isTimerGone(timer, now));
  const goneCount = (allTimers?.length ?? 0) - timers.length;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (goneCount > 0) void removeGoneTimers();
  }, [goneCount]);

  const anyRinging = timers.some((timer) => timerState(timer, now) === 'ringing');
  useEffect(() => {
    if (anyRinging) startAlarm();
    else stopAlarm();
    return () => stopAlarm();
  }, [anyRinging]);

  // Lišta „Vrátit zpět" sedne nad dock: nahlásit, kolik místa odspodu zabírá.
  const hasTimers = timers.length > 0;
  useEffect(() => {
    const section = sectionRef.current;
    if (!hasTimers || !section) {
      setBottomInset(0);
      return;
    }
    const report = () => setBottomInset(window.innerHeight - section.getBoundingClientRect().top);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(section);
    window.addEventListener('resize', report);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
      setBottomInset(0);
    };
  }, [hasTimers, pathname, setBottomInset]);

  if (!hasTimers) return null;

  function cancel(timer: Timer) {
    const snapshot = { ...timer };
    void removeTimer(timer.id);
    // Vrací se tentýž záznam (stejný cílový čas), odpočet mezitím běžel dál.
    showUndo({
      message: 'Časovač zrušen',
      undo: () => {
        primeAlarm();
        return restoreTimers([snapshot]);
      },
    });
  }

  function snooze(timer: Timer) {
    primeAlarm();
    void snoozeTimer(timer.id);
  }

  // Na obrazovkách se spodní lištou sedí nad ní.
  const aboveTabs = TAB_PATHS.includes(pathname);
  const list = (
    <ul className="mx-auto flex w-full max-w-2xl flex-col gap-1.5">
      {timers.map((timer) => {
        const state = timerState(timer, now);
        return (
          <li
            key={timer.id}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 shadow-sm ${ROW_CLASS[state]}`}
          >
            <p className={`min-w-0 truncate text-sm ${state === 'silenced' ? 'text-stone-400' : 'text-stone-500'}`}>
              {timer.label}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {state === 'running' ? (
                <>
                  <span className="mr-1 text-xl font-semibold tabular-nums">
                    {formatCountdown(Date.parse(timer.endsAt) - now)}
                  </span>
                  <Button role="secondary" onClick={() => cancel(timer)}>
                    Zrušit
                  </Button>
                </>
              ) : state === 'ringing' ? (
                <>
                  <span className="mr-1 text-xl font-semibold text-brand-dark dark:text-amber-400">Hotovo!</span>
                  <Button role="secondary" onClick={() => snooze(timer)}>
                    +5 min
                  </Button>
                  <Button role="primary" onClick={() => void silenceTimer(timer.id)}>
                    Zastavit
                  </Button>
                </>
              ) : (
                <>
                  <span className="mr-1 text-xl font-semibold text-stone-400">Hotovo</span>
                  {/* „×" není tam, kde bylo „Zastavit": dvojí ťuknutí mokrým prstem nesmí
                      časovač ztlumit a hned smazat. Na místě Zastavit je „+5 min". */}
                  <Button role="ghost" onClick={() => void removeTimer(timer.id)} aria-label="Odebrat časovač">
                    ×
                  </Button>
                  <Button role="secondary" onClick={() => snooze(timer)}>
                    +5 min
                  </Button>
                </>
              )}
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
        ref={sectionRef}
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
