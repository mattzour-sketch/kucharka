import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { todayIso } from '../../lib/date';
import { parseDecimal } from '../../lib/num';
import { isBareUrl, parseRecipeText } from '../../lib/parseRecipe';
import { combineRawCapture, splitIngredientLines } from '../../lib/recipeText';
import {
  fallbackImportName,
  isPreviewEdited,
  previewFromParsed,
  previewSummary,
  rawImportName,
  type ImportPreview,
} from '../../lib/importPreview';
import { clearImportDraft, getImportDraft, saveImportDraft, saveImportedRecipe } from './importDraftRepo';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAutoGrow } from '../../hooks/useAutoGrow';

const IG_HINT = 'Instagram: ⋯ → Otevřít v prohlížeči, podrž popisek → Kopírovat.';
const URL_MESSAGE = `Odkaz neotevřu – vlož text popisku. ${IG_HINT}`;
const DRAFT_DEBOUNCE_MS = 400;

interface DraftState {
  pasteText: string;
  parsedText: string | null;
  preview: ImportPreview | null;
  parsedPreview: ImportPreview | null;
}

const fieldClass =
  'rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 outline-none focus:border-brand';
// Pole náhledu rostou s obsahem (useAutoGrow) – žádný scroll uvnitř pole.
const areaClass =
  'mt-1 min-h-24 w-full resize-none overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 leading-relaxed outline-none focus:border-brand';

/**
 * Vložení receptu ze schránky (§11, UC031). Rozebere text na název/porce/dobu/
 * suroviny/postup, ukáže editovatelný náhled a uloží – i s originálem vloženého textu
 * jako poznámkou. Parser se plete, proto je náhled vždy. Rozdělaný náhled se průběžně
 * ukládá do `importDrafts` a přežije zavření appky.
 */
export default function ImportRecipeScreen() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [restored, setRestored] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsedText, setParsedText] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  /** Text čekající na potvrzení „Přepsat náhled?" (null = dialog zavřený). */
  const [pendingParse, setPendingParse] = useState<string | null>(null);
  const [focusNameRequest, setFocusNameRequest] = useState(0);
  /** Vložený text je po „Rozebrat" sbalený, ať je náhled hned nahoře. */
  const [sourceOpen, setSourceOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const ingredientsRef = useAutoGrow(preview?.ingredients ?? '');
  const instructionsRef = useAutoGrow(preview?.instructions ?? '');
  /** Koncept se úspěšně načetl → smí se průběžně zapisovat. Po chybě načtení zůstává false. */
  const loadedRef = useRef(false);
  /** Po uložení už koncept nezapisovat (jinak by ho doběhnutý debounce vzkřísil). */
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<DraftState>({ pasteText: '', parsedText: null, preview: null, parsedPreview: null });

  // Zapíše aktuální koncept hned (flush). Čte jen refy, takže je stabilní.
  const persistDraft = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!loadedRef.current || doneRef.current) return;
    const draft = draftRef.current;
    if (draft.pasteText.trim() === '' && draft.preview === null) void clearImportDraft();
    else void saveImportDraft(draft);
  }, []);

  // Načtení rozdělaného konceptu (jednou).
  useEffect(() => {
    let cancelled = false;
    void getImportDraft()
      .then((draft) => {
        if (cancelled) return;
        if (draft) {
          setPasteText(draft.pasteText);
          setParsedText(draft.parsedText);
          setPreview(draft.preview);
          setParsedPreview(draft.parsedPreview);
          setRestored(true);
        }
        // Zapisovat koncept smíme jen po úspěšném načtení – jinak by prázdný stav přepsal
        // (smazal) koncept, který se jen nepodařilo přečíst.
        loadedRef.current = true;
      })
      .catch(() => {
        // Chyba IndexedDB (např. blokovaný upgrade DB) nesmí zablokovat vložení – jede se bez
        // průběžného ukládání konceptu; uložit recept jde dál.
        if (!cancelled) setMessage('Rozdělaný náhled nejde načíst.');
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Průběžné ukládání konceptu (debounce).
  useEffect(() => {
    draftRef.current = { pasteText, parsedText, preview, parsedPreview };
    if (!loaded) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(persistDraft, DRAFT_DEBOUNCE_MS);
  }, [pasteText, parsedText, preview, parsedPreview, loaded, persistDraft]);

  // PWA na pozadí může zemřít dřív, než debounce doběhne → uložit hned. Totéž při odchodu z obrazovky.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') persistDraft();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      persistDraft();
    };
  }, [persistDraft]);

  // Po „Rozebrat" bez názvu fokus do pole Název (C).
  useEffect(() => {
    if (focusNameRequest === 0) return;
    nameRef.current?.focus();
    nameRef.current?.scrollIntoView({ block: 'center' });
  }, [focusNameRequest]);

  function applyParse(text: string) {
    const next = previewFromParsed(parseRecipeText(text));
    setPreview(next);
    setParsedPreview(next);
    setParsedText(text);
    setMessage('');
    setRestored(false);
    setSourceOpen(false);
    if (next.name.trim() === '') setFocusNameRequest((count) => count + 1);
  }

  function requestParse(text: string) {
    if (isBareUrl(text)) {
      setMessage(URL_MESSAGE);
      return;
    }
    if (preview && parsedPreview && isPreviewEdited(preview, parsedPreview)) {
      setPendingParse(text);
      return;
    }
    applyParse(text);
  }

  async function handlePasteFromClipboard() {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setMessage('Schránku nejde přečíst – vlož text ručně do pole níže.');
      return;
    }
    if (!text.trim()) {
      setMessage('Schránka je prázdná.');
      return;
    }
    setPasteText(text);
    requestParse(text);
  }

  /** Vložení do prázdného pole se rovnou rozebere (o ťuknutí míň). Do rozepsaného textu ne. */
  function handlePasteIntoField(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (pasteText.trim() !== '') return;
    const text = event.clipboardData.getData('text');
    if (!text.trim()) return;
    event.preventDefault();
    setPasteText(text);
    requestParse(text);
  }

  function updateField(field: keyof ImportPreview, value: string) {
    setPreview((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleDiscard() {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    await clearImportDraft();
    setPasteText('');
    setParsedText(null);
    setPreview(null);
    setParsedPreview(null);
    setMessage('');
    setRestored(false);
  }

  /** Uloží recept, smaže koncept a otevře detail. Při chybě hláška, náhled i text zůstávají. */
  async function saveAndOpen(input: Parameters<typeof saveImportedRecipe>[0]) {
    setSaving(true);
    doneRef.current = true;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    try {
      const id = await saveImportedRecipe(input);
      navigate(`/recept/${id}`, { replace: true });
    } catch (error) {
      // Hláška místo neošetřeného rejection (volá se přes `void`); jde to zkusit znovu.
      doneRef.current = false;
      setSaving(false);
      setMessage(error instanceof Error ? `Uložení se nepovedlo: ${error.message}` : 'Uložení se nepovedlo.');
    }
  }

  /** UC031b: text beze změny – název z prvního řádku, celý text v postupu, žádné suroviny. */
  function handleSaveRaw() {
    const text = pasteText.trim();
    if (text === '' || saving) return;
    void saveAndOpen({
      content: {
        name: rawImportName(text),
        capturedOn: todayIso(),
        ingredientLines: [],
        instructions: text,
        rawCapture: combineRawCapture('', text),
        tags: [],
        prepMinutes: null,
      },
      servings: null,
      // Originál je celý v postupu, poznámka by byla duplicitní.
      originalText: '',
      clearDraft: loadedRef.current,
    });
  }

  function handleSave() {
    if (!preview || saving) return;
    const prepMinutes = parseDecimal(preview.prepMinutes);
    const servings = parseDecimal(preview.servings);
    void saveAndOpen({
      content: {
        name: preview.name.trim() || fallbackImportName(preview.source),
        capturedOn: todayIso(),
        ingredientLines: splitIngredientLines(preview.ingredients),
        instructions: preview.instructions.trim() || null,
        rawCapture: combineRawCapture(preview.ingredients, preview.instructions),
        tags: [],
        prepMinutes: prepMinutes != null && prepMinutes > 0 ? prepMinutes : null,
        source: preview.source.trim() || null,
      },
      servings,
      originalText: parsedText ?? pasteText,
      clearDraft: loadedRef.current,
    });
  }

  return (
    <div className="min-h-dvh">
      <ScreenHeader
        variant="stack"
        width="narrow"
        closeIcon
        onBack={() => navigate('/')}
        title="Vložit recept"
        actions={
          <Button role="primary" disabled={!preview || saving} onClick={handleSave}>
            Uložit
          </Button>
        }
      />

      {loaded ? (
        <main className="mx-auto max-w-2xl px-4 py-4">
          {restored ? (
            <div className="mb-3 flex items-center justify-between gap-3 text-sm text-stone-500">
              <span>{preview ? 'Obnoven rozdělaný náhled.' : 'Obnoven vložený text.'}</span>
              <Button role="ghost" onClick={() => void handleDiscard()}>
                Zahodit
              </Button>
            </div>
          ) : null}

          {preview && !sourceOpen ? (
            <button
              type="button"
              onClick={() => setSourceOpen(true)}
              aria-expanded={false}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-stone-700 px-4 py-3 text-left text-sm text-stone-500"
            >
              <span>Vložený text</span>
              <span className="shrink-0">Zobrazit ▾</span>
            </button>
          ) : (
            <>
              <textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                onPaste={handlePasteIntoField}
                autoFocus={!restored}
                placeholder="Sem vlož zkopírovaný recept…"
                className="min-h-[18dvh] w-full resize-none rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 text-sm leading-relaxed outline-none placeholder:text-stone-300 focus:border-brand"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button role="secondary" onClick={() => void handlePasteFromClipboard()}>
                  Vložit ze schránky
                </Button>
                <Button role="primary" disabled={pasteText.trim() === ''} onClick={() => requestParse(pasteText)}>
                  Rozebrat
                </Button>
                {/* Po rozebrání ukládá „Uložit" v hlavičce – druhé uložení vedle by mátlo. */}
                {!preview ? (
                  <Button role="ghost" disabled={pasteText.trim() === '' || saving} onClick={handleSaveRaw}>
                    Uložit bez rozebrání
                  </Button>
                ) : null}
              </div>
            </>
          )}
          {message ? <p className="mt-2 text-sm text-stone-500">{message}</p> : null}
          {!preview && message !== URL_MESSAGE ? (
            <p className="mt-2 text-xs text-stone-400">{IG_HINT}</p>
          ) : null}

          {preview ? (
            <div className="mt-5 border-t border-stone-200 dark:border-stone-700 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Náhled – uprav, co parser netrefil
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {previewSummary(preview.ingredients, preview.instructions)}
              </p>
              <input
                ref={nameRef}
                value={preview.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder={`Název – jinak „${fallbackImportName(preview.source)}"`}
                aria-label="Název receptu"
                className="mt-3 w-full border-b border-stone-200 dark:border-stone-700 bg-transparent py-2 text-lg font-medium outline-none placeholder:text-stone-400 focus:border-brand"
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-500">
                <span className="flex items-center gap-2">
                  <label htmlFor="servings">Porcí</label>
                  <input
                    id="servings"
                    value={preview.servings}
                    onChange={(event) => updateField('servings', event.target.value)}
                    inputMode="decimal"
                    placeholder="—"
                    className={`w-16 ${fieldClass}`}
                  />
                </span>
                <span className="flex items-center gap-2">
                  <label htmlFor="prep">Doba</label>
                  <input
                    id="prep"
                    value={preview.prepMinutes}
                    onChange={(event) => updateField('prepMinutes', event.target.value)}
                    inputMode="numeric"
                    placeholder="—"
                    className={`w-16 ${fieldClass}`}
                  />
                  <span>min</span>
                </span>
              </div>

              <label
                htmlFor="ingredients"
                className="mt-4 block text-xs font-semibold uppercase tracking-wide text-stone-400"
              >
                Suroviny
              </label>
              <textarea
                id="ingredients"
                ref={ingredientsRef}
                value={preview.ingredients}
                onChange={(event) => updateField('ingredients', event.target.value)}
                className={areaClass}
              />

              <label
                htmlFor="instructions"
                className="mt-4 block text-xs font-semibold uppercase tracking-wide text-stone-400"
              >
                Postup
              </label>
              <textarea
                id="instructions"
                ref={instructionsRef}
                value={preview.instructions}
                onChange={(event) => updateField('instructions', event.target.value)}
                className={areaClass}
              />
            </div>
          ) : null}
        </main>
      ) : null}

      <ConfirmDialog
        open={pendingParse !== null}
        title="Přepsat náhled?"
        confirmLabel="Přepsat"
        confirmRole="destructive"
        onConfirm={() => {
          if (pendingParse !== null) applyParse(pendingParse);
          setPendingParse(null);
        }}
        onCancel={() => setPendingParse(null)}
      >
        Ruční úpravy náhledu se ztratí.
      </ConfirmDialog>
    </div>
  );
}
