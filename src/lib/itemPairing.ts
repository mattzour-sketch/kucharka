import type { RecipeItem } from '../db';
import { learnedKey } from './foodMatch';
import { isIngredientHeading } from './ingredientSection';

/**
 * Párování řádků surovin po úpravě receptu na existující položky (2026-10-01). Díky tomu
 * oprava překlepu nebo změna množství neodpojí napojenou potravinu: položka si nechá id
 * i napojení. Čistá logika. Pořadí:
 * 1) stejný text (jako dřív),
 * 2) stejný název potraviny („200 g mouky" → „250 g mouky"),
 * 3) velmi podobný text – překlep („mukoy" → „mouky").
 * Nadpis sekce se páruje jen s nadpisem. Úplně jiná surovina se nespáruje (nová položka).
 */

const MIN_SIMILARITY = 0.75;

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** Podobnost 0–1 podle editační vzdálenosti (bez ohledu na velikost písmen a mezery). */
export function textSimilarity(a: string, b: string): number {
  const x = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const y = b.toLowerCase().replace(/\s+/g, ' ').trim();
  const longest = Math.max(x.length, y.length);
  return longest === 0 ? 1 : 1 - levenshtein(x, y) / longest;
}

/**
 * Pro každý nový řádek vrátí existující položku, která mu patří (nebo null = nová položka).
 * Každá existující položka se použije nejvýš jednou.
 */
export function pairEditedLines(existing: readonly RecipeItem[], lines: readonly string[]): (RecipeItem | null)[] {
  const result: (RecipeItem | null)[] = lines.map(() => null);
  const used = new Set<string>();

  // 1) Stejný text.
  const byText = new Map<string, RecipeItem[]>();
  for (const item of [...existing].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = byText.get(item.rawText) ?? [];
    list.push(item);
    byText.set(item.rawText, list);
  }
  lines.forEach((line, index) => {
    const item = byText.get(line)?.shift();
    if (item) {
      result[index] = item;
      used.add(item.id);
    }
  });

  // 2) + 3) Upravené řádky: nejlepší zbylá položka podle názvu potraviny, pak podle podobnosti.
  lines.forEach((line, index) => {
    if (result[index]) return;
    const heading = isIngredientHeading(line);
    const key = heading ? '' : learnedKey(line);
    let best: RecipeItem | null = null;
    let bestScore = 0;
    for (const item of existing) {
      if (used.has(item.id) || isIngredientHeading(item.rawText) !== heading) continue;
      const sameFood = key !== '' && learnedKey(item.rawText) === key;
      const similarity = textSimilarity(line, item.rawText);
      if (!sameFood && similarity < MIN_SIMILARITY) continue;
      // Stejný název má přednost; při shodě rozhodne podobnost a blízkost pořadí.
      const score = (sameFood ? 2 : 1) + similarity - Math.abs(item.sortOrder - index) * 0.01;
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
    if (best) {
      result[index] = best;
      used.add(best.id);
    }
  });

  return result;
}
