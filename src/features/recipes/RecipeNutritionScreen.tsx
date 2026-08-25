import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Food } from '../../db';
import { parseDecimal, formatNumber } from '../../lib/num';
import { parseIngredientLine } from '../../lib/ingredientParse';
import { matchesQuery } from '../../lib/search';
import { nutritionFromData } from '../nutrition/recipeNutrition';
import NutritionSummary from '../nutrition/NutritionSummary';
import FoodPicker from '../foods/FoodPicker';
import { updateRecipeItemLink, updateRecipeMeta } from './recipesRepo';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import EmptyState from '../../components/ui/EmptyState';
import { cardClass } from '../../components/ui/cardClass';
import { ReadingSkeleton } from '../../components/ui/Loading';

/**
 * Návrh napojení podle textu suroviny (S4, „40g másla" → gramáž 40 + tip na
 * potravinu „máslo"). Jen návrh k potvrzení jedním klepnutím — `raw_text` se
 * nemění a nic se nenapojí samo (pravidlo 1, 2; mimo rozsah je jen tiché
 * automatické napojení bez potvrzení).
 */
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
 * Doplnění nutričních hodnot k receptu (SPEC 6.6). Levý text suroviny je
 * nedotknutelný – napojení potraviny ho nikdy nepřepíše (E-17). Souhrn se
 * přepočítává živě a vždy přiznává úplnost (R-31, E-13).
 */
export default function RecipeNutritionScreen() {
  const { id } = useParams();

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const recipe = await db.recipes.get(id);
    if (!recipe) return { recipe: null, foods: [], recipes: [], items: [] };
    const [foods, recipes, items] = await Promise.all([
      db.foods.toArray(),
      db.recipes.toArray(),
      db.recipeItems.toArray(),
    ]);
    return { recipe, foods, recipes, items };
  }, [id]);

  const [pickingItemId, setPickingItemId] = useState<string | null>(null);
  const [servings, setServings] = useState('');
  const [cookedWeight, setCookedWeight] = useState('');
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [unit, setUnit] = useState<Record<string, 'g' | 'ks'>>({});
  const seededRef = useRef(false);

  useEffect(() => {
    if (!data || !data.recipe || seededRef.current) return;
    seededRef.current = true;
    setServings(data.recipe.servings != null ? String(data.recipe.servings) : '');
    setCookedWeight(data.recipe.cookedWeightG != null ? String(data.recipe.cookedWeightG) : '');
    const initialAmount: Record<string, string> = {};
    const initialUnit: Record<string, 'g' | 'ks'> = {};
    for (const item of data.items) {
      if (item.recipeId !== id) continue;
      if (item.amountKs != null) {
        initialUnit[item.id] = 'ks';
        initialAmount[item.id] = String(item.amountKs);
      } else {
        initialUnit[item.id] = 'g';
        initialAmount[item.id] = item.amountG != null ? String(item.amountG) : '';
      }
    }
    setAmount(initialAmount);
    setUnit(initialUnit);
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

  const items = data.items
    .filter((item) => item.recipeId === id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const foodMap = new Map(data.foods.map((food) => [food.id, food]));
  const nutrition = nutritionFromData(id, {
    foods: data.foods,
    recipes: data.recipes,
    items: data.items,
  });

  // Napojení potraviny na surovinu — ať přijde z ručního výběru, nebo z návrhu
  // (viz suggestFood výše). Gramáž se předvyplní z rawText, jen když ještě
  // není zadaná a potravina nemá hmotnost kusu (tam by „g" pletlo „ks").
  function linkFood(itemId: string, foodId: string, food: Food | undefined, rawText: string) {
    void updateRecipeItemLink(itemId, { foodId, isSkipped: false });
    if (food?.pieceGrams) {
      setUnit((prev) => ({ ...prev, [itemId]: 'ks' }));
      return;
    }
    if ((amount[itemId] ?? '') !== '') return;
    const parsedAmount = parseIngredientLine(rawText).amountG;
    if (parsedAmount == null) return;
    const value = String(parsedAmount);
    setUnit((prev) => ({ ...prev, [itemId]: 'g' }));
    setAmount((prev) => ({ ...prev, [itemId]: value }));
    persistAmount(itemId, value, 'g', null);
  }

  // U „ks" je zdroj pravdy počet kusů; gramáž (a tím kcal) se dopočítá z hmotnosti kusu.
  function persistAmount(itemId: string, value: string, u: 'g' | 'ks', pieceGrams: number | null) {
    const parsed = parseDecimal(value);
    if (u === 'ks') {
      void updateRecipeItemLink(itemId, {
        amountKs: parsed,
        amountG: parsed != null && pieceGrams ? parsed * pieceGrams : null,
      });
    } else {
      void updateRecipeItemLink(itemId, { amountG: parsed, amountKs: null });
    }
  }

  function toggleUnit(
    itemId: string,
    currentUnit: 'g' | 'ks',
    pieceGrams: number,
    itemG: number | null,
    itemKs: number | null,
  ) {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    if (currentUnit === 'g') {
      const grams = parseDecimal(amount[itemId] ?? '') ?? itemG;
      const next = grams != null ? String(round2(grams / pieceGrams)) : '';
      setUnit((prev) => ({ ...prev, [itemId]: 'ks' }));
      setAmount((prev) => ({ ...prev, [itemId]: next }));
      persistAmount(itemId, next, 'ks', pieceGrams);
    } else {
      const ks = parseDecimal(amount[itemId] ?? '') ?? itemKs;
      const next = ks != null ? String(round2(ks * pieceGrams)) : '';
      setUnit((prev) => ({ ...prev, [itemId]: 'g' }));
      setAmount((prev) => ({ ...prev, [itemId]: next }));
      persistAmount(itemId, next, 'g', pieceGrams);
    }
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
              className="w-16 rounded-xl border border-stone-200 bg-white px-3 py-1.5 outline-none focus:border-brand"
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
              className="w-24 rounded-xl border border-stone-200 bg-white px-3 py-1.5 outline-none focus:border-brand"
            />
          </label>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => {
            const food = item.foodId ? foodMap.get(item.foodId) : undefined;
            const contribution =
              food && item.amountG != null ? (food.energyKcal * item.amountG) / 100 : null;
            const currentUnit: 'g' | 'ks' = unit[item.id] ?? (item.amountKs != null ? 'ks' : 'g');
            const pieceGrams = food?.pieceGrams ?? null;
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
                      className="font-medium text-brand"
                    >
                      vrátit
                    </button>
                  </div>
                ) : food ? (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-stone-600">→ {food.name}</span>
                    <input
                      value={amount[item.id] ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAmount((prev) => ({ ...prev, [item.id]: value }));
                        persistAmount(item.id, value, currentUnit, pieceGrams);
                      }}
                      inputMode="decimal"
                      placeholder={currentUnit}
                      className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-right outline-none focus:border-brand"
                    />
                    {pieceGrams ? (
                      <button
                        type="button"
                        onClick={() =>
                          toggleUnit(
                            item.id,
                            currentUnit,
                            pieceGrams,
                            item.amountG ?? null,
                            item.amountKs ?? null,
                          )
                        }
                        className="w-8 shrink-0 rounded-lg border border-stone-200 py-1 text-xs font-medium text-stone-600"
                        aria-label="Přepnout jednotku g/ks"
                      >
                        {currentUnit}
                      </button>
                    ) : (
                      <span className="w-8 text-center text-xs text-stone-400">g</span>
                    )}
                    <span className="w-14 text-right text-xs text-stone-400">
                      {currentUnit === 'ks' && item.amountG != null
                        ? `${formatNumber(item.amountG)} g`
                        : contribution != null
                          ? `${formatNumber(contribution)} kcal`
                          : ''}
                    </span>
                    <IconButton
                      size="sm"
                      onClick={() =>
                        void updateRecipeItemLink(item.id, { foodId: null, amountKs: null })
                      }
                      aria-label="Odpojit potravinu"
                    >
                      ×
                    </IconButton>
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
                      napojit potravinu
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
      </main>

      {pickingItemId ? (
        <FoodPicker
          onSelect={(foodId) => {
            const pickedItem = items.find((item) => item.id === pickingItemId);
            linkFood(pickingItemId, foodId, foodMap.get(foodId), pickedItem?.rawText ?? '');
            setPickingItemId(null);
          }}
          onClose={() => setPickingItemId(null)}
        />
      ) : null}
    </div>
  );
}
