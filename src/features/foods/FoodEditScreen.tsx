import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type FoodBasis } from '../../db';
import { parseDecimal } from '../../lib/num';
import { createFood, softDeleteFood, updateFood } from './foodsRepo';
import { restoreFood } from '../trash/trashRepo';
import { useUndo } from '../../components/undoContext';

/** Ruční založení a editace potraviny (F-02, F-04, F-08). Hodnoty na 100 g/ml. */
export default function FoodEditScreen() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(routeId);

  const existing = useLiveQuery(() => (routeId ? db.foods.get(routeId) : undefined), [routeId]);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [basis, setBasis] = useState<FoodBasis>('g');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [pieceGrams, setPieceGrams] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { showUndo } = useUndo();

  useEffect(() => {
    if (existing && loadedId !== existing.id) {
      setLoadedId(existing.id);
      setName(existing.name);
      setBrand(existing.brand ?? '');
      setBasis(existing.basis);
      setKcal(String(existing.energyKcal));
      setProtein(String(existing.proteinG));
      setCarbs(String(existing.carbsG));
      setFat(String(existing.fatG));
      setPieceGrams(existing.pieceGrams != null ? String(existing.pieceGrams) : '');
    }
  }, [existing, loadedId]);

  async function handleSave() {
    const energyKcal = parseDecimal(kcal);
    if (name.trim() === '') {
      setError('Doplň název potraviny.');
      return;
    }
    if (energyKcal === null || energyKcal < 0) {
      setError('Doplň energii (kcal na 100 g/ml).');
      return;
    }
    const payload = {
      name: name.trim(),
      brand: brand.trim() || null,
      basis,
      energyKcal,
      proteinG: parseDecimal(protein) ?? 0,
      carbsG: parseDecimal(carbs) ?? 0,
      fatG: parseDecimal(fat) ?? 0,
      pieceGrams: parseDecimal(pieceGrams),
    };
    if (routeId) {
      await updateFood(routeId, payload);
    } else {
      await createFood(payload);
    }
    navigate('/potraviny', { replace: true });
  }

  async function handleDelete() {
    if (!routeId) return;
    const foodId = routeId;
    await softDeleteFood(foodId);
    showUndo({ message: 'Potravina smazána', undo: () => restoreFood(foodId) });
    navigate('/potraviny', { replace: true });
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-2 py-2">
          <button
            type="button"
            onClick={() => navigate('/potraviny')}
            className="rounded-lg px-3 py-1.5 text-stone-500 transition hover:bg-stone-200/60"
            aria-label="Zavřít"
          >
            ✕
          </button>
          <span className="text-sm font-medium text-stone-600">
            {isEdit ? 'Upravit potravinu' : 'Nová potravina'}
          </span>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
          >
            Uložit
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Název (Rýže dlouhozrnná)"
          className="w-full border-b border-stone-200 bg-transparent py-2 text-lg font-medium outline-none placeholder:text-stone-400 focus:border-brand"
        />
        <input
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
          placeholder="Značka (nepovinné)"
          className="mt-2 w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-stone-400"
        />

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-stone-500">Hodnoty na 100</span>
          {(['g', 'ml'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBasis(option)}
              className={`rounded-full px-3 py-1 font-medium transition ${
                basis === option ? 'bg-brand text-white' : 'border border-stone-200 text-stone-600'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <NumberField label="Energie (kcal)" value={kcal} onChange={setKcal} />
          <NumberField label="Bílkoviny (g)" value={protein} onChange={setProtein} />
          <NumberField label="Sacharidy (g)" value={carbs} onChange={setCarbs} />
          <NumberField label="Tuky (g)" value={fat} onChange={setFat} />
        </div>

        <div className="mt-4">
          <NumberField
            label="Hmotnost 1 kusu (g) – nepovinné"
            value={pieceGrams}
            onChange={setPieceGrams}
          />
          <p className="mt-1 text-xs text-stone-400">
            Umožní zadat surovinu v kusech (1 vejce ≈ 60 g).
          </p>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        {isEdit ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="mt-8 w-full rounded-xl py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.99]"
          >
            Smazat potravinu
          </button>
        ) : null}
      </main>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-stone-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder="0"
        className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-brand"
      />
    </label>
  );
}
