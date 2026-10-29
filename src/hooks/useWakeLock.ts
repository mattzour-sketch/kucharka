import { useEffect } from 'react';
import { keepScreenAwake, type WakeLockLike } from '../lib/wakeLock';

/**
 * Drží displej rozsvícený, dokud je komponenta připojená (režim vaření, E-15).
 * Kde Screen Wake Lock API chybí nebo je odmítnuté, tiše nic nedělá (fallback).
 * Logika (uvolnění při skrytí, nový zámek po návratu) je v `lib/wakeLock.ts`.
 */

function getWakeLock(): WakeLockLike | undefined {
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
}

export function useWakeLock(): void {
  useEffect(() => keepScreenAwake(getWakeLock(), document), []);
}
