import { db, type ShoppingItem } from '../../db';
import { newId } from '../../lib/id';

/**
 * Nákupní seznam (lokální). Položky jsou volný text – suroviny se do něj
 * posílají tak, jak jsou v receptu (naškálované podle porcí), plus ruční přídavky.
 * Množství se záměrně nesčítají (volný text „2 vejce" + „3 vejce" spolehlivě
 * sečíst nejde), radši se položky nechají vypsané.
 */

export function getShoppingItems(): Promise<ShoppingItem[]> {
  return db.shoppingItems.orderBy('sortOrder').toArray();
}

async function nextOrder(): Promise<number> {
  const items = await db.shoppingItems.toArray();
  return items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
}

export async function addShoppingItem(text: string, source: string | null = null): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  await db.shoppingItems.add({
    id: newId(),
    text: clean,
    checked: false,
    source,
    createdAt: new Date().toISOString(),
    sortOrder: await nextOrder(),
  });
}

/** Přidá víc řádků (suroviny receptu) najednou. Vrací id přidaných – pro „vrátit zpět". */
export async function addLinesToShopping(lines: string[], source: string | null): Promise<string[]> {
  const clean = lines.map((line) => line.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const now = new Date().toISOString();
  let order = await nextOrder();
  const items: ShoppingItem[] = clean.map((text) => ({
    id: newId(),
    text,
    checked: false,
    source,
    createdAt: now,
    sortOrder: order++,
  }));
  await db.shoppingItems.bulkAdd(items);
  return items.map((item) => item.id);
}

export async function setShoppingChecked(id: string, checked: boolean): Promise<void> {
  await db.shoppingItems.update(id, { checked });
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await db.shoppingItems.delete(id);
}

export async function removeShoppingItems(ids: string[]): Promise<void> {
  await db.shoppingItems.bulkDelete(ids);
}

/** Vrátit zpět hromadné smazání – vrátí položky přesně tak, jak byly. */
export async function restoreShoppingItems(items: ShoppingItem[]): Promise<void> {
  await db.shoppingItems.bulkPut(items);
}

/** Smaže odškrtnuté (nakoupené). */
export async function clearCheckedShopping(): Promise<void> {
  const checked = await db.shoppingItems.filter((item) => item.checked).toArray();
  await db.shoppingItems.bulkDelete(checked.map((item) => item.id));
}

export async function clearShopping(): Promise<void> {
  await db.shoppingItems.clear();
}
