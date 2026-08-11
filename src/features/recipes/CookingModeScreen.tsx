import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CookSession } from '../../db';
import { formatCzechDate } from '../../lib/date';
import { scaleQuantityText } from '../../lib/scale';
import { splitStepByDurations } from '../../lib/duration';
import { primeAlarm } from '../../lib/alarm';
import { useWakeLock } from '../../hooks/useWakeLock';
import { getRecipeItems } from './recipesRepo';
import { clearCookSession, getCookSession, saveCookSession } from './cookSessionRepo';
import { addTimer } from './timerRepo';
import CookingTimers from './CookingTimers';
import ServingsStepper from './ServingsStepper';

// Do téhle doby se odškrtnutí obnoví tiše; po delší době appka nabídne volbu (§6 [R]).
const STALE_MS = 3 * 60 * 60 * 1000;

/**
 * Režim vaření (R-22, 6.3): větší písmo, displej nezhasíná (wake lock),
 * suroviny jdou odškrtávat klepnutím. Odškrtnutí je stav sezení – přežije odchod
 * z appky (uloženo v Dexie); po delší době nabídne pokračovat/začít znovu (§6).
 */
export default function CookingModeScreen() {
  const { id } = useParams();
  const data = useLiveQuery(async () => {
    if (!id) return { recipe: null, items: [] };
    const recipe = (await db.recipes.get(id)) ?? null;
    const items = recipe ? await getRecipeItems(id) : [];
    return { recipe, items };
  }, [id]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [targetServings, setTargetServings] = useState<number | null>(null);
  const [stalePrompt, setStalePrompt] = useState<CookSession | null>(null);
  useEffect(() => setTargetServings(null), [id]);
  useWakeLock();

  // Načtení rozdělaného vaření: čerstvé obnovit tiše, staré nabídnout.
  useEffect(() => {
    setChecked({});
    setStalePrompt(null);
    if (!id) return;
    let cancelled = false;
    void getCookSession(id).then((session) => {
      if (cancelled || !session || session.checkedItemIds.length === 0) return;
      if (Date.now() - Date.parse(session.updatedAt) < STALE_MS) {
        setChecked(Object.fromEntries(session.checkedItemIds.map((itemId) => [itemId, true])));
      } else {
        setStalePrompt(session);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (data === undefined) return null;
  const { recipe, items } = data;
  if (!recipe || recipe.deletedAt) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-stone-500">Recept nenalezen.</p>
        <Link to="/" className="text-sm font-medium text-brand">
          Zpět na seznam
        </Link>
      </div>
    );
  }

  function toggleItem(itemId: string) {
    const next = { ...checked, [itemId]: !(checked[itemId] ?? false) };
    setChecked(next);
    // Během nabídky (staré vaření) neukládáme, ať se původní sezení nepřepíše.
    if (id && !stalePrompt) {
      void saveCookSession(
        id,
        Object.keys(next).filter((key) => next[key]),
      );
    }
  }

  function continueSession() {
    if (!stalePrompt || !id) return;
    setChecked(Object.fromEntries(stalePrompt.checkedItemIds.map((itemId) => [itemId, true])));
    void saveCookSession(id, stalePrompt.checkedItemIds);
    setStalePrompt(null);
  }

  function restartSession() {
    if (!id) return;
    setChecked({});
    void clearCookSession(id);
    setStalePrompt(null);
  }

  const steps = (recipe.instructions ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const baseServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  const targetPortions = targetServings ?? baseServings;
  const scaleFactor = targetPortions / baseServings;

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-2 py-2">
          <Link
            to={`/recept/${recipe.id}`}
            className="rounded-lg px-3 py-1.5 text-lg text-stone-500 transition hover:bg-stone-100"
            aria-label="Zpět na recept"
          >
            ‹
          </Link>
          <span className="truncate text-sm font-medium text-stone-600">{recipe.name}</span>
          <span className="w-9" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <CookingTimers />

        {stalePrompt ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              Rozdělané vaření z {formatCzechDate(stalePrompt.updatedAt.slice(0, 10))}. Pokračovat,
              nebo začít znovu?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={continueSession}
                className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
              >
                Pokračovat
              </button>
              <button
                type="button"
                onClick={restartSession}
                className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
              >
                Začít znovu
              </button>
            </div>
          </div>
        ) : null}

        {items.length > 0 ? (
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
                Suroviny
              </h2>
              <ServingsStepper
                value={targetPortions}
                onStep={(delta) =>
                  setTargetServings((prev) => Math.max(1, (prev ?? baseServings) + delta))
                }
              />
            </div>
            <ul className="mt-2">
              {items.map((item) => {
                const isChecked = checked[item.id] ?? false;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className="flex w-full items-center gap-3 rounded-xl py-3 text-left text-lg transition active:bg-stone-100"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                          isChecked
                            ? 'border-brand bg-brand text-white'
                            : 'border-stone-300 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span className={isChecked ? 'text-stone-400 line-through' : ''}>
                        {scaleQuantityText(item.rawText, scaleFactor)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {steps.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Postup</h2>
            <ol className="mt-2 space-y-4">
              {steps.map((step, index) => (
                <li key={index} className="flex gap-3 text-lg leading-relaxed">
                  <span className="shrink-0 font-semibold text-brand">{index + 1}.</span>
                  <span>
                    {splitStepByDurations(step).map((segment, segIndex) => {
                      if (segment.seconds == null) {
                        return <span key={segIndex}>{segment.text}</span>;
                      }
                      const seconds = segment.seconds;
                      return (
                        <button
                          key={segIndex}
                          type="button"
                          onClick={() => {
                            primeAlarm();
                            void addTimer(`Krok ${index + 1}`, seconds);
                          }}
                          className="rounded bg-brand/10 px-1 font-medium text-brand-dark underline decoration-dotted underline-offset-2"
                        >
                          {segment.text}
                        </button>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {items.length === 0 && steps.length === 0 ? (
          <p className="mt-6 text-stone-400">Recept zatím nemá suroviny ani postup.</p>
        ) : null}
      </main>
    </div>
  );
}
