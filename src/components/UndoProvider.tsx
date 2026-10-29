import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UndoContext, type UndoRequest } from './undoContext';

/**
 * Globální lišta „Vrátit zpět" po smazání. Je nad routerem, takže přežije i
 * přechod na jinou obrazovku (smazání receptu skočí na seznam, lišta zůstane).
 * Po chvíli sama zmizí a smazání platí.
 */

const UNDO_MS = 6000;
/** Výchozí odstup lišty od spodku (nad spodní lištou záložek). */
const BASE_BOTTOM_PX = 80;
/** Mezera mezi lištou a tím, co je pod ní (dock časovačů). */
const INSET_GAP_PX = 8;

interface ActiveRequest extends UndoRequest {
  id: number;
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ActiveRequest | null>(null);
  const [bottomInset, setBottomInsetState] = useState(0);
  const timer = useRef<number | null>(null);
  const nextId = useRef(0);
  const currentId = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    currentId.current = null;
    setRequest(null);
  }, []);

  const showUndo = useCallback(
    (next: UndoRequest) => {
      if (timer.current) window.clearTimeout(timer.current);
      nextId.current += 1;
      const id = nextId.current;
      currentId.current = id;
      setRequest({ ...next, id });
      timer.current = window.setTimeout(() => {
        currentId.current = null;
        setRequest(null);
        timer.current = null;
      }, UNDO_MS);
      return () => {
        if (currentId.current === id) clear();
      };
    },
    [clear],
  );

  const setBottomInset = useCallback((px: number) => {
    setBottomInsetState(Math.max(0, Math.round(px)));
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleUndo = useCallback(async () => {
    if (!request) return;
    const run = request.undo;
    clear();
    await run();
  }, [request, clear]);

  // Stabilní hodnota: změna insetu nepřekreslí všechny `useUndo()` obrazovky.
  const value = useMemo(() => ({ showUndo, setBottomInset }), [showUndo, setBottomInset]);
  const bottom = Math.max(BASE_BOTTOM_PX, bottomInset + INSET_GAP_PX);

  return (
    <UndoContext.Provider value={value}>
      {children}
      {request ? (
        <div
          className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
          style={{ bottom: `${bottom}px` }}
        >
          <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-full bg-stone-800 px-4 py-2.5 text-sm text-white shadow-lg">
            <span className="min-w-0 truncate">{request.message}</span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void handleUndo()}
                className="rounded-full px-2 py-1 font-semibold text-amber-300 transition hover:text-amber-200"
              >
                Vrátit zpět
              </button>
              <button
                type="button"
                onClick={clear}
                aria-label="Zavřít"
                className="px-1 text-lg leading-none text-stone-400 transition hover:text-stone-200"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </UndoContext.Provider>
  );
}
