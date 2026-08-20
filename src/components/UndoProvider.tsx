import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { UndoContext, type UndoRequest } from './undoContext';

/**
 * Globální lišta „Vrátit zpět" po smazání. Je nad routerem, takže přežije i
 * přechod na jinou obrazovku (smazání receptu skočí na seznam, lišta zůstane).
 * Po chvíli sama zmizí a smazání platí.
 */

const UNDO_MS = 6000;

export function UndoProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<UndoRequest | null>(null);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setRequest(null);
  }, []);

  const showUndo = useCallback((next: UndoRequest) => {
    if (timer.current) window.clearTimeout(timer.current);
    setRequest(next);
    timer.current = window.setTimeout(() => {
      setRequest(null);
      timer.current = null;
    }, UNDO_MS);
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

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      {request ? (
        <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
          <div className="flex w-full max-w-sm items-center justify-between gap-3 rounded-full bg-stone-800 px-4 py-2.5 text-sm text-white shadow-lg">
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
