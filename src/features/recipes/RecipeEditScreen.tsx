import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { todayIso } from '../../lib/date';
import { parseDecimal } from '../../lib/num';
import { combineRawCapture, splitIngredientLines } from '../../lib/recipeText';
import TagInput from './TagInput';
import {
  createRecipeWithContent,
  getRecipeItems,
  updateRecipeContent,
  type RecipeContent,
} from './recipesRepo';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';

function snapshotOf(
  name: string,
  capturedOn: string,
  ingredients: string,
  instructions: string,
  tags: string[],
  prepMinutes: string,
): string {
  return JSON.stringify([name, capturedOn, ingredients, instructions, tags, prepMinutes]);
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

  const idRef = useRef<string | null>(routeId ?? null);
  const loadedRef = useRef(!routeId); // nový recept je „načtený" hned
  const lastSaved = useRef('');

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
    setName(recipe.name);
    setCapturedOn(recipe.capturedOn);
    setIngredients(ingText);
    setInstructions(stepText);
    setTags(recipe.tags);
    setPrepMinutes(prepText);
    lastSaved.current = snapshotOf(recipe.name, recipe.capturedOn, ingText, stepText, recipe.tags, prepText);
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

  // Průběžné ukládání konceptu (debounce).
  useEffect(() => {
    if (!loadedRef.current) return;
    const snapshot = snapshotOf(name, capturedOn, ingredients, instructions, tags, prepMinutes);
    if (snapshot === lastSaved.current) return;

    const hasContent =
      name.trim() !== '' || ingredients.trim() !== '' || instructions.trim() !== '';
    if (!idRef.current && !hasContent) return;

    const timer = setTimeout(() => {
      void persist().then(() => {
        lastSaved.current = snapshot;
      });
    }, 500);
    return () => clearTimeout(timer);
    // persist čte aktuální stav ze closure; závislosti jsou samotná pole.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, capturedOn, ingredients, instructions, tags, prepMinutes]);

  function deriveName(): string {
    const base = splitIngredientLines(ingredients)[0] ?? splitIngredientLines(instructions)[0] ?? '';
    return base.length > 80 ? base.slice(0, 80).trimEnd() : base;
  }

  async function handleSave() {
    const finalName = name.trim() || deriveName() || 'Bez názvu';
    if (finalName !== name) setName(finalName);
    const id = await persist(finalName);
    lastSaved.current = snapshotOf(finalName, capturedOn, ingredients, instructions, tags, prepMinutes);
    navigate(`/recept/${id}`, { replace: true });
  }

  async function handleClose() {
    const hasContent =
      name.trim() !== '' || ingredients.trim() !== '' || instructions.trim() !== '';
    if (idRef.current || hasContent) {
      const id = await persist();
      navigate(isEdit ? `/recept/${id}` : '/', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
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
          <Button role="primary" onClick={() => void handleSave()}>
            Uložit
          </Button>
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
        </div>

        <label className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Suroviny
        </label>
        <textarea
          value={ingredients}
          onChange={(event) => setIngredients(event.target.value)}
          autoFocus={!isEdit}
          placeholder={
            'jedna surovina na řádek…\n\n# Na těsto (nadpis sekce)\n4 velký brambory\n2 vejce\nhrst hladký mouky'
          }
          className="mt-1 min-h-[20dvh] resize-none rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 leading-relaxed outline-none placeholder:text-stone-300 focus:border-brand"
        />

        <label className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Postup
        </label>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder={'jak to uvařit…\n\nNastrouhat najemno, osmažit na sádle na prudkém ohni.'}
          className="mt-1 min-h-[22dvh] flex-1 resize-none rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 leading-relaxed outline-none placeholder:text-stone-300 focus:border-brand"
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
    </div>
  );
}
