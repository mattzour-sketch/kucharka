import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { isBackupReminderDue, readLastBackupAt, subscribeLastBackup } from '../../lib/backupStatus';

/** Poslední záloha + jestli ji připomenout (tečka u „Víc" i v sekci Záloha). */
export function useBackupReminder(): { lastBackupAt: string | null; due: boolean } {
  const lastBackupAt = useSyncExternalStore(subscribeLastBackup, readLastBackupAt);
  const recipeCount = useLiveQuery(() => db.recipes.filter((recipe) => !recipe.deletedAt).count(), []);
  return {
    lastBackupAt,
    due: recipeCount !== undefined && isBackupReminderDue(lastBackupAt, recipeCount),
  };
}
