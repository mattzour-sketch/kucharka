import { useEffect, useRef } from 'react';

/**
 * Gesto/tlačítko Zpět zavře otevřený překryv (fotka, výběr potraviny), ne celou
 * obrazovku. Při otevření přidá do historie krok se stejnou adresou; Zpět ho odebere
 * a zavolá `onClose`. Zavření tlačítkem v překryvu ten krok uklidí přes `history.back()`.
 * Krok se přidává až v dalším tiku – StrictMode efekt hned zruší a znovu spustí, a
 * okamžitý `back()` by pak sebral krok i druhému běhu.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const marker = Math.random().toString(36).slice(2);
    let pushed = false;
    let popped = false;

    function isOurs(): boolean {
      const state: unknown = window.history.state;
      return typeof state === 'object' && state !== null && (state as { overlay?: string }).overlay === marker;
    }
    function onPop() {
      if (!pushed || isOurs()) return;
      popped = true;
      onCloseRef.current();
    }

    const timer = setTimeout(() => {
      // Stav routeru (klíč, index) zůstává – router tak nepozná žádnou změnu adresy.
      const state: unknown = window.history.state;
      const base = typeof state === 'object' && state !== null ? state : {};
      window.history.pushState({ ...base, overlay: marker }, '');
      pushed = true;
    });
    window.addEventListener('popstate', onPop);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', onPop);
      if (pushed && !popped && isOurs()) window.history.back();
    };
  }, [open]);
}
