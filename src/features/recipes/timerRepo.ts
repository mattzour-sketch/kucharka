import { db, type Timer } from '../../db';
import { newId } from '../../lib/id';

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
