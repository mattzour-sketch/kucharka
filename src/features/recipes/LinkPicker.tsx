import { useEffect, useRef, useState } from 'react';
import { extractFoodQuery } from '../../lib/foodMatch';
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
 * `RecipePickList`). Vrací `LinkTarget`, dosazení řeší volající. `context` = text
 * suroviny, kterou napojuju: je vidět nahoře a název z něj předvyplní hledání
 * (označený, ať jde hned přepsat).
 */
export default function LinkPicker({
  currentRecipeId,
  onSelect,
  onClose,
  initialMode = 'food',
  context,
}: {
  currentRecipeId: string;
  onSelect: (target: LinkTarget) => void;
  onClose: () => void;
  initialMode?: Mode;
  context?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState(() => (context ? extractFoodQuery(context) : ''));
  const inputRef = useRef<HTMLInputElement>(null);
  // Předvyplněný název označit, ať ho první písmeno přepíše.
  useEffect(() => inputRef.current?.select(), []);

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
            placeholder={mode === 'food' ? 'hledat potravinu…' : 'hledat recept…'}
            className="min-w-0 flex-1 rounded-full border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm outline-none focus:border-brand"
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
