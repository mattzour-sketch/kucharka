import { useRef, useState } from 'react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { cardClass } from '../../components/ui/cardClass';
import { downloadTextFile } from '../../lib/download';
import {
  STALE_BACKUP_DAYS,
  daysSince,
  formatCzechDateTime,
  formatRelativeDays,
  todayIso,
} from '../../lib/date';
import { restoreItemsAdded } from '../../lib/backup';
import { readLastBackupAt, writeLastBackupAt } from '../../lib/backupStatus';
import { czechPlural } from '../../lib/plural';
import { applyRestore, exportBackupJson, prepareRestore, type RestorePreview } from './dbBackup';

const pluralRecipes = (n: number) => `${n} ${czechPlural(n, ['recept', 'recepty', 'receptů'])}`;
const pluralItems = (n: number) => `${n} ${czechPlural(n, ['položku', 'položky', 'položek'])}`;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Notice = { text: string; tone: 'info' | 'error' } | null;

export default function BackupSection() {
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => readLastBackupAt());
  const [notice, setNotice] = useState<Notice>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    try {
      const { json, exportedAt } = await exportBackupJson();
      downloadTextFile(`kucharka-${todayIso()}.json`, json);
      // „Naposledy zálohováno" až TEĎ, po úspěšném stažení (ne uvnitř exportu).
      writeLastBackupAt(exportedAt);
      setLastBackupAt(readLastBackupAt());
      setNotice({
        tone: 'info',
        text: 'Záloha je stažená v tomhle zařízení. Ulož si soubor i mimo něj (e-mail, cloud, flash) — jinak o něj při ztrátě nebo rozbití telefonu přijdeš.',
      });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Export se nepovedl.' });
    }
  }

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      setPreview(await prepareRestore(text, file.size));
      setNotice(null);
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Soubor nejde načíst.' });
    }
  }

  async function confirmRestore() {
    if (!preview) return;
    setBusy(true);
    try {
      const { added, overwritten } = preview.impact.recipes;
      const itemsAdded = restoreItemsAdded(preview.impact);
      await applyRestore(preview);
      setLastBackupAt(readLastBackupAt());
      // Shrnutí toho, co obnova reálně udělala (spočítané proti DB, ne holý počet ze zálohy).
      const changes: string[] = [];
      if (added > 0) changes.push(`přidala ${pluralRecipes(added)}`);
      if (overwritten > 0) changes.push(`přepsala ${pluralRecipes(overwritten)}`);
      if (itemsAdded > 0) changes.push(`přidala ${pluralItems(itemsAdded)} vaření a nákupu`);
      setNotice({
        tone: 'info',
        text: changes.length > 0 ? `Obnova ${changes.join(', ')}.` : 'Obnoveno — v datech se nic nezměnilo.',
      });
      setPreview(null);
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Obnova se nepovedla.' });
    } finally {
      setBusy(false);
    }
  }

  const stale = lastBackupAt !== null && daysSince(lastBackupAt) > STALE_BACKUP_DAYS;

  return (
    <section className={cardClass({ className: 'mt-3' })}>
      <h2 className="font-medium">Záloha dat</h2>
      <p className="mt-1 text-sm text-stone-500">
        Data žijí jen v tomhle prohlížeči. Export je tvoje záloha a zároveň způsob, jak recepty
        přenést jinam.
      </p>

      {lastBackupAt ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-stone-500">
          {stale ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden /> : null}
          <span>
            Naposledy zálohováno {formatRelativeDays(lastBackupAt)}
            {stale ? ' — zálohuj radši znovu' : ''}.
          </span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-stone-500">Zatím nezálohováno.</p>
      )}

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
            if (file) void handleFile(file);
            event.target.value = '';
          }}
        />
      </div>

      {notice ? (
        <p
          className={
            notice.tone === 'error'
              ? 'mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300'
              : 'mt-3 rounded-lg bg-stone-100 p-3 text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300'
          }
        >
          {notice.text}
        </p>
      ) : null}

      <ConfirmDialog
        open={preview !== null}
        title="Obnovit ze zálohy?"
        confirmLabel="Obnovit"
        busy={busy}
        onConfirm={() => void confirmRestore()}
        onCancel={() => setPreview(null)}
      >
        {preview ? <RestorePreviewBody preview={preview} /> : null}
      </ConfirmDialog>
    </section>
  );
}

/** Náhled dopadu obnovy: co udělá s mými daty (hrdina dialogu) + co záloha obsahuje. */
function RestorePreviewBody({ preview }: { preview: RestorePreview }) {
  const { parsed, impact } = preview;
  const { added, overwritten, newerInDb } = impact.recipes;
  const itemsAdded = restoreItemsAdded(impact);

  const effects: string[] = [];
  if (added > 0) effects.push(`Přidá ${pluralRecipes(added)}.`);
  if (overwritten > 0) {
    effects.push(`Přepíše ${pluralRecipes(overwritten)}, ${overwritten === 1 ? 'který' : 'které'} už máš.`);
  }
  if (itemsAdded > 0) {
    effects.push(`Přidá ${pluralItems(itemsAdded)} do historie vaření a nákupu.`);
  }

  const cautions: string[] = [];
  if (newerInDb > 0) {
    cautions.push(
      `${pluralRecipes(newerInDb)} máš novější než záloha — obnova ${newerInDb === 1 ? 'ho' : 'je'} přepíše.`,
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-stone-500">
        {parsed.exportedAt ? `Záloha z ${formatCzechDateTime(parsed.exportedAt)}` : 'Záloha (datum neznámé)'} ·{' '}
        {formatFileSize(preview.fileSize)}
      </p>

      <div>
        <p className="font-medium text-stone-700 dark:text-stone-200">Co obnova udělá</p>
        {effects.length > 0 ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {effects.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">Data v záloze odpovídají tomu, co máš — nic nepřepíše ani nepřidá.</p>
        )}
      </div>

      {cautions.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">Pozor</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {cautions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-stone-200 pt-3 text-stone-500 dark:border-stone-700">
        <Row label="Recepty" value={parsed.data.recipes.length} />
        <Row label="Suroviny" value={parsed.data.recipeItems.length} />
        <Row label="Fotky" value={parsed.data.photos.length} />
        <Row
          label="Historie vaření"
          value={parsed.present.cookLogs ? parsed.data.cookLogs.length : 'neobsahuje'}
        />
        <Row label="Nákup" value={parsed.present.shoppingItems ? parsed.data.shoppingItems.length : 'neobsahuje'} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="text-stone-700 dark:text-stone-300">{value}</dd>
    </div>
  );
}
