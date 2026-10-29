import { describe, expect, it } from 'vitest';
import {
  isStaleTimer,
  isTimerGone,
  SILENCED_TIMER_MS,
  SNOOZE_MS,
  snoozedEndsAt,
  STALE_TIMER_MS,
  stepTimerLabel,
  timerState,
} from './timers';

describe('isStaleTimer', () => {
  const now = Date.parse('2026-10-23T18:00:00Z');

  it('běžící ani čerstvě doběhlý časovač není zastaralý', () => {
    expect(isStaleTimer('2026-10-23T18:05:00Z', now)).toBe(false);
    expect(isStaleTimer('2026-10-23T17:50:00Z', now)).toBe(false);
  });

  it('doběhlý před víc než 3 hodinami je zastaralý', () => {
    expect(isStaleTimer(new Date(now - STALE_TIMER_MS - 1000).toISOString(), now)).toBe(true);
    expect(isStaleTimer('2026-10-22T19:00:00Z', now)).toBe(true);
  });
});

describe('timerState', () => {
  const now = Date.parse('2026-10-29T18:00:00Z');

  it('běžící, doběhlý (zvoní) a ztlumený', () => {
    expect(timerState({ endsAt: '2026-10-29T18:05:00Z' }, now)).toBe('running');
    expect(timerState({ endsAt: '2026-10-29T17:59:00Z' }, now)).toBe('ringing');
    expect(timerState({ endsAt: '2026-10-29T17:59:00Z', silencedAt: null }, now)).toBe('ringing');
    expect(
      timerState({ endsAt: '2026-10-29T17:59:00Z', silencedAt: '2026-10-29T17:59:30Z' }, now),
    ).toBe('silenced');
  });

  it('přesně v cílovém čase už zvoní', () => {
    expect(timerState({ endsAt: new Date(now).toISOString() }, now)).toBe('ringing');
  });

  it('běžící časovač je běžící, i kdyby měl ztlumení z dřívějška', () => {
    expect(
      timerState({ endsAt: '2026-10-29T18:05:00Z', silencedAt: '2026-10-29T17:50:00Z' }, now),
    ).toBe('running');
  });
});

describe('isTimerGone', () => {
  const now = Date.parse('2026-10-29T18:00:00Z');
  const endsAt = '2026-10-29T17:50:00Z';

  it('ztlumený zůstane 2 minuty od ztlumení, pak zmizí', () => {
    const silencedJustNow = new Date(now - SILENCED_TIMER_MS + 1000).toISOString();
    const silencedLongAgo = new Date(now - SILENCED_TIMER_MS).toISOString();
    expect(isTimerGone({ endsAt, silencedAt: silencedJustNow }, now)).toBe(false);
    expect(isTimerGone({ endsAt, silencedAt: silencedLongAgo }, now)).toBe(true);
  });

  it('zvonící ani běžící nezmizí sám (kromě zastaralého)', () => {
    expect(isTimerGone({ endsAt }, now)).toBe(false);
    expect(isTimerGone({ endsAt: '2026-10-29T18:30:00Z' }, now)).toBe(false);
    expect(isTimerGone({ endsAt: '2026-10-29T14:00:00Z' }, now)).toBe(true);
  });
});

describe('snoozedEndsAt', () => {
  it('doběhlý před 3 min → konec = teď + 5 min, nezávisle na původním konci', () => {
    const now = Date.parse('2026-10-29T18:03:00Z');
    expect(snoozedEndsAt(now)).toBe('2026-10-29T18:08:00.000Z');
    expect(Date.parse(snoozedEndsAt(now)) - now).toBe(SNOOZE_MS);
  });

  it('prodloužený časovač zase běží', () => {
    const now = Date.parse('2026-10-29T18:03:00Z');
    expect(timerState({ endsAt: snoozedEndsAt(now), silencedAt: null }, now)).toBe('running');
  });
});

describe('stepTimerLabel', () => {
  it('přidá začátek kroku', () => {
    expect(stepTimerLabel(2, 'Těstoviny vařte 10 minut v osolené vodě.')).toBe(
      'Krok 3 · Těstoviny vařte 10 minut',
    );
  });

  it('uřízne krátké slovo a interpunkci na konci', () => {
    expect(stepTimerLabel(0, 'Pečte v troubě 25 minut')).toBe('Krok 1 · Pečte v troubě');
    expect(stepTimerLabel(0, 'Cibuli a česnek v hrnci orestujte')).toBe('Krok 1 · Cibuli a česnek');
    expect(stepTimerLabel(0, 'Vařte, dokud nezměkne')).toBe('Krok 1 · Vařte, dokud nezměkne');
  });

  it('dlouhé slovo zkrátí na limit znaků', () => {
    expect(stepTimerLabel(4, 'Předehřejte troubu na 180 °C a pečte')).toBe(
      'Krok 5 · Předehřejte troubu na 180',
    );
  });

  it('prázdný krok = jen číslo', () => {
    expect(stepTimerLabel(1, '   ')).toBe('Krok 2');
  });
});
