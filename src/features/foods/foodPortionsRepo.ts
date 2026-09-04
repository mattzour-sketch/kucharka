import { db, type FoodPortion } from '../../db';
import { newId } from '../../lib/id';
import { normalizeForSearch } from '../../lib/search';

/**
 * Domácí míry potraviny (UC017). Tabulka `foodPortions` v Dexie už existovala
 * (a je v záloze), tady k ní přibývá repo vrstva. Mazání je soft (pravidlo 7) –
 * `deletedAt`, aby se míra nevzkřísila z aditivní obnovy zálohy.
 */

/** Míra platí, jen když má neprázdný název a kladnou gramáž (OO7). */
function isValidGrams(grams: number | null): grams is number {
  return grams != null && grams > 0;
}

/** Aktivní míry potraviny (bez smazaných), v pořadí uložení dle gramáže. */
export async function listPortions(foodId: string): Promise<FoodPortion[]> {
  const rows = await db.foodPortions.where('foodId').equals(foodId).toArray();
  return rows
    .filter((portion) => !portion.deletedAt)
    .sort((a, b) => a.grams - b.grams || a.label.localeCompare(b.label, 'cs'));
}

/**
 * Přidá jednu míru (např. inline „+ míra" u suroviny). Když už aktivní míra se
 * stejným názvem existuje (OO7 dedup, case/diakritika-insensitive), vrátí ji beze
 * změny místo přidání druhé. Vrací id a platnou gramáž (existující, nebo novou).
 */
export async function addPortion(
  foodId: string,
  label: string,
  grams: number,
): Promise<{ id: string; grams: number }> {
  const trimmed = label.trim();
  const key = normalizeForSearch(trimmed);
  const existing = await listPortions(foodId);
  const duplicate = existing.find((portion) => normalizeForSearch(portion.label) === key);
  if (duplicate) return { id: duplicate.id, grams: duplicate.grams };
  const id = newId();
  await db.foodPortions.add({ id, foodId, label: trimmed, grams, deletedAt: null });
  return { id, grams };
}

export async function updatePortion(
  id: string,
  patch: { label?: string; grams?: number },
): Promise<void> {
  await db.foodPortions.update(id, patch);
}

/** Nikdy nemažeme natvrdo – jen `deletedAt` (pravidlo 7). */
export async function removePortion(id: string): Promise<void> {
  await db.foodPortions.update(id, { deletedAt: new Date().toISOString() });
}

/** Řádek z editoru potraviny (gramáž může být rozepsaná/neúplná). */
export interface PortionDraft {
  id?: string;
  label: string;
  grams: number | null;
}

export interface PortionPlan {
  add: { label: string; grams: number }[];
  update: { id: string; label: string; grams: number }[];
  remove: string[];
}

/**
 * Čistý diff draftů editoru proti uloženým mírám (testuje se bez DB).
 * - Nevalidní řádek (prázdný název / nekladná gramáž) se zahodí.
 * - Duplicitní název (case/diakritika-insensitive) – první výskyt vyhrává (OO7).
 * - Existující míra, která mezi validními drafty (dle id) chybí, jde do `remove`
 *   (sem spadne i řádek, u kterého uživatel smazal název – tím ho zneplatnil).
 */
export function planPortionChanges(
  existing: readonly FoodPortion[],
  drafts: readonly PortionDraft[],
): PortionPlan {
  const seen = new Set<string>();
  const valid: { id?: string; label: string; grams: number }[] = [];
  for (const draft of drafts) {
    const label = draft.label.trim();
    if (label === '' || !isValidGrams(draft.grams)) continue;
    const key = normalizeForSearch(label);
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push({ id: draft.id, label, grams: draft.grams });
  }

  const existingById = new Map(existing.map((portion) => [portion.id, portion]));
  const add: PortionPlan['add'] = [];
  const update: PortionPlan['update'] = [];
  const keptIds = new Set<string>();

  for (const item of valid) {
    const prev = item.id ? existingById.get(item.id) : undefined;
    if (item.id && prev) {
      keptIds.add(item.id);
      if (prev.label !== item.label || prev.grams !== item.grams) {
        update.push({ id: item.id, label: item.label, grams: item.grams });
      }
    } else {
      add.push({ label: item.label, grams: item.grams });
    }
  }

  const remove = existing
    .filter((portion) => !keptIds.has(portion.id))
    .map((portion) => portion.id);

  return { add, update, remove };
}

/** Spočítá plán z draftů a zapíše ho (jediný commit z editoru potraviny). */
export async function reconcilePortions(
  foodId: string,
  drafts: readonly PortionDraft[],
): Promise<void> {
  const existing = await listPortions(foodId);
  const plan = planPortionChanges(existing, drafts);
  if (plan.add.length === 0 && plan.update.length === 0 && plan.remove.length === 0) return;
  const now = new Date().toISOString();
  await db.transaction('rw', db.foodPortions, async () => {
    if (plan.add.length > 0) {
      await db.foodPortions.bulkAdd(
        plan.add.map((portion) => ({ id: newId(), foodId, label: portion.label, grams: portion.grams, deletedAt: null })),
      );
    }
    for (const change of plan.update) {
      await db.foodPortions.update(change.id, { label: change.label, grams: change.grams });
    }
    for (const id of plan.remove) {
      await db.foodPortions.update(id, { deletedAt: now });
    }
  });
}
