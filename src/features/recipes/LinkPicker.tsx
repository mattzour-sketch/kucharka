import { useState } from 'react';
import FoodPickList from '../foods/FoodPickList';
import RecipePickList from './RecipePickList';
import Button from '../../components/ui/Button';
import Segmented from '../../components/ui/Segmented';

/** Co picker vrátí: buď potravinu, nebo podrecept (nikdy oboje). */
export type LinkTarget =
  | { kind: 'food'; foodId: string }
  | { kind: 'recipe'; subRecipeId: string };

type Mode = 'food' | 'recipe';

/**
 * Sjednocený výběr napojení suroviny (UC016): potravina NEBO recept (podrecept),
 * přepínač v hlavičce. Sdílené hledací pole; tělo dle režimu (`FoodPickList` /
 * `RecipePickList`). Vrací `LinkTarget`, dosazení řeší volající.
 */
export default function LinkPicker({
  currentRecipeId,
  onSelect,
  onClose,
  initialMode = 'food',
}: {
  currentRecipeId: string;
  onSelect: (target: LinkTarget) => void;
  onClose: () => void;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState('');

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white">
      <header className="border-b border-stone-200 p-3">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            placeholder={mode === 'food' ? 'hledat potravinu…' : 'hledat recept…'}
            className="min-w-0 flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm outline-none focus:border-brand"
          />
          <Button role="ghost" onClick={onClose}>
            Zavřít
          </Button>
        </div>
        <div className="mt-2">
          <Segmented
            value={mode}
            onChange={setMode}
            ariaLabel="Typ napojení"
            options={[
              { value: 'food', label: 'Potravina' },
              { value: 'recipe', label: 'Recept' },
            ]}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {mode === 'food' ? (
          <FoodPickList query={query} onSelect={(foodId) => onSelect({ kind: 'food', foodId })} />
        ) : (
          <RecipePickList
            currentRecipeId={currentRecipeId}
            query={query}
            onSelect={(subRecipeId) => onSelect({ kind: 'recipe', subRecipeId })}
          />
        )}
      </div>
    </div>
  );
}
