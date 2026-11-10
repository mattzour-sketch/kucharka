import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { estimateStorage, isStoragePersisted } from '../../lib/storage';
import BackupSection from '../backup/BackupSection';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Segmented from '../../components/ui/Segmented';
import Icon, { type IconName } from '../../components/ui/Icon';
import { cardClass } from '../../components/ui/cardClass';
import { readThemePref, setThemePref, type ThemePref } from '../../lib/theme';

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Řádek seskupeného seznamu odkazů: ikona, název, volitelný počet a šipka. */
function NavRow({ to, icon, label, value }: { to: string; icon: IconName; label: string; value?: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 px-4 transition hover:bg-stone-900/[0.04] focus-visible:bg-stone-900/[0.07] focus-visible:outline-none active:bg-stone-900/[0.07] dark:hover:bg-white/5 dark:focus-visible:bg-white/10 dark:active:bg-white/10"
    >
      <Icon name={icon} className="text-stone-500 dark:text-stone-400" />
      <span className="flex-1 font-semibold">{label}</span>
      {value ? <span className="text-sm tabular-nums text-stone-500 dark:text-stone-400">{value}</span> : null}
      <Icon name="forward" className="h-4 w-4 text-stone-400 dark:text-stone-500" />
    </Link>
  );
}

export default function SettingsScreen() {
  const recipeCount = useLiveQuery(() => db.recipes.filter((recipe) => !recipe.deletedAt).count(), []);
  const shoppingLeft = useLiveQuery(() => db.shoppingItems.filter((item) => !item.checked).count(), []);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [theme, setTheme] = useState<ThemePref>(() => readThemePref());

  function changeTheme(next: ThemePref) {
    setTheme(next);
    setThemePref(next);
  }

  useEffect(() => {
    void isStoragePersisted().then(setPersisted);
    void estimateStorage().then(setUsage);
  }, []);

  return (
    <div>
      <ScreenHeader width="narrow" title="Víc" />

      <main className="mx-auto max-w-2xl px-4 py-4">
        <BackupSection />

        {/* Odkazy na další obrazovky jako jeden seskupený seznam, ne tři samostatné karty. */}
        <nav
          aria-label="Další obrazovky"
          className={cardClass({
            padding: 'none',
            className: 'mt-3 divide-y divide-stone-900/[0.07] overflow-hidden dark:divide-white/10',
          })}
        >
          <NavRow to="/nakup" icon="cart" label="Nákupní seznam" value={shoppingLeft ? String(shoppingLeft) : undefined} />
          <NavRow to="/statistiky" icon="chart" label="Statistiky vaření" />
          <NavRow to="/kos" icon="trash" label="Koš" />
        </nav>

        <section className={cardClass({ className: 'mt-3' })}>
          <h2 className="font-bold">Vzhled</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Motiv aplikace. „Systém" se řídí telefonem.</p>
          <div className="mt-2">
            <Segmented
              value={theme}
              onChange={changeTheme}
              ariaLabel="Motiv"
              options={[
                { value: 'system', label: 'Systém' },
                { value: 'light', label: 'Světlý' },
                { value: 'dark', label: 'Tmavý' },
              ]}
            />
          </div>
        </section>

        <section className={cardClass({ padding: 'panel', className: 'mt-3 text-sm' })}>
          <h2 className="text-base font-bold">Úložiště</h2>
          <dl className="mt-2 space-y-1 tabular-nums text-stone-700 dark:text-stone-300">
            <div className="flex justify-between">
              <dt>Receptů</dt>
              <dd>{recipeCount ?? '…'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Trvalé úložiště</dt>
              <dd>{persisted === null ? '…' : persisted ? 'zapnuté' : 'nezapnuté'}</dd>
            </div>
            {usage ? (
              <div className="flex justify-between">
                <dt>Obsazeno</dt>
                <dd>{formatMB(usage.usage)}</dd>
              </div>
            ) : null}
          </dl>
          {persisted === false ? (
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              Prohlížeč trvalé úložiště většinou povolí až po přidání aplikace na plochu.
            </p>
          ) : null}
        </section>

        <section className={cardClass({ padding: 'panel', className: 'mt-3 text-sm' })}>
          <h2 className="text-base font-bold">O aplikaci</h2>
          <p className="mt-1 text-stone-500 dark:text-stone-400">
            Osobní kuchařka. Funguje offline, bez serveru a bez účtu. Data jsou jen v tomhle prohlížeči.
          </p>
        </section>
      </main>
    </div>
  );
}
