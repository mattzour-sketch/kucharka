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

  it.each([
    ['Knead for 5 mins.', '5 mins', 300],
    ['Let rise 1 hour.', '1 hour', 3600],
    ['Chill 2 hours', '2 hours', 7200],
    ['Chill 2 hrs', '2 hrs', 7200],
    ['Rest 1 hr', '1 hr', 3600],
    ['Microwave 30 seconds', '30 seconds', 30],
    ['Microwave 10 sec', '10 sec', 10],
    ['Microwave 10 secs', '10 secs', 10],
    ['Knead for about 5 minutes', '5 minutes', 300],
  ])('anglické časy: %s', (step, text, seconds) => {
    expect(splitStepByDurations(step).filter((segment) => segment.seconds != null)).toEqual([
      { text, seconds },
    ]);
  });

  it('„1 hr 30 mins" = dva klikací segmenty', () => {
    expect(splitStepByDurations('Bake 1 hr 30 mins')).toEqual([
      { text: 'Bake ', seconds: null },
      { text: '1 hr', seconds: 3600 },
      { text: ' ', seconds: null },
      { text: '30 mins', seconds: 1800 },
    ]);
  });

  it.each(['Bake 2 sheets', 'Makes 4 servings', 'Bake at 375°F (190 °C)', 'Add 2 scoops'])(
    'anglický text bez délky nic nechytá: %s',
    (step) => {
      expect(splitStepByDurations(step)).toEqual([{ text: step, seconds: null }]);
    },
  );

  it('rozsah „12–15 minutes": klikací je horní mez (dnešní chování)', () => {
    const timed = splitStepByDurations('Bake for 12–15 minutes').filter((s) => s.seconds != null);
    expect(timed).toEqual([{ text: '15 minutes', seconds: 900 }]);
  });

  it('formatCountdown', () => {
    expect(formatCountdown(90 * 1000)).toBe('1:30');
    expect(formatCountdown(5 * 1000)).toBe('0:05');
    expect(formatCountdown(3600 * 1000)).toBe('1:00:00');
    expect(formatCountdown(-500)).toBe('0:00');
  });
});
