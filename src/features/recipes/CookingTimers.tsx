import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Timer } from '../../db';
import { formatCountdown } from '../../lib/duration';
import { primeAlarm, startAlarm, stopAlarm } from '../../lib/alarm';
import {
  activeTimerFor,
  finishedAgoLabel,
  hasNewTimer,
  isTimerGone,
  timerState,
  type TimerState,
} from '../../lib/timers';
import {
  addTimer,
  getTimers,
  removeGoneTimers,
  removeTimer,
  restoreTimers,
  silenceTimer,
  snoozeTimer,
  startStepTimer,
} from './timerRepo';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import { useUndo } from '../../components/undoContext';
import { TAB_PATHS } from '../../components/TabLayout';
import { FIELD } from '../../components/ui/styles';
import { cx } from '../../components/ui/cx';
import Icon from '../../components/ui/Icon';

const ROW_CLASS: Record<TimerState, string> = {
  // Lišta plave nad obsahem → bílá plocha se stínem, ne šedá dlaždice. Zvonící = jantar (pozor).
  running: 'bg-white ring-1 ring-stone-900/10 dark:bg-stone-800 dark:ring-white/10',
  ringing: 'animate-pulse bg-amber-100 ring-2 ring-amber-500 dark:bg-amber-900 dark:ring-amber-400',
  silenced: 'bg-white ring-1 ring-stone-900/10 dark:bg-stone-800 dark:ring-white/10',
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
        const ago = state === 'running' ? null : finishedAgoLabel(timer.endsAt, now);
        return (
          <li
            key={timer.id}
            className={`flex items-center justify-between gap-3 rounded-2xl py-2 pl-4 pr-2 shadow-lg shadow-stone-900/10 ${ROW_CLASS[state]}`}
          >
            <div className="min-w-0">
              <p
                className={`truncate text-sm ${
                  state === 'ringing'
                    ? 'font-medium text-amber-900 dark:text-amber-100'
                    : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                {timer.label}
              </p>
              {ago ? (
                <p className={`text-xs ${state === 'ringing' ? 'text-amber-800 dark:text-amber-200' : 'text-stone-500 dark:text-stone-400'}`}>
                  Doběhl {ago}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {state === 'running' ? (
                <>
                  <span className="mr-1 text-2xl font-bold tabular-nums tracking-tight">
                    {formatCountdown(Date.parse(timer.endsAt) - now)}
                  </span>
                  <Button role="secondary" onClick={() => cancel(timer)}>
                    Zrušit
                  </Button>
                </>
              ) : state === 'ringing' ? (
                <>
                  <span className="mr-1 text-xl font-bold text-amber-900 dark:text-amber-100">Hotovo!</span>
                  <Button role="secondary" onClick={() => snooze(timer)}>
                    +5 min
                  </Button>
                  <Button role="primary" onClick={() => void silenceTimer(timer.id)}>
                    Zastavit
                  </Button>
                </>
              ) : (
                <>
                  <span className="mr-1 text-xl font-bold text-stone-400 dark:text-stone-500">Hotovo</span>
                  {/* „×" není tam, kde bylo „Zastavit": dvojí ťuknutí mokrým prstem nesmí
                      časovač ztlumit a hned smazat. Na místě Zastavit je „+5 min". */}
                  <IconButton onClick={() => void removeTimer(timer.id)} aria-label="Odebrat časovač">
                    <Icon name="close" />
                  </IconButton>
                  <Button role="secondary" onClick={() => snooze(timer)}>
                    +5 min
                  </Button>
                </>
              )}
            </div>
          </li>
        );
      })}
      {/* Web nemá notifikace na pozadí: u čerstvého časovače to krátce říct. */}
      {hasNewTimer(timers, now) ? (
        <li className="self-center rounded-full bg-white/90 px-3 py-0.5 text-center text-xs text-stone-600 backdrop-blur dark:bg-stone-900/90 dark:text-stone-300">
          Zvoní, jen když je Kuchařka otevřená
        </li>
      ) : null}
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
        className={`fixed inset-x-0 z-30 px-3 pb-3 pt-1 ${aboveTabs ? 'bottom-16' : 'bottom-0'}`}
      >
        {list}
      </section>
    </>
  );
}

/**
 * Klikací čas v kroku. Ťuknutí spustí časovač; když už tentýž běží nebo zvoní, druhý
 * nevznikne a u času je vidět, kolik zbývá.
 */
export function StepTimerButton({
  text,
  seconds,
  source,
  label,
  timers,
}: {
  text: string;
  seconds: number;
  source: string;
  label: string;
  timers: readonly Timer[];
}) {
  const [now, setNow] = useState(() => Date.now());
  const active = activeTimerFor(timers, source, now);
  const isActive = Boolean(active);

  // Tiká jen při běžícím časovači, ať celý krok nepřekresluje každé půl sekundy zbytečně.
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [isActive]);

  const remaining = active ? Date.parse(active.endsAt) - now : 0;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (active) return;
        primeAlarm();
        setNow(Date.now());
        void startStepTimer(source, label, seconds);
      }}
      className="rounded-md bg-brand/10 px-1.5 py-0.5 font-semibold text-brand-dark underline decoration-dotted underline-offset-4 dark:bg-brand-bright/25 dark:text-brand-light"
    >
      {text}
      {active ? (
        <span className="ml-1.5 inline-flex items-center gap-1 whitespace-nowrap align-baseline text-base tabular-nums">
          <Icon name="clock" className="h-4 w-4" />
          {remaining > 0 ? formatCountdown(remaining) : 'zvoní'}
        </span>
      ) : null}
    </button>
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
    <div className="mt-8 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
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
        className={cx(FIELD, 'h-10 w-16 px-2 text-center text-base font-semibold tabular-nums')}
      />
      <span>min</span>
      <Button role="secondary" onClick={addAdhoc}>
        Spustit
      </Button>
    </div>
  );
}
