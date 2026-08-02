import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { todayIso } from '../../lib/date';
import { createRecipe, updateRecipe } from './recipesRepo';

function snapshotOf(name: string, capturedOn: string, body: string): string {
  return JSON.stringify([name, capturedOn, body]);
}

/** Když uživatel nevyplní název, odvodíme ho z prvního řádku textu. */
function deriveName(body: string): string {
  const firstLine =
    body
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';
  return firstLine.length > 80 ? firstLine.slice(0, 80).trimEnd() : firstLine;
}

/**
 * Zachycení nového receptu i editace stávajícího (R-01 až R-03, R-05).
 * Koncept se ukládá průběžně do IndexedDB (SPEC 6.2), takže hovor ani pád
 * aplikace text nezahodí. Uložit jde kdykoliv, povinný je jen název – a ten
 * se v nouzi odvodí z textu.
 */
export default function RecipeEditScreen() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(routeId);

  const existing = useLiveQuery(() => (routeId ? db.recipes.get(routeId) : undefined), [routeId]);

  const [name, setName] = useState('');
  const [capturedOn, setCapturedOn] = useState(todayIso());
  const [body, setBody] = useState('');

  const idRef = useRef<string | null>(routeId ?? null);
  const loadedRef = useRef(!routeId); // nový recept je „načtený" hned
  const lastSaved = useRef('');

  // Načtení existujícího receptu do formuláře (jen jednou).
  useEffect(() => {
    if (routeId && existing && !loadedRef.current) {
      loadedRef.current = true;
      idRef.current = existing.id;
      setName(existing.name);
      setCapturedOn(existing.capturedOn);
      setBody(existing.rawCapture ?? '');
      lastSaved.current = snapshotOf(existing.name, existing.capturedOn, existing.rawCapture ?? '');
    }
  }, [routeId, existing]);

  async function persist(finalName?: string): Promise<string> {
    const payload = {
      name: finalName ?? name.trim(),
      capturedOn,
      rawCapture: body,
    };
    if (!idRef.current) {
      idRef.current = await createRecipe(payload);
    } else {
      await updateRecipe(idRef.current, payload);
    }
    return idRef.current;
  }

  // Průběžné ukládání konceptu (debounce).
  useEffect(() => {
    if (!loadedRef.current) return;
    const snapshot = snapshotOf(name, capturedOn, body);
    if (snapshot === lastSaved.current) return;

    const hasContent = name.trim() !== '' || body.trim() !== '';
    if (!idRef.current && !hasContent) return;

    const timer = setTimeout(() => {
      void persist().then(() => {
        lastSaved.current = snapshot;
      });
    }, 500);
    return () => clearTimeout(timer);
    // persist čte aktuální stav ze closure; závislosti jsou samotná pole.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, capturedOn, body]);

  async function handleSave() {
    const finalName = name.trim() || deriveName(body) || 'Bez názvu';
    if (finalName !== name) setName(finalName);
    const id = await persist(finalName);
    lastSaved.current = snapshotOf(finalName, capturedOn, body);
    navigate(`/recept/${id}`, { replace: true });
  }

  async function handleClose() {
    const hasContent = name.trim() !== '' || body.trim() !== '';
    if (idRef.current || hasContent) {
      const id = await persist();
      navigate(isEdit ? `/recept/${id}` : '/', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-2 py-2">
          <button
            type="button"
            onClick={() => void handleClose()}
            className="rounded-lg px-3 py-1.5 text-stone-500 transition hover:bg-stone-200/60"
            aria-label="Zavřít"
          >
            ✕
          </button>
          <span className="text-sm font-medium text-stone-600">
            {isEdit ? 'Upravit recept' : 'Nový recept'}
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

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Název receptu"
          className="w-full border-b border-stone-200 bg-transparent py-2 text-lg font-medium outline-none placeholder:text-stone-400 focus:border-brand"
        />
        <div className="mt-2 flex items-center gap-2 text-sm text-stone-500">
          <label htmlFor="capturedOn">Datum</label>
          <input
            id="capturedOn"
            type="date"
            value={capturedOn}
            onChange={(event) => setCapturedOn(event.target.value)}
            className="bg-transparent py-1.5 outline-none"
          />
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          autoFocus={!isEdit}
          placeholder={'Suroviny a postup, jak to slyšíš…\n\n4 velký brambory\n2 vejce\nhrst hladký mouky\n\nNastrouhat najemno, osmažit na sádle.'}
          className="mt-3 min-h-[45dvh] flex-1 resize-none rounded-2xl border border-stone-200 bg-white p-4 leading-relaxed outline-none placeholder:text-stone-300 focus:border-brand"
        />

        <p className="py-3 text-center text-xs text-stone-400">
          Ukládá se průběžně. Uložit jde kdykoliv, i s prázdným tělem.
        </p>
      </div>
    </div>
  );
}
