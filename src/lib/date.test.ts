import { describe, expect, it } from 'vitest';
import {
  daysSince,
  formatCzechDate,
  formatCzechDateTime,
  formatRelativeDays,
  toLocalIsoDate,
  todayIso,
} from './date';

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

describe('date – záloha (UC030)', () => {
  const now = new Date('2026-09-13T12:00:00.000Z');

  it('daysSince počítá celé dny do minulosti', () => {
    expect(daysSince('2026-09-13T00:00:00.000Z', now)).toBe(0);
    expect(daysSince('2026-09-10T12:00:00.000Z', now)).toBe(3);
    expect(daysSince('nesmysl', now)).toBe(0);
  });

  it('formatRelativeDays dává český relativní čas', () => {
    expect(formatRelativeDays('2026-09-13T09:00:00.000Z', now)).toBe('dnes');
    expect(formatRelativeDays('2026-09-12T09:00:00.000Z', now)).toBe('včera');
    expect(formatRelativeDays('2026-09-10T12:00:00.000Z', now)).toBe('před 3 dny');
    expect(formatRelativeDays('2026-09-06T12:00:00.000Z', now)).toBe('před týdnem');
    expect(formatRelativeDays('2026-08-30T12:00:00.000Z', now)).toBe('před 2 týdny');
    expect(formatRelativeDays('2026-07-15T12:00:00.000Z', now)).toBe('před 2 měsíci');
    expect(formatRelativeDays('2025-08-01T12:00:00.000Z', now)).toBe('před rokem');
  });

  it('formatCzechDateTime ukáže datum i čas (lokální)', () => {
    expect(formatCzechDateTime('2026-09-13T14:30:00')).toBe('13. 9. 2026 14:30');
    expect(formatCzechDateTime('2026-09-13T09:05:00')).toBe('13. 9. 2026 9:05');
  });
});
