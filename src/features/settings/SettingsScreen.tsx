import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { todayIso } from '../../lib/date';
import { downloadTextFile } from '../../lib/download';
import { estimateStorage, isStoragePersisted } from '../../lib/storage';
import { exportBackupJson, importBackupJson } from '../backup/dbBackup';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import Segmented from '../../components/ui/Segmented';
import { cardClass } from '../../components/ui/cardClass';
import { readThemePref, setThemePref, type ThemePref } from '../../lib/theme';

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsScreen() {
  const recipeCount = useLiveQuery(() => db.recipes.filter((recipe) => !recipe.deletedAt).count(), []);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState<ThemePref>(() => readThemePref());
  const fileRef = useRef<HTMLInputElement>(null);

  function changeTheme(next: ThemePref) {
    setTheme(next);
    setThemePref(next);
  }

  useEffect(() => {
    void isStoragePersisted().then(setPersisted);
    void estimateStorage().then(setUsage);
  }, []);

  async function handleExport() {
    const json = await exportBackupJson();
    downloadTextFile(`kucharka-${todayIso()}.json`, json);
    setMessage('Záloha stažena.');
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const { recipes } = await importBackupJson(text);
      setMessage(`Import hotový: ${recipes} receptů.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import se nepovedl.');
    }
  }

  return (
    <div>
      <ScreenHeader width="narrow" title="Víc" />

      <main className="mx-auto max-w-2xl px-4 py-4">
        <section className={cardClass()}>
          <h2 className="font-medium">Vzhled</h2>
          <p className="mt-1 text-sm text-stone-500">Motiv aplikace. „Systém" se řídí telefonem.</p>
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

        <section className={cardClass({ className: 'mt-3' })}>
          <h2 className="font-medium">Záloha dat</h2>
          <p className="mt-1 text-sm text-stone-500">
            Data jsou uložená jen v tomhle prohlížeči. Export je tvoje záloha i způsob, jak recepty
            přenést na jiné zařízení.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button role="primary" onClick={() => void handleExport()}>
              Exportovat do souboru
            </Button>
            <Button role="secondary" onClick={() => fileRef.current?.click()}>
              Obnovit ze zálohy
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportFile(file);
                event.target.value = '';
              }}
            />
          </div>
          {message ? <p className="mt-3 text-sm text-brand-dark dark:text-amber-400">{message}</p> : null}
        </section>

        <Link
          to="/statistiky"
          className={cardClass({
            padding: 'panel',
            interactive: true,
            className: 'mt-3 flex items-center justify-between',
          })}
        >
          <span className="font-medium">Statistiky vaření</span>
          <span className="text-stone-400">›</span>
        </Link>

        <Link
          to="/kos"
          className={cardClass({
            padding: 'panel',
            interactive: true,
            className: 'mt-3 flex items-center justify-between',
          })}
        >
          <span className="font-medium">Koš</span>
          <span className="text-stone-400">›</span>
        </Link>

        <section className={cardClass({ padding: 'panel', className: 'mt-3 text-sm' })}>
          <h2 className="font-medium">Úložiště</h2>
          <dl className="mt-2 space-y-1 text-stone-600 dark:text-stone-300">
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
            <p className="mt-2 text-xs text-stone-400">
              Prohlížeč trvalé úložiště většinou povolí až po přidání aplikace na plochu.
            </p>
          ) : null}
        </section>

        <section className={cardClass({ padding: 'panel', className: 'mt-3 text-sm' })}>
          <h2 className="font-medium">O aplikaci</h2>
          <p className="mt-1 text-stone-500">
            Osobní kuchařka · Fáze 1. Local-first, funguje offline, bez serveru a bez účtu.
          </p>
        </section>
      </main>
    </div>
  );
}
