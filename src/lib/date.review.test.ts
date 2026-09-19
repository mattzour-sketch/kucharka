import { describe, expect, it } from 'vitest';
import { STALE_BACKUP_DAYS, daysSince, formatRelativeDays } from './date';

/**
 * Review UC030: práh stárnutí zálohy. BackupSection značí zálohu jako starou při
 * `daysSince > STALE_BACKUP_DAYS`, tzn. 30 dní ještě NENÍ staré, 31 už ano
 * (Rozhodnutí bod 6 = 30 dní). Zamyká hranici, ať se nesveze na 29/30.
 */
describe('date – práh stárnutí zálohy (STALE_BACKUP_DAYS)', () => {
  const base = new Date('2026-09-13T12:00:00.000Z');
  const daysAgo = (n: number) => new Date(base.getTime() - n * 86_400_000).toISOString();

  it('práh je 30 dní', () => {
    expect(STALE_BACKUP_DAYS).toBe(30);
  });

  it('30 dní ještě není staré, 31 už ano', () => {
    expect(daysSince(daysAgo(30), base)).toBe(30);
    expect(daysSince(daysAgo(30), base) > STALE_BACKUP_DAYS).toBe(false);
    expect(daysSince(daysAgo(31), base)).toBe(31);
    expect(daysSince(daysAgo(31), base) > STALE_BACKUP_DAYS).toBe(true);
  });

  it('budoucí čas (posun hodin) se bere jako „dnes", ne záporné dny', () => {
    const future = new Date(base.getTime() + 5 * 3_600_000).toISOString();
    expect(daysSince(future, base)).toBeLessThanOrEqual(0);
    expect(formatRelativeDays(future, base)).toBe('dnes');
  });
});
