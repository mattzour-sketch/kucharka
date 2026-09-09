import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Food, type FoodPortion } from '../../db';
import { parseDecimal, formatNumber } from '../../lib/num';
import { parseIngredientLine } from '../../lib/ingredientParse';
import { matchesQuery } from '../../lib/search';
import {
  deriveInitialAmountValue,
  resolveAmount,
  unitOptionsForFood,
  type AmountUnitOption,
  type AmountValue,
} from '../../lib/amount';
import { matchPortionInText } from '../../lib/portionMatch';
import { portionsForTargetKcal, type Nutrients } from '../../lib/nutrition';
import { addPortion } from '../foods/foodPortionsRepo';
import { nutritionFromData } from '../nutrition/recipeNutrition';
import NutritionSummary from '../nutrition/NutritionSummary';
import LinkPicker from './LinkPicker';
import { updateRecipeItemLink, updateRecipeMeta } from './recipesRepo';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import AmountPicker from '../../components/ui/AmountPicker';
import AddPortionInline from '../../components/ui/AddPortionInline';
import EmptyState from '../../components/ui/EmptyState';
import { cardClass } from '../../components/ui/cardClass';
import { ReadingSkeleton } from '../../components/ui/Loading';

/**
 * Návrh napojení podle textu suroviny (S4, „40g másla" → gramáž 40 + tip na
 * potravinu „máslo"). Jen návrh k potvrzení jedním klepnutím — `raw_text` se
 * nemění a nic se nenapojí samo (pravidlo 1, 2; mimo rozsah je jen tiché
 * automatické napojení bez potvrzení).
 */
/** Podrecept se zadává jen v gramech (UC016, rozhodnutí 1). */
const GRAMS_ONLY: AmountUnitOption[] = [{ id: 'g', kind: 'g', label: 'g', gramsPerUnit: 1 }];

function suggestFood(query: string, foods: Food[]): Food | null {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;
  return (
    foods.find(
      (food) => !food.deletedAt && matchesQuery(`${food.name} ${food.brand ?? ''}`, trimmed),
    ) ?? null
  );
}

/**
 * Škálování na cílové kcal/porci (UC024). Orientační pomůcka: z celkových kalorií
 * a finální hmotnosti dopočítá, na kolik porcí (a gramů/porci) recept vyjde, aby
 * porce měla ~cíl. Nepředstírá (pravidlo 4) — bez smysluplného cíle nic neukáže.
 */
function TargetKcalHint({ totalKcal, finalWeight }: { totalKcal: number; finalWeight: number }) {
  const [target, setTarget] = useState('');
  const parsed = parseDecimal(target);
  const result = parsed != null ? portionsForTargetKcal(totalKcal, finalWeight, parsed) : null;
  return (
    <div className="mt-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 text-sm">
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-stone-500">Cíl na porci</span>
        <input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          inputMode="decimal"
          placeholder="kcal"
          className="w-20 rounded-lg border border-stone-200 dark:border-stone-700 px-2 py-1 text-right outline-none focus:border-brand"
        />
        <span className="text-stone-500">kcal</span>
      </label>
      {result ? (
        <p className="mt-2 text-stone-600 dark:text-stone-300">
          ≈ <span className="font-medium">{formatNumber(result.portions, 1)}</span> porcí · ≈{' '}
          <span className="font-medium">{formatNumber(result.gramsPerPortion)}</span> g/porce
          <span className="ml-1 text-xs text-stone-400">(orientačně)</span>
        </p>
      ) : (
        <p className="mt-2 text-xs text-stone-400">
          Zadej cílové kcal na porci — spočítám počet porcí i gramáž.
        </p>
      )}
    </div>
  );
}

/**
 * Doplnění nutričních hodnot k receptu (SPEC 6.6). Levý text suroviny je
 * nedotknutelný – napojení potraviny ho nikdy nepřepíše (E-17). Souhrn se
 * přepočítává živě a vždy přiznává úplnost (R-31, E-13).
 */
export default function RecipeNutritionScreen() {
  const { id } = useParams();

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const recipe = await db.recipes.get(id);
    if (!recipe) return { recipe: null, foods: [], recipes: [], items: [], portions: [] };
    const [foods, recipes, items, portions] = await Promise.all([
      db.foods.toArray(),
      db.recipes.toArray(),
      db.recipeItems.toArray(),
      db.foodPortions.toArray(),
    ]);
    return { recipe, foods, recipes, items, portions };
  }, [id]);

  const [pickingItemId, setPickingItemId] = useState<string | null>(null);
  const [servings, setServings] = useState('');
  const [cookedWeight, setCookedWeight] = useState('');
  const [values, setValues] = useState<Record<string, AmountValue>>({});
  const [addMeasureItemId, setAddMeasureItemId] = useState<string | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!data || !data.recipe || seededRef.current) return;
    seededRef.current = true;
    setServings(data.recipe.servings != null ? String(data.recipe.servings) : '');
    setCookedWeight(data.recipe.cookedWeightG != null ? String(data.recipe.cookedWeightG) : '');
    const localFoodMap = new Map(data.foods.map((food) => [food.id, food]));
    const localPortions = new Map<string, FoodPortion[]>();
    for (const portion of data.portions) {
      if (portion.deletedAt) continue;
      const list = localPortions.get(portion.foodId) ?? [];
      list.push(portion);
      localPortions.set(portion.foodId, list);
    }
    const initialValues: Record<string, AmountValue> = {};
    for (const item of data.items) {
      if (item.recipeId !== id) continue;
      let options: AmountUnitOption[];
      if (item.subRecipeId) {
        options = GRAMS_ONLY;
      } else {
        const food = item.foodId ? localFoodMap.get(item.foodId) : undefined;
        options = unitOptionsForFood(food, item.foodId ? (localPortions.get(item.foodId) ?? []) : []);
      }
      initialValues[item.id] = deriveInitialAmountValue(item, options);
    }
    setValues(initialValues);
  }, [data, id]);

  if (data === undefined) {
    return (
      <div className="min-h-dvh">
        <ScreenHeader
          variant="stack"
          width="narrow"
          backTo={id ? `/recept/${id}` : '/'}
          backLabel="Zpět na recept"
          title="Kalorie"
        />
        <main className="mx-auto max-w-2xl px-4 py-4">
          <ReadingSkeleton />
        </main>
      </div>
    );
  }
  if (!data || !data.recipe || !id) {
    return (
      <div className="min-h-dvh">
        <ScreenHeader variant="stack" width="narrow" backTo="/" backLabel="Zpět na seznam" title="Kalorie" />
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

  // Zúžená (nenull) reference pro použití v closurech (linkSubRecipe apod.).
  const loadedData = data;
  const items = data.items
    .filter((item) => item.recipeId === id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const foodMap = new Map(data.foods.map((food) => [food.id, food]));
  const portionsByFood = new Map<string, FoodPortion[]>();
  for (const portion of data.portions) {
    if (portion.deletedAt) continue;
    const list = portionsByFood.get(portion.foodId) ?? [];
    list.push(portion);
    portionsByFood.set(portion.foodId, list);
  }
  const nutrition = nutritionFromData(id, {
    foods: data.foods,
    recipes: data.recipes,
    items: data.items,
  });

  // Nesmazané recepty pro název podreceptu (smazaný/neznámý → „recept nedostupný").
  const recipeMap = new Map(data.recipes.filter((recipe) => !recipe.deletedAt).map((recipe) => [recipe.id, recipe]));
  // Hodnoty podreceptů na 100 g (jednou za render) pro příspěvek na řádku.
  const subRecipePer100 = new Map<string, Nutrients | null>();
  for (const item of items) {
    if (item.subRecipeId && !subRecipePer100.has(item.subRecipeId)) {
      const sub = nutritionFromData(item.subRecipeId, {
        foods: data.foods,
        recipes: data.recipes,
        items: data.items,
      });
      subRecipePer100.set(item.subRecipeId, sub.per100g);
    }
  }

  function optionsFor(foodId: string | null | undefined): AmountUnitOption[] {
    const food = foodId ? foodMap.get(foodId) : undefined;
    return unitOptionsForFood(food, foodId ? (portionsByFood.get(foodId) ?? []) : []);
  }

  // Zapíše hodnotu pickeru na surovinu: `amountG` (a u „ks" i `amountKs`) je zdroj
  // pravdy pro kcal (OO2 – míra se neukládá, jen její výsledná gramáž).
  function commitValue(itemId: string, next: AmountValue, options: AmountUnitOption[]) {
    setValues((prev) => ({ ...prev, [itemId]: next }));
    const { amountG, amountKs } = resolveAmount(next, options);
    void updateRecipeItemLink(itemId, { amountG, amountKs });
  }

  // Napojení potraviny na surovinu — ať přijde z ručního výběru, nebo z návrhu
  // (viz suggestFood výše). Předvyplnění výběru: 1) míra rozpoznaná z textu (OO5),
  // 2) „ks" u potraviny s hmotností kusu, 3) gramáž z textu, když je pole prázdné.
  function linkFood(itemId: string, foodId: string, food: Food | undefined, rawText: string) {
    void updateRecipeItemLink(itemId, { foodId, isSkipped: false });
    const portions = portionsByFood.get(foodId) ?? [];
    const options = unitOptionsForFood(food, portions);
    const match = matchPortionInText(rawText, portions);
    if (match) {
      commitValue(itemId, { unitId: match.portionId, raw: String(match.count) }, options);
      return;
    }
    if (food?.pieceGrams) {
      setValues((prev) => ({ ...prev, [itemId]: { unitId: 'ks', raw: '' } }));
      return;
    }
    const existingRaw = values[itemId]?.raw ?? '';
    if (existingRaw !== '') {
      setValues((prev) => ({ ...prev, [itemId]: { unitId: 'g', raw: existingRaw } }));
      return;
    }
    const parsedAmount = parseIngredientLine(rawText).amountG;
    commitValue(itemId, { unitId: 'g', raw: parsedAmount != null ? String(parsedAmount) : '' }, options);
  }

  // Inline „+ míra" u suroviny: uloží míru k potravině a rovnou ji vybere (počet 1).
  async function addMeasureForItem(itemId: string, foodId: string, label: string, grams: number) {
    const added = await addPortion(foodId, label, grams);
    setValues((prev) => ({ ...prev, [itemId]: { unitId: added.id, raw: '1' } }));
    void updateRecipeItemLink(itemId, { amountG: added.grams, amountKs: null });
    setAddMeasureItemId(null);
  }

  // Napojení podreceptu (UC016). Předvyplní spočítanou finální hmotnost podreceptu,
  // ať uživatel nemusí vážit celý hrnec. Repo vynuluje foodId/amountKs (vzájemné vyloučení).
  function linkSubRecipe(itemId: string, subRecipeId: string) {
    const sub = nutritionFromData(subRecipeId, {
      foods: loadedData.foods,
      recipes: loadedData.recipes,
      items: loadedData.items,
    });
    const amountG = sub.finalWeight != null ? Math.round(sub.finalWeight) : null;
    void updateRecipeItemLink(itemId, { subRecipeId, isSkipped: false, amountG });
    setValues((prev) => ({ ...prev, [itemId]: { unitId: 'g', raw: amountG != null ? String(amountG) : '' } }));
  }

  return (
    <div className="min-h-dvh">
      <ScreenHeader
        variant="stack"
        width="narrow"
        backTo={`/recept/${id}`}
        backLabel="Zpět na recept"
        title="Kalorie"
      />

      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-stone-500">Porcí</span>
            <input
              value={servings}
              onChange={(event) => {
                setServings(event.target.value);
                void updateRecipeMeta(id, { servings: parseDecimal(event.target.value) });
              }}
              inputMode="decimal"
              placeholder="—"
              className="w-16 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-stone-500">Hmotnost po uvaření (g)</span>
            <input
              value={cookedWeight}
              onChange={(event) => {
                setCookedWeight(event.target.value);
                void updateRecipeMeta(id, { cookedWeightG: parseDecimal(event.target.value) });
              }}
              inputMode="decimal"
              placeholder="—"
              className="w-24 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 outline-none focus:border-brand"
            />
          </label>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => {
            const food = item.foodId ? foodMap.get(item.foodId) : undefined;
            const contribution =
              food && item.amountG != null ? (food.energyKcal * item.amountG) / 100 : null;
            const options = item.subRecipeId ? GRAMS_ONLY : optionsFor(item.foodId);
            const value = values[item.id] ?? deriveInitialAmountValue(item, options);
            const currentOption = options.find((option) => option.id === value.unitId);
            const isGramUnit = !currentOption || currentOption.kind === 'g';
            // U „g" ukaž kcal (jako dřív); u „ks"/míry ukaž dopočtenou gramáž,
            // ať je vidět, z čeho číslo vzniklo („2 lžíce" → 30 g).
            const readout = isGramUnit
              ? contribution != null
                ? `${formatNumber(contribution)} kcal`
                : ''
              : item.amountG != null
                ? `${formatNumber(item.amountG)} g`
                : '';
            // Podrecept: název + příspěvek (nebo „bez kalorií" u nespočitatelného/nedostupného).
            const subRecipe = item.subRecipeId ? recipeMap.get(item.subRecipeId) : undefined;
            const subPer100 = item.subRecipeId ? (subRecipePer100.get(item.subRecipeId) ?? null) : null;
            const subContribution =
              subPer100 && item.amountG != null ? (subPer100.kcal * item.amountG) / 100 : null;
            const subReadout =
              subPer100 == null
                ? 'bez kalorií'
                : subContribution != null
                  ? `${formatNumber(subContribution)} kcal`
                  : '';
            const suggestion =
              !food && !item.isSkipped
                ? suggestFood(parseIngredientLine(item.rawText).foodQuery, data.foods)
                : null;
            return (
              <li key={item.id} className={cardClass({ padding: 'row' })}>
                <p className="font-medium">{item.rawText}</p>

                {item.isSkipped ? (
                  <div className="mt-1 flex items-center justify-between text-sm text-stone-400">
                    <span>přeskočeno</span>
                    <button
                      type="button"
                      onClick={() => void updateRecipeItemLink(item.id, { isSkipped: false })}
                      className="font-medium text-brand dark:text-amber-400"
                    >
                      vrátit
                    </button>
                  </div>
                ) : food ? (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-stone-600 dark:text-stone-300">→ {food.name}</span>
                      <AmountPicker
                        options={options}
                        value={value}
                        onChange={(next) => commitValue(item.id, next, options)}
                      />
                      <span className="w-14 text-right text-xs text-stone-400">{readout}</span>
                      <IconButton
                        size="sm"
                        onClick={() => {
                          void updateRecipeItemLink(item.id, {
                            foodId: null,
                            amountG: null,
                            amountKs: null,
                          });
                          setValues((prev) => ({ ...prev, [item.id]: { unitId: 'g', raw: '' } }));
                          setAddMeasureItemId((prev) => (prev === item.id ? null : prev));
                        }}
                        aria-label="Odpojit potravinu"
                      >
                        ×
                      </IconButton>
                    </div>
                    {addMeasureItemId === item.id ? (
                      <div className="mt-2">
                        <AddPortionInline
                          onAdd={(label, grams) =>
                            void addMeasureForItem(item.id, food.id, label, grams)
                          }
                          onClose={() => setAddMeasureItemId(null)}
                        />
                      </div>
                    ) : (
                      <div className="mt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setAddMeasureItemId(item.id)}
                          className="text-xs font-medium text-brand dark:text-amber-400"
                        >
                          + míra
                        </button>
                      </div>
                    )}
                  </div>
                ) : item.subRecipeId ? (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-stone-600 dark:text-stone-300">
                        → {subRecipe ? subRecipe.name : 'recept nedostupný'}
                        <span className="ml-1 text-xs text-stone-400">recept</span>
                      </span>
                      <AmountPicker
                        options={GRAMS_ONLY}
                        value={value}
                        onChange={(next) => commitValue(item.id, next, GRAMS_ONLY)}
                      />
                      <span className="w-16 text-right text-xs text-stone-400">{subReadout}</span>
                      <IconButton
                        size="sm"
                        onClick={() => {
                          void updateRecipeItemLink(item.id, {
                            subRecipeId: null,
                            amountG: null,
                            amountKs: null,
                          });
                          setValues((prev) => ({ ...prev, [item.id]: { unitId: 'g', raw: '' } }));
                        }}
                        aria-label="Odpojit podrecept"
                      >
                        ×
                      </IconButton>
                    </div>
                    {subRecipe && subPer100 == null ? (
                      <p className="mt-1 text-xs text-stone-400">
                        {subRecipe.name} nemá napojené suroviny —{' '}
                        <Link
                          className="font-medium text-brand dark:text-amber-400"
                          to={`/recept/${item.subRecipeId}/kalorie`}
                        >
                          doplnit
                        </Link>
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {suggestion ? (
                      <Button
                        role="secondary"
                        onClick={() => linkFood(item.id, suggestion.id, suggestion, item.rawText)}
                      >
                        → {suggestion.name}?
                      </Button>
                    ) : null}
                    <Button role="tint" onClick={() => setPickingItemId(item.id)}>
                      napojit
                    </Button>
                    <Button
                      role="ghost"
                      onClick={() => void updateRecipeItemLink(item.id, { isSkipped: true })}
                    >
                      přeskočit
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {items.length === 0 ? (
          <EmptyState title="Recept nemá suroviny" description="Přidej je v úpravě receptu." />
        ) : null}

        <div className="mt-5">
          {nutrition.computable || nutrition.hasCycle ? (
            <NutritionSummary result={nutrition} />
          ) : (
            <p className="text-center text-sm text-stone-400">
              Napoj suroviny na potraviny a doplň gramáž, ať se spočítají kalorie.
            </p>
          )}
        </div>

        {nutrition.computable && nutrition.total && nutrition.finalWeight ? (
          <TargetKcalHint totalKcal={nutrition.total.kcal} finalWeight={nutrition.finalWeight} />
        ) : null}
      </main>

      {pickingItemId ? (
        <LinkPicker
          currentRecipeId={id}
          onSelect={(target) => {
            const pickedItem = items.find((item) => item.id === pickingItemId);
            if (target.kind === 'food') {
              linkFood(
                pickingItemId,
                target.foodId,
                foodMap.get(target.foodId),
                pickedItem?.rawText ?? '',
              );
            } else {
              linkSubRecipe(pickingItemId, target.subRecipeId);
            }
            setPickingItemId(null);
          }}
          onClose={() => setPickingItemId(null)}
        />
      ) : null}
    </div>
  );
}
