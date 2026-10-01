import type { Food, Recipe, RecipeItem } from '../db';
import { parseLeadingQuantity } from './scale';
import { normalizeForSearch } from './search';

/**
 * Párování textu suroviny na potravinu (automatické napojení, UC-kalorie 2026-09-26).
 * Čistá logika: z volného textu vytáhne název potraviny, vybere NEJLEPŠÍ shodu (ne první)
 * a pamatuje si, jak uživatel dřív napojoval stejný text. Text suroviny se nikdy nemění
 * (pravidlo 2) – výsledek je jen návrh, který UI uloží jako napojení (nullable, pravidlo 1).
 */

// Jednotky a výplňová slova hned za množstvím („100g of skyr", „2 lžíce kakaa", „1tsp …").
// Porovnává se bez diakritiky a velikosti písmen.
const UNIT_WORD_RE =
  /^(?:polevkov[aeu]|cajov[aeu]|kavov[aeu]|vrchovat[aeu]|zarovnan[aeu]|g|gr|gram[uy]?|grams?|dkg|dag|deka?|kg|kila?|ml|dl|cl|l|litr[uy]?|ks|kus[uy]?|lzic[ei]?|lzick[auy]|lzicek|hrst[i]?|spetk[auy]|strouz(?:ek|ky|ku)|plat(?:ek|ky)|baleni|tsp|tbsp|tablespoons?|teaspoons?|cups?|cloves?|pinch(?:es)?|slices?|bowls?|cans?|of|na)$/;

// Předložky: slova za nimi jsou doplněk („prášek DO PEČIVA", „mouka NA PIZZU"), ne hlavní název.
const PREPOSITIONS = new Set(['do', 'na', 's', 'se', 'z', 'ze', 'v', 'of', 'for', 'with', 'to']);
// Slova, která o potravině nic neříkají.
const STOPWORDS = new Set([...PREPOSITIONS, 'a', 'the', 'and', 'trochu', 'cca', 'asi', 'kousek', 'about']);

/**
 * Název potraviny z textu suroviny: bez množství a jednotky, bez poznámky za čárkou,
 * pomlčkou nebo závorkou. Formát „Rice: 2 bowls" (název napřed) vrátí „Rice".
 */
export function extractFoodQuery(rawText: string): string {
  const labelFirst = rawText.match(/^([^:\d]{2,40}?)\*?:\s*\d/);
  if (labelFirst) return labelFirst[1].trim();

  // „medu nebo cukru" / „honey or sugar" → první možnost.
  let text = rawText.split(/[,(;]|\s[–-]\s|\s(?:nebo|or)\s/)[0].trim();
  const quantity = parseLeadingQuantity(text);
  if (quantity) text = quantity.rest;
  const words = text.split(/\s+/).filter(Boolean);
  while (words.length > 1 && UNIT_WORD_RE.test(normalizeForSearch(words[0]))) words.shift();
  // „1tsp" / „100g" bez mezery: parseLeadingQuantity nechá jednotku přilepenou ke slovu.
  return words.join(' ').replace(/^(?:tsp|tbsp|g|ml|kg)\s+/i, '').trim();
}

// Anglická slova z IG receptů → české názvy v databázi potravin. Víceslovné napřed.
const PHRASE_ALIASES: [RegExp, string][] = [
  [/\bbaking powder\b/, 'prasek do peciva'],
  [/\bcream cheese\b/, 'cerstvy syr smetanovy'],
  [/\bchicken breasts?\b/, 'kureci prsa'],
  [/\bolive oil\b/, 'olivovy olej'],
  [/\bbrown sugar\b/, 'hnedy cukr'],
  [/\bpowdered sugar|icing sugar\b/, 'cukr mouckovy'],
  [/\bprotein powder\b/, 'protein'],
  [/\bsoy sauce\b/, 'sojova omacka'],
  [/\bsesame oil\b/, 'sezamovy olej'],
  [/\bpeanut butter\b/, 'arasidove maslo'],
  [/\bgreek yog(?:h)?urt\b/, 'jogurt recky'],
];
const WORD_ALIASES: Record<string, string> = {
  flour: 'mouka hladka',
  sugar: 'cukr',
  butter: 'maslo',
  egg: 'vejce',
  eggs: 'vejce',
  milk: 'mleko',
  yogurt: 'jogurt',
  yoghurt: 'jogurt',
  oats: 'ovesne vlocky',
  cinnamon: 'skorice',
  honey: 'med',
  rice: 'ryze',
  beef: 'hovezi',
  pork: 'veprove',
  chicken: 'kureci',
  oil: 'olej',
  garlic: 'cesnek',
  onion: 'cibule',
  cocoa: 'kakao',
  banana: 'banan',
  bananas: 'banan',
  cheese: 'syr',
  cream: 'smetana',
  potato: 'brambory',
  potatoes: 'brambory',
  tomato: 'rajce',
  tomatoes: 'rajce',
  carrot: 'mrkev',
  apple: 'jablko',
  spinach: 'spenat',
  skyr: 'skyr',
  casein: 'kasein',
  whey: 'syrovatkovy',
  vanilla: 'vanilkovy',
  sweetener: 'sladidlo',
  erythritol: 'erythritol',
  parmesan: 'parmezan',
  // Česká slova, která se skloňují nepravidelně nebo se píšou jinak než v databázi.
  parmazan: 'parmezan',
  parmazanu: 'parmezan',
  mrkve: 'mrkev',
  mrkvi: 'mrkev',
  vajec: 'vejce',
  vajicka: 'vejce',
  spagety: 'testoviny',
  spaget: 'testoviny',
  spaghetti: 'testoviny',
  mozzarella: 'mozzarella',
  salmon: 'losos',
  tuna: 'tunak',
  shrimp: 'krevety',
  lemon: 'citron',
  lime: 'limetka',
  pasta: 'testoviny',
  broccoli: 'brokolice',
  cucumber: 'okurka',
  avocado: 'avokado',
  zucchini: 'cuketa',
  paprika: 'paprika',
  ginger: 'zazvor',
  chives: 'pazitka',
  coconut: 'kokos',
  almonds: 'mandle',
  walnuts: 'vlasske orechy',
  peanuts: 'arasidy',
};

function stem(token: string): string {
  const stripped = token.replace(/[aeiouy]+$/, '');
  return stripped.length >= 3 ? stripped : token;
}

interface QueryTokens {
  /** Všechna významová slova dotazu. */
  all: string[];
  /** Slova před první předložkou – aspoň jedno z nich musí v názvu potraviny být. */
  head: string[];
}

/** Normalizované tokeny dotazu (bez diakritiky, anglická slova přeložená, bez výplňových slov). */
function queryTokens(query: string): QueryTokens {
  let normalized = normalizeForSearch(query);
  for (const [re, czech] of PHRASE_ALIASES) normalized = normalized.replace(re, czech);
  const raw = normalized
    .split(/[^a-z0-9]+/)
    .flatMap((token) => (WORD_ALIASES[token] ?? token).split(' '))
    .filter(Boolean);
  const meaningful = (token: string) => token.length >= 2 && !STOPWORDS.has(token);
  const prepositionAt = raw.findIndex((token) => PREPOSITIONS.has(token));
  const head = (prepositionAt === -1 ? raw : raw.slice(0, prepositionAt)).filter(meaningful);
  return { all: raw.filter(meaningful), head };
}

function nameTokens(name: string): string[] {
  return normalizeForSearch(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token) && !/^\d+$/.test(token));
}

function tokenMatches(queryToken: string, nameToken: string): boolean {
  // Krátká slova jen přesně nebo přes kmen – „syr" (sýr) nesmí chytit „syrová", „medu" = „med".
  if (queryToken.length <= 3 || nameToken.length <= 3) {
    return queryToken === nameToken || stem(queryToken) === nameToken || stem(nameToken) === queryToken;
  }
  const q = stem(queryToken);
  const n = stem(nameToken);
  // Obráceně (dotaz začíná kmenem názvu) jen u delšího kmene: „parmazánu" nesmí chytit „para".
  return nameToken.startsWith(q) || (n.length >= 4 && queryToken.startsWith(n)) || q === n;
}

const MIN_SCORE = 8;

/**
 * Skóre shody dotazu s názvem potraviny: +10 za každé slovo dotazu, které v názvu je,
 * −2 za každé slovo názvu navíc („Máslo" > „Máslo přepuštěné (ghí)"), +3 když název
 * začíná některým slovem dotazu („Cukr krystal" > „Vanilkový cukr"). Aspoň polovina
 * slov dotazu musí sedět a mezi nimi aspoň jedno hlavní (před předložkou), jinak null.
 */
function scoreFood(query: QueryTokens, food: Food): number | null {
  const tokens = query.all;
  const names = nameTokens(food.name);
  if (names.length === 0 || tokens.length === 0) return null;
  const matches = (token: string) => names.some((name) => tokenMatches(token, name));
  const matchedQuery = tokens.filter(matches);
  // Polovina se počítá z hlavních slov (před předložkou) – „oleje na orestování" = „oleje".
  const required = query.head.length > 0 ? query.head : tokens;
  const matchedRequired = required.filter(matches).length;
  if (matchedRequired === 0 || matchedRequired * 2 < required.length) return null;
  const matchedNames = names.filter((name) => tokens.some((token) => tokenMatches(token, name)));
  const firstBonus = tokens.some((token) => tokenMatches(token, names[0])) ? 3 : 0;
  // Delší shodný začátek slova = bližší slovo („kakaa" je blíž „kakao" než „kaki"). Strop 5
  // znaků, ať dlouhé přídavné jméno („strouhaného") nepřebije samotnou potravinu („eidamu").
  const prefixBonus = matchedQuery.reduce((sum, token) => {
    const best = Math.max(...names.filter((name) => tokenMatches(token, name)).map((name) => commonPrefix(token, name)));
    return sum + Math.min(best, 5) * 3;
  }, 0);
  // Recepty píšou syrovou váhu: „Rýže vařená" jen když to dotaz sám říká.
  const cooked = (token: string) => /^(?:varen|cooked)/.test(token);
  const cookedPenalty = names.some(cooked) && !tokens.some(cooked) ? 6 : 0;
  return (
    matchedQuery.length * 10 -
    (names.length - matchedNames.length) * 2 +
    firstBonus +
    prefixBonus -
    cookedPenalty
  );
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/** Nejlepší potravina pro dotaz, nebo null, když nic nesedí dost. Při shodě skóre vyhrává dřívější. */
export function bestFoodMatch(query: string, foods: readonly Food[]): Food | null {
  const tokens = queryTokens(query);
  let best: Food | null = null;
  let bestScore = MIN_SCORE - 1;
  for (const food of foods) {
    if (food.deletedAt) continue;
    const score = scoreFood(tokens, food);
    if (score !== null && score > bestScore) {
      best = food;
      bestScore = score;
    }
  }
  return best;
}

/** Klíč pro „naučené" napojení: normalizovaný název potraviny z textu suroviny. */
export function learnedKey(rawText: string): string {
  return normalizeForSearch(extractFoodQuery(rawText)).replace(/\s+/g, ' ').trim();
}

/**
 * Naučená napojení: jak uživatel dřív napojoval surovinu se stejným názvem (napříč recepty).
 * Vyhrává nejčastější potravina, při shodě ta z naposledy upraveného receptu (jedna oprava
 * tak přebije jeden starší omyl). Smazané potraviny a recepty v koši se ignorují.
 */
export function buildLearnedLinks(
  items: readonly RecipeItem[],
  foods: readonly Food[],
  recipes: readonly Pick<Recipe, 'id' | 'updatedAt' | 'deletedAt'>[] = [],
): Map<string, string> {
  const alive = new Set(foods.filter((food) => !food.deletedAt).map((food) => food.id));
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const stats = new Map<string, Map<string, { count: number; latest: string }>>();
  for (const item of items) {
    if (!item.foodId || !alive.has(item.foodId)) continue;
    const recipe = recipeById.get(item.recipeId);
    if (recipe?.deletedAt) continue;
    const key = learnedKey(item.rawText);
    if (!key) continue;
    const perFood = stats.get(key) ?? new Map<string, { count: number; latest: string }>();
    const prev = perFood.get(item.foodId) ?? { count: 0, latest: '' };
    const updatedAt = recipe?.updatedAt ?? '';
    perFood.set(item.foodId, { count: prev.count + 1, latest: updatedAt > prev.latest ? updatedAt : prev.latest });
    stats.set(key, perFood);
  }
  const learned = new Map<string, string>();
  for (const [key, perFood] of stats) {
    const [foodId] = [...perFood.entries()].sort(
      (a, b) => b[1].count - a[1].count || b[1].latest.localeCompare(a[1].latest),
    )[0];
    learned.set(key, foodId);
  }
  return learned;
}
