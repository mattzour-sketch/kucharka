import { describe, expect, it } from 'vitest';
import { formatCountdown, splitStepByDurations } from './duration';

describe('duration', () => {
  it('rozdělí krok a rozpozná délku', () => {
    expect(splitStepByDurations('Dusit 20 minut a odstavit.')).toEqual([
      { text: 'Dusit ', seconds: null },
      { text: '20 minut', seconds: 1200 },
      { text: ' a odstavit.', seconds: null },
    ]);
  });

  it('rozpozná hodiny, minuty i sekundy a víc délek naráz', () => {
    expect(splitStepByDurations('Péct 1 h, pak nechat 90 s')).toEqual([
      { text: 'Péct ', seconds: null },
      { text: '1 h', seconds: 3600 },
      { text: ', pak nechat ', seconds: null },
      { text: '90 s', seconds: 90 },
    ]);
  });

  it('nechytá čísla bez jednotky ani slova začínající na m', () => {
    expect(splitStepByDurations('Nastrouhat 4 brambory na másle')).toEqual([
      { text: 'Nastrouhat 4 brambory na másle', seconds: null },
    ]);
  });

  it('formatCountdown', () => {
    expect(formatCountdown(90 * 1000)).toBe('1:30');
    expect(formatCountdown(5 * 1000)).toBe('0:05');
    expect(formatCountdown(3600 * 1000)).toBe('1:00:00');
    expect(formatCountdown(-500)).toBe('0:00');
  });
});
