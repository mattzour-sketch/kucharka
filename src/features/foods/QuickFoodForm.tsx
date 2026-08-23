import { useState } from 'react';
import { type FoodBasis } from '../../db';
import { parseDecimal } from '../../lib/num';
import { createFood } from './foodsRepo';

/**
 * Rychlé inline založení potraviny přímo z výběru (FoodPicker): jen název + energie
 * na 100 g/ml a přepínač jednotky. Makra, značku i hmotnost kusu se doplní případně
 * později v plné editaci potraviny. Po úspěchu volá `onCreated(newId)`.
 */
export default function QuickFoodForm({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string;
  onCreated: (foodId: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [kcal, setKcal] = useState('');
  const [basis, setBasis] = useState<FoodBasis>('g');
  const [error, setError] = useState('');

  async function handleCreate() {
    if (name.trim() === '') {
      setError('Doplň název.');
      return;
    }
    const energyKcal = parseDecimal(kcal);
    if (energyKcal === null || energyKcal < 0) {
      setError('Doplň energii (kcal na 100 g).');
      return;
    }
    const id = await createFood({
      name: name.trim(),
      basis,
      energyKcal,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
    onCreated(id);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoFocus={initialName.trim() === ''}
        placeholder="Název"
        className="w-full border-b border-stone-200 bg-transparent py-2 text-lg font-medium outline-none placeholder:text-stone-400 focus:border-brand"
      />

      <div className="flex items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="text-xs text-stone-500">Energie (kcal na 100 {basis})</span>
          <input
            value={kcal}
            onChange={(event) => setKcal(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleCreate();
            }}
            autoFocus={initialName.trim() !== ''}
            inputMode="decimal"
            placeholder="0"
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-brand"
          />
        </label>
        <div className="flex items-center gap-1 pb-1">
          {(['g', 'ml'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBasis(option)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                basis === option ? 'bg-brand text-white' : 'border border-stone-200 text-stone-600'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCreate()}
          className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
        >
          Založit a napojit
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
        >
          Zpět
        </button>
      </div>
    </div>
  );
}
