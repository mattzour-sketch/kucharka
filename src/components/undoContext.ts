import { createContext, useContext } from 'react';

/** Sdílený kontext lišty „Vrátit zpět" (viz `UndoProvider`). */

export interface UndoRequest {
  message: string;
  undo: () => void | Promise<void>;
}

export interface UndoContextValue {
  /** Ukáže lištu. Vrací „zavři ji, pokud je to pořád tahle" (jinou lištu nezavře). */
  showUndo: (request: UndoRequest) => () => void;
  /** Kolik px odspodu zabírá něco pevného (lišta časovačů); lišta „Vrátit zpět" sedne nad to. */
  setBottomInset: (px: number) => void;
}

export const UndoContext = createContext<UndoContextValue | null>(null);

export function useUndo(): UndoContextValue {
  const context = useContext(UndoContext);
  if (!context) throw new Error('useUndo musí být uvnitř <UndoProvider>.');
  return context;
}
