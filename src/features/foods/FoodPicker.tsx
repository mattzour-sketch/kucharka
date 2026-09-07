import { useState } from 'react';
import FoodPickList from './FoodPickList';
import Button from '../../components/ui/Button';

/**
 * Vyhledání a výběr potraviny pro napojení suroviny (overlay). Používá režim vaření.
 * Tělo (hledání + založení + seznam) je sdílené ve `FoodPickList`; tady jen overlay
 * a hledací pole. Na obrazovce Kalorie se místo něj používá `LinkPicker` (i podrecept).
 */
export default function FoodPicker({
  onSelect,
  onClose,
}: {
  onSelect: (foodId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white">
      <header className="border-b border-stone-200 p-3">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            placeholder="hledat potravinu…"
            className="min-w-0 flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm outline-none focus:border-brand"
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
