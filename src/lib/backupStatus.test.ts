import { describe, expect, it } from 'vitest';
import { isBackupReminderDue } from './backupStatus';

const now = new Date('2026-10-22T12:00:00');

describe('isBackupReminderDue', () => {
  it('bez receptů nepřipomíná, i když se nikdy nezálohovalo', () => {
    expect(isBackupReminderDue(null, 0, now)).toBe(false);
  });

  it('s recepty a bez zálohy připomíná', () => {
    expect(isBackupReminderDue(null, 3, now)).toBe(true);
  });

  it('čerstvá záloha nepřipomíná', () => {
    expect(isBackupReminderDue('2026-10-10T12:00:00', 3, now)).toBe(false);
  });

  it('přesně 30 dní ještě ne, 31 už ano', () => {
    expect(isBackupReminderDue('2026-09-22T12:00:00', 3, now)).toBe(false);
    expect(isBackupReminderDue('2026-09-21T12:00:00', 3, now)).toBe(true);
  });
});
