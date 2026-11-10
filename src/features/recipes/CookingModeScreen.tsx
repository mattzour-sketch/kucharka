import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CookReplacement, type FoodPortion } from '../../db';
import { formatCzechDate, toLocalIsoDate } from '../../lib/date';
import { scaleQuantityText } from '../../lib/scale';
import {
  deriveInitialAmountValue,
  resolveAmount,
  unitOptionsForFood,
  type AmountUnitOption,
  type AmountValue,
} from '../../lib/amount';
import { matchPortionInText } from '../../lib/portionMatch';
import { ingredientHeadingLabel, isIngredientHeading } from '../../lib/ingredientSection';
import { addPortion } from '../foods/foodPortionsRepo';
import { splitStepByDurations } from '../../lib/duration';
import { cookingSteps } from '../../lib/recipeText';
import { matchStepIngredients } from '../../lib/stepIngredients';
import { isStaleTimer, isTimerGone, stepTimerLabel, stepTimerSource, timerState } from '../../lib/timers';
import { useWakeLock } from '../../hooks/useWakeLock';
import { getAllRecipeItems, getRecipeItems } from './recipesRepo';
import {
  clearCookSession,
  getCookSession,
  saveCookSession,
  type CookSessionState,
} from './cookSessionRepo';
import { getTimers, removeTimers, restoreTimers } from './timerRepo';
import { getRecipeNotes } from './recipeNotesRepo';
import { partitionNotes } from '../../lib/originalNote';
import { addCookLog, deleteCookLog, getCookLogs } from './cookLogRepo';
import { useUndo } from '../../components/undoContext';
import { applyReplacements, nutritionFromData, perPortionFromResult } from '../nutrition/recipeNutrition';
import FoodPicker from '../foods/FoodPicker';
import { AdhocTimerForm, StepTimerButton } from './CookingTimers';
import ServingsStepper from './ServingsStepper';
import IngredientLine from './IngredientLine';
import { hasAmountColumn } from '../../lib/amountSplit';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import AmountPicker from '../../components/ui/AmountPicker';
import AddPortionInline from '../../components/ui/AddPortionInline';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { cx } from '../../components/ui/cx';
import { cardClass } from '../../components/ui/cardClass';
import { Skeleton, ReadingSkeleton } from '../../components/ui/Loading';
import { FIELD, SECTION_TITLE, LABEL, LINK, CHECK, CHECK_ON, CHECK_OFF } from '../../components/ui/styles';
import Icon from '../../components/ui/Icon';

// Do téhle doby se sezení obnoví tiše; po delší době appka nabídne volbu (§6 [R]).
const STALE_MS = 3 * 60 * 60 * 1000;
// Kolik posledních poznámek k receptu je vidět hned; zbytek po ťuknutí.
const NOTES_SHOWN = 2;

function keysOf(record: Record<string, boolean>): string[] {
  return Object.keys(record).filter((key) => record[key]);
}

/** Porce zvolené na detailu receptu (předané při ťuknutí na Vařit). */
function entryServingsOf(state: unknown): number | null {
  if (typeof state !== 'object' || state === null || !('servings' in state)) return null;
  const servings = state.servings;
  return typeof servings === 'number' && servings > 0 ? servings : null;
}

/** Jemná odezva při odškrtnutí (kde to zařízení umí). */
function buzz(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(8);
  }
}

type CookTab = 'ingredients' | 'steps';

function replacementAmountLabel(replacement: CookReplacement): string {
  if (replacement.amountKs != null) return `${replacement.amountKs} ks`;
  if (replacement.amountG != null) return `${replacement.amountG} g`;
  return '';
}

/**
 * Režim vaření (R-22, §6, §7, §8): velké písmo, displej nezhasíná (wake lock),
 * odškrtávání surovin, časovače, a odchylky (vypnout / změnit množství / nahradit
 * pro dnešek). Recept se tu NIKDY nemění – trvalé úpravy jsou jen v Upravit
 * (rozhodnutí uživatele 2026-09-25). Suroviny a postup jsou na dvou záložkách,
 * ať se k postupu nescrolluje přes všechny suroviny. Stav sezení přežije odchod z appky.
 */
export default function CookingModeScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Porce z detailu mají přednost před uloženým sezením (je to čerstvá volba).
  const entryServingsRef = useRef(entryServingsOf(location.state));
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
      getAllRecipeItems(),
      db.foodPortions.toArray(),
    ]);
    return { recipe, items, foods, recipes, allItems, portions };
  }, [id]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [targetServings, setTargetServings] = useState<number | null>(null);
  const [stalePrompt, setStalePrompt] = useState<CookSessionState | null>(null);
  const [staleUpdatedAt, setStaleUpdatedAt] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState('');
  const [showFinish, setShowFinish] = useState(false);
  const [finishNote, setFinishNote] = useState('');
  const [tab, setTab] = useState<CookTab>('ingredients');
  // §8 náhrady suroviny (jen tohle vaření). Klíč = id původní suroviny.
  const [replacements, setReplacements] = useState<Record<string, CookReplacement>>({});
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null);
  const [replText, setReplText] = useState('');
  const [replFoodId, setReplFoodId] = useState<string | null>(null);
  const [replValue, setReplValue] = useState<AmountValue>({ unitId: 'g', raw: '' });
  const [replPickerOpen, setReplPickerOpen] = useState(false);
  // Inline „+ míra" u náhrady: je otevřený mini-formulář?
  const [addMeasureFor, setAddMeasureFor] = useState<'repl' | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  // Vlastní poznámky k receptu („příště míň soli") – při vaření jen ke čtení.
  const ownNotes =
    useLiveQuery(
      async () => (id ? partitionNotes(await getRecipeNotes(id)).own : []),
      [id],
    ) ?? [];
  const [notesOpen, setNotesOpen] = useState(false);
  const shownNotes = notesOpen ? ownNotes : ownNotes.slice(-NOTES_SHOWN);
  const hiddenNoteCount = ownNotes.length - shownNotes.length;
  // Časovače jsou společné všem receptům; Hotovo je zruší (jdou vrátit s historií).
  const activeTimers = (useLiveQuery(() => getTimers(), []) ?? []).filter(
    (timer) => !isStaleTimer(timer.endsAt, Date.now()),
  );
  // Do hlášky „Zruší se i časovač" jen ty, které ještě běží nebo zvoní; ztlumené za chvíli
  // zmizí samy. Zrušit (a vrátit) se při Hotovo dál všechny `activeTimers`.
  const timerHintNow = Date.now();
  const hintTimers = activeTimers.filter(
    (timer) => timerState(timer, timerHintNow) !== 'silenced' && !isTimerGone(timer, timerHintNow),
  );
  const { showUndo } = useUndo();
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
    setReplValue({ unitId: 'g', raw: '' });
    setAddMeasureFor(null);
    setTab('ingredients');
    const entryServings = entryServingsRef.current;
    setTargetServings(entryServings);
    if (!id) return;
    // Porce z detailu jsou přečtené → pryč z historie, ať je návrat sem nepřebije.
    if (entryServings !== null) navigate('.', { replace: true, state: null });
    let cancelled = false;
    void getCookSession(id).then((session) => {
      if (cancelled) return;
      const state: CookSessionState = {
        checkedItemIds: session?.checkedItemIds ?? [],
        offItemIds: session?.offItemIds ?? [],
        amountOverrides: session?.amountOverrides ?? {},
        replacements: session?.replacements ?? {},
        doneStepIndices: session?.doneStepIndices ?? [],
        targetServings: session?.targetServings ?? null,
      };
      const hasProgress =
        state.checkedItemIds.length > 0 ||
        state.offItemIds.length > 0 ||
        Object.keys(state.amountOverrides).length > 0 ||
        Object.keys(state.replacements ?? {}).length > 0 ||
        (state.doneStepIndices ?? []).length > 0;
      const fresh = session !== undefined && Date.now() - Date.parse(session.updatedAt) < STALE_MS;
      if (!fresh && hasProgress) {
        setStalePrompt(state);
        setStaleUpdatedAt(session?.updatedAt ?? null);
        return;
      }
      if (fresh) applyState(state);
      // Porce z detailu uložit hned – po zamčení telefonu a návratu do appky zůstanou.
      if (entryServings !== null) {
        void saveCookSession(id, {
          ...(fresh ? state : { checkedItemIds: [], offItemIds: [], amountOverrides: {} }),
          targetServings: entryServings,
        });
      }
    });
    return () => {
      cancelled = true;
    };
    // navigate jen uklízí předané porce; sezení se načítá při změně receptu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function applyState(state: CookSessionState) {
    setChecked(Object.fromEntries(state.checkedItemIds.map((itemId) => [itemId, true])));
    setOff(Object.fromEntries(state.offItemIds.map((itemId) => [itemId, true])));
    setOverrides(state.amountOverrides);
    setReplacements(state.replacements ?? {});
    setDoneSteps(new Set(state.doneStepIndices ?? []));
    setTargetServings(entryServingsRef.current ?? state.targetServings ?? null);
  }

  function persist(
    patch: {
      checked?: Record<string, boolean>;
      off?: Record<string, boolean>;
      overrides?: Record<string, string>;
      replacements?: Record<string, CookReplacement>;
      doneSteps?: Set<number>;
      servings?: number | null;
    } = {},
  ) {
    if (!id) return;
    // Ťuknutí do seznamu během nabídky (staré vaření) = začít znovu: stav na obrazovce
    // je prázdný, takže uložení staré sezení přepíše tím novým a nabídka zmizí.
    if (stalePrompt) setStalePrompt(null);
    void saveCookSession(id, {
      checkedItemIds: keysOf(patch.checked ?? checked),
      offItemIds: keysOf(patch.off ?? off),
      amountOverrides: patch.overrides ?? overrides,
      replacements: patch.replacements ?? replacements,
      doneStepIndices: [...(patch.doneSteps ?? doneSteps)],
      targetServings: patch.servings !== undefined ? patch.servings : targetServings,
    });
  }

  if (data === undefined) {
    return (
      <div className="min-h-dvh">
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
      <div className="min-h-dvh">
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
    persist({ checked: next });
    buzz();
  }

  function toggleStep(index: number) {
    const next = new Set(doneSteps);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setDoneSteps(next);
    persist({ doneSteps: next });
    buzz();
    if (next.has(index)) revealNextStep(next, index);
  }

  /** Po odškrtnutí kroku dostat další nehotový do zorného pole (jen když je mimo). */
  function revealNextStep(done: Set<number>, from: number) {
    const after = steps.findIndex((_, i) => i > from && !done.has(i));
    const target = after >= 0 ? after : steps.findIndex((_, i) => !done.has(i));
    if (target < 0) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`step-${target}`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < 120 || rect.bottom > window.innerHeight - 80) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  function toggleOff(itemId: string) {
    const next = { ...off, [itemId]: !(off[itemId] ?? false) };
    // Vypnutí ruší případnou náhradu (vylučují se).
    const nextRepl = { ...replacements };
    if (next[itemId]) delete nextRepl[itemId];
    setOff(next);
    setReplacements(nextRepl);
    persist({ off: next, replacements: nextRepl });
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
    persist({ off: nextOff, replacements: nextRepl });
    setReplacingItemId(null);
  }

  function removeReplacement(itemId: string) {
    const nextRepl = { ...replacements };
    delete nextRepl[itemId];
    setReplacements(nextRepl);
    persist({ replacements: nextRepl });
    setReplacingItemId(null);
  }

  function saveOverride(itemId: string) {
    const value = overrideDraft.trim();
    const next = { ...overrides };
    if (value) next[itemId] = value;
    else delete next[itemId];
    setOverrides(next);
    persist({ overrides: next });
    setEditingItemId(null);
  }

  function openEdit(itemId: string) {
    setEditingItemId(itemId);
    setOverrideDraft(overrides[itemId] ?? '');
  }

  function continueSession() {
    if (!stalePrompt || !id) return;
    applyState(stalePrompt);
    void saveCookSession(id, {
      ...stalePrompt,
      targetServings: entryServingsRef.current ?? stalePrompt.targetServings,
    });
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

  const steps = cookingSteps(recipe.instructions);

  const baseServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  const targetPortions = targetServings ?? baseServings;
  const scaleFactor = targetPortions / baseServings;

  // Množství surovin zmíněných v kroku – jak se dnes vaří (porce, odchylky, náhrady).
  const itemById = new Map(items.map((item) => [item.id, item]));
  const replacingItem = replacingItemId ? itemById.get(replacingItemId) : undefined;
  const stepIngredientLabels = matchStepIngredients(steps, items).map((itemIds) =>
    itemIds.flatMap((itemId) => {
      const item = itemById.get(itemId);
      if (!item || off[itemId]) return [];
      const replacement = replacements[itemId];
      if (replacement) return [`${replacement.text} ${replacementAmountLabel(replacement)}`.trim()];
      return [overrides[itemId] || scaleQuantityText(item.rawText, scaleFactor)];
    }),
  );

  // Průběh vaření: odškrtané suroviny (mimo vypnuté a nahrazené) + hotové kroky.
  const ingredientUnits = items.filter(
    (item) => !isIngredientHeading(item.rawText) && !(off[item.id] ?? false) && !replacements[item.id],
  );
  const checkedCount = ingredientUnits.filter((item) => checked[item.id]).length;
  const doneStepCount = steps.filter((_, index) => doneSteps.has(index)).length;
  const totalUnits = ingredientUnits.length + steps.length;
  const doneUnits = checkedCount + doneStepCount;
  const progressPct = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;
  const allDone = totalUnits > 0 && doneUnits === totalUnits;
  const currentStepIndex = steps.findIndex((_, index) => !doneSteps.has(index));
  const allIngredientsChecked = ingredientUnits.length > 0 && checkedCount === ingredientUnits.length;
  // Záložky jen když je co přepínat; jinak se ukáže to, co recept má.
  const hasTabs = items.length > 0 && steps.length > 0;
  const shownTab: CookTab = hasTabs ? tab : items.length > 0 ? 'ingredients' : 'steps';
  const staleDoneCount = stalePrompt
    ? stalePrompt.checkedItemIds.length + (stalePrompt.doneStepIndices ?? []).length
    : 0;

  function handleFinish() {
    if (!recipe || !id) return;
    const recipeId = id;
    const sessionBefore: CookSessionState = {
      checkedItemIds: keysOf(checked),
      offItemIds: keysOf(off),
      amountOverrides: overrides,
      replacements,
      doneStepIndices: [...doneSteps],
      targetServings,
    };
    const cancelledTimers = activeTimers;
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
    }).then(async (log) => {
      await clearCookSession(recipeId);
      if (cancelledTimers.length > 0) await removeTimers(cancelledTimers);
      navigate(`/recept/${recipeId}`, { replace: true });
      // Ťuknutí omylem: vrátí záznam, rozdělané vaření i časovače.
      showUndo({
        message: 'Uloženo do historie',
        undo: async () => {
          await deleteCookLog(log.id);
          await saveCookSession(recipeId, sessionBefore);
          if (cancelledTimers.length > 0) await restoreTimers(cancelledTimers);
        },
      });
    });
  }

  // Sloupec množství jako na detailu (počítá se z textů přepočtených na dnešní porce).
  const amountColumn = hasAmountColumn(
    items
      .filter((item) => !isIngredientHeading(item.rawText))
      .map((item) => scaleQuantityText(item.rawText, scaleFactor)),
  );

  return (
    <div className="min-h-dvh">
      <ScreenHeader
        variant="stack"
        width="narrow"
        backTo={`/recept/${recipe.id}`}
        backLabel="Zpět na recept"
        title={recipe.name}
      />

      <main className="mx-auto max-w-2xl px-4 py-4">
        {lastLog || ownNotes.length > 0 ? (
          <div className={cardClass({ padding: 'row', className: 'mb-4 space-y-1.5 text-sm text-stone-700 dark:text-stone-300' })}>
            {lastLog ? (
              <p>
                Naposledy uvařeno {formatCzechDate(lastLog.cookedOn)}
                {lastLog.note ? ` · ${lastLog.note}` : ''}
              </p>
            ) : null}
            {shownNotes.map((note) => (
              <p key={note.id} className="whitespace-pre-line font-medium text-stone-900 dark:text-stone-100">
                {note.body}
              </p>
            ))}
            {hiddenNoteCount > 0 ? (
              <button
                type="button"
                onClick={() => setNotesOpen(true)}
                className={cx(LINK, 'flex min-h-9 items-center text-sm')}
              >
                Další poznámky ({hiddenNoteCount})
              </button>
            ) : null}
          </div>
        ) : null}

        {stalePrompt ? (
          <div className="mb-4 rounded-2xl bg-amber-100 p-4 dark:bg-amber-500/15">
            <p className="text-base font-medium text-amber-900 dark:text-amber-200">
              Rozdělané vaření
              {staleUpdatedAt ? ` z ${formatCzechDate(toLocalIsoDate(new Date(staleUpdatedAt)))}` : ''}
              {staleDoneCount > 0 ? `, odškrtnuto ${staleDoneCount}` : ''}. Pokračovat, nebo začít
              znovu?
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

        {totalUnits > 0 && !stalePrompt ? (
          <div className="mb-4">
            <p
              className={cx(
                'mb-1.5 text-sm font-semibold tabular-nums text-stone-600 dark:text-stone-300',
                allDone && 'text-brand dark:text-brand-light',
              )}
            >
              {allDone ? 'Hotovo 🎉' : `Hotovo ${progressPct} %`}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-stone-900/[0.08] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300 dark:bg-brand-bright"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : null}

        {hasTabs ? (
          // Velké cíle na ťuknutí (mastné ruce), počty odškrtnutého přímo v záložce.
          <div
            className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-stone-900/[0.07] p-1 dark:bg-white/10"
            role="tablist"
            aria-label="Suroviny nebo postup"
          >
            {(
              [
                ['ingredients', 'Suroviny', `${checkedCount}/${ingredientUnits.length}`],
                ['steps', 'Postup', `${doneStepCount}/${steps.length}`],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cx(
                  'min-h-12 rounded-xl text-base font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                  tab === value
                    ? 'bg-brand text-white shadow-sm dark:bg-brand-bright'
                    : 'text-stone-600 dark:text-stone-300',
                )}
              >
                {label} <span className="text-sm font-semibold tabular-nums opacity-80">{count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {shownTab === 'ingredients' && items.length > 0 ? (
          <section>
            <div className={cx('flex items-center gap-3', hasTabs ? 'justify-end' : 'justify-between')}>
              {hasTabs ? null : (
                <h2 className={SECTION_TITLE}>Suroviny</h2>
              )}
              <ServingsStepper
                value={targetPortions}
                base={recipe.servings && recipe.servings > 0 ? recipe.servings : undefined}
                onStep={(delta) => {
                  const next = Math.max(1, targetPortions + delta);
                  setTargetServings(next);
                  persist({ servings: next });
                }}
              />
            </div>
            {!recipe.servings ? (
              <p className="mt-1 text-right text-xs text-stone-500 dark:text-stone-400">Porce nezadané – počítám od 1.</p>
            ) : null}
            <ul className="mt-2">
              {items.map((item) => {
                if (isIngredientHeading(item.rawText)) {
                  return (
                    <li
                      key={item.id}
                      className="pb-1 pt-5 text-base font-bold text-stone-500 first:pt-1 dark:text-stone-400"
                    >
                      {ingredientHeadingLabel(item.rawText)}
                    </li>
                  );
                }
                const isOff = off[item.id] ?? false;
                const replacement = replacements[item.id];
                const isReplaced = Boolean(replacement);
                const replAmountLabel = replacement ? replacementAmountLabel(replacement) : '';
                const override = overrides[item.id];
                const baseText = scaleQuantityText(item.rawText, scaleFactor);
                const isChecked = !isOff && !isReplaced && (checked[item.id] ?? false);
                const editing = editingItemId === item.id;
                return (
                  <li key={item.id} className="border-b border-stone-200/80 last:border-0 dark:border-stone-800">
                    <div className="flex items-center gap-1">
                      {isReplaced ? (
                        <div className="flex min-h-14 flex-1 items-center gap-3 py-2.5 text-lg leading-snug">
                          <span className="h-8 w-8 shrink-0" aria-hidden />
                          <span className="min-w-0">
                            <span className="text-stone-400 line-through dark:text-stone-500">{baseText}</span>
                            <span className="font-bold text-brand-dark dark:text-brand-light"> → {replacement.text}</span>
                            {replAmountLabel ? (
                              <span className="ml-1 text-sm text-stone-500 dark:text-stone-400">{replAmountLabel}</span>
                            ) : null}
                          </span>
                        </div>
                      ) : isOff ? (
                        <div className="flex min-h-14 flex-1 items-center gap-3 py-2.5 text-lg leading-snug text-stone-400 dark:text-stone-500">
                          <span className="h-8 w-8 shrink-0" aria-hidden />
                          <span className="line-through">{baseText}</span>
                          <span className="text-xs">· vypnuto</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleCheck(item.id)}
                          aria-pressed={isChecked}
                          aria-label={override || baseText}
                          className="flex min-h-14 flex-1 items-center gap-3 rounded-xl py-2.5 text-left text-lg leading-snug transition active:bg-stone-900/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 dark:active:bg-white/10"
                        >
                          <span aria-hidden className={cx(CHECK, isChecked ? CHECK_ON : CHECK_OFF)}>
                            {isChecked ? <Icon name="check" className="h-5 w-5" /> : null}
                          </span>
                          <span
                            className={cx(
                              'min-w-0 flex-1',
                              isChecked && 'text-stone-400 line-through dark:text-stone-500',
                            )}
                          >
                            <IngredientLine text={override || baseText} column={amountColumn} />
                            {override ? (
                              <span className="mt-0.5 block text-sm text-stone-400 line-through dark:text-stone-500">
                                {baseText}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      )}
                      <IconButton onClick={() => openEdit(item.id)} aria-label={`Úprava suroviny ${baseText}`}>
                        <Icon name="more" />
                      </IconButton>
                    </div>

                    {editing ? (
                      <div className="flex flex-wrap items-center gap-2 pb-3 pl-11 text-sm">
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
                              className={cx(FIELD, 'h-10 min-w-[11rem] flex-1 px-3 text-base')}
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
                      <div className="flex flex-col gap-2 pb-3 pl-11 pr-2 text-sm">
                        <input
                          value={replText}
                          onChange={(event) => setReplText(event.target.value)}
                          placeholder="čím nahradit (např. tvaroh)"
                          className={cx(FIELD, 'h-10 w-full px-3 text-base')}
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
                                <Icon name="close" className="h-4 w-4" />
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
                                className={cx(LINK, 'flex min-h-9 items-center self-end text-sm')}
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
            </ul>
            {hasTabs && allIngredientsChecked ? (
              <button
                type="button"
                onClick={() => setTab('steps')}
                className="mt-4 min-h-12 w-full rounded-2xl bg-brand/10 text-base font-bold text-brand-dark transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 dark:bg-brand-bright/20 dark:text-brand-light motion-reduce:active:scale-100"
              >
                Na postup →
              </button>
            ) : null}
          </section>
        ) : null}

        {shownTab === 'steps' && steps.length > 0 ? (
          <section className={hasTabs ? undefined : 'mt-8'}>
            {hasTabs ? null : (
              <h2 className={SECTION_TITLE}>Postup</h2>
            )}
            <ol className={cx('space-y-4', !hasTabs && 'mt-2')}>
              {steps.map((step, index) => {
                const stepDone = doneSteps.has(index);
                const isCurrent = index === currentStepIndex;
                return (
                <li key={index} id={`step-${index}`} className="flex gap-3 text-lg leading-relaxed">
                  <button
                    type="button"
                    onClick={() => toggleStep(index)}
                    className={cx(
                      CHECK,
                      'text-sm font-bold tabular-nums',
                      stepDone
                        ? CHECK_ON
                        : isCurrent
                          ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light'
                          : 'border-stone-400 text-stone-600 dark:border-stone-500 dark:text-stone-300',
                    )}
                    aria-label={
                      stepDone ? `Krok ${index + 1} hotový` : `Označit krok ${index + 1} za hotový`
                    }
                    aria-pressed={stepDone}
                  >
                    {stepDone ? <Icon name="check" className="h-5 w-5" /> : index + 1}
                  </button>
                  {/* Ťuknutí na text kroku = odškrtnout (mokré ruce); kolečko zůstává pro klávesnici. */}
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleStep(index)}>
                  <span className={stepDone ? 'text-stone-400 line-through dark:text-stone-500' : ''}>
                    {splitStepByDurations(step).map((segment, segIndex) => {
                      if (segment.seconds == null) {
                        return <span key={segIndex}>{segment.text}</span>;
                      }
                      return (
                        <StepTimerButton
                          key={segIndex}
                          text={segment.text}
                          seconds={segment.seconds}
                          source={stepTimerSource(id ?? '', index, segIndex)}
                          label={stepTimerLabel(index, step)}
                          timers={activeTimers}
                        />
                      );
                    })}
                  </span>
                  {stepIngredientLabels[index].length > 0 ? (
                    <p className="mt-1 text-base text-stone-500 dark:text-stone-400">
                      {stepIngredientLabels[index].join(' · ')}
                    </p>
                  ) : null}
                  </div>
                </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {items.length === 0 && steps.length === 0 ? (
          <p className="mt-6 text-stone-500 dark:text-stone-400">Recept zatím nemá suroviny ani postup.</p>
        ) : null}

        <AdhocTimerForm />

        {items.length > 0 || steps.length > 0 ? (
          showFinish ? (
            <Card className="mt-8">
              <label className={LABEL}>Uložit do historie vaření</label>
              <textarea
                value={finishNote}
                onChange={(event) => setFinishNote(event.target.value)}
                placeholder="Poznámka (nepovinné) – např. „vyšlo na 3 porce“"
                className={cx(FIELD, 'mt-2 min-h-[12dvh] w-full resize-none p-3 text-base')}
              />
              {hintTimers.length > 0 ? (
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {hintTimers.length === 1
                    ? `Zruší se i časovač ${hintTimers[0].label}.`
                    : `Zruší se i časovače (${hintTimers.length}).`}
                </p>
              ) : null}
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
            // zůstává výrazné (větší písmo, 56 px) a přes celou šířku.
            <button
              type="button"
              onClick={() => setShowFinish(true)}
              className="mt-8 min-h-14 w-full rounded-2xl bg-brand text-lg font-bold text-white transition hover:bg-brand-dark active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 dark:bg-brand-bright dark:hover:bg-brand dark:focus-visible:ring-offset-stone-950 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              Hotovo — uložit do historie
            </button>
          )
        ) : null}
      </main>

      {replPickerOpen ? (
        <FoodPicker
          context={replacingItem ? `Náhrada za: ${replacingItem.rawText}` : undefined}
          initialQuery={replText}
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
    </div>
  );
}
