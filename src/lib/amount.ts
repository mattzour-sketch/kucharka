import type { Food, FoodPortion } from '../db';
import { parseDecimal } from './num';
import { matchPortionInText } from './portionMatch';

/**
 * Sjednocená logika zadávání množství suroviny (UC017): gramy / kusy / domácí míry.
 * Dnes byla ta samá logika inline na třech místech (obrazovka Kalorie, náhrada a
 * přidání ve vaření). Sem se stáhla, otestovala a UI ji jen volá.
 *
 * Zásady (CLAUDE.md): interně gramy a PLNÁ přesnost (pravidlo 9) – `amountG` se
 * počítá bez předběžného zaokrouhlení; `round2` je jen na zobrazovaném počtu při
 * ručním přepnutí jednotky. Ukládá se vždy jen `amountG`/`amountKs` (OO2) – míra je
 * pomůcka při zadávání, ne trvalý atribut suroviny.
 */

export type AmountUnitKind = 'g' | 'ks' | 'portion';

/** Jedna volitelná jednotka v pickeru. `gramsPerUnit` = kolik gramů je 1 jednotka. */
export interface AmountUnitOption {
  /** 'g', 'ks', nebo id domácí míry (`FoodPortion.id`). */
  id: string;
  kind: AmountUnitKind;
  label: string;
  gramsPerUnit: number;
}

/** Stav pickeru: zvolená jednotka + uživatelem psané číslo (smí být '' i s čárkou). */
export interface AmountValue {
  unitId: string;
  raw: string;
}

/** Co se uloží na surovinu. `amountG` je zdroj pravdy pro kcal. */
export interface AmountResult {
  amountG: number | null;
  amountKs: number | null;
}

/** Zaokrouhlení pro ZOBRAZENÝ počet (ne pro data). */
function formatRaw(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Nabídka jednotek pro potravinu: vždy „g", je-li `pieceGrams` tak „ks", a za
 * každou platnou domácí míru jedna volba (v pořadí, jak přišly). Nevalidní míra
 * (prázdný název / nekladná gramáž) se do nabídky nedostane.
 */
export function unitOptionsForFood(
  food: Pick<Food, 'pieceGrams'> | undefined | null,
  portions: readonly Pick<FoodPortion, 'id' | 'label' | 'grams'>[],
): AmountUnitOption[] {
  const options: AmountUnitOption[] = [{ id: 'g', kind: 'g', label: 'g', gramsPerUnit: 1 }];
  if (food?.pieceGrams) {
    options.push({ id: 'ks', kind: 'ks', label: 'ks', gramsPerUnit: food.pieceGrams });
  }
  // Míry řadíme podle gramáže (shodně s `listPortions` v editoru), ať je pořadí
  // v pickeru i v editaci potraviny stejné. Nevalidní míry vynecháme (OO7).
  const sortedPortions = [...portions]
    .filter((portion) => portion.label.trim() !== '' && portion.grams > 0)
    .sort((a, b) => a.grams - b.grams || a.label.localeCompare(b.label, 'cs'));
  for (const portion of sortedPortions) {
    options.push({ id: portion.id, kind: 'portion', label: portion.label, gramsPerUnit: portion.grams });
  }
  return options;
}

/**
 * Převede stav pickeru na uložitelné `amountG`/`amountKs`.
 * - g:  `amountG = n` (''→null, '0'→0), `amountKs = null` — bajt-identické s dneškem.
 * - ks: `amountKs = n`, `amountG = n * gramsPerUnit` (nebo null) — beze změny.
 * - míra: `amountG = n * gramsPerUnit` jen pro n>0, jinak null; `amountKs = null`.
 */
export function resolveAmount(
  value: AmountValue,
  options: readonly AmountUnitOption[],
): AmountResult {
  const option = options.find((o) => o.id === value.unitId) ?? options[0];
  if (!option) return { amountG: null, amountKs: null };
  const n = parseDecimal(value.raw);
  if (option.kind === 'g') {
    return { amountG: n, amountKs: null };
  }
  if (option.kind === 'ks') {
    return {
      amountKs: n,
      amountG: n != null && option.gramsPerUnit ? n * option.gramsPerUnit : null,
    };
  }
  return {
    amountG: n != null && n > 0 ? n * option.gramsPerUnit : null,
    amountKs: null,
  };
}

/**
 * Přepnutí jednotky se zachováním fyzických gramů (zobecnění dnešního g↔ks toggle).
 * Zaokrouhlí se jen zobrazený počet; do `amountG` se převod nepromítá dřív, než ho
 * spočítá `resolveAmount`.
 */
export function convertAmountUnit(
  value: AmountValue,
  options: readonly AmountUnitOption[],
  toUnitId: string,
): AmountValue {
  const to = options.find((o) => o.id === toUnitId);
  if (!to) return value;
  const from = options.find((o) => o.id === value.unitId);
  const n = parseDecimal(value.raw);
  if (from == null || n == null) return { unitId: toUnitId, raw: '' };
  const grams = n * from.gramsPerUnit;
  const converted = to.gramsPerUnit ? grams / to.gramsPerUnit : 0;
  return { unitId: toUnitId, raw: formatRaw(converted) };
}

/**
 * Odvození počáteční jednotky při otevření/napojení (OO2 + must-fix „vidět původ čísla"):
 * - uložený `amountKs` → jednotka „ks" (dnešní chování),
 * - jinak když `amountG` čistě sedí na počet × míru rozpoznanou z `raw_text`
 *   (`matchPortionInText`), ukáž míru („2 lžíce") místo holých gramů,
 * - jinak jednotka „g".
 * Úložiště zůstává jen gramáž – tohle je čistě odvození pro zobrazení a editaci.
 */
export function deriveInitialAmountValue(
  item: { amountG?: number | null; amountKs?: number | null; rawText: string },
  options: readonly AmountUnitOption[],
): AmountValue {
  if (item.amountKs != null && options.some((o) => o.id === 'ks')) {
    return { unitId: 'ks', raw: formatRaw(item.amountKs) };
  }
  if (item.amountG != null) {
    const portionOptions = options.filter((o) => o.kind === 'portion');
    if (portionOptions.length > 0) {
      const match = matchPortionInText(item.rawText, portionOptions);
      if (match) {
        const opt = portionOptions.find((o) => o.id === match.portionId);
        if (opt && Math.abs(item.amountG - match.count * opt.gramsPerUnit) < 0.5) {
          return { unitId: opt.id, raw: formatRaw(match.count) };
        }
      }
    }
    return { unitId: 'g', raw: formatRaw(item.amountG) };
  }
  return { unitId: 'g', raw: '' };
}
