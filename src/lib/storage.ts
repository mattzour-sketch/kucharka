/**
 * Trvalé úložiště. V lokální variantě žijí data jen v tomhle prohlížeči, takže
 * žádáme prohlížeč, ať data nemaže (Safari/iOS umí odklidit data málo
 * používaného webu). Po instalaci na plochu to prohlížeče většinou povolí.
 * Skutečnou pojistkou proti ztrátě zůstává export (viz backup.ts, NF-4).
 */

export async function ensurePersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}
