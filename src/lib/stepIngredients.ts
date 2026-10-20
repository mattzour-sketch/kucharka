/**
 * Které suroviny se zmiňují v kroku postupu (režim vaření ukáže jejich množství přímo
 * u kroku). Čistá logika, jen náznak: text suroviny ani kroku se nemění (pravidlo 2)
 * a nenalezená surovina prostě u kroku chybí.
 */
import { extractFoodQuery } from './foodMatch';
import { isIngredientHeading } from './ingredientSection';
import { normalizeForSearch } from './search';

// Obecná přídavná jména („velká cibule", „hladké mouky") – samy o sobě surovinu neurčují
// a v postupu se běžně objevují v jiném smyslu („ve velkém hrnci").
const GENERIC_ADJECTIVE_RE =
  /^(?:velk|mal|stredn|cerstv|mlet|strouhan|nakrajen|krajen|sekan|jemn|hrub|polohrub|hladk|bil|cerven|zelen|cern|sladk|polotucn|nizkotucn|plnotucn|tucn|mrazen|varen|syrov|such|domac|kvalitn)(?:y|a|e|i|eho|emu|ou|ych|ym|ymi)$/;

// Zbytek slova za společným začátkem = česká koncovka: prázdná, nebo začíná samohláskou
// („rýž|e" × „rýž|i", „smetan|a" × „smetan|ou", „vývar|" × „vývar|em"), nebo přídavné
// jméno na -cí od stejného slova („kuře|cí prsa" × „kuře|").
const ENDING_RE = /^(?:[aeiouy][a-z]{0,3}|ci[a-z]{0,3})?$/;

const MIN_COMMON_PREFIX = 3;

function words(text: string): string[] {
  return normalizeForSearch(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_COMMON_PREFIX);
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/** Stejné slovo v jiném pádě: společný začátek ≥ 3 a oba zbytky jsou jen koncovky. */
function sameWord(a: string, b: string): boolean {
  const prefix = commonPrefix(a, b);
  if (prefix < MIN_COMMON_PREFIX) return false;
  return ENDING_RE.test(a.slice(prefix)) && ENDING_RE.test(b.slice(prefix));
}

// Za předložkou je doplněk, ne název („prášek DO PEČIVA", „egg FOR egg wash").
const PREPOSITIONS = new Set(['do', 'na', 'pro', 's', 'se', 'z', 'ze', 'v', 've', 'k', 'ke', 'of', 'for', 'with', 'to']);
const FILLER_WORDS = new Set(['the', 'and', 'nebo', 'good', 'quality', 'large', 'small']);

/** Slova, podle kterých se surovina v kroku pozná (název bez množství, jednotky a obecných přívlastků). */
function ingredientKeywords(rawText: string): string[] {
  const all = normalizeForSearch(extractFoodQuery(rawText)).split(/[^a-z0-9]+/).filter(Boolean);
  const cut = all.findIndex((word, index) => index > 0 && PREPOSITIONS.has(word));
  return (cut > 0 ? all.slice(0, cut) : all).filter(
    (word) => word.length >= MIN_COMMON_PREFIX && !FILLER_WORDS.has(word) && !GENERIC_ADJECTIVE_RE.test(word),
  );
}

/**
 * Pro každý krok vrátí id surovin, které v něm padly (v pořadí surovin). Nadpisy
 * sekcí („# Na těsto") se přeskočí.
 */
export function matchStepIngredients(
  steps: readonly string[],
  ingredients: readonly { id: string; rawText: string }[],
): string[][] {
  const keyed = ingredients
    .filter((item) => !isIngredientHeading(item.rawText))
    .map((item) => ({ id: item.id, keywords: ingredientKeywords(item.rawText) }))
    .filter((item) => item.keywords.length > 0);

  return steps.map((step) => {
    const stepWords = words(step);
    return keyed
      .filter((item) => item.keywords.some((keyword) => stepWords.some((word) => sameWord(keyword, word))))
      .map((item) => item.id);
  });
}
