import { useEffect, useRef, useState } from 'react';
import { extractFoodQuery } from '../../lib/foodMatch';
import FoodPickList from './FoodPickList';
import Button from '../../components/ui/Button';
import { useBackToClose } from '../../hooks/useBackToClose';

/**
 * Vyhledání a výběr potraviny pro napojení suroviny (overlay). Používá režim vaření.
 * Tělo (hledání + založení + seznam) je sdílené ve `FoodPickList`; tady jen overlay
 * a hledací pole. Na obrazovce Kalorie se místo něj používá `LinkPicker` (i podrecept).
 * `context` = surovina, ke které se vybírá (vidět nahoře); `initialQuery` předvyplní
 * hledání (název vytažený z textu, označený, ať jde hned přepsat).
 */
export default function FoodPicker({
  onSelect,
  onClose,
  context,
  initialQuery = '',
}: {
  onSelect: (foodId: string) => void;
  onClose: () => void;
  context?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(() => (initialQuery ? extractFoodQuery(initialQuery) : ''));
  const inputRef = useRef<HTMLInputElement>(null);
  // Předvyplněný název označit, ať ho první písmeno přepíše.
  useEffect(() => inputRef.current?.select(), []);
  useBackToClose(true, onClose);
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white dark:bg-stone-900">
      <header className="border-b border-stone-200 dark:border-stone-700 p-3">
        {context ? <p className="mb-2 truncate text-sm text-stone-500">{context}</p> : null}
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            ref={inputRef}
            autoFocus
            placeholder="hledat potravinu…"
            className="min-w-0 flex-1 rounded-full border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm outline-none focus:border-brand"
          />
          <Button role="ghost" onClick={onClose}>
            Zavřít
          </Button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        <FoodPickList query={query} onSelect={onSelect} />
      </div>
    </div>
  );
}
