import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CookLog } from '../../db';
import { formatCzechDate, formatRecentDate } from '../../lib/date';
import { recipeDateLine } from '../../lib/recipeDates';
import { cookLogView } from '../../lib/cookLogView';
import { formatNumber } from '../../lib/num';
import { czechPlural } from '../../lib/plural';
import { scaleQuantityText } from '../../lib/scale';
import { ingredientHeadingLabel, isIngredientHeading } from '../../lib/ingredientSection';
import { formatPrepTime } from '../../lib/prepTime';
import { originalNoteText, partitionNotes } from '../../lib/originalNote';
import { buildRecipeText } from '../../lib/shareText';
import { cookingSteps } from '../../lib/recipeText';
import LinkedText from '../../components/ui/LinkedText';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { nutritionFromData } from '../nutrition/recipeNutrition';
import NutritionSummary from '../nutrition/NutritionSummary';
import { addRecipePhoto, deleteRecipePhoto, getRecipePhotos, restoreRecipePhoto } from '../photos/photosRepo';
import {
  duplicateRecipe,
  getAllRecipeItems,
  setRecipeFavorite,
  softDeleteRecipe,
  updateRecipeMeta,
} from './recipesRepo';
import { deleteCookLog, getCookLogs, replayCookLog, restoreCookLog } from './cookLogRepo';
import { restoreRecipe } from '../trash/trashRepo';
import { addLinesToShopping, removeShoppingItems } from '../shopping/shoppingRepo';
import {
  addRecipeNote,
  deleteRecipeNote,
  getRecipeNotes,
  restoreRecipeNote,
} from './recipeNotesRepo';
import { useUndo } from '../../components/undoContext';
import ServingsStepper from './ServingsStepper';
import IngredientLine from './IngredientLine';
import { hasAmountColumn } from '../../lib/amountSplit';
import { recipeListHref } from './listReturn';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import Icon, { type IconName } from '../../components/ui/Icon';
import Tag from '../../components/ui/Tag';
import Segmented from '../../components/ui/Segmented';
import FilterChip from '../../components/ui/FilterChip';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { cardClass } from '../../components/ui/cardClass';
import { cx } from '../../components/ui/cx';
import { ReadingSkeleton } from '../../components/ui/Loading';
import { useBackToClose } from '../../hooks/useBackToClose';
import { SECTION_TITLE } from '../../components/ui/styles';

/** Nabídka porcí u receptu bez počtu porcí (víc porcí se nastaví v Upravit). */
const SERVINGS_CHOICES = [1, 2, 3, 4, 5, 6];

export default function RecipeDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // Na desktopu je foťák k ničemu (`capture` se ignoruje): jen jedno „Přidat fotku".
  const [isTouch] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const photoSources: { key: string; ref: typeof fileRef; icon: IconName; label: string }[] = isTouch
    ? [
        { key: 'camera', ref: cameraRef, icon: 'camera', label: 'Vyfotit' },
        { key: 'gallery', ref: fileRef, icon: 'image', label: 'Z galerie' },
      ]
    : [{ key: 'gallery', ref: fileRef, icon: 'camera', label: 'Přidat fotku' }];
  const [viewingPhotoId, setViewingPhotoId] = useState<string | null>(null);
  useBackToClose(viewingPhotoId !== null, () => setViewingPhotoId(null));
  const [targetServings, setTargetServings] = useState<number | null>(null);
  const [shareMsg, setShareMsg] = useState('');
  // Historie: kalorie na porci, nebo za celou uvařenou dávku.
  const [histMode, setHistMode] = useState<'porce' | 'cely'>('porce');
  const [noteDraft, setNoteDraft] = useState('');
  const { showUndo } = useUndo();

  // Detail se mezi recepty neremountuje – při změně id vynuluj cíl porcí.
  useEffect(() => setTargetServings(null), [id]);

  const data = useLiveQuery(async () => {
    if (!id) return { recipe: null, items: [], foods: [], recipes: [], allItems: [] };
    const recipe = (await db.recipes.get(id)) ?? null;
    if (!recipe) return { recipe: null, items: [], foods: [], recipes: [], allItems: [] };
    const [foods, recipes, allItems] = await Promise.all([
      db.foods.toArray(),
      db.recipes.toArray(),
      getAllRecipeItems(),
    ]);
    const items = allItems
      .filter((item) => item.recipeId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { recipe, items, foods, recipes, allItems };
  }, [id]);

  const photos = useLiveQuery(() => (id ? getRecipePhotos(id) : Promise.resolve([])), [id]) ?? [];
  const cookLogs = useLiveQuery(() => (id ? getCookLogs(id) : Promise.resolve([])), [id]) ?? [];
  const notes = useLiveQuery(() => (id ? getRecipeNotes(id) : Promise.resolve([])), [id]) ?? [];

  if (data === undefined) {
    return (
      <div className="min-h-dvh">
        <ScreenHeader variant="stack" width="narrow" backTo={recipeListHref()} backLabel="Zpět na seznam" />
        <main className="mx-auto max-w-2xl px-4 py-4">
          <ReadingSkeleton />
        </main>
      </div>
    );
  }
  const { recipe, items } = data;
  if (!recipe || recipe.deletedAt || !id) return <NotFound />;

  async function handleDelete() {
    if (!id) return;
    const recipeId = id;
    await softDeleteRecipe(recipeId);
    showUndo({ message: 'Recept smazán', undo: () => restoreRecipe(recipeId) });
    navigate('/', { replace: true });
  }

  async function handleDuplicate() {
    if (!id) return;
    const copyId = await duplicateRecipe(id);
    if (copyId) navigate(`/recept/${copyId}/upravit`);
  }

  function onPhotoInput(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void handleAddPhotos(event.target.files);
    event.target.value = '';
  }

  async function handleAddPhotos(files: FileList) {
    if (!id) return;
    for (const file of Array.from(files)) {
      await addRecipePhoto(id, file);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    const photo = photos.find((item) => item.id === photoId);
    await deleteRecipePhoto(photoId);
    setViewingPhotoId(null);
    if (photo) showUndo({ message: 'Fotka smazána', undo: () => restoreRecipePhoto(photo) });
  }

  async function handleReplay(log: CookLog) {
    if (!id) return;
    await replayCookLog(log);
    navigate(`/recept/${id}/varit`);
  }

  async function handleAddToShopping() {
    if (!recipe) return;
    const lines = items
      .filter((item) => !isIngredientHeading(item.rawText))
      .map((item) => scaleQuantityText(item.rawText, scaleFactor));
    const ids = await addLinesToShopping(lines, recipe.name || null);
    if (ids.length > 0) {
      showUndo({ message: `Přidáno do nákupu (${ids.length})`, undo: () => removeShoppingItems(ids) });
    }
  }

  /** Počet porcí rovnou z detailu; množství se dál ukazují tak, jak jsou napsaná. */
  async function handleSetServings(count: number) {
    if (!id) return;
    await updateRecipeMeta(id, { servings: count });
    setTargetServings(null);
  }

  async function handleDeleteLog(logId: string) {
    const log = cookLogs.find((item) => item.id === logId);
    await deleteCookLog(logId);
    if (log) showUndo({ message: 'Záznam smazán', undo: () => restoreCookLog(log) });
  }

  function handleAddNote() {
    const text = noteDraft.trim();
    if (!id || !text) return;
    void addRecipeNote(id, text);
    setNoteDraft('');
  }

  async function handleDeleteNote(noteId: string, message = 'Poznámka smazána') {
    const note = notes.find((item) => item.id === noteId);
    await deleteRecipeNote(noteId);
    if (note) showUndo({ message, undo: () => restoreRecipeNote(note) });
  }

  // Originál vloženého textu (UC031) se ukazuje zvlášť a sbalený, ne mezi vlastními poznámkami.
  const { own: ownNotes, originals: originalNotes } = partitionNotes(notes);

  const nutrition = nutritionFromData(id, {
    foods: data.foods,
    recipes: data.recipes,
    items: data.allItems,
  });
  const hasIngredients = items.length > 0;
  const hasSteps = Boolean(recipe.instructions && recipe.instructions.trim());
  const legacyText = !hasIngredients && !hasSteps ? (recipe.rawCapture ?? '').trim() : '';
  const viewingPhoto = photos.find((photo) => photo.id === viewingPhotoId) ?? null;
  const steps = cookingSteps(recipe.instructions);

  const baseServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  const targetPortions = targetServings ?? baseServings;
  const scaleFactor = targetPortions / baseServings;

  // Řádky surovin pro zobrazení: nadpis sekce, nebo text přepočtený na zvolené porce.
  const ingredientRows = items.map((item) =>
    isIngredientHeading(item.rawText)
      ? { id: item.id, heading: ingredientHeadingLabel(item.rawText), text: '' }
      : { id: item.id, heading: null, text: scaleQuantityText(item.rawText, scaleFactor) },
  );
  const amountColumn = hasAmountColumn(ingredientRows.filter((row) => row.heading === null).map((row) => row.text));

  async function handleShare() {
    if (!recipe) return;
    const scaled = scaleFactor !== 1;
    const text = buildRecipeText({
      name: recipe.name,
      ingredients: items.map((item) => scaleQuantityText(item.rawText, scaleFactor)),
      instructions: recipe.instructions ?? null,
      portions: recipe.servings || scaled ? targetPortions : null,
      scaledFrom: scaled ? baseServings : null,
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.name || 'Recept', text });
        return;
      }
    } catch {
      return; // sdílení zrušeno uživatelem
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareMsg('Zkopírováno do schránky.');
    } catch {
      setShareMsg('Zkopírování se nepovedlo.');
    }
  }

  return (
    <div className="min-h-dvh">
      <ScreenHeader
        variant="stack"
        width="narrow"
        backTo={recipeListHref()}
        backLabel="Zpět na seznam"
        actions={
          <>
            <IconButton
              tone="favorite"
              active={recipe.isFavorite}
              onClick={() => void setRecipeFavorite(recipe.id, !recipe.isFavorite)}
              aria-label={recipe.isFavorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
              aria-pressed={recipe.isFavorite}
            >
              <Icon name="star" filled={recipe.isFavorite} className="h-6 w-6" />
            </IconButton>
            <Button role="secondary" to={`/recept/${recipe.id}/upravit`}>
              Upravit
            </Button>
            <Button
              role="primary"
              onClick={() =>
                navigate(`/recept/${recipe.id}/varit`, {
                  state: targetServings !== null ? { servings: targetServings } : null,
                })
              }
            >
              Vařit
            </Button>
          </>
        }
      />

      <main className="mx-auto max-w-2xl px-4 py-4">
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight">
          {recipe.name || '(bez názvu)'}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-stone-500 dark:text-stone-400">
          {recipe.prepMinutes ? (
            <span className="inline-flex items-center gap-1 font-semibold text-stone-700 dark:text-stone-200">
              <Icon name="clock" className="h-4 w-4" />
              {formatPrepTime(recipe.prepMinutes)}
            </span>
          ) : null}
          {recipe.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
          <span>
            {recipeDateLine(
              recipe.capturedOn,
              cookLogs.map((log) => log.cookedOn),
            )}
          </span>
        </div>

        {/* První fotka je tvář receptu (stejná jako v seznamu); další jsou malé náhledy.
            Přidání fotky je vždy jen malé tlačítko, ať neodsouvá suroviny. */}
        {photos.length > 0 ? (
          <PhotoThumb blob={photos[0].blob} hero onClick={() => setViewingPhotoId(photos[0].id)} />
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {photos.slice(1).map((photo) => (
            <PhotoThumb
              key={photo.id}
              blob={photo.blob}
              onClick={() => setViewingPhotoId(photo.id)}
            />
          ))}
          {photoSources.map((source) => (
            <FilterChip key={source.key} active={false} onClick={() => source.ref.current?.click()}>
              <Icon name={source.icon} className="-ml-0.5 h-4 w-4" />
              {source.label}
            </FilterChip>
          ))}
          {/* Foťák zvlášť: s `capture` mobil otevře rovnou fotoaparát a galerii nenabídne. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhotoInput}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPhotoInput}
          />
        </div>

        {hasIngredients ? (
          <section className="mt-5">
            {nutrition.computable || nutrition.hasCycle ? (
              <div className="mb-1">
                <NutritionSummary result={nutrition} compact />
              </div>
            ) : null}
            <Link
              to={`/recept/${recipe.id}/kalorie`}
              className="inline-flex min-h-9 items-center text-sm font-semibold text-brand dark:text-brand-light"
            >
              {nutrition.computable ? 'Upravit kalorie' : 'Spočítat kalorie →'}
            </Link>
          </section>
        ) : null}

        {hasIngredients ? (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className={SECTION_TITLE}>Suroviny</h2>
              {/* Bez zadaných porcí by počítadlo násobilo od 1 – nejdřív „Pro kolik porcí?" dole. */}
              {recipe.servings ? (
                <ServingsStepper
                  value={targetPortions}
                  base={recipe.servings}
                  onStep={(delta) =>
                    setTargetServings((prev) => Math.max(1, (prev ?? baseServings) + delta))
                  }
                />
              ) : null}
            </div>
            {/* Navažovací seznam: množství tučně ve vlastním sloupci zarovnané pod sebou,
                název vedle. Jen zobrazení – text suroviny se nemění (pravidlo 2). */}
            <ul className="mt-2 text-[17px] leading-snug">
              {ingredientRows.map((row) =>
                row.heading !== null ? (
                  <li
                    key={row.id}
                    className="pb-1.5 pt-5 text-sm font-semibold text-stone-500 first:pt-1 dark:text-stone-400"
                  >
                    {row.heading}
                  </li>
                ) : (
                  <li
                    key={row.id}
                    className="border-t border-stone-200/80 py-2.5 first:border-t-0 dark:border-stone-800"
                  >
                    <IngredientLine text={row.text} column={amountColumn} />
                  </li>
                ),
              )}
            </ul>
            {!recipe.servings ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-sm text-stone-500 dark:text-stone-400">Pro kolik porcí?</span>
                {SERVINGS_CHOICES.map((count) => (
                  <FilterChip key={count} active={false} onClick={() => void handleSetServings(count)}>
                    {count}
                  </FilterChip>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {hasSteps ? (
          <section className="mt-8">
            <h2 className={SECTION_TITLE}>Postup</h2>
            {steps.length > 1 ? (
              // Kroky číslované stejně jako ve vaření (vlastní „1." z textu se neopakuje).
              <ol className="mt-3 space-y-3.5 text-[17px] leading-relaxed">
                {steps.map((step, index) => (
                  <li key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
                    <span className="font-bold tabular-nums text-brand dark:text-brand-light">{index + 1}</span>
                    <span>
                      <LinkedText text={step} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-[17px] leading-relaxed">
                <LinkedText text={recipe.instructions ?? ''} />
              </p>
            )}
          </section>
        ) : null}

        {legacyText ? (
          <Card className="mt-5">
            <p className="whitespace-pre-wrap leading-relaxed">
              <LinkedText text={legacyText} />
            </p>
          </Card>
        ) : null}

        {!hasIngredients && !hasSteps && !legacyText ? (
          <p className="mt-5 text-stone-500 dark:text-stone-400">Zatím bez obsahu. Klepni na „Upravit" nebo přidej fotku.</p>
        ) : null}

        <section className="mt-8">
          <h2 className={SECTION_TITLE}>Poznámky</h2>
          <div className="mt-2 flex gap-2">
            <input
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleAddNote();
              }}
              placeholder={'poznámka k receptu (např. „příště míň soli")'}
              className="h-10 min-w-0 flex-1 rounded-xl bg-stone-100 px-3 text-base outline-none placeholder:text-stone-500 focus-visible:ring-2 focus-visible:ring-brand/50 dark:bg-stone-900 dark:placeholder:text-stone-400 dark:focus-visible:ring-brand-light/60"
            />
            <Button role="secondary" onClick={handleAddNote}>
              Přidat
            </Button>
          </div>
          {ownNotes.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {[...ownNotes].reverse().map((note) => (
                <li key={note.id} className={cardClass({ padding: 'panel' })}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 whitespace-pre-wrap text-sm">{note.body}</p>
                    <IconButton
                      size="sm"
                      onClick={() => void handleDeleteNote(note.id)}
                      aria-label="Smazat poznámku"
                    >
                      <Icon name="close" className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{formatCzechDate(note.notedOn)}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {originalNotes.map((note) => (
            <details
              key={note.id}
              className="mt-3 rounded-xl border border-dashed border-stone-300 px-3 py-2 dark:border-stone-700"
            >
              <summary className="cursor-pointer py-1 text-sm text-stone-500 dark:text-stone-400">
                Originál · {formatCzechDate(note.notedOn)}
              </summary>
              <div className="mt-2 flex items-start justify-between gap-3">
                <p className="min-w-0 whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-300">
                  {originalNoteText(note.body)}
                </p>
                <IconButton
                  size="sm"
                  onClick={() => void handleDeleteNote(note.id, 'Originál smazán')}
                  aria-label="Smazat originál"
                >
                  <Icon name="close" className="h-4 w-4" />
                </IconButton>
              </div>
            </details>
          ))}
        </section>

        {cookLogs.length > 0 ? (
          <section className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className={SECTION_TITLE}>Historie vaření</h2>
              {cookLogs.some((log) => Boolean(log.perPortion) && log.portions > 1) ? (
                <Segmented
                  value={histMode}
                  onChange={setHistMode}
                  ariaLabel="Kalorie na porci nebo celkem"
                  options={[
                    { value: 'porce', label: 'Na porci' },
                    { value: 'cely', label: 'Celý' },
                  ]}
                />
              ) : null}
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {cookLogs.map((log) => {
                const view = cookLogView(log.ingredients, log.portions, recipe.servings);
                return (
                <li key={log.id} className={cardClass({ padding: 'panel' })}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold">
                      {formatRecentDate(log.cookedOn)} · {log.portions}{' '}
                      {czechPlural(log.portions, ['porce', 'porce', 'porcí'])}
                    </span>
                    <IconButton
                      size="sm"
                      onClick={() => void handleDeleteLog(log.id)}
                      aria-label="Smazat záznam"
                    >
                      <Icon name="close" className="h-4 w-4" />
                    </IconButton>
                  </div>
                  {log.note ? <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{log.note}</p> : null}
                  {log.perPortion ? (
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      ≈{' '}
                      {formatNumber(
                        histMode === 'cely' ? log.perPortion.kcal * log.portions : log.perPortion.kcal,
                      )}{' '}
                      kcal {histMode === 'cely' ? 'celkem' : '/ porce'}
                      {log.nutrition && log.nutrition.connected < log.nutrition.countable
                        ? ` · orientační (z ${log.nutrition.connected} z ${log.nutrition.countable})`
                        : ''}
                    </p>
                  ) : null}
                  {view.deviations.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-sm">
                      {view.deviations.map((ingredient, index) => (
                        <li
                          key={index}
                          className={
                            ingredient.off
                              ? 'text-stone-400 line-through dark:text-stone-500'
                              : 'text-brand-dark dark:text-brand-light'
                          }
                        >
                          {ingredient.text}
                          {ingredient.replacedWith ? ` → ${ingredient.replacedWith}` : ''}
                          {ingredient.off ? ' · vynecháno' : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">podle receptu</p>
                  )}
                  {view.canReplay ? (
                    <button
                      type="button"
                      onClick={() => void handleReplay(log)}
                      className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-brand dark:text-brand-light"
                    >
                      Uvařit znovu takhle →
                    </button>
                  ) : null}
                </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="mt-8 flex gap-2">
          <Button role="secondary" fullWidth onClick={() => void handleShare()}>
            Sdílet
          </Button>
          <Button role="secondary" fullWidth onClick={() => void handleDuplicate()}>
            Duplikovat
          </Button>
          {hasIngredients ? (
            <Button role="secondary" fullWidth onClick={() => void handleAddToShopping()}>
              Do nákupu
            </Button>
          ) : null}
        </div>
        {shareMsg ? <p className="mt-2 text-center text-sm text-stone-600 dark:text-stone-300">{shareMsg}</p> : null}

        <div className="mt-4">
          <Button role="destructive" fullWidth onClick={() => void handleDelete()}>
            Smazat recept
          </Button>
        </div>
      </main>

      {viewingPhoto ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/90">
          <div className="flex items-center justify-between p-3">
            <button
              type="button"
              onClick={() => void handleDeletePhoto(viewingPhoto.id)}
              className="rounded-lg px-3 py-1.5 text-sm text-red-300 hover:bg-white/10"
            >
              Smazat
            </button>
            <button
              type="button"
              onClick={() => setViewingPhotoId(null)}
              className="rounded-lg px-3 py-1.5 text-sm text-white hover:bg-white/10"
            >
              Zavřít
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
            <FullPhoto blob={viewingPhoto.blob} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PhotoThumb({ blob, hero = false, onClick }: { blob: Blob; hero?: boolean; onClick: () => void }) {
  const url = useObjectUrl(blob);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'shrink-0 overflow-hidden bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 dark:bg-stone-900',
        hero ? 'mt-4 block aspect-[16/10] w-full rounded-2xl sm:aspect-[21/9]' : 'h-16 w-16 rounded-xl',
      )}
    >
      {url ? <img src={url} alt="Fotka receptu" className="h-full w-full object-cover" /> : null}
    </button>
  );
}

function FullPhoto({ blob }: { blob: Blob }) {
  const url = useObjectUrl(blob);
  if (!url) return null;
  return <img src={url} alt="Fotka receptu" className="max-h-full max-w-full object-contain" />;
}

function NotFound() {
  return (
    <div className="min-h-dvh">
      <ScreenHeader variant="stack" width="narrow" backTo="/" backLabel="Zpět na seznam" />
      <main className="mx-auto max-w-2xl px-4">
        <EmptyState
          fill
          title="Recept nenalezen"
          action={
            <Button role="primary" to="/">
              Zpět na seznam
            </Button>
          }
        />
      </main>
    </div>
  );
}
