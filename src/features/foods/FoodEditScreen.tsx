import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type FoodBasis } from '../../db';
import { parseDecimal } from '../../lib/num';
import { createFood, softDeleteFood, updateFood } from './foodsRepo';
import { listPortions, reconcilePortions } from './foodPortionsRepo';
import { restoreFood } from '../trash/trashRepo';
import { useUndo } from '../../components/undoContext';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import Segmented from '../../components/ui/Segmented';
import { PortionNameDatalist } from '../../components/ui/AddPortionInline';
import { ABSURD_GRAMS, PORTION_DATALIST_ID } from '../../components/ui/portionLabels';

/** Řádek editoru měr – gramáž je zatím string (může být rozepsaná). */
interface PortionRow {
  id?: string;
  label: string;
  grams: string;
}

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
  const [portions, setPortions] = useState<PortionRow[]>([]);
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
      void listPortions(existing.id).then((rows) =>
        setPortions(rows.map((row) => ({ id: row.id, label: row.label, grams: String(row.grams) }))),
      );
    }
  }, [existing, loadedId]);

  function setPortionRow(index: number, patch: Partial<PortionRow>) {
    setPortions((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

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
    let foodId: string;
    if (routeId) {
      await updateFood(routeId, payload);
      foodId = routeId;
    } else {
      foodId = await createFood(payload);
    }
    // Domácí míry se ukládají až po potravině (potřebují foodId). Nevalidní řádky
    // se v plánu zahodí – uložení potraviny to nikdy nezablokuje (pravidlo 3).
    await reconcilePortions(
      foodId,
      portions.map((row) => ({ id: row.id, label: row.label, grams: parseDecimal(row.grams) })),
    );
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
      <ScreenHeader
        variant="stack"
        width="narrow"
        closeIcon
        onBack={() => navigate('/potraviny')}
        title={isEdit ? 'Upravit potravinu' : 'Nová potravina'}
        actions={
          <Button role="primary" onClick={() => void handleSave()}>
            Uložit
          </Button>
        }
      />

      <main className="mx-auto max-w-2xl px-4 py-4">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Název (Rýže dlouhozrnná)"
          className="w-full border-b border-stone-200 dark:border-stone-700 bg-transparent py-2 text-lg font-medium outline-none placeholder:text-stone-400 focus:border-brand"
        />
        <input
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
          placeholder="Značka (nepovinné)"
          className="mt-2 w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-stone-400"
        />

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-stone-500">Hodnoty na 100</span>
          <Segmented
            value={basis}
            onChange={setBasis}
            ariaLabel="Jednotka hodnot"
            options={[
              { value: 'g', label: 'g' },
              { value: 'ml', label: 'ml' },
            ]}
          />
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

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Domácí míry
            </span>
            <Button
              role="tint"
              onClick={() => setPortions((prev) => [...prev, { label: '', grams: '' }])}
            >
              + míra
            </Button>
          </div>
          <p className="mt-1 text-xs text-stone-400">
            Např. „lžíce" = 15 g. Pak jde surovinu zadat v mírách místo gramů.
          </p>
          {portions.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {portions.map((row, index) => {
                const g = parseDecimal(row.grams);
                const absurd = g != null && g > ABSURD_GRAMS;
                return (
                  <li key={row.id ?? `new-${index}`} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        value={row.label}
                        onChange={(event) => setPortionRow(index, { label: event.target.value })}
                        list={PORTION_DATALIST_ID}
                        placeholder="míra (lžíce)"
                        className="min-w-0 flex-1 rounded-lg border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-sm outline-none focus:border-brand"
                      />
                      <input
                        value={row.grams}
                        onChange={(event) => setPortionRow(index, { grams: event.target.value })}
                        inputMode="decimal"
                        placeholder="g"
                        aria-label="Gramů na 1 míru"
                        className="w-16 rounded-lg border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-right text-sm outline-none focus:border-brand"
                      />
                      <span className="text-xs text-stone-400">g</span>
                      <IconButton
                        size="sm"
                        tone="danger"
                        onClick={() => setPortions((prev) => prev.filter((_, i) => i !== index))}
                        aria-label="Odebrat míru"
                      >
                        ×
                      </IconButton>
                    </div>
                    {absurd ? (
                      <p className="pl-1 text-xs text-amber-600">{g} g na jednu míru, fakt?</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <PortionNameDatalist />
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        {isEdit ? (
          <div className="mt-8">
            <Button role="destructive" fullWidth onClick={() => void handleDelete()}>
              Smazat potravinu
            </Button>
          </div>
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
        className="mt-1 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 outline-none focus:border-brand"
      />
    </label>
  );
}
