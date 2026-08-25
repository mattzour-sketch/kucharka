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
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import EmptyState from '../../components/ui/EmptyState';
import { RowsSkeleton } from '../../components/ui/Loading';
import { cardClass } from '../../components/ui/cardClass';

/** Nákupní seznam (lokální, odškrtávací). Suroviny sem chodí z receptů. */
export default function ShoppingListScreen() {
  const items = useLiveQuery(() => db.shoppingItems.orderBy('sortOrder').toArray(), []);
  const [draft, setDraft] = useState('');
  const { showUndo } = useUndo();

  // Dokud data nedorazí, neukazuj „prázdný seznam" – to je jen probliknutí, ne stav.
  const loading = items === undefined;
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
      <ScreenHeader
        width="narrow"
        title="Nákup"
        actions={
          !loading && list.length > 0 ? (
            <span className="text-sm text-stone-400">
              {list.length} položek{checkedCount > 0 ? ` · ${checkedCount} nakoupeno` : ''}
            </span>
          ) : undefined
        }
      />

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
          <Button role="primary" onClick={submitDraft}>
            Přidat
          </Button>
        </div>

        {loading ? (
          <div className="mt-4">
            <RowsSkeleton />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="Nákupní seznam je prázdný"
            description="Přidej položku, nebo pošli suroviny z receptu (🛒 v detailu receptu)."
          />
        ) : (
          <>
            <ul
              className={cardClass({
                padding: 'none',
                className: 'mt-4 flex flex-col divide-y divide-stone-100 overflow-hidden',
              })}
            >
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
                  <IconButton
                    size="sm"
                    onClick={() => void deleteShoppingItem(item.id)}
                    aria-label="Odebrat položku"
                  >
                    ×
                  </IconButton>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              {checkedCount > 0 ? (
                <Button role="secondary" onClick={() => void handleClear(true)}>
                  Smazat nakoupené
                </Button>
              ) : null}
              <Button role="ghost" onClick={() => void handleClear(false)}>
                Vymazat vše
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
