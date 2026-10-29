import { describe, expect, it } from 'vitest';
import {
  isTimerGone,
  SILENCED_TIMER_MS,
  SNOOZE_MS,
  snoozedEndsAt,
  STALE_TIMER_MS,
  timerState,
  type TimerTiming,
} from './timers';

/** Review: životní cyklus časovače běží → zvoní → ztlumený → +5 min → zvoní / zmizí. */

const iso = (ms: number) => new Date(ms).toISOString();
const t0 = Date.parse('2026-10-29T18:00:00Z');

describe('časovač – celý cyklus (review)', () => {
  it('doběhne → zvoní → Zastavit → tichý 2 min → zmizí; nikdy nezvoní znovu sám', () => {
    const timer: TimerTiming = { endsAt: iso(t0) };
    expect(timerState(timer, t0 - 1)).toBe('running');
    expect(timerState(timer, t0)).toBe('ringing');
    const silenced = { ...timer, silencedAt: iso(t0 + 60_000) };
    for (let now = t0 + 60_000; now < t0 + 60_000 + SILENCED_TIMER_MS; now += 10_000) {
      expect(timerState(silenced, now)).toBe('silenced');
      expect(isTimerGone(silenced, now)).toBe(false);
    }
    expect(isTimerGone(silenced, t0 + 60_000 + SILENCED_TIMER_MS)).toBe(true);
  });

  it('ztlumený → +5 min → běží 5:00 od ťuknutí → znovu zvoní (silencedAt vynulované)', () => {
    const tap = t0 + 90_000;
    const snoozed: TimerTiming = { endsAt: snoozedEndsAt(tap), silencedAt: null };
    expect(timerState(snoozed, tap)).toBe('running');
    expect(isTimerGone(snoozed, tap + SILENCED_TIMER_MS + 1)).toBe(false);
    expect(timerState(snoozed, tap + SNOOZE_MS)).toBe('ringing');
    // Zvonící po +5 min nezmizí sám ani po 2 minutách.
    expect(isTimerGone(snoozed, tap + SNOOZE_MS + SILENCED_TIMER_MS * 5)).toBe(false);
  });

  it('kdyby snooze zapomněl smazat silencedAt, po doběhnutí by nezvonil (hlídá repo)', () => {
    const tap = t0 + 90_000;
    const wrong: TimerTiming = { endsAt: snoozedEndsAt(tap), silencedAt: iso(t0 + 60_000) };
    // Běží správně, ale po doběhnutí je hned „silenced" a rovnou „gone" – proto snoozeTimer
    // musí nastavit silencedAt: null (timerRepo.ts to dělá).
    expect(timerState(wrong, tap + SNOOZE_MS)).toBe('silenced');
    expect(isTimerGone(wrong, tap + SNOOZE_MS)).toBe(true);
  });

  it('zvonící déle než 3 h je zastaralý a zmizí (isStaleTimer platí dál)', () => {
    expect(isTimerGone({ endsAt: iso(t0) }, t0 + STALE_TIMER_MS + 1)).toBe(true);
  });

  it('vrácený (Zrušit → Vrátit) běžící záznam s uplynulým endsAt zvoní', () => {
    const snapshot: TimerTiming = { endsAt: iso(t0 + 5_000) };
    expect(timerState(snapshot, t0 + 6_000)).toBe('ringing');
    expect(isTimerGone(snapshot, t0 + 6_000)).toBe(false);
  });
});
