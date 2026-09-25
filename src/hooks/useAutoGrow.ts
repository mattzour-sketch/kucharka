import { useLayoutEffect, useRef } from 'react';

/**
 * Textové pole roste s obsahem (žádný scroll uvnitř pole – na mobilu je scroll ve scrollu
 * nepoužitelný). Výška se přepočítá při každé změně hodnoty; `min-h-*` z třídy dál platí.
 */
export function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [value]);
  return ref;
}
