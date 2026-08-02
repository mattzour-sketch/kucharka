import { describe, expect, it } from 'vitest';
import { formatCzechDate, toLocalIsoDate, todayIso } from './date';

describe('date', () => {
  it('používá lokální složky – večer se neposune na zítřek (E-07)', () => {
    // 2. 8. 2026, 23:50 lokálního času
    const d = new Date(2026, 7, 2, 23, 50, 0);
    expect(toLocalIsoDate(d)).toBe('2026-08-02');
  });

  it('doplňuje vedoucí nuly u měsíce a dne', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('todayIso má formát YYYY-MM-DD', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formatCzechDate převádí na český formát', () => {
    expect(formatCzechDate('2026-08-02')).toBe('2. 8. 2026');
    expect(formatCzechDate('2026-12-25')).toBe('25. 12. 2026');
  });
});
