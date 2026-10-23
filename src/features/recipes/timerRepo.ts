import { db, type Timer } from '../../db';
import { newId } from '../../lib/id';
import { isStaleTimer } from '../../lib/timers';

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

/** Zapomenuté časovače z minulého vaření (doběhly před hodinami) tiše smaže. */
export async function removeStaleTimers(now: number = Date.now()): Promise<void> {
  const stale = (await db.timers.toArray()).filter((timer) => isStaleTimer(timer.endsAt, now));
  if (stale.length > 0) await db.timers.bulkDelete(stale.map((timer) => timer.id));
}

/** Zrušení časovačů při Hotovo; vrácené záznamy jdou přes `restoreTimers` vrátit zpět. */
export async function removeTimers(timers: Timer[]): Promise<void> {
  await db.timers.bulkDelete(timers.map((timer) => timer.id));
}

export async function restoreTimers(timers: Timer[]): Promise<void> {
  await db.timers.bulkPut(timers);
}
