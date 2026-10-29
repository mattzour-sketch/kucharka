import { db, type Timer } from '../../db';
import { newId } from '../../lib/id';
import { isTimerGone, snoozedEndsAt } from '../../lib/timers';

/** Časovače vaření (§7). Ukládá se cílový čas, ne zbývající sekundy. */

export function getTimers(): Promise<Timer[]> {
  return db.timers.orderBy('endsAt').toArray();
}

export async function addTimer(label: string, seconds: number): Promise<void> {
  const now = Date.now();
  await db.timers.add({
    id: newId(),
    label,
    endsAt: new Date(now + seconds * 1000).toISOString(),
    createdAt: new Date(now).toISOString(),
  });
}

export async function removeTimer(id: string): Promise<void> {
  await db.timers.delete(id);
}

/** Zastavení doběhlého časovače: přestane zvonit, ale chvíli zůstane v liště (viz `isTimerGone`). */
export async function silenceTimer(id: string, now: number = Date.now()): Promise<void> {
  await db.timers.update(id, { silencedAt: new Date(now).toISOString() });
}

/** „+5 min": tentýž záznam znovu běží 5 minut od teď (zvonění i ztlumení se zruší). */
export async function snoozeTimer(id: string, now: number = Date.now()): Promise<void> {
  await db.timers.update(id, { endsAt: snoozedEndsAt(now), silencedAt: null });
}

/**
 * Zapomenuté časovače z minulého vaření a zastavené po lhůtě tiše smaže. Čtení i mazání
 * v jedné transakci: časovač, který mezitím dostal „+5 min", se nesmaže.
 * (`silenceTimer`/`snoozeTimer` jsou jedno `update`, to je atomické samo.)
 */
export async function removeGoneTimers(now: number = Date.now()): Promise<void> {
  await db.transaction('rw', db.timers, async () => {
    const gone = (await db.timers.toArray()).filter((timer) => isTimerGone(timer, now));
    if (gone.length > 0) await db.timers.bulkDelete(gone.map((timer) => timer.id));
  });
}

/** Zrušení časovačů při Hotovo; vrácené záznamy jdou přes `restoreTimers` vrátit zpět. */
export async function removeTimers(timers: Timer[]): Promise<void> {
  await db.timers.bulkDelete(timers.map((timer) => timer.id));
}

export async function restoreTimers(timers: Timer[]): Promise<void> {
  await db.timers.bulkPut(timers);
}
