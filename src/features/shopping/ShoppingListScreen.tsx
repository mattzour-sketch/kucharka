import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ShoppingItem } from '../../db';
import { useUndo } from '../../components/undoContext';
import {
  addShoppingItem,
  clearCheckedShopping,
  clearShopping,
  deleteShoppingItem,
  restoreShoppingItems,
  setShoppingChecked,
} from './shoppingRepo';

/** Nákupní seznam (lokální, odškrtávací). Suroviny sem chodí z receptů. */
export default function ShoppingListScreen() {
  const items = useLiveQuery(() => db.shoppingItems.orderBy('sortOrder').toArray(), []);
  const [draft, setDraft] = useState('');
  const { showUndo } = useUndo();

  const list = items ?? [];
  // Nakoupené (odškrtnuté) klesají dolů, ať jsou aktivní položky nahoře.
  const sorted = [...list].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return a.sortOrder - b.sortOrder;
  });
  const checkedCount = list.filter((item) => item.checked).length;

  function submitDraft() {
    const text = draft.trim();
    if (!text) return;
    void addShoppingItem(text);
    setDraft('');
  }

  async function handleClear(onlyChecked: boolean) {
    const snapshot: ShoppingItem[] = onlyChecked ? list.filter((item) => item.checked) : list;
    if (snapshot.length === 0) return;
    if (onlyChecked) await clearCheckedShopping();
    else await clearShopping();
    showUndo({
      message: onlyChecked ? 'Nakoupené smazány' : 'Seznam vymazán',
      undo: () => restoreShoppingItems(snapshot),
    });
  }

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight">Nákup</h1>
          {list.length > 0 ? (
            <span className="text-sm text-stone-400">
              {list.length} položek{checkedCount > 0 ? ` · ${checkedCount} nakoupeno` : ''}
            </span>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitDraft();
            }}
            placeholder="přidat položku…"
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={submitDraft}
            className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
          >
            Přidat
          </button>
        </div>

        {list.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-stone-500">Nákupní seznam je prázdný.</p>
            <p className="mt-1 text-sm text-stone-400">
              Přidej položku, nebo pošli suroviny z receptu (🛒 v detailu receptu).
            </p>
          </div>
        ) : (
          <>
            <ul className="mt-4 flex flex-col divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {sorted.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void setShoppingChecked(item.id, !item.checked)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-pressed={item.checked}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                        item.checked
                          ? 'border-brand bg-brand text-white'
                          : 'border-stone-300 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span className="min-w-0">
                      <span className={item.checked ? 'text-stone-400 line-through' : ''}>
                        {item.text}
                      </span>
                      {item.source ? (
                        <span className="ml-2 text-xs text-stone-400">· {item.source}</span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteShoppingItem(item.id)}
                    className="shrink-0 px-1 text-stone-400 transition hover:text-stone-600"
                    aria-label="Odebrat položku"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              {checkedCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void handleClear(true)}
                  className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
                >
                  Smazat nakoupené
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleClear(false)}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 active:scale-95"
              >
                Vymazat vše
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
