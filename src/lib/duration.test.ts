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

  it('„1 hr 30 mins" = jeden klikací úsek', () => {
    expect(splitStepByDurations('Bake 1 hr 30 mins')).toEqual([
      { text: 'Bake ', seconds: null },
      { text: '1 hr 30 mins', seconds: 5400 },
    ]);
  });

  it('„Péct 1 h 30 min" = jeden úsek 1:30:00', () => {
    expect(splitStepByDurations('Péct 1 h 30 min')).toEqual([
      { text: 'Péct ', seconds: null },
      { text: '1 h 30 min', seconds: 5400 },
    ]);
  });

  it.each([
    ['1 hodinu 30 minut', 5400],
    ['2 h 30 min 10 s', 9010],
    ['1h30min', 5400],
    ['1h 30m', 5400],
    ['2h30m10s', 9010],
  ])('spojené časy bez spojky: %s', (text, seconds) => {
    expect(splitStepByDurations(`Péct ${text} doměkka`)).toEqual([
      { text: 'Péct ', seconds: null },
      { text, seconds },
      { text: ' doměkka', seconds: null },
    ]);
  });

  it.each([
    ['1 h a 30 min', '1 h', 3600, ' a ', '30 min', 1800],
    ['1 hour and 30 minutes', '1 hour', 3600, ' and ', '30 minutes', 1800],
    ['30 min 1 h', '30 min', 1800, ' ', '1 h', 3600],
    ['20 min 20 min', '20 min', 1200, ' ', '20 min', 1200],
    ['1 h, 30 min', '1 h', 3600, ', ', '30 min', 1800],
  ])(
    'nespojí se (spojka, pořadí, opakování, čárka): %s',
    (step, firstText, first, gap, secondText, second) => {
      expect(splitStepByDurations(step)).toEqual([
        { text: firstText, seconds: first },
        { text: gap, seconds: null },
        { text: secondText, seconds: second },
      ]);
    },
  );

  it('„1 h 30" (minuty bez jednotky) = jen „1 h"', () => {
    expect(splitStepByDurations('Péct 1 h 30')).toEqual([
      { text: 'Péct ', seconds: null },
      { text: '1 h', seconds: 3600 },
      { text: ' 30', seconds: null },
    ]);
  });

  it('nulový čas mezi dvěma časy spojení přeruší', () => {
    expect(splitStepByDurations('1 h 0 min 30 s').filter((s) => s.seconds != null)).toEqual([
      { text: '1 h', seconds: 3600 },
      { text: '30 s', seconds: 30 },
    ]);
  });

  it('skloňovaná jednotka s diakritikou: „po 5 minutách" = „5 minut" (dnešní chování)', () => {
    expect(splitStepByDurations('Po 5 minutách otočit').filter((s) => s.seconds != null)).toEqual([
      { text: '5 minut', seconds: 300 },
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

  it('rozsah „1–1,5 h": klikací je horní mez', () => {
    const timed = splitStepByDurations('Péct 1–1,5 h').filter((s) => s.seconds != null);
    expect(timed).toEqual([{ text: '1,5 h', seconds: 5400 }]);
  });

  it('formatCountdown', () => {
    expect(formatCountdown(90 * 1000)).toBe('1:30');
    expect(formatCountdown(5 * 1000)).toBe('0:05');
    expect(formatCountdown(3600 * 1000)).toBe('1:00:00');
    expect(formatCountdown(-500)).toBe('0:00');
  });
});
