import { useEffect } from 'react';

/**
 * Drží displej rozsvícený, dokud je komponenta připojená (režim vaření, E-15).
 * Kde Screen Wake Lock API chybí nebo je odmítnuté, tiše nic nedělá (fallback).
 * Lock se uvolní při odchodu z obrazovky a znovu vezme při návratu na kartu.
 */

interface WakeLockSentinelLike {
  release(): Promise<void>;
}
interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

function getWakeLock(): WakeLockLike | undefined {
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
}

export function useWakeLock(): void {
  useEffect(() => {
    let released = false;
    let sentinel: WakeLockSentinelLike | null = null;

    async function acquire() {
      const wakeLock = getWakeLock();
      if (!wakeLock) return;
      try {
        const next = await wakeLock.request('screen');
        if (released) {
          void next.release().catch(() => {});
          return;
        }
        sentinel = next;
      } catch {
        // nepodporováno nebo odmítnuto – bez wake locku, nevadí
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && !released && !sentinel) {
        void acquire();
      }
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, []);
}
