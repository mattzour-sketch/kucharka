import { useEffect, useMemo, useRef } from 'react';
import { useUndo } from '../../components/undoContext';
import {
  ingredientSplitLabel,
  proposeIngredientSplit,
  proposeStepSplit,
  stepSplitLabel,
} from '../../lib/lineSplit';

export type SplitKind = 'ingredients' | 'steps';

export interface SplitOfferState {
  /** Text nabídky („Rozdělit na 3 suroviny"); null = není co rozdělit. */
  label: string | null;
  /** Rozdělit pole a ukázat „Rozděleno" s „Vrátit zpět". */
  apply: () => void;
  /** Volat z `onChange` pole (jen uživatelský vstup): zavře „naši" lištu Vrátit. */
  noteEdit: () => void;
}

/**
 * Nabídka ručního rozdělení diktátu z jednoho řádku (suroviny / postup). Nic se nedělí
 * samo; rozdělení je jen úprava textu pole, takže průběžné ukládání i „Zahodit" fungují
 * beze změny. „Vrátit zpět" vrátí pole jen tehdy, když je pořád přesně výsledek
 * rozdělení – nic napsaného potom nesmaže. Lišta zmizí, jakmile se do pole začne psát.
 */
export function useSplitOffer(
  kind: SplitKind,
  value: string,
  update: (fn: (current: string) => string) => void,
): SplitOfferState {
  const { showUndo } = useUndo();
  const dismissRef = useRef<(() => void) | null>(null);

  const proposal = useMemo(
    () => (kind === 'ingredients' ? proposeIngredientSplit(value) : proposeStepSplit(value)),
    [kind, value],
  );
  const label = proposal
    ? kind === 'ingredients'
      ? ingredientSplitLabel(proposal.count)
      : stepSplitLabel(proposal.count)
    : null;

  function apply() {
    if (!proposal) return;
    const before = value;
    const after = proposal.text;
    update(() => after);
    dismissRef.current = showUndo({
      message: 'Rozděleno',
      undo: () => update((current) => (current === after ? before : current)),
    });
  }

  function noteEdit() {
    dismissRef.current?.();
    dismissRef.current = null;
  }

  // Odchod z obrazovky (Uložit, Zpět) lištu zavře – Vrátit by už nic nevrátilo.
  useEffect(
    () => () => {
      dismissRef.current?.();
      dismissRef.current = null;
    },
    [],
  );

  return { label, apply, noteEdit };
}
