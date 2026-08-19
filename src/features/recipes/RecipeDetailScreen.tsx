import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CookLog } from '../../db';
import { formatCzechDate } from '../../lib/date';
import { formatNumber } from '../../lib/num';
import { scaleQuantityText } from '../../lib/scale';
import { buildRecipeText } from '../../lib/shareText';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { nutritionFromData } from '../nutrition/recipeNutrition';
import NutritionSummary from '../nutrition/NutritionSummary';
import { addRecipePhoto, deleteRecipePhoto, getRecipePhotos } from '../photos/photosRepo';
import { setRecipeFavorite, softDeleteRecipe } from './recipesRepo';
import { deleteCookLog, getCookLogs, replayCookLog } from './cookLogRepo';
import ServingsStepper from './ServingsStepper';

export default function RecipeDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewingPhotoId, setViewingPhotoId] = useState<string | null>(null);
  const [targetServings, setTargetServings] = useState<number | null>(null);
  const [shareMsg, setShareMsg] = useState('');

  // Detail se mezi recepty neremountuje – při změně id vynuluj cíl porcí.
  useEffect(() => setTargetServings(null), [id]);

  const data = useLiveQuery(async () => {
    if (!id) return { recipe: null, items: [], foods: [], recipes: [], allItems: [] };
    const recipe = (await db.recipes.get(id)) ?? null;
    if (!recipe) return { recipe: null, items: [], foods: [], recipes: [], allItems: [] };
    const [foods, recipes, allItems] = await Promise.all([
      db.foods.toArray(),
      db.recipes.toArray(),
      db.recipeItems.toArray(),
    ]);
    const items = allItems
      .filter((item) => item.recipeId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { recipe, items, foods, recipes, allItems };
  }, [id]);

  const photos = useLiveQuery(() => (id ? getRecipePhotos(id) : Promise.resolve([])), [id]) ?? [];
  const cookLogs = useLiveQuery(() => (id ? getCookLogs(id) : Promise.resolve([])), [id]) ?? [];

  if (data === undefined) return null;
  const { recipe, items } = data;
  if (!recipe || recipe.deletedAt || !id) return <NotFound />;

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('Opravdu smazat tenhle recept?')) return;
    await softDeleteRecipe(id);
    navigate('/', { replace: true });
  }

  async function handleAddPhotos(files: FileList) {
    if (!id) return;
    for (const file of Array.from(files)) {
      await addRecipePhoto(id, file);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!window.confirm('Smazat fotku?')) return;
    await deleteRecipePhoto(photoId);
    setViewingPhotoId(null);
  }

  async function handleReplay(log: CookLog) {
    if (!id) return;
    await replayCookLog(log);
    navigate(`/recept/${id}/varit`);
  }

  async function handleDeleteLog(logId: string) {
    if (!window.confirm('Smazat záznam z historie?')) return;
    await deleteCookLog(logId);
  }

  const nutrition = nutritionFromData(id, {
    foods: data.foods,
    recipes: data.recipes,
    items: data.allItems,
  });
  const hasIngredients = items.length > 0;
  const hasSteps = Boolean(recipe.instructions && recipe.instructions.trim());
  const legacyText = !hasIngredients && !hasSteps ? (recipe.rawCapture ?? '').trim() : '';
  const viewingPhoto = photos.find((photo) => photo.id === viewingPhotoId) ?? null;

  const baseServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  const targetPortions = targetServings ?? baseServings;
  const scaleFactor = targetPortions / baseServings;

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
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-2 py-2">
          <Link
            to="/"
            className="rounded-lg px-3 py-1.5 text-lg text-stone-500 transition hover:bg-stone-200/60"
            aria-label="Zpět na seznam"
          >
            ‹
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void setRecipeFavorite(recipe.id, !recipe.isFavorite)}
              className={`rounded-full px-2 py-1.5 text-xl leading-none transition ${
                recipe.isFavorite ? 'text-amber-500' : 'text-stone-300 hover:text-stone-500'
              }`}
              aria-label={recipe.isFavorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
              aria-pressed={recipe.isFavorite}
            >
              {recipe.isFavorite ? '★' : '☆'}
            </button>
            <Link
              to={`/recept/${recipe.id}/upravit`}
              className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
            >
              Upravit
            </Link>
            <Link
              to={`/recept/${recipe.id}/varit`}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
            >
              Vařit
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">{recipe.name || '(bez názvu)'}</h1>
        <p className="mt-1 text-sm text-stone-500">{formatCzechDate(recipe.capturedOn)}</p>

        {recipe.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs text-brand-dark"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo) => (
            <PhotoThumb
              key={photo.id}
              blob={photo.blob}
              onClick={() => setViewingPhotoId(photo.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-stone-300 text-stone-400 transition hover:border-brand hover:text-brand"
          >
            <span className="text-2xl leading-none">📷</span>
            <span className="text-xs">Fotka</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void handleAddPhotos(event.target.files);
              event.target.value = '';
            }}
          />
        </div>

        {hasIngredients ? (
          <section className="mt-5">
            {nutrition.computable || nutrition.hasCycle ? (
              <div className="mb-2">
                <NutritionSummary result={nutrition} />
              </div>
            ) : null}
            <Link
              to={`/recept/${recipe.id}/kalorie`}
              className="inline-block text-sm font-medium text-brand"
            >
              {nutrition.computable ? 'Upravit kalorie' : 'Spočítat kalorie →'}
            </Link>
          </section>
        ) : null}

        {hasIngredients ? (
          <section className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Suroviny
              </h2>
              <ServingsStepper
                value={targetPortions}
                onStep={(delta) =>
                  setTargetServings((prev) => Math.max(1, (prev ?? baseServings) + delta))
                }
              />
            </div>
            <ul className="mt-2 space-y-1">
              {items.map((item) => (
                <li key={item.id} className="flex gap-2 leading-relaxed">
                  <span className="mt-0.5 text-brand">•</span>
                  <span>{scaleQuantityText(item.rawText, scaleFactor)}</span>
                </li>
              ))}
            </ul>
            {!recipe.servings ? (
              <p className="mt-1.5 text-xs text-stone-400">
                Recept nemá počet porcí – počítám od 1. Nastavíš ho ve „Spočítat kalorie".
              </p>
            ) : null}
          </section>
        ) : null}

        {hasSteps ? (
          <section className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Postup</h2>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{recipe.instructions}</p>
          </section>
        ) : null}

        {legacyText ? (
          <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
            <p className="whitespace-pre-wrap leading-relaxed">{legacyText}</p>
          </div>
        ) : null}

        {!hasIngredients && !hasSteps && !legacyText ? (
          <p className="mt-5 text-stone-400">Zatím bez obsahu. Klepni na „Upravit" nebo přidej fotku.</p>
        ) : null}

        {cookLogs.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Historie vaření
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {cookLogs.map((log) => (
                <li key={log.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">
                      {formatCzechDate(log.cookedOn)} · {log.portions} porcí
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteLog(log.id)}
                      className="text-stone-400 hover:text-stone-600"
                      aria-label="Smazat záznam"
                    >
                      ×
                    </button>
                  </div>
                  {log.note ? <p className="mt-1 text-sm text-stone-500">{log.note}</p> : null}
                  {log.perPortion ? (
                    <p className="mt-1 text-sm font-medium text-brand-dark">
                      ≈ {formatNumber(log.perPortion.kcal)} kcal / porce
                      {log.nutrition && log.nutrition.connected < log.nutrition.countable
                        ? ` · orientační (z ${log.nutrition.connected} z ${log.nutrition.countable})`
                        : ''}
                    </p>
                  ) : null}
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {log.ingredients.map((ingredient, index) => (
                      <li
                        key={index}
                        className={
                          ingredient.off
                            ? 'text-stone-400 line-through'
                            : ingredient.replacedWith || ingredient.changed
                              ? 'text-brand-dark'
                              : 'text-stone-600'
                        }
                      >
                        {ingredient.text}
                        {ingredient.replacedWith ? ` → ${ingredient.replacedWith}` : ''}
                        {ingredient.off ? ' · vynecháno' : ''}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => void handleReplay(log)}
                    className="mt-3 text-sm font-medium text-brand"
                  >
                    Uvařit znovu takhle →
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => void handleShare()}
          className="mt-8 w-full rounded-xl border border-stone-300 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-[0.99]"
        >
          Sdílet jako text
        </button>
        {shareMsg ? <p className="mt-2 text-center text-sm text-brand-dark">{shareMsg}</p> : null}

        <button
          type="button"
          onClick={() => void handleDelete()}
          className="mt-3 w-full rounded-xl py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.99]"
        >
          Smazat recept
        </button>
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

function PhotoThumb({ blob, onClick }: { blob: Blob; onClick: () => void }) {
  const url = useObjectUrl(blob);
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-stone-500">Recept nenalezen.</p>
      <Link to="/" className="text-sm font-medium text-brand">
        Zpět na seznam
      </Link>
    </div>
  );
}
