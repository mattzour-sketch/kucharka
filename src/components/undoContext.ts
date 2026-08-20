import { createContext, useContext } from 'react';

/** Sdílený kontext lišty „Vrátit zpět" (viz `UndoProvider`). */

export interface UndoRequest {
  message: string;
  undo: () => void | Promise<void>;
}

export interface UndoContextValue {
  showUndo: (request: UndoRequest) => void;
}

export const UndoContext = createContext<UndoContextValue | null>(null);

export function useUndo(): UndoContextValue {
  const context = useContext(UndoContext);
  if (!context) throw new Error('useUndo musí být uvnitř <UndoProvider>.');
  return context;
}
