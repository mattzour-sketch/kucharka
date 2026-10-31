import { describe, expect, it } from 'vitest';
import { formatRecentDate } from './date';
import { recipeDateLine, updatedLabel } from './recipeDates';

const TODAY = '2026-10-31';

describe('recipeDateLine', () => {
  it('neuvařený recept ukáže jen datum zapsání', () => {
    expect(recipeDateLine('2026-08-02', [], TODAY)).toBe('zapsáno 2. 8. 2026');
  });

  it('jednou uvařený bez počtu, víckrát s počtem a posledním dnem', () => {
    expect(recipeDateLine('2026-08-02', ['2026-09-10'], TODAY)).toBe(
      'zapsáno 2. 8. 2026 · uvařeno 10. 9. 2026',
    );
    expect(
      recipeDateLine('2026-08-02', ['2026-10-28', '2026-08-15', '2026-09-01', '2026-10-01'], TODAY),
    ).toBe('zapsáno 2. 8. 2026 · uvařeno 4×, naposledy před 3 dny');
  });

  it('čerstvá data slovy', () => {
    expect(recipeDateLine(TODAY, [TODAY], TODAY)).toBe('zapsáno dnes · uvařeno dnes');
  });
});

describe('updatedLabel', () => {
  it('den úpravy v lokálním čase', () => {
    const lateEvening = new Date(2026, 9, 30, 23, 50).toISOString();
    expect(updatedLabel(lateEvening, TODAY)).toBe('upraveno včera');
    expect(updatedLabel(lateEvening, '2026-11-20')).toBe('upraveno 30. 10. 2026');
  });
});

describe('formatRecentDate', () => {
  it.each([
    ['2026-10-31', 'dnes'],
    ['2026-10-30', 'včera'],
    ['2026-10-29', 'před 2 dny'],
    ['2026-10-25', 'před 6 dny'],
    ['2026-10-24', '24. 10. 2026'],
    ['2026-11-01', '1. 11. 2026'],
  ])('%s → %s', (iso, label) => {
    expect(formatRecentDate(iso, TODAY)).toBe(label);
  });

  it('přes přechod na zimní čas a přes rok', () => {
    expect(formatRecentDate('2026-10-24', '2026-10-25')).toBe('včera');
    expect(formatRecentDate('2025-12-31', '2026-01-01')).toBe('včera');
  });
});
