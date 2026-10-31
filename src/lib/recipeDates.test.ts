import { describe, expect, it } from 'vitest';
import { recipeDateLine, updatedLabel } from './recipeDates';

describe('recipeDateLine', () => {
  it('neuvařený recept ukáže jen datum zapsání', () => {
    expect(recipeDateLine('2026-08-02', [])).toBe('zapsáno 2. 8. 2026');
  });

  it('jednou uvařený bez počtu, víckrát s počtem a posledním dnem', () => {
    expect(recipeDateLine('2026-08-02', ['2026-09-10'])).toBe('zapsáno 2. 8. 2026 · uvařeno 10. 9. 2026');
    expect(recipeDateLine('2026-08-02', ['2026-10-28', '2026-08-15', '2026-09-01', '2026-10-01'])).toBe(
      'zapsáno 2. 8. 2026 · uvařeno 4×, naposledy 28. 10. 2026',
    );
  });
});

describe('updatedLabel', () => {
  it('den úpravy v lokálním čase', () => {
    const lateEvening = new Date(2026, 9, 30, 23, 50).toISOString();
    expect(updatedLabel(lateEvening)).toBe('upraveno 30. 10. 2026');
  });
});
