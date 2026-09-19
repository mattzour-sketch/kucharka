import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Button, { type ButtonRole } from './Button';

function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter(
    (el) => !el.hasAttribute('disabled'),
  );
}

/**
 * Modální potvrzení nad obsahem. Používá se u rizikových akcí, kde uživatel musí
 * napřed vidět dopad a teprve pak potvrdit (UC030 obnova). Přes `createPortal`
 * do `document.body`, a11y (role dialog, Esc, fokus), tmavý režim.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Zrušit',
  confirmRole = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmRole?: ButtonRole;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // onCancel drž v refu, ať efekt závisí jen na `open` (jinak by se fokus vracel při každém renderu).
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Fokus dovnitř dialogu (poslední prvek = potvrzení), ať jde ovládat klávesnicí.
    const focusables = focusablesIn(panelRef.current);
    focusables[focusables.length - 1]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancelRef.current();
        return;
      }
      // Tab drží fokus uvnitř dialogu (jednoduchý trap).
      if (event.key === 'Tab') {
        const els = focusablesIn(panelRef.current);
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Po zavření vrať fokus na spouštěč.
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => {
        // Klik do ztmavlého pozadí = zrušit; klik do panelu ne.
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-xl outline-none dark:border-stone-700 dark:bg-stone-900"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-3 text-sm text-stone-600 dark:text-stone-300">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button role="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button role={confirmRole} onClick={onConfirm} disabled={busy}>
            {busy ? 'Pracuji…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
