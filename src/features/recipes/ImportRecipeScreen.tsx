import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { isSameName } from '../../lib/search';
import { todayIso } from '../../lib/date';
import { fieldValue, normalizedPrepText, parsePrepInput, parseServingsInput } from '../../lib/fieldInput';
import { isBareUrl, parseRecipeText } from '../../lib/parseRecipe';
import { sharedTextFromParams } from '../../lib/shareTarget';
import { linkRecipeName } from '../../lib/links';
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
import TagInput from './TagInput';
import { useTagSuggestions } from './useTagSuggestions';
import { useSplitOffer } from './useSplitOffer';
import FieldLabelWithSplit from './SplitOffer';
import { cardClass } from '../../components/ui/cardClass';
import FieldInputHints from './FieldInputHints';
import { FIELD, FIELD_SM, SECTION_TITLE, LABEL } from '../../components/ui/styles';
import { cx } from '../../components/ui/cx';

const IG_HINT = 'Instagram: podrž spodní lištu (Circle to Search), označ text v reelu → Kopírovat.';
const URL_MESSAGE = `Odkaz neotevřu – vlož text. ${IG_HINT}`;
const DRAFT_DEBOUNCE_MS = 400;

interface DraftState {
  pasteText: string;
  parsedText: string | null;
  preview: ImportPreview | null;
  parsedPreview: ImportPreview | null;
  tags: string[];
}

/** Návod k vložení (rozbalovací, ať nezdržuje). Sdílení do appky umí jen Android s nainstalovanou appkou. */
function ImportHelp() {
  return (
    <details className="mt-4 rounded-2xl bg-stone-100 px-4 py-1 text-sm text-stone-700 dark:bg-stone-900 dark:text-stone-300 [&[open]]:pb-4">
      <summary className="flex min-h-10 cursor-pointer items-center font-semibold text-stone-700 dark:text-stone-200">
        Jak na recept z Instagramu
      </summary>
      <p className="mt-2 font-semibold text-stone-900 dark:text-stone-100">Text z reelu</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>Zastav reel, případně rozbal popisek.</li>
        <li>Podrž spodní lištu (Circle to Search), označ text → Kopírovat.</li>
        <li>Tady „Vložit ze schránky" → zkontroluj náhled → Uložit.</li>
      </ol>
      <p className="mt-3 font-semibold text-stone-900 dark:text-stone-100">Jen odkaz</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>V Instagramu Sdílet → Kuchařka, nebo Kopírovat odkaz a vložit sem.</li>
        <li>„Uložit odkaz na později" → recept s klikacím odkazem, text doplníš přes Upravit.</li>
      </ol>
      <p className="mt-3 font-semibold text-stone-900 dark:text-stone-100">Dobré vědět</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>Text z WhatsAppu, Keepu nebo webu: Sdílet → Kuchařka.</li>
        <li>Sdílení do Kuchařky jde jen na Androidu s nainstalovanou appkou. Na iPhonu podrž text na snímku obrazovky → Kopírovat.</li>
        <li>Když se recept rozebere špatně, uprav náhled, nebo „Uložit bez rozebrání".</li>
        <li>Originál vloženého textu zůstane u receptu v poznámce.</li>
      </ul>
    </details>
  );
}

const fieldClass = cx(FIELD_SM, 'h-10 px-3 text-right font-medium tabular-nums');
// Pole náhledu rostou s obsahem (useAutoGrow) – žádný scroll uvnitř pole.
const areaClass = cx(FIELD, 'min-h-24 w-full resize-none overflow-hidden p-4 text-[17px] leading-relaxed');

/**
 * Vložení receptu ze schránky (§11, UC031). Rozebere text na název/porce/dobu/
 * suroviny/postup, ukáže editovatelný náhled a uloží – i s originálem vloženého textu
 * jako poznámkou. Parser se plete, proto je náhled vždy. Rozdělaný náhled se průběžně
 * ukládá do `importDrafts` a přežije zavření appky.
 */
export default function ImportRecipeScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  /** Text sdílený z jiné appky (manifest `share_target`) – čte se jen při otevření. */
  const [sharedText] = useState(() => sharedTextFromParams(searchParams));
  const [loaded, setLoaded] = useState(false);
  const [restored, setRestored] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsedText, setParsedText] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ImportPreview | null>(null);
  // Stejný příspěvek sdílený podruhé: jen upozornit, uložení nic neblokuje (pravidlo 3).
  const previewName = preview?.name ?? '';
  const sameNameRecipe = useLiveQuery(
    async () =>
      previewName.trim()
        ? ((await db.recipes.toArray()).find((recipe) => !recipe.deletedAt && isSameName(recipe.name, previewName)) ??
          null)
        : null,
    [previewName],
  );
  /** Mimo náhled, ať je nové „Rozebrat" nezahodí. */
  const [tags, setTags] = useState<string[]>([]);
  const tagSuggestions = useTagSuggestions();
  const [message, setMessage] = useState('');
  /** Holý odkaz (IG sdílí jen ten) → nabídka „Uložit odkaz na později". */
  const [bareLink, setBareLink] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Text čekající na potvrzení „Přepsat náhled?" (null = dialog zavřený). */
  const [pendingParse, setPendingParse] = useState<string | null>(null);
  const [focusNameRequest, setFocusNameRequest] = useState(0);
  /** Vložený text je po „Rozebrat" sbalený, ať je náhled hned nahoře. */
  const [sourceOpen, setSourceOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const ingredientsRef = useAutoGrow(preview?.ingredients ?? '');
  const instructionsRef = useAutoGrow(preview?.instructions ?? '');
  // Rozdělení diktátu se v náhledu počítá jako ruční úprava (isPreviewEdited, souhrn).
  const updateIngredients = useCallback((fn: (current: string) => string) => {
    setPreview((prev) => (prev ? { ...prev, ingredients: fn(prev.ingredients) } : prev));
  }, []);
  const updateInstructions = useCallback((fn: (current: string) => string) => {
    setPreview((prev) => (prev ? { ...prev, instructions: fn(prev.instructions) } : prev));
  }, []);
  const ingredientsSplit = useSplitOffer('ingredients', preview?.ingredients ?? '', updateIngredients);
  const instructionsSplit = useSplitOffer('steps', preview?.instructions ?? '', updateInstructions);
  /** Koncept se úspěšně načetl → smí se průběžně zapisovat. Po chybě načtení zůstává false. */
  const loadedRef = useRef(false);
  /** Po uložení už koncept nezapisovat (jinak by ho doběhnutý debounce vzkřísil). */
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<DraftState>({
    pasteText: '',
    parsedText: null,
    preview: null,
    parsedPreview: null,
    tags: [],
  });

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

  const applyParse = useCallback((text: string) => {
    const next = previewFromParsed(parseRecipeText(text));
    setPreview(next);
    setParsedPreview(next);
    setParsedText(text);
    setMessage('');
    setBareLink(null);
    setRestored(false);
    setSourceOpen(false);
    if (next.name.trim() === '') setFocusNameRequest((count) => count + 1);
  }, []);

  // Sdílený text je přečtený → pryč z adresy, ať ho obnovení stránky nevloží znovu.
  useEffect(() => {
    if (searchParams.toString() !== '') setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  // Načtení rozdělaného konceptu (jednou), pak případně sdíleného textu.
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
          setTags(draft.tags ?? []);
          setRestored(true);
        }
        if (sharedText !== null) {
          if (isBareUrl(sharedText)) {
            // Koncept zůstává, jen nápověda (IG sdílí odkaz, ne popisek).
            setMessage(URL_MESSAGE);
            setBareLink(sharedText.trim());
          } else {
            setPasteText(sharedText);
            const edited =
              draft?.preview != null &&
              draft.parsedPreview != null &&
              isPreviewEdited(draft.preview, draft.parsedPreview);
            if (edited) setPendingParse(sharedText);
            else applyParse(sharedText);
          }
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
  }, [sharedText, applyParse]);

  // Průběžné ukládání konceptu (debounce).
  useEffect(() => {
    draftRef.current = { pasteText, parsedText, preview, parsedPreview, tags };
    if (!loaded) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(persistDraft, DRAFT_DEBOUNCE_MS);
  }, [pasteText, parsedText, preview, parsedPreview, tags, loaded, persistDraft]);

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

  function requestParse(text: string) {
    if (isBareUrl(text)) {
      setMessage(URL_MESSAGE);
      setBareLink(text.trim());
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
    setTags([]);
    setMessage('');
    setBareLink(null);
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
        tags,
        prepMinutes: null,
      },
      servings: null,
      // Originál je celý v postupu, poznámka by byla duplicitní.
      originalText: '',
      clearDraft: loadedRef.current,
    });
  }

  /**
   * Recept jen s odkazem v postupu (na detailu klikací) – text se doplní později přes Upravit.
   * Rozdělaný náhled zůstává: odkaz s ním nesouvisí, proto `clearDraft: false`.
   */
  function handleSaveLink() {
    if (bareLink === null || saving) return;
    void saveAndOpen({
      content: {
        name: linkRecipeName(bareLink),
        capturedOn: todayIso(),
        ingredientLines: [],
        instructions: bareLink,
        rawCapture: combineRawCapture('', bareLink),
        tags,
        prepMinutes: null,
      },
      servings: null,
      originalText: '',
      clearDraft: false,
    });
  }

  function handleSave() {
    if (!preview || saving) return;
    const prepMinutes = fieldValue(parsePrepInput(preview.prepMinutes));
    const servings = fieldValue(parseServingsInput(preview.servings));
    void saveAndOpen({
      content: {
        name: preview.name.trim() || fallbackImportName(preview.source),
        capturedOn: todayIso(),
        ingredientLines: splitIngredientLines(preview.ingredients),
        instructions: preview.instructions.trim() || null,
        rawCapture: combineRawCapture(preview.ingredients, preview.instructions),
        tags,
        prepMinutes,
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
            <div className="mb-3 flex items-center justify-between gap-3 text-sm text-stone-500 dark:text-stone-400">
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
              className={cardClass({
                padding: 'none',
                interactive: true,
                className: 'flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm',
              })}
            >
              <span className="font-semibold">Vložený text</span>
              <span className="shrink-0 text-stone-500 dark:text-stone-400">Zobrazit ▾</span>
            </button>
          ) : (
            <>
              <textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                onPaste={handlePasteIntoField}
                autoFocus={!restored}
                placeholder="Sem vlož zkopírovaný recept…"
                className={cx(FIELD, 'min-h-[18dvh] w-full resize-none p-4 text-base leading-relaxed')}
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
          {message ? <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{message}</p> : null}
          {bareLink !== null && message === URL_MESSAGE ? (
            <div className="mt-2">
              <Button role="secondary" disabled={saving} onClick={handleSaveLink}>
                Uložit odkaz na později
              </Button>
            </div>
          ) : null}
          {!preview ? <ImportHelp /> : null}

          {preview ? (
            <div className="mt-6 border-t border-stone-200/80 pt-5 dark:border-stone-800">
              <p className={SECTION_TITLE}>Náhled – uprav, co parser netrefil</p>
              <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
                {previewSummary(preview.ingredients, preview.instructions)}
              </p>
              <input
                ref={nameRef}
                value={preview.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder={`Název – jinak „${fallbackImportName(preview.source)}"`}
                aria-label="Název receptu"
                className="mt-3 w-full border-b border-stone-200 bg-transparent py-2 text-2xl font-bold tracking-tight outline-none placeholder:font-semibold placeholder:text-stone-400 focus:border-brand dark:border-stone-700 dark:placeholder:text-stone-500 dark:focus:border-brand-light"
              />
              {sameNameRecipe ? (
                <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
                  Už máš:{' '}
                  <Link to={`/recept/${sameNameRecipe.id}`} className="font-medium underline">
                    {sameNameRecipe.name}
                  </Link>
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-500 dark:text-stone-400">
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
                    onBlur={() => {
                      const normalized = normalizedPrepText(preview.prepMinutes);
                      if (normalized !== preview.prepMinutes) updateField('prepMinutes', normalized);
                    }}
                    inputMode="numeric"
                    placeholder="—"
                    className={`w-16 ${fieldClass}`}
                  />
                  <span>min</span>
                </span>
              </div>
              <FieldInputHints prep={preview.prepMinutes} servings={preview.servings} />

              <FieldLabelWithSplit
                htmlFor="ingredients"
                splitLabel={ingredientsSplit.label}
                onSplit={ingredientsSplit.apply}
              >
                Suroviny
              </FieldLabelWithSplit>
              <textarea
                id="ingredients"
                ref={ingredientsRef}
                value={preview.ingredients}
                onChange={(event) => {
                  ingredientsSplit.noteEdit();
                  updateField('ingredients', event.target.value);
                }}
                className={areaClass}
              />

              <FieldLabelWithSplit
                htmlFor="instructions"
                splitLabel={instructionsSplit.label}
                onSplit={instructionsSplit.apply}
              >
                Postup
              </FieldLabelWithSplit>
              <textarea
                id="instructions"
                ref={instructionsRef}
                value={preview.instructions}
                onChange={(event) => {
                  instructionsSplit.noteEdit();
                  updateField('instructions', event.target.value);
                }}
                className={areaClass}
              />

              <p className={cx(LABEL, 'mt-4')}>Štítky</p>
              <div className="mt-1.5">
                <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
              </div>
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
