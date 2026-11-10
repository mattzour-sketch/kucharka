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
import { czechPlural } from '../../lib/plural';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import EmptyState from '../../components/ui/EmptyState';
import { RowsSkeleton } from '../../components/ui/Loading';
import { cardClass } from '../../components/ui/cardClass';
import Icon from '../../components/ui/Icon';
import { FIELD } from '../../components/ui/styles';
import { cx } from '../../components/ui/cx';

/**
 * Nákupní seznam (lokální, odškrtávací). Suroviny sem chodí z receptů. Otevírá se z „Víc“
 * (není ve spodní liště – uživatel ho zatím nepoužívá, rozhodnutí 2026-09-25).
 */
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
        variant="stack"
        width="narrow"
        backTo="/vic"
        title="Nákup"
        actions={
          !loading && list.length > 0 ? (
            <span className="text-sm tabular-nums text-stone-500 dark:text-stone-400">
              {list.length} {czechPlural(list.length, ['položka', 'položky', 'položek'])}
              {checkedCount > 0 ? ` · ${checkedCount} nakoupeno` : ''}
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
            className={cx(FIELD, 'h-11 min-w-0 flex-1 px-3 text-base')}
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
            description="Přidej položku, nebo pošli suroviny z receptu („Do nákupu“ v detailu receptu)."
          />
        ) : (
          <>
            <ul
              className={cardClass({
                padding: 'none',
                className: 'mt-4 flex flex-col divide-y divide-stone-900/[0.07] overflow-hidden dark:divide-white/10',
              })}
            >
              {sorted.map((item) => (
                <li key={item.id} className="flex min-h-14 items-center gap-2 py-1.5 pl-4 pr-2">
                  <button
                    type="button"
                    onClick={() => void setShoppingChecked(item.id, !item.checked)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-pressed={item.checked}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        item.checked
                          ? 'border-brand bg-brand text-white dark:border-brand-bright dark:bg-brand-bright'
                          : 'border-stone-400 text-transparent dark:border-stone-500'
                      }`}
                    >
                      <Icon name="check" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className={item.checked ? 'text-stone-400 line-through dark:text-stone-500' : ''}>
                        {item.text}
                      </span>
                      {item.source ? (
                        <span className="ml-2 text-xs text-stone-500 dark:text-stone-400">· {item.source}</span>
                      ) : null}
                    </span>
                  </button>
                  <IconButton
                    size="sm"
                    onClick={() => void deleteShoppingItem(item.id)}
                    aria-label="Odebrat položku"
                  >
                    <Icon name="close" className="h-4 w-4" />
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
