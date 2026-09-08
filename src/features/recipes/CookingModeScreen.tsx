import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CookReplacement, type FoodPortion } from '../../db';
import { formatCzechDate } from '../../lib/date';
import { formatNumber } from '../../lib/num';
import { matchesQuery } from '../../lib/search';
import { parseLeadingQuantity, scaleQuantityText } from '../../lib/scale';
import {
  deriveInitialAmountValue,
  resolveAmount,
  unitOptionsForFood,
  type AmountUnitOption,
  type AmountValue,
} from '../../lib/amount';
import { matchPortionInText } from '../../lib/portionMatch';
import { addPortion } from '../foods/foodPortionsRepo';
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
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import AmountPicker from '../../components/ui/AmountPicker';
import AddPortionInline from '../../components/ui/AddPortionInline';
import Tag from '../../components/ui/Tag';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { cardClass } from '../../components/ui/cardClass';
import { Skeleton, ReadingSkeleton } from '../../components/ui/Loading';

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

// Běžné kuchyňské jednotky, které za vedoucím číslem nepatří do názvu (kvůli našeptávači).
const LEADING_UNIT =
  /^(kg|dkg|dag|g|mg|ml|dl|cl|l|ks|lžíce|lžíc[ei]|lžička|lžičk[uy]|hrst|hrsti|špetka|špetk[uy]|plátek|plátky|stroužek|stroužky|hrnek|hrnku|šálek|balení|konzerva|konzervy|plechovka|sáček)$/i;

/**
 * Název suroviny pro našeptávač: odřízne vedoucí množství („2", „200 g") a
 * jednotku, ať „2 vejce" najde „Vejce" a „200 g mouky" najde „Mouka".
 */
function searchTermFromText(text: string): string {
  const parsed = parseLeadingQuantity(text.trim());
  let rest = (parsed ? parsed.rest : text).trim();
  if (parsed && rest) {
    const space = rest.indexOf(' ');
    const firstWord = space === -1 ? rest : rest.slice(0, space);
    if (LEADING_UNIT.test(firstWord)) rest = space === -1 ? '' : rest.slice(space + 1).trim();
  }
  return rest;
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
    const empty = { recipe: null, items: [], foods: [], recipes: [], allItems: [], portions: [] };
    if (!id) return empty;
    const recipe = (await db.recipes.get(id)) ?? null;
    if (!recipe) return empty;
    const [items, foods, recipes, allItems, portions] = await Promise.all([
      getRecipeItems(id),
      db.foods.toArray(),
      db.recipes.toArray(),
      db.recipeItems.toArray(),
      db.foodPortions.toArray(),
    ]);
    return { recipe, items, foods, recipes, allItems, portions };
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
  // Nepovinné napojení nové suroviny na potravinu (kvůli kaloriím). Vlastní picker,
  // ať se neplete s náhradou. Text je zdroj pravdy, napojení je štítek vedle.
  const [newItemFoodId, setNewItemFoodId] = useState<string | null>(null);
  const [newItemValue, setNewItemValue] = useState<AmountValue>({ unitId: 'g', raw: '' });
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  // §8 náhrady suroviny (jen tohle vaření). Klíč = id původní suroviny.
  const [replacements, setReplacements] = useState<Record<string, CookReplacement>>({});
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null);
  const [replText, setReplText] = useState('');
  const [replFoodId, setReplFoodId] = useState<string | null>(null);
  const [replValue, setReplValue] = useState<AmountValue>({ unitId: 'g', raw: '' });
  const [replPickerOpen, setReplPickerOpen] = useState(false);
  // Inline „+ míra" ve vaření: u které větve je otevřený mini-formulář.
  const [addMeasureFor, setAddMeasureFor] = useState<'repl' | 'add' | null>(null);
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
    setNewItemFoodId(null);
    setNewItemValue({ unitId: 'g', raw: '' });
    setReplValue({ unitId: 'g', raw: '' });
    setAddMeasureFor(null);
    setAddPickerOpen(false);
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

  if (data === undefined) {
    return (
      <div className="min-h-dvh bg-white dark:bg-stone-900">
        <ScreenHeader
          variant="stack"
          width="narrow"
          backTo={id ? `/recept/${id}` : '/'}
          backLabel="Zpět na recept"
          title={<Skeleton className="h-4 w-32" />}
        />
        <main className="mx-auto max-w-2xl px-4 py-4">
          <ReadingSkeleton />
        </main>
      </div>
    );
  }
  const { recipe, items, foods, recipes: allRecipes, allItems, portions } = data;
  const foodMap = new Map(foods.map((food) => [food.id, food]));
  const portionsByFood = new Map<string, FoodPortion[]>();
  for (const portion of portions) {
    if (portion.deletedAt) continue;
    const list = portionsByFood.get(portion.foodId) ?? [];
    list.push(portion);
    portionsByFood.set(portion.foodId, list);
  }
  function optionsFor(foodId: string | null | undefined): AmountUnitOption[] {
    const food = foodId ? foodMap.get(foodId) : undefined;
    return unitOptionsForFood(food, foodId ? (portionsByFood.get(foodId) ?? []) : []);
  }
  if (!recipe || recipe.deletedAt || !id) {
    return (
      <div className="min-h-dvh bg-white dark:bg-stone-900">
        <ScreenHeader variant="stack" width="narrow" backTo="/" backLabel="Zpět na seznam" />
        <main className="mx-auto max-w-2xl px-4">
          <EmptyState
            fill
            title="Recept nenalezen"
            action={
              <Button role="primary" to="/">
                Zpět na seznam
              </Button>
            }
          />
        </main>
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
    const options = optionsFor(existing?.foodId ?? null);
    setReplValue(
      deriveInitialAmountValue(
        {
          amountG: existing?.amountG ?? null,
          amountKs: existing?.amountKs ?? null,
          rawText: existing?.text ?? '',
        },
        options,
      ),
    );
    setAddMeasureFor(null);
    setEditingItemId(null);
  }

  // Inline „+ míra" u náhrady: uloží míru k náhradní potravině a rovnou ji vybere.
  async function addMeasureForRepl(label: string, grams: number) {
    if (!replFoodId) return;
    const added = await addPortion(replFoodId, label, grams);
    setReplValue({ unitId: added.id, raw: '1' });
    setAddMeasureFor(null);
  }

  function saveReplacement(itemId: string) {
    const food = replFoodId ? foodMap.get(replFoodId) : undefined;
    const text = replText.trim() || food?.name || '';
    if (!text) {
      setReplacingItemId(null);
      return;
    }
    const { amountG, amountKs } = resolveAmount(replValue, optionsFor(replFoodId));
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

  // Přidání suroviny: text zůstává zdrojem pravdy, napojení potraviny je nepovinné
  // (pravidlo 1). Když je pole prázdné, použije se aspoň název napojené potraviny.
  // U napojení se uloží i množství (g/ks), ať se kalorie fakt spočítají.
  function handleAddItem() {
    if (!id) return;
    const food = newItemFoodId ? foodMap.get(newItemFoodId) : undefined;
    const text = newItemText.trim() || food?.name || '';
    if (!text) return;
    let link: { foodId: string; amountG: number | null; amountKs: number | null } | undefined;
    if (newItemFoodId) {
      const { amountG, amountKs } = resolveAmount(newItemValue, optionsFor(newItemFoodId));
      link = { foodId: newItemFoodId, amountG, amountKs };
    }
    void addRecipeItem(id, text, link);
    setNewItemText('');
    setNewItemFoodId(null);
    setNewItemValue({ unitId: 'g', raw: '' });
    setAddMeasureFor(null);
  }

  function linkNewItemFood(foodId: string) {
    setNewItemFoodId(foodId);
    const food = foodMap.get(foodId);
    // Předvyplnění výběru: míra z textu (OO5), jinak „ks" u potraviny s hmotností kusu.
    const match = matchPortionInText(newItemText, portionsByFood.get(foodId) ?? []);
    setNewItemValue(
      match
        ? { unitId: match.portionId, raw: String(match.count) }
        : { unitId: food?.pieceGrams ? 'ks' : 'g', raw: '' },
    );
  }

  // Inline „+ míra" u přidávané suroviny.
  async function addMeasureForAdd(label: string, grams: number) {
    if (!newItemFoodId) return;
    const added = await addPortion(newItemFoodId, label, grams);
    setNewItemValue({ unitId: added.id, raw: '1' });
    setAddMeasureFor(null);
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

  // Našeptávač u přidání suroviny: dokud není potravina napojená, nabídni odpovídající
  // založené potraviny. Hledá podle názvu bez vedoucího množství („2 vejce" → „Vejce").
  // Ťuknutí NECHÁ napsaný text a jen napojí (pravidlo 2); volný text funguje dál.
  const addSearchTerm = searchTermFromText(newItemText);
  const addSuggestions =
    addSearchTerm && !newItemFoodId
      ? foods
          .filter(
            (food) =>
              !food.deletedAt && matchesQuery(`${food.name} ${food.brand ?? ''}`, addSearchTerm),
          )
          .slice(0, 6)
      : [];

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
    <div className="min-h-dvh bg-white dark:bg-stone-900">
      <ScreenHeader
        variant="stack"
        width="narrow"
        backTo={`/recept/${recipe.id}`}
        backLabel="Zpět na recept"
        title={recipe.name}
      />

      <main className="mx-auto max-w-2xl px-4 py-4">
        {lastLog ? (
          <div className="mb-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 p-3 text-sm text-stone-600 dark:text-stone-300">
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
              <Button role="primary" onClick={continueSession}>
                Pokračovat
              </Button>
              <Button role="secondary" onClick={restartSession}>
                Začít znovu
              </Button>
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
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Suroviny
              </h2>
              {editMode ? (
                <Button role="primary" onClick={() => setEditMode(false)}>
                  Hotovo
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <ServingsStepper
                    value={targetPortions}
                    onStep={(delta) =>
                      setTargetServings((prev) => Math.max(1, (prev ?? baseServings) + delta))
                    }
                  />
                  <IconButton onClick={() => setEditMode(true)} aria-label="Upravit suroviny">
                    ✎
                  </IconButton>
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
                        className="min-w-0 flex-1 rounded-lg border border-stone-200 dark:border-stone-700 px-3 py-1.5 outline-none focus:border-brand"
                      />
                      <IconButton
                        size="sm"
                        tone="danger"
                        onClick={() => void deleteRecipeItem(item.id)}
                        aria-label="Odebrat surovinu"
                      >
                        ×
                      </IconButton>
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
                  <li key={item.id} className="border-b border-stone-100 dark:border-stone-800 last:border-0">
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
                          className="flex flex-1 items-center gap-3 py-3 text-left text-lg transition active:bg-stone-100 dark:bg-stone-800"
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                              isChecked
                                ? 'border-brand bg-brand text-white'
                                : 'border-stone-300 dark:border-stone-600 text-transparent'
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
                      <IconButton onClick={() => openEdit(item.id)} aria-label="Úprava suroviny">
                        ⋯
                      </IconButton>
                    </div>

                    {editing ? (
                      <div className="flex flex-wrap items-center gap-2 pb-3 pl-9 text-sm">
                        <Button role="secondary" onClick={() => toggleOff(item.id)}>
                          {isOff ? 'Zapnout' : 'Vypnout dnes'}
                        </Button>
                        {!isOff ? (
                          <>
                            <input
                              value={overrideDraft}
                              onChange={(event) => setOverrideDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') saveOverride(item.id);
                              }}
                              placeholder="jiné množství pro dnešek"
                              className="min-w-0 flex-1 rounded-full border border-stone-200 dark:border-stone-700 px-3 py-1 outline-none focus:border-brand"
                            />
                            <Button role="primary" onClick={() => saveOverride(item.id)}>
                              Uložit
                            </Button>
                          </>
                        ) : null}
                        {!isOff ? (
                          <Button role="secondary" onClick={() => openReplace(item.id)}>
                            {isReplaced ? 'Upravit náhradu' : 'Nahradit'}
                          </Button>
                        ) : null}
                        <Button role="ghost" onClick={() => setEditingItemId(null)}>
                          Zavřít
                        </Button>
                      </div>
                    ) : null}

                    {replacingItemId === item.id ? (
                      <div className="flex flex-col gap-2 pb-3 pl-9 pr-2 text-sm">
                        <input
                          value={replText}
                          onChange={(event) => setReplText(event.target.value)}
                          placeholder="čím nahradit (např. tvaroh)"
                          className="w-full rounded-full border border-stone-200 dark:border-stone-700 px-3 py-1.5 outline-none focus:border-brand"
                        />
                        {replFoodId ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-stone-600 dark:text-stone-300">
                                → {foodMap.get(replFoodId)?.name}
                              </span>
                              <AmountPicker
                                options={optionsFor(replFoodId)}
                                value={replValue}
                                onChange={setReplValue}
                              />
                              <IconButton
                                size="sm"
                                onClick={() => {
                                  setReplFoodId(null);
                                  setReplValue({ unitId: 'g', raw: '' });
                                  if (addMeasureFor === 'repl') setAddMeasureFor(null);
                                }}
                                aria-label="Odpojit potravinu"
                              >
                                ×
                              </IconButton>
                            </div>
                            {addMeasureFor === 'repl' ? (
                              <AddPortionInline
                                onAdd={(label, grams) => void addMeasureForRepl(label, grams)}
                                onClose={() => setAddMeasureFor(null)}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setAddMeasureFor('repl')}
                                className="self-end text-xs font-medium text-brand"
                              >
                                + míra
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="self-start">
                            <Button role="tint" onClick={() => setReplPickerOpen(true)}>
                              napojit potravinu (kvůli kaloriím)
                            </Button>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Button role="primary" onClick={() => saveReplacement(item.id)}>
                            Uložit náhradu
                          </Button>
                          {isReplaced ? (
                            <Button role="destructive" onClick={() => removeReplacement(item.id)}>
                              Odebrat
                            </Button>
                          ) : null}
                          <Button role="ghost" onClick={() => setReplacingItemId(null)}>
                            Zavřít
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
              {editMode ? (
                <li className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={newItemText}
                      onChange={(event) => setNewItemText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleAddItem();
                      }}
                      placeholder="přidat surovinu…"
                      className="min-w-0 flex-1 rounded-lg border border-dashed border-stone-300 dark:border-stone-600 px-3 py-1.5 outline-none focus:border-brand"
                    />
                    <div className="shrink-0">
                      <Button role="tint" onClick={handleAddItem}>
                        Přidat
                      </Button>
                    </div>
                  </div>
                  {addSuggestions.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {addSuggestions.map((food) => (
                        <li key={food.id}>
                          <button
                            type="button"
                            onClick={() => linkNewItemFood(food.id)}
                            className={cardClass({
                              padding: 'row',
                              interactive: true,
                              className:
                                'flex w-full items-center justify-between gap-3 text-left text-sm',
                            })}
                          >
                            <span className="min-w-0 truncate">{food.name}</span>
                            <span className="shrink-0 text-xs text-stone-400">
                              {formatNumber(food.energyKcal)} kcal / 100 {food.basis}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex flex-col gap-2 pl-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {newItemFoodId ? (
                        <>
                          <Tag
                            onRemove={() => {
                              setNewItemFoodId(null);
                              setNewItemValue({ unitId: 'g', raw: '' });
                              if (addMeasureFor === 'add') setAddMeasureFor(null);
                            }}
                            removeLabel="Odpojit potravinu"
                          >
                            → {foodMap.get(newItemFoodId)?.name}
                          </Tag>
                          <AmountPicker
                            options={optionsFor(newItemFoodId)}
                            value={newItemValue}
                            onChange={setNewItemValue}
                          />
                          {addMeasureFor === 'add' ? null : (
                            <button
                              type="button"
                              onClick={() => setAddMeasureFor('add')}
                              className="text-xs font-medium text-brand"
                            >
                              + míra
                            </button>
                          )}
                        </>
                      ) : (
                        <Button role="tint" onClick={() => setAddPickerOpen(true)}>
                          napojit potravinu (kvůli kaloriím)
                        </Button>
                      )}
                    </div>
                    {newItemFoodId && addMeasureFor === 'add' ? (
                      <AddPortionInline
                        onAdd={(label, grams) => void addMeasureForAdd(label, grams)}
                        onClose={() => setAddMeasureFor(null)}
                      />
                    ) : null}
                  </div>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {steps.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Postup</h2>
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
                          : 'border-stone-300 dark:border-stone-600 text-stone-400'
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
            <Card className="mt-8">
              <label className="text-sm font-medium">Uložit do historie vaření</label>
              <textarea
                value={finishNote}
                onChange={(event) => setFinishNote(event.target.value)}
                placeholder="Poznámka (nepovinné) – např. „příště míň soli“"
                className="mt-2 min-h-[12dvh] w-full resize-none rounded-xl border border-stone-200 dark:border-stone-700 p-3 text-sm outline-none focus:border-brand"
              />
              <div className="mt-2 flex gap-2">
                <Button role="primary" onClick={handleFinish}>
                  Uložit do historie
                </Button>
                <Button role="secondary" onClick={() => setShowFinish(false)}>
                  Zrušit
                </Button>
              </div>
            </Card>
          ) : (
            // Dokumentovaná výjimka z jedné velikosti primary: hlavní CTA vaření
            // zůstává výrazné (větší písmo, py-3) a přes celou šířku. Radius sjednocen na pill.
            <button
              type="button"
              onClick={() => setShowFinish(true)}
              className="mt-8 w-full rounded-full bg-brand py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-dark active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
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
            const match = matchPortionInText(replText, portionsByFood.get(foodId) ?? []);
            setReplValue(
              match
                ? { unitId: match.portionId, raw: String(match.count) }
                : { unitId: food?.pieceGrams ? 'ks' : 'g', raw: '' },
            );
            setReplPickerOpen(false);
          }}
          onClose={() => setReplPickerOpen(false)}
        />
      ) : null}

      {addPickerOpen ? (
        <FoodPicker
          onSelect={(foodId) => {
            linkNewItemFood(foodId);
            // Text předvyplníme názvem jen když je pole prázdné (pravidlo 2).
            const food = foodMap.get(foodId);
            if (!newItemText.trim() && food) setNewItemText(food.name);
            setAddPickerOpen(false);
          }}
          onClose={() => setAddPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
