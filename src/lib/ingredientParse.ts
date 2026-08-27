import { foldDiacritics } from './search';

/**
 * Rozpoznání množství na začátku volného textu suroviny (SPEC E-12, pravidlo 1).
 * Slouží jen jako **návrh** při napojování potraviny na obrazovce Kalorie (S4) —
 * `raw_text` se tímhle nikdy nemění (pravidlo 2), jde jen o předvyplnění gramáže
 * a hledaného výrazu, aby uživatel nepsal „40" a „máslo" znovu, když už je
 * napsal v „40g másla".
 */
export interface ParsedIngredientLine {
  /** Gramáž odvozená z jednoznačné váhové/objemové jednotky (g, dkg, kg, ml, l). Null, když jednotka chybí nebo je nevažitelná (ks, hrst, lžíce…). */
  amountG: number | null;
  /** Zbytek textu po odseknutí čísla a jednotky — vstup pro hledání potraviny. */
  foodQuery: string;
}

/** Násobitel do gramů/mililitrů (app dál gramy a mililitry neodlišuje, viz recipeItems.amountG). */
const GRAM_UNITS: Record<string, number> = {
  g: 1,
  gram: 1,
  gramy: 1,
  gramu: 1,
  gramů: 1,
  dkg: 10,
  dag: 10,
  deko: 10,
  deka: 10,
  kg: 1000,
  kilo: 1000,
  kilogram: 1000,
  kilogramy: 1000,
  kilogramu: 1000,
  ml: 1,
  mililitr: 1,
  mililitry: 1,
  mililitru: 1,
  l: 1000,
  litr: 1000,
  litry: 1000,
  litru: 1000,
};

/** Nevažitelné, ale rozpoznatelné jednotky množství — odseknou se z dotazu, gramáž ale neurčují. */
const OTHER_QUANTITY_WORDS = new Set([
  'ks',
  'kus',
  'kusy',
  'kusu',
  'kusů',
  'lzice',
  'lzici',
  'lzic',
  'lzicka',
  'lzicky',
  'lzicek',
  'hrst',
  'hrsti',
  'spetka',
  'spetku',
  'strouzek',
  'strouzky',
  'platek',
  'platky',
  'baleni',
]);

function normalizeWord(word: string): string {
  return foldDiacritics(word).toLowerCase();
}

/** Rozpozná úvodní číslo a případnou jednotku, zbytek vrátí jako dotaz na potravinu. */
export function parseIngredientLine(rawText: string): ParsedIngredientLine {
  const trimmed = rawText.trim();
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(\S+)?\s*(.*)$/);

  if (!match) {
    return { amountG: null, foodQuery: trimmed };
  }

  const [, numberPart, wordPart, rest] = match;
  const quantity = Number(numberPart.replace(',', '.'));

  if (wordPart) {
    const normalizedWord = normalizeWord(wordPart);
    const gramMultiplier = GRAM_UNITS[normalizedWord];
    if (gramMultiplier != null) {
      return { amountG: quantity * gramMultiplier, foodQuery: rest.trim() };
    }
    if (OTHER_QUANTITY_WORDS.has(normalizedWord)) {
      return { amountG: null, foodQuery: rest.trim() };
    }
    // Slovo za číslem není známá jednotka — je to už název suroviny („2 vejce").
    return { amountG: null, foodQuery: `${wordPart} ${rest}`.trim() };
  }

  return { amountG: null, foodQuery: trimmed };
}
