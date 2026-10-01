import type { Food, FoodPortion, RecipeItem } from '../db';
import { bestFoodMatch, extractFoodQuery, learnedKey } from './foodMatch';
import { isIngredientHeading } from './ingredientSection';
import { parseIngredientLine } from './ingredientParse';
import { matchPortionInText } from './portionMatch';
import { parseLeadingQuantity } from './scale';
import { normalizeForSearch } from './search';

/**
 * Automatické napojení surovin receptu na potraviny jedním ťuknutím (2026-09-26).
 * Čistá logika: z textu každé nenapojené suroviny navrhne potravinu a množství.
 * Rozhodnutí uživatele:
 * - napárování se uloží rovnou (UI nabídne „Vrátit"), text suroviny se nemění (pravidla 1, 2);
 * - lžíce/lžička bez míry potraviny se odhadne (15 g / 5 g) a označí jako odhad;
 * - sůl, pepř, voda, špetka, „podle chuti" se automaticky přeskočí (≈ 0 kcal).
 * Nic se nevymýšlí: bez shody zůstane surovina nenapojená, bez čitelného množství bez gramáže
 * (pravidlo 4 – úplnost to přizná).
 */

export const SPOON_GRAMS = 15;
export const TEASPOON_GRAMS = 5;

export type AutoLinkEntry =
  | { itemId: string; kind: 'skip' }
  | {
      itemId: string;
      kind: 'link';
      foodId: string;
      amountG: number | null;
      amountKs: number | null;
      /** Množství je odhad z obecné lžíce/lžičky, ne z textu ani z míry potraviny. */
      estimated: boolean;
    };

const NEGLIGIBLE_WORDS = new Set([
  'sul',
  'soli',
  'pepr',
  'pepre',
  'peprem',
  'voda',
  'vody',
  'vodu',
  'vodou',
  'spetka',
  'spetku',
  'spetky',
  'salt',
  'pepper',
  'water',
  'pinch',
]);

/** Surovina s ≈ 0 kcal (sůl, pepř, voda, špetka, „podle chuti") – přeskočí se. */
export function isNegligible(rawText: string): boolean {
  const normalized = normalizeForSearch(rawText);
  if (/\bpodle chuti\b|\bto taste\b/.test(normalized)) return true;
  return normalized.split(/[^a-z0-9]+/).some((word) => NEGLIGIBLE_WORDS.has(word));
}

const SPOON_RE = /^(?:lzic[ei]?|tbsp|tablespoons?)$/;
const TEASPOON_RE = /^(?:lzick[auy]|lzicek|tsp|teaspoons?)$/;
const PIECE_UNIT_RE = /^(?:ks|kus[uy]?|strouz(?:ek|ky|ku)|cloves?)$/;
// Slovo za číslem, které je jednotkou (pak to není „4 vejce" = 4 kusy).
const OTHER_UNIT_RE = /^(?:g|gr|dkg|dag|kg|ml|dl|cl|l|hrst[i]?|spetk[auy]|plat(?:ek|ky)|baleni|cups?|bowls?|slices?|cans?|pinch(?:es)?)$/;

const MEASURE_MODIFIER_RE = /^(?:polevkov[aeu]|cajov[aeu]|kavov[aeu]|vrchovat[aeu]|zarovnan[aeu]|heaping|level)$/;

export interface ResolvedAmount {
  amountG: number | null;
  amountKs: number | null;
  estimated: boolean;
}

/**
 * Množství z textu suroviny pro napárovanou potravinu. Pořadí: gramy/ml v textu →
 * domácí míra potraviny („2 lžíce" a potravina má míru „lžíce") → kusy u potraviny
 * s hmotností kusu („4 vejce") → obecná lžíce/lžička (odhad) → nic.
 */
export function resolveAmountFromText(
  rawText: string,
  food: Food,
  portions: readonly FoodPortion[],
): ResolvedAmount {
  // „Beef*: 250g" – množství je za dvojtečkou.
  const labelFirst = rawText.match(/^[^:\d]{2,40}?\*?:\s*(\d.*)$/);
  const text = labelFirst ? labelFirst[1] : rawText;

  const grams = parseIngredientLine(text).amountG;
  if (grams != null) return { amountG: grams, amountKs: null, estimated: false };

  const alive = portions.filter((portion) => !portion.deletedAt);
  const portionMatch = matchPortionInText(text, alive);
  if (portionMatch) {
    const portion = alive.find((item) => item.id === portionMatch.portionId);
    if (portion) return { amountG: portionMatch.count * portion.grams, amountKs: null, estimated: false };
  }

  const quantity = parseLeadingQuantity(text);
  if (!quantity) return { amountG: null, amountKs: null, estimated: false };
  // „1 polévková lžíce", „1 čajová lžička", „2 vrchovaté lžíce" – přívlastek před jednotkou.
  const words = quantity.rest.split(/\s+/).map(normalizeForSearch);
  const unit = (MEASURE_MODIFIER_RE.test(words[0] ?? '') ? words[1] : words[0]) ?? '';
  if (food.pieceGrams && (PIECE_UNIT_RE.test(unit) || (!OTHER_UNIT_RE.test(unit) && !SPOON_RE.test(unit) && !TEASPOON_RE.test(unit)))) {
    return { amountG: quantity.amount * food.pieceGrams, amountKs: quantity.amount, estimated: false };
  }
  if (SPOON_RE.test(unit)) return { amountG: quantity.amount * SPOON_GRAMS, amountKs: null, estimated: true };
  if (TEASPOON_RE.test(unit)) return { amountG: quantity.amount * TEASPOON_GRAMS, amountKs: null, estimated: true };
  return { amountG: null, amountKs: null, estimated: false };
}

/** Surovina, kterou má smysl napojovat: není nadpis sekce, není přeskočená ani napojená. */
export function isUnlinked(item: RecipeItem): boolean {
  return !isIngredientHeading(item.rawText) && !item.isSkipped && !item.foodId && !item.subRecipeId;
}

/**
 * Plán napojení pro nenapojené suroviny receptu. Potravina: naučené napojení (jak to
 * uživatel napojil dřív) → nejlepší shoda názvu. Bez shody se surovina v plánu neobjeví.
 */
export function planAutoLinks(input: {
  items: readonly RecipeItem[];
  foods: readonly Food[];
  portions: readonly FoodPortion[];
  learned: ReadonlyMap<string, string>;
}): AutoLinkEntry[] {
  const foodById = new Map(input.foods.filter((food) => !food.deletedAt).map((food) => [food.id, food]));
  const plan: AutoLinkEntry[] = [];
  for (const item of input.items) {
    if (!isUnlinked(item)) continue;
    if (isNegligible(item.rawText)) {
      plan.push({ itemId: item.id, kind: 'skip' });
      continue;
    }
    const learnedId = input.learned.get(learnedKey(item.rawText));
    const food =
      (learnedId ? foodById.get(learnedId) : undefined) ??
      bestFoodMatch(extractFoodQuery(item.rawText), input.foods);
    if (!food) continue;
    const portions = input.portions.filter((portion) => portion.foodId === food.id);
    plan.push({ itemId: item.id, kind: 'link', foodId: food.id, ...resolveAmountFromText(item.rawText, food, portions) });
  }
  return plan;
}
