import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Recipe, type RecipeItem } from '../../db';
import { todayIso } from '../../lib/date';
import { parseDecimal } from '../../lib/num';
import { combineRawCapture, splitIngredientLines } from '../../lib/recipeText';
import TagInput from './TagInput';
import {
  createRecipeWithContent,
  getRecipeItems,
  restoreRecipeSnapshot,
  softDeleteRecipe,
  updateRecipeContent,
  type RecipeContent,
} from './recipesRepo';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAutoGrow } from '../../hooks/useAutoGrow';

/** Porce jen kladné – 0 nebo nesmysl = nezadané. */
function positiveOrNull(value: number | null): number | null {
  return value != null && value > 0 ? value : null;
}

function snapshotOf(
  name: string,
  capturedOn: string,
  ingredients: string,
  instructions: string,
  tags: string[],
  prepMinutes: string,
  servings: string,
): string {
  return JSON.stringify([name, capturedOn, ingredients, instructions, tags, prepMinutes, servings]);
}

/**
 * Zachycení nového receptu i editace stávajícího (R-01 až R-03, R-11, R-16).
 * Dvě pole (suroviny / postup) + štítky. Koncept se ukládá průběžně do
 * IndexedDB (SPEC 6.2). Uložit jde kdykoliv, povinný je jen název – ten se
 * v nouzi odvodí z textu.
 */
export default function RecipeEditScreen() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(routeId);

  const loaded = useLiveQuery(async () => {
    if (!routeId) return undefined;
    const recipe = await db.recipes.get(routeId);
    if (!recipe) return { recipe: null, items: [] };
    return { recipe, items: await getRecipeItems(routeId) };
  }, [routeId]);

  const tagSuggestions = useLiveQuery(async () => {
    const recipes = await db.recipes.toArray();
    const set = new Set<string>();
    for (const recipe of recipes) {
      if (!recipe.deletedAt) recipe.tags.forEach((tag) => set.add(tag));
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'cs'));
  }, []);

  const [name, setName] = useState('');
  const [capturedOn, setCapturedOn] = useState(todayIso());
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [prepMinutes, setPrepMinutes] = useState('');
  const [servings, setServings] = useState('');

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const ingredientsRef = useAutoGrow(ingredients);
  const instructionsRef = useAutoGrow(instructions);

  const idRef = useRef<string | null>(routeId ?? null);
  const loadedRef = useRef(!routeId); // nový recept je „načtený" hned
  const lastSaved = useRef('');
  /** Stav při otevření úprav – pro „Zahodit změny" (recept i suroviny s napojením). */
  const originalRef = useRef<{ recipe: Recipe; items: RecipeItem[]; snapshot: string } | null>(null);
  /** Po „Zahodit" už nic neukládat (doběhnutý debounce by změny vrátil). */
  const discardedRef = useRef(false);

  // Načtení existujícího receptu do formuláře (jen jednou).
  useEffect(() => {
    if (!routeId || loadedRef.current || !loaded) return;
    loadedRef.current = true;
    const recipe = loaded.recipe;
    if (!recipe) return;
    idRef.current = recipe.id;

    let ingText = loaded.items.map((item) => item.rawText).join('\n');
    const stepText = recipe.instructions ?? '';
    if (!ingText && !stepText && recipe.rawCapture) {
      ingText = recipe.rawCapture; // legacy recept z jednoho pole
    }

    const prepText = recipe.prepMinutes != null ? String(recipe.prepMinutes) : '';
    const servingsText = recipe.servings != null ? String(recipe.servings).replace('.', ',') : '';
    setName(recipe.name);
    setCapturedOn(recipe.capturedOn);
    setIngredients(ingText);
    setInstructions(stepText);
    setTags(recipe.tags);
    setPrepMinutes(prepText);
    setServings(servingsText);
    lastSaved.current = snapshotOf(
      recipe.name,
      recipe.capturedOn,
      ingText,
      stepText,
      recipe.tags,
      prepText,
      servingsText,
    );
    originalRef.current = { recipe, items: loaded.items, snapshot: lastSaved.current };
  }, [routeId, loaded]);

  function buildContent(finalName: string): RecipeContent {
    return {
      name: finalName,
      capturedOn,
      ingredientLines: splitIngredientLines(ingredients),
      instructions: instructions.trim() || null,
      rawCapture: combineRawCapture(ingredients, instructions),
      tags,
      prepMinutes: parseDecimal(prepMinutes),
      servings: positiveOrNull(parseDecimal(servings)),
    };
  }

  async function persist(finalName?: string): Promise<string> {
    const content = buildContent(finalName ?? name.trim());
    if (!idRef.current) {
      idRef.current = await createRecipeWithContent(content);
    } else {
      await updateRecipeContent(idRef.current, content);
    }
    return idRef.current;
  }

  const currentSnapshot = snapshotOf(name, capturedOn, ingredients, instructions, tags, prepMinutes, servings);
  const hasContent = name.trim() !== '' || ingredients.trim() !== '' || instructions.trim() !== '';
  // Je co zahodit: u úpravy změna oproti otevření, u nového receptu cokoliv napsaného.
  const canDiscard = originalRef.current
    ? currentSnapshot !== originalRef.current.snapshot
    : !isEdit && (hasContent || idRef.current !== null);

  // Průběžné ukládání konceptu (debounce).
  useEffect(() => {
    if (!loadedRef.current || discardedRef.current) return;
    const snapshot = currentSnapshot;
    if (snapshot === lastSaved.current) return;
    if (!idRef.current && !hasContent) return;

    const timer = setTimeout(() => {
      if (discardedRef.current) return;
      void persist().then(() => {
        lastSaved.current = snapshot;
      });
    }, 500);
    return () => clearTimeout(timer);
    // persist čte aktuální stav ze closure; závislosti jsou samotná pole.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, capturedOn, ingredients, instructions, tags, prepMinutes, servings]);

  function deriveName(): string {
    const base = splitIngredientLines(ingredients)[0] ?? splitIngredientLines(instructions)[0] ?? '';
    return base.length > 80 ? base.slice(0, 80).trimEnd() : base;
  }

  async function handleSave() {
    const finalName = name.trim() || deriveName() || 'Bez názvu';
    // Beze změny nic neukládat – recept se jinak posune nahoru v řazení „Upravené".
    if (idRef.current && finalName === name && currentSnapshot === lastSaved.current) {
      navigate(`/recept/${idRef.current}`, { replace: true });
      return;
    }
    if (finalName !== name) setName(finalName);
    const id = await persist(finalName);
    lastSaved.current = snapshotOf(finalName, capturedOn, ingredients, instructions, tags, prepMinutes, servings);
    navigate(`/recept/${id}`, { replace: true });
  }

  async function handleClose() {
    if (idRef.current && currentSnapshot === lastSaved.current) {
      navigate(isEdit ? `/recept/${idRef.current}` : '/', { replace: true });
      return;
    }
    if (idRef.current || hasContent) {
      const id = await persist();
      navigate(isEdit ? `/recept/${id}` : '/', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }

  /** Úprava: recept zpět do stavu při otevření. Nový recept: do koše (jde obnovit). */
  async function handleDiscard() {
    discardedRef.current = true;
    setConfirmDiscard(false);
    const original = originalRef.current;
    if (original) {
      await restoreRecipeSnapshot(original.recipe, original.items);
      navigate(`/recept/${original.recipe.id}`, { replace: true });
      return;
    }
    if (idRef.current) await softDeleteRecipe(idRef.current);
    navigate('/', { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <ScreenHeader
        variant="stack"
        width="narrow"
        closeIcon
        onBack={() => void handleClose()}
        title={isEdit ? 'Upravit recept' : 'Nový recept'}
        actions={
          <>
            {canDiscard ? (
              <Button role="ghost" onClick={() => setConfirmDiscard(true)}>
                Zahodit
              </Button>
            ) : null}
            <Button role="primary" onClick={() => void handleSave()}>
              Uložit
            </Button>
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Název receptu"
          className="w-full border-b border-stone-200 dark:border-stone-700 bg-transparent py-2 text-lg font-medium outline-none placeholder:text-stone-400 focus:border-brand"
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
          <span className="flex items-center gap-2">
            <label htmlFor="capturedOn">Datum</label>
            <input
              id="capturedOn"
              type="date"
              value={capturedOn}
              onChange={(event) => setCapturedOn(event.target.value)}
              className="bg-transparent py-1.5 outline-none"
            />
          </span>
          <span className="flex items-center gap-2">
            <label htmlFor="prep">Doba</label>
            <input
              id="prep"
              value={prepMinutes}
              onChange={(event) => setPrepMinutes(event.target.value)}
              inputMode="numeric"
              placeholder="—"
              className="w-14 bg-transparent py-1.5 text-right outline-none placeholder:text-stone-400"
            />
            <span>min</span>
          </span>
          <span className="flex items-center gap-2">
            <label htmlFor="servings">Porcí</label>
            <input
              id="servings"
              value={servings}
              onChange={(event) => setServings(event.target.value)}
              inputMode="decimal"
              placeholder="—"
              className="w-10 bg-transparent py-1.5 text-right outline-none placeholder:text-stone-400"
            />
          </span>
        </div>

        <label className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Suroviny
        </label>
        <textarea
          ref={ingredientsRef}
          value={ingredients}
          onChange={(event) => setIngredients(event.target.value)}
          autoFocus={!isEdit}
          placeholder={
            'jedna surovina na řádek…\n\n# Na těsto (nadpis sekce)\n4 velký brambory\n2 vejce\nhrst hladký mouky'
          }
          className="mt-1 min-h-[20dvh] resize-none overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 leading-relaxed outline-none placeholder:text-stone-300 focus:border-brand"
        />

        <label className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Postup
        </label>
        <textarea
          ref={instructionsRef}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder={'jak to uvařit…\n\nNastrouhat najemno, osmažit na sádle na prudkém ohni.'}
          className="mt-1 min-h-[22dvh] resize-none overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 leading-relaxed outline-none placeholder:text-stone-300 focus:border-brand"
        />

        <label className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Štítky
        </label>
        <div className="mt-1">
          <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions ?? []} />
        </div>

        <p className="py-3 text-center text-xs text-stone-400">
          Ukládá se průběžně. Uložit jde kdykoliv, obě pole jsou nepovinná.
        </p>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title={isEdit ? 'Zahodit změny?' : 'Zahodit recept?'}
        confirmLabel="Zahodit"
        confirmRole="destructive"
        onConfirm={() => void handleDiscard()}
        onCancel={() => setConfirmDiscard(false)}
      >
        {isEdit ? 'Recept zůstane, jak byl před úpravou.' : 'Recept se přesune do koše.'}
      </ConfirmDialog>
    </div>
  );
}
