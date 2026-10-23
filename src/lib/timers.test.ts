import { describe, expect, it } from 'vitest';
import { isStaleTimer, STALE_TIMER_MS, stepTimerLabel } from './timers';

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
