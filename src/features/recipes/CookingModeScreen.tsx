import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CookReplacement } from '../../db';
import { formatCzechDate } from '../../lib/date';
import { parseDecimal } from '../../lib/num';
import { scaleQuantityText } from '../../lib/scale';
import { splitStepByDurations } from '../../lib/duration';
import { primeAlarm } from '../../lib/alarm';
import { useWakeLock } from '../../hooks/useWakeLock';
import {
  addRecipeItem,
  deleteRecipeItem,
  getRecipeItems,
  updateRecipeItemText,
} from './recipesRepo';
import {
  clearCookSession,
  getCookSession,
  saveCookSession,
  type CookSessionState,
} from './cookSessionRepo';
import { addTimer } from './timerRepo';
import { addCookLog, getCookLogs } from './cookLogRepo';
import { applyReplacements, nutritionFromData, perPortionFromResult } from '../nutrition/recipeNutrition';
import FoodPicker from '../foods/FoodPicker';
import CookingTimers from './CookingTimers';
import ServingsStepper from './ServingsStepper';

// Do téhle doby se sezení obnoví tiše; po delší době appka nabídne volbu (§6 [R]).
const STALE_MS = 3 * 60 * 60 * 1000;

function keysOf(record: Record<string, boolean>): string[] {
  return Object.keys(record).filter((key) => record[key]);
}

/** Jemná odezva při odškrtnutí (kde to zařízení umí). */
function buzz(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(8);
  }
}

/**
 * Režim vaření (R-22, §6, §7, §8): velké písmo, displej nezhasíná (wake lock),
 * odškrtávání surovin, časovače, a odchylky (vypnout / změnit množství pro dnešek
 * bez sáhnutí do receptu). Stav sezení přežije odchod z appky.
 */
export default function CookingModeScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lastLog = useLiveQuery(
    () => (id ? getCookLogs(id).then((logs) => logs[0] ?? null) : Promise.resolve(null)),
    [id],
  );
  const data = useLiveQuery(async () => {
    const empty = { recipe: null, items: [], foods: [], recipes: [], allItems: [] };
    if (!id) return empty;
    const recipe = (await db.recipes.get(id)) ?? null;
    if (!recipe) return empty;
    const [items, foods, recipes, allItems] = await Promise.all([
      getRecipeItems(id),
      db.foods.toArray(),
      db.recipes.toArray(),
      db.recipeItems.toArray(),
    ]);
    return { recipe, items, foods, recipes, allItems };
  }, [id]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [targetServings, setTargetServings] = useState<number | null>(null);
  const [stalePrompt, setStalePrompt] = useState<CookSessionState | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState('');
  const [showFinish, setShowFinish] = useState(false);
  const [finishNote, setFinishNote] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  // §8 náhrady suroviny (jen tohle vaření). Klíč = id původní suroviny.
  const [replacements, setReplacements] = useState<Record<string, CookReplacement>>({});
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null);
  const [replText, setReplText] = useState('');
  const [replFoodId, setReplFoodId] = useState<string | null>(null);
  const [replAmount, setReplAmount] = useState('');
  const [replUnit, setReplUnit] = useState<'g' | 'ks'>('g');
  const [replPickerOpen, setReplPickerOpen] = useState(false);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  useEffect(() => setTargetServings(null), [id]);
  useWakeLock();

  // Načtení sezení: čerstvé obnovit tiše, staré nabídnout.
  useEffect(() => {
    setChecked({});
    setOff({});
    setOverrides({});
    setReplacements({});
    setReplacingItemId(null);
    setDoneSteps(new Set());
    setStalePrompt(null);
    setEditingItemId(null);
    if (!id) return;
    let cancelled = false;
    void getCookSession(id).then((session) => {
      if (cancelled || !session) return;
      const state: CookSessionState = {
        checkedItemIds: session.checkedItemIds,
        offItemIds: session.offItemIds ?? [],
        amountOverrides: session.amountOverrides ?? {},
        replacements: session.replacements ?? {},
        doneStepIndices: session.doneStepIndices ?? [],
      };
      const hasContent =
        state.checkedItemIds.length > 0 ||
        state.offItemIds.length > 0 ||
        Object.keys(state.amountOverrides).length > 0 ||
        Object.keys(state.replacements ?? {}).length > 0 ||
        (state.doneStepIndices ?? []).length > 0;
      if (!hasContent) return;
      if (Date.now() - Date.parse(session.updatedAt) < STALE_MS) {
        applyState(state);
      } else {
        setStalePrompt(state);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function applyState(state: CookSessionState) {
    setChecked(Object.fromEntries(state.checkedItemIds.map((itemId) => [itemId, true])));
    setOff(Object.fromEntries(state.offItemIds.map((itemId) => [itemId, true])));
    setOverrides(state.amountOverrides);
    setReplacements(state.replacements ?? {});
    setDoneSteps(new Set(state.doneStepIndices ?? []));
  }

  function persist(
    nextChecked: Record<string, boolean>,
    nextOff: Record<string, boolean>,
    nextOverrides: Record<string, string>,
    nextReplacements: Record<string, CookReplacement> = replacements,
    nextDoneSteps: Set<number> = doneSteps,
  ) {
    // Během nabídky (staré vaření) neukládáme, ať se původní sezení nepřepíše.
    if (!id || stalePrompt) return;
    void saveCookSession(id, {
      checkedItemIds: keysOf(nextChecked),
      offItemIds: keysOf(nextOff),
      amountOverrides: nextOverrides,
      replacements: nextReplacements,
      doneStepIndices: [...nextDoneSteps],
    });
  }

  if (data === undefined) return null;
  const { recipe, items, foods, recipes: allRecipes, allItems } = data;
  const foodMap = new Map(foods.map((food) => [food.id, food]));
  if (!recipe || recipe.deletedAt || !id) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-stone-500">Recept nenalezen.</p>
        <Link to="/" className="text-sm font-medium text-brand">
          Zpět na seznam
        </Link>
      </div>
    );
  }

  function toggleCheck(itemId: string) {
    const next = { ...checked, [itemId]: !(checked[itemId] ?? false) };
    setChecked(next);
    persist(next, off, overrides);
    buzz();
  }

  function toggleStep(index: number) {
    const next = new Set(doneSteps);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setDoneSteps(next);
    persist(checked, off, overrides, replacements, next);
    buzz();
  }

  function toggleOff(itemId: string) {
    const next = { ...off, [itemId]: !(off[itemId] ?? false) };
    // Vypnutí ruší případnou náhradu (vylučují se).
    const nextRepl = { ...replacements };
    if (next[itemId]) delete nextRepl[itemId];
    setOff(next);
    setReplacements(nextRepl);
    persist(checked, next, overrides, nextRepl);
    setEditingItemId(null);
  }

  function openReplace(itemId: string) {
    const existing = replacements[itemId];
    setReplacingItemId(itemId);
    setReplText(existing?.text ?? '');
    setReplFoodId(existing?.foodId ?? null);
    if (existing?.amountKs != null) {
      setReplUnit('ks');
      setReplAmount(String(existing.amountKs));
    } else {
      setReplUnit('g');
      setReplAmount(existing?.amountG != null ? String(existing.amountG) : '');
    }
    setEditingItemId(null);
  }

  function toggleReplUnit() {
    const pieceGrams = replFoodId ? (foodMap.get(replFoodId)?.pieceGrams ?? null) : null;
    if (!pieceGrams) return;
    const parsed = parseDecimal(replAmount);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    if (replUnit === 'g') {
      setReplUnit('ks');
      setReplAmount(parsed != null ? String(round2(parsed / pieceGrams)) : '');
    } else {
      setReplUnit('g');
      setReplAmount(parsed != null ? String(round2(parsed * pieceGrams)) : '');
    }
  }

  function saveReplacement(itemId: string) {
    const food = replFoodId ? foodMap.get(replFoodId) : undefined;
    const text = replText.trim() || food?.name || '';
    if (!text) {
      setReplacingItemId(null);
      return;
    }
    const parsed = parseDecimal(replAmount);
    let amountG: number | null = null;
    let amountKs: number | null = null;
    if (replUnit === 'ks') {
      amountKs = parsed;
      amountG = parsed != null && food?.pieceGrams ? parsed * food.pieceGrams : null;
    } else {
      amountG = parsed;
    }
    const nextRepl = {
      ...replacements,
      [itemId]: { text, foodId: replFoodId, amountG, amountKs },
    };
    // Náhrada ruší „vypnuto" (vylučují se).
    const nextOff = { ...off, [itemId]: false };
    setReplacements(nextRepl);
    setOff(nextOff);
    persist(checked, nextOff, overrides, nextRepl);
    setReplacingItemId(null);
  }

  function removeReplacement(itemId: string) {
    const nextRepl = { ...replacements };
    delete nextRepl[itemId];
    setReplacements(nextRepl);
    persist(checked, off, overrides, nextRepl);
    setReplacingItemId(null);
  }

  function saveOverride(itemId: string) {
    const value = overrideDraft.trim();
    const next = { ...overrides };
    if (value) next[itemId] = value;
    else delete next[itemId];
    setOverrides(next);
    persist(checked, off, next);
    setEditingItemId(null);
  }

  function openEdit(itemId: string) {
    setEditingItemId(itemId);
    setOverrideDraft(overrides[itemId] ?? '');
  }

  function continueSession() {
    if (!stalePrompt || !id) return;
    applyState(stalePrompt);
    void saveCookSession(id, stalePrompt);
    setStalePrompt(null);
  }

  function restartSession() {
    if (!id) return;
    setChecked({});
    setOff({});
    setOverrides({});
    setReplacements({});
    setReplacingItemId(null);
    setDoneSteps(new Set());
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

  // Průběh vaření: odškrtané suroviny (mimo vypnuté a nahrazené) + hotové kroky.
  const ingredientUnits = items.filter((item) => !(off[item.id] ?? false) && !replacements[item.id]);
  const checkedCount = ingredientUnits.filter((item) => checked[item.id]).length;
  const doneStepCount = steps.filter((_, index) => doneSteps.has(index)).length;
  const totalUnits = ingredientUnits.length + steps.length;
  const doneUnits = checkedCount + doneStepCount;
  const progressPct = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;
  const allDone = totalUnits > 0 && doneUnits === totalUnits;
  const currentStepIndex = steps.findIndex((_, index) => !doneSteps.has(index));
  const progressParts = [
    ingredientUnits.length > 0 ? `Suroviny ${checkedCount}/${ingredientUnits.length}` : null,
    steps.length > 0 ? `Postup ${doneStepCount}/${steps.length}` : null,
  ].filter(Boolean);

  function handleFinish() {
    if (!recipe || !id) return;
    const ingredients = items.map((item) => {
      const override = overrides[item.id];
      const replacement = replacements[item.id];
      return {
        text: override || scaleQuantityText(item.rawText, scaleFactor),
        off: off[item.id] ?? false,
        changed: Boolean(override),
        replacedWith: replacement ? replacement.text : null,
      };
    });
    // Kalorie té varianty: vynechané suroviny se odečtou, náhrady se přičtou (§8).
    const withRepl = applyReplacements(allItems, id, replacements);
    const result = nutritionFromData(
      id,
      { foods, recipes: allRecipes, items: withRepl.items },
      { skipItemIds: [...keysOf(off), ...withRepl.replacedIds] },
    );
    const perPortion = perPortionFromResult(result, recipe.servings);
    void addCookLog({
      recipeId: id,
      recipeName: recipe.name,
      portions: targetPortions,
      ingredients,
      note: finishNote.trim() || null,
      offItemIds: keysOf(off),
      amountOverrides: overrides,
      replacements,
      perPortion,
      nutrition: {
        connected: result.completeness.connected,
        countable: result.completeness.countable,
      },
    }).then(() => {
      if (id) void clearCookSession(id);
      navigate(`/recept/${id}`, { replace: true });
    });
  }

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
        {lastLog ? (
          <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
            Naposledy uvařeno {formatCzechDate(lastLog.cookedOn)}
            {lastLog.note ? ` · ${lastLog.note}` : ''}
          </div>
        ) : null}

        <CookingTimers />

        {stalePrompt ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              Rozdělané vaření. Pokračovat, nebo začít znovu?
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

        {totalUnits > 0 && !editMode && !stalePrompt ? (
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-stone-500">
              <span className={allDone ? 'text-brand-dark' : ''}>
                {allDone ? 'Hotovo 🎉' : `Hotovo ${progressPct} %`}
              </span>
              <span>{progressParts.join(' · ')}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : null}

        {items.length > 0 || editMode ? (
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
                Suroviny
              </h2>
              {editMode ? (
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
                >
                  Hotovo
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <ServingsStepper
                    value={targetPortions}
                    onStep={(delta) =>
                      setTargetServings((prev) => Math.max(1, (prev ?? baseServings) + delta))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="rounded-lg px-2 py-1.5 text-stone-400 transition hover:text-stone-600"
                    aria-label="Upravit suroviny"
                  >
                    ✎
                  </button>
                </div>
              )}
            </div>
            <ul className="mt-2">
              {items.map((item) => {
                if (editMode) {
                  return (
                    <li key={item.id} className="flex items-center gap-2 py-1.5">
                      <input
                        defaultValue={item.rawText}
                        onBlur={(event) => {
                          if (event.target.value.trim() !== item.rawText) {
                            void updateRecipeItemText(item.id, event.target.value);
                          }
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-1.5 outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => void deleteRecipeItem(item.id)}
                        className="shrink-0 px-2 text-lg text-red-500 hover:text-red-600"
                        aria-label="Odebrat surovinu"
                      >
                        ×
                      </button>
                    </li>
                  );
                }
                const isOff = off[item.id] ?? false;
                const replacement = replacements[item.id];
                const isReplaced = Boolean(replacement);
                const replAmountLabel = replacement
                  ? replacement.amountKs != null
                    ? `${replacement.amountKs} ks`
                    : replacement.amountG != null
                      ? `${replacement.amountG} g`
                      : ''
                  : '';
                const override = overrides[item.id];
                const baseText = scaleQuantityText(item.rawText, scaleFactor);
                const isChecked = !isOff && !isReplaced && (checked[item.id] ?? false);
                const editing = editingItemId === item.id;
                return (
                  <li key={item.id} className="border-b border-stone-100 last:border-0">
                    <div className="flex items-center gap-1">
                      {isReplaced ? (
                        <div className="flex flex-1 items-center gap-2 py-3 text-lg">
                          <span className="h-7 w-7 shrink-0" aria-hidden />
                          <span className="min-w-0">
                            <span className="text-stone-400 line-through">{baseText}</span>
                            <span className="font-medium text-brand-dark"> → {replacement.text}</span>
                            {replAmountLabel ? (
                              <span className="ml-1 text-sm text-stone-400">{replAmountLabel}</span>
                            ) : null}
                          </span>
                        </div>
                      ) : isOff ? (
                        <div className="flex flex-1 items-center gap-3 py-3 text-lg text-stone-400">
                          <span className="h-7 w-7 shrink-0" aria-hidden />
                          <span className="line-through">{baseText}</span>
                          <span className="text-xs">· vypnuto</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleCheck(item.id)}
                          className="flex flex-1 items-center gap-3 py-3 text-left text-lg transition active:bg-stone-100"
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
                            {override || baseText}
                            {override ? (
                              <span className="ml-2 text-sm text-stone-400 line-through">
                                {baseText}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(item.id)}
                        className="shrink-0 rounded-lg px-2 py-2 text-stone-400 transition hover:text-stone-600"
                        aria-label="Úprava suroviny"
                      >
                        ⋯
                      </button>
                    </div>

                    {editing ? (
                      <div className="flex flex-wrap items-center gap-2 pb-3 pl-9 text-sm">
                        <button
                          type="button"
                          onClick={() => toggleOff(item.id)}
                          className="rounded-full border border-stone-300 px-3 py-1 font-medium text-stone-700 transition hover:bg-stone-100"
                        >
                          {isOff ? 'Zapnout' : 'Vypnout dnes'}
                        </button>
                        {!isOff ? (
                          <>
                            <input
                              value={overrideDraft}
                              onChange={(event) => setOverrideDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') saveOverride(item.id);
                              }}
                              placeholder="jiné množství pro dnešek"
                              className="min-w-0 flex-1 rounded-full border border-stone-200 px-3 py-1 outline-none focus:border-brand"
                            />
                            <button
                              type="button"
                              onClick={() => saveOverride(item.id)}
                              className="rounded-full bg-brand px-3 py-1 font-medium text-white transition hover:bg-brand-dark"
                            >
                              Uložit
                            </button>
                          </>
                        ) : null}
                        {!isOff ? (
                          <button
                            type="button"
                            onClick={() => openReplace(item.id)}
                            className="rounded-full border border-stone-300 px-3 py-1 font-medium text-stone-700 transition hover:bg-stone-100"
                          >
                            {isReplaced ? 'Upravit náhradu' : 'Nahradit'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="text-stone-400 hover:text-stone-600"
                        >
                          Zavřít
                        </button>
                      </div>
                    ) : null}

                    {replacingItemId === item.id ? (
                      <div className="flex flex-col gap-2 pb-3 pl-9 pr-2 text-sm">
                        <input
                          value={replText}
                          onChange={(event) => setReplText(event.target.value)}
                          placeholder="čím nahradit (např. tvaroh)"
                          className="w-full rounded-full border border-stone-200 px-3 py-1.5 outline-none focus:border-brand"
                        />
                        {replFoodId ? (
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-stone-600">
                              → {foodMap.get(replFoodId)?.name}
                            </span>
                            <input
                              value={replAmount}
                              onChange={(event) => setReplAmount(event.target.value)}
                              inputMode="decimal"
                              placeholder={replUnit}
                              className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-right outline-none focus:border-brand"
                            />
                            {foodMap.get(replFoodId)?.pieceGrams ? (
                              <button
                                type="button"
                                onClick={toggleReplUnit}
                                className="w-8 shrink-0 rounded-lg border border-stone-200 py-1 text-xs font-medium text-stone-600"
                                aria-label="Přepnout jednotku g/ks"
                              >
                                {replUnit}
                              </button>
                            ) : (
                              <span className="w-8 text-center text-xs text-stone-400">g</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setReplFoodId(null)}
                              className="text-stone-400 hover:text-stone-600"
                              aria-label="Odpojit potravinu"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReplPickerOpen(true)}
                            className="self-start rounded-full bg-brand/10 px-3 py-1 font-medium text-brand-dark transition hover:bg-brand/20"
                          >
                            napojit potravinu (kvůli kaloriím)
                          </button>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => saveReplacement(item.id)}
                            className="rounded-full bg-brand px-3 py-1 font-medium text-white transition hover:bg-brand-dark"
                          >
                            Uložit náhradu
                          </button>
                          {isReplaced ? (
                            <button
                              type="button"
                              onClick={() => removeReplacement(item.id)}
                              className="rounded-full px-3 py-1 font-medium text-red-600 transition hover:bg-red-50"
                            >
                              Odebrat
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setReplacingItemId(null)}
                            className="text-stone-400 hover:text-stone-600"
                          >
                            Zavřít
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
              {editMode ? (
                <li className="mt-2 flex items-center gap-2">
                  <input
                    value={newItemText}
                    onChange={(event) => setNewItemText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void addRecipeItem(id, newItemText);
                        setNewItemText('');
                      }
                    }}
                    placeholder="přidat surovinu…"
                    className="min-w-0 flex-1 rounded-lg border border-dashed border-stone-300 px-3 py-1.5 outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void addRecipeItem(id, newItemText);
                      setNewItemText('');
                    }}
                    className="shrink-0 rounded-lg bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand-dark transition hover:bg-brand/20"
                  >
                    Přidat
                  </button>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {steps.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Postup</h2>
            <ol className="mt-2 space-y-4">
              {steps.map((step, index) => {
                const stepDone = doneSteps.has(index);
                const isCurrent = index === currentStepIndex;
                return (
                <li key={index} className="flex gap-3 text-lg leading-relaxed">
                  <button
                    type="button"
                    onClick={() => toggleStep(index)}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition ${
                      stepDone
                        ? 'border-brand bg-brand text-white'
                        : isCurrent
                          ? 'border-brand text-brand'
                          : 'border-stone-300 text-stone-400'
                    }`}
                    aria-label={
                      stepDone ? `Krok ${index + 1} hotový` : `Označit krok ${index + 1} za hotový`
                    }
                    aria-pressed={stepDone}
                  >
                    {stepDone ? '✓' : index + 1}
                  </button>
                  <span className={stepDone ? 'text-stone-400 line-through' : ''}>
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
                );
              })}
            </ol>
          </section>
        ) : null}

        {items.length === 0 && steps.length === 0 ? (
          <p className="mt-6 text-stone-400">Recept zatím nemá suroviny ani postup.</p>
        ) : null}

        {items.length > 0 || steps.length > 0 ? (
          showFinish ? (
            <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-4">
              <label className="text-sm font-medium">Uložit do historie vaření</label>
              <textarea
                value={finishNote}
                onChange={(event) => setFinishNote(event.target.value)}
                placeholder="Poznámka (nepovinné) – např. „příště míň soli“"
                className="mt-2 min-h-[12dvh] w-full resize-none rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-brand"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
                >
                  Uložit do historie
                </button>
                <button
                  type="button"
                  onClick={() => setShowFinish(false)}
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
                >
                  Zrušit
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowFinish(true)}
              className="mt-8 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark active:scale-[0.99]"
            >
              Hotovo — uložit do historie
            </button>
          )
        ) : null}
      </main>

      {replPickerOpen ? (
        <FoodPicker
          onSelect={(foodId) => {
            setReplFoodId(foodId);
            const food = foodMap.get(foodId);
            if (!replText.trim() && food) setReplText(food.name);
            if (food?.pieceGrams) setReplUnit('ks');
            setReplPickerOpen(false);
          }}
          onClose={() => setReplPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
