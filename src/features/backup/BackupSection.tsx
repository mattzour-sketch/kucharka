import { useRef, useState } from 'react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { cardClass } from '../../components/ui/cardClass';
import Segmented from '../../components/ui/Segmented';
import { canShareTextFile, downloadTextFile, shareTextFile } from '../../lib/download';
import { formatCzechDateTime, formatRelativeDays, todayIso } from '../../lib/date';
import { backupContentCounts, restoreItemsAdded, type RestoreMode } from '../../lib/backup';
import { writeLastBackupAt } from '../../lib/backupStatus';
import { czechPlural } from '../../lib/plural';
import { useBackupReminder } from './useBackupReminder';
import { applyRestore, exportBackupJson, prepareRestore, type RestorePreview } from './dbBackup';

const pluralRecipes = (n: number) => `${n} ${czechPlural(n, ['recept', 'recepty', 'receptů'])}`;
const pluralItems = (n: number) => `${n} ${czechPlural(n, ['položku', 'položky', 'položek'])}`;
const whichYouHave = (n: number) => (n === 1 ? 'který' : 'které');

const RESTORE_MODES = [
  { value: 'keepNewer', label: 'Novější nechat' },
  { value: 'overwriteAll', label: 'Přepsat vše' },
] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Notice = { text: string; tone: 'info' | 'error' } | null;

export default function BackupSection() {
  const { lastBackupAt, due } = useBackupReminder();
  const [notice, setNotice] = useState<Notice>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [mode, setMode] = useState<RestoreMode>('keepNewer');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [canShare] = useState(canShareTextFile);

  async function handleExport() {
    try {
      const { json, exportedAt } = await exportBackupJson();
      downloadTextFile(`kucharka-${todayIso()}.json`, json);
      // „Naposledy zálohováno" až TEĎ, po úspěšném stažení (ne uvnitř exportu).
      writeLastBackupAt(exportedAt);
      setNotice({
        tone: 'info',
        text: 'Záloha je stažená v tomhle zařízení. Ulož si soubor i mimo něj (e-mail, cloud, flash) — jinak o něj při ztrátě nebo rozbití telefonu přijdeš.',
      });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Export se nepovedl.' });
    }
  }

  async function handleShare() {
    try {
      const { json, exportedAt } = await exportBackupJson();
      // .txt, protože .json Chrome sdílet nedovolí; obnova bere obojí.
      const shared = await shareTextFile(`kucharka-${todayIso()}.txt`, json);
      if (!shared) return;
      writeLastBackupAt(exportedAt);
      setNotice({ tone: 'info', text: 'Záloha odeslaná.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Sdílení se nepovedlo.' });
    }
  }

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      setPreview(await prepareRestore(text, file.size));
      setMode('keepNewer');
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
      const { kept } = await applyRestore(preview, mode);
      // Shrnutí toho, co obnova reálně udělala (spočítané proti DB, ne holý počet ze zálohy).
      const changes: string[] = [];
      if (added > 0) changes.push(`přidala ${pluralRecipes(added)}`);
      if (overwritten - kept > 0) changes.push(`přepsala ${pluralRecipes(overwritten - kept)}`);
      if (kept > 0) changes.push(`nechala ${pluralRecipes(kept)}, ${whichYouHave(kept)} máš novější`);
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

  return (
    <section className={cardClass({ className: 'mt-3' })}>
      <h2 className="font-medium">Záloha dat</h2>
      <p className="mt-1 text-sm text-stone-500">
        Data žijí jen v tomhle prohlížeči. Export je tvoje záloha a zároveň způsob, jak recepty
        přenést jinam.
      </p>

      <p className="mt-2 flex items-center gap-1.5 text-sm text-stone-500">
        {due ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden /> : null}
        <span>
          {lastBackupAt
            ? `Naposledy zálohováno ${formatRelativeDays(lastBackupAt)}${due ? ' — zálohuj radši znovu' : ''}.`
            : 'Zatím nezálohováno.'}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {canShare ? (
          <Button role="primary" onClick={() => void handleShare()}>
            Sdílet zálohu
          </Button>
        ) : null}
        <Button role={canShare ? 'secondary' : 'primary'} onClick={() => void handleExport()}>
          Exportovat do souboru
        </Button>
        <Button role="secondary" onClick={() => fileRef.current?.click()}>
          Obnovit ze zálohy
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,text/plain,.txt"
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
        {preview ? <RestorePreviewBody preview={preview} mode={mode} onModeChange={setMode} /> : null}
      </ConfirmDialog>
    </section>
  );
}

/** Náhled dopadu obnovy: co udělá s mými daty (hrdina dialogu) + co záloha obsahuje. */
function RestorePreviewBody({
  preview,
  mode,
  onModeChange,
}: {
  preview: RestorePreview;
  mode: RestoreMode;
  onModeChange: (mode: RestoreMode) => void;
}) {
  const { parsed, impact } = preview;
  const { added, overwritten, newerInDb } = impact.recipes;
  // Obsah zálohy bez smazaných položek a receptů v koši.
  const counts = backupContentCounts(parsed.data);
  const itemsAdded = restoreItemsAdded(impact);
  const kept = mode === 'keepNewer' ? newerInDb : 0;
  const rewritten = overwritten - kept;

  const effects: string[] = [];
  if (added > 0) effects.push(`Přidá ${pluralRecipes(added)}.`);
  if (rewritten > 0) effects.push(`Přepíše ${pluralRecipes(rewritten)}, ${whichYouHave(rewritten)} už máš.`);
  if (kept > 0) effects.push(`Nechá ${pluralRecipes(kept)}, ${whichYouHave(kept)} máš novější.`);
  if (itemsAdded > 0) {
    effects.push(`Přidá ${pluralItems(itemsAdded)} do historie vaření a nákupu.`);
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

      {newerInDb > 0 ? (
        <div
          className={
            mode === 'overwriteAll'
              ? 'rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
              : 'rounded-lg border border-stone-200 p-3 dark:border-stone-700'
          }
        >
          <p>{pluralRecipes(newerInDb)} máš novější než záloha.</p>
          <Segmented
            className="mt-2"
            options={RESTORE_MODES}
            value={mode}
            onChange={onModeChange}
            ariaLabel="Novější recepty"
          />
          {mode === 'overwriteAll' ? (
            <p className="mt-2">Úpravy z doby po záloze se ztratí.</p>
          ) : null}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-stone-200 pt-3 text-stone-500 dark:border-stone-700">
        <Row label="Recepty" value={counts.recipes} />
        <Row label="Suroviny" value={counts.recipeItems} />
        <Row label="Poznámky" value={counts.recipeNotes} />
        <Row label="Fotky" value={counts.photos} />
        <Row label="Potraviny" value={counts.foods} />
        <Row label="Domácí míry" value={counts.foodPortions} />
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
