import { describe, expect, it } from 'vitest';
import { splitStepByDurations } from './duration';
import { parseTimeLine } from './recipeImportLines';

/** Review: spojené časy a konec regexu `(?![a-z])` místo `\b`. */

const timed = (step: string) =>
  splitStepByDurations(step).filter((segment) => segment.seconds != null);

describe('duration – spojené časy (review)', () => {
  it('text segmentů dá dohromady původní krok (nic se neztratí ani nepřidá)', () => {
    for (const step of [
      'Péct 1 h 30 min, pak 10 min odpočinout.',
      'Bake 1 hr 30 mins at 180 °C',
      'Vařit 1h30min a pak 2 h 5 s',
      'Po 5 minutách otočit, 12–15 minutes',
      'Bez času',
      '',
    ]) {
      expect(splitStepByDurations(step).map((segment) => segment.text).join('')).toBe(step);
    }
  });

  it('velká písmena („1 H 30 MIN") se spojí jako malá', () => {
    expect(timed('Péct 1 H 30 MIN')).toEqual([{ text: '1 H 30 MIN', seconds: 5400 }]);
  });

  it('„2 hodiny 15 minut" = 8100 s', () => {
    expect(timed('Dusit 2 hodiny 15 minut')).toEqual([{ text: '2 hodiny 15 minut', seconds: 8100 }]);
  });

  it('„1 h 30 s" (vynechané minuty, ale pořadí sedí) = jeden úsek', () => {
    expect(timed('Vařit 1 h 30 s')).toEqual([{ text: '1 h 30 s', seconds: 3630 }]);
  });

  it('„1 h 1 h" (opakování) se nespojí', () => {
    expect(timed('1 h 1 h')).toEqual([
      { text: '1 h', seconds: 3600 },
      { text: '1 h', seconds: 3600 },
    ]);
  });

  it('rozsah za hodinou („1 h 10–15 min") se nespojí, klikací je horní mez', () => {
    expect(timed('Péct 1 h 10–15 min')).toEqual([
      { text: '1 h', seconds: 3600 },
      { text: '15 min', seconds: 900 },
    ]);
  });

  it('tečka mezi časy spojení zabrání („1 h. 30 min")', () => {
    expect(timed('Péct 1 h. 30 min odpočinout')).toHaveLength(2);
  });

  it('„1h30" bez jednotky minut = jen „1h" (nové chování díky `(?![a-z])`)', () => {
    expect(timed('Péct 1h30')).toEqual([{ text: '1h', seconds: 3600 }]);
  });

  it('jednotka hned před písmenem bez diakritiky se nebere („2 hrnky" ani „5 mouky")', () => {
    expect(timed('Přidej 2 hrnky mléka')).toEqual([]);
    expect(timed('5 mouky')).toEqual([]);
  });

  it('desetinný čas se spojí s minutami („1,5 h 10 min")', () => {
    expect(timed('Péct 1,5 h 10 min')).toEqual([{ text: '1,5 h 10 min', seconds: 6000 }]);
  });
});

describe('parseTimeLine – doba přípravy se spojenými časy (review)', () => {
  it.each([
    ['Prep: 1h30min', 90],
    ['Cook time: 2 hrs 15 mins', 135],
    ['Doba přípravy: 1 hodina 30 minut', 90],
    ['Prep: 1 h a 30 min', 90],
    ['Total: 1 hour and 30 minutes', 90],
  ])('%s → %d min', (line, minutes) => {
    const entries = parseTimeLine(line);
    expect(entries?.[0]?.minutes).toBe(minutes);
  });

  it('„Prep: 10 min | Cook: 1 h 30 min" – dva údaje', () => {
    expect(parseTimeLine('Prep: 10 min | Cook: 1 h 30 min')).toEqual([
      { kind: 'prep', minutes: 10 },
      { kind: 'cook', minutes: 90 },
    ]);
  });
});
