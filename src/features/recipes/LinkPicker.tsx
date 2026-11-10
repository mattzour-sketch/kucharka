import { useEffect, useRef, useState } from 'react';
import { extractFoodQuery } from '../../lib/foodMatch';
import FoodPickList from '../foods/FoodPickList';
import RecipePickList from './RecipePickList';
import Button from '../../components/ui/Button';
import Segmented from '../../components/ui/Segmented';
import { useBackToClose } from '../../hooks/useBackToClose';
import { FIELD } from '../../components/ui/styles';
import { cx } from '../../components/ui/cx';

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
  useBackToClose(true, onClose);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white dark:bg-stone-950">
      <header className="border-b border-stone-200/80 p-3 dark:border-stone-800">
        {context ? <p className="mb-2 truncate text-sm text-stone-500 dark:text-stone-400">{context}</p> : null}
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            ref={inputRef}
            autoFocus
            placeholder={mode === 'food' ? 'hledat potravinu…' : 'hledat recept…'}
            className={cx(FIELD, 'h-11 min-w-0 flex-1 px-3 text-base')}
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
