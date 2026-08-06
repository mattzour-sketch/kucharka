import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { todayIso } from '../../lib/date';
import { parseDecimal } from '../../lib/num';
import { parseRecipeText } from '../../lib/parseRecipe';
import { combineRawCapture, splitIngredientLines } from '../../lib/recipeText';
import { createRecipeWithContent, updateRecipeMeta } from './recipesRepo';

/**
 * Vložení receptu ze schránky (§11). Rozebere text na název/porce/suroviny/postup,
 * ukáže editovatelný náhled a uloží. Parser se plete – proto je náhled vždy.
 */
export default function ImportRecipeScreen() {
  const navigate = useNavigate();
  const [pasteText, setPasteText] = useState('');
  const [name, setName] = useState('');
  const [servings, setServings] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [message, setMessage] = useState('');
  const [parsed, setParsed] = useState(false);

  function fillFromText(text: string) {
    const result = parseRecipeText(text);
    setName(result.name);
    setServings(result.servings != null ? String(result.servings) : '');
    setIngredients(result.ingredients.join('\n'));
    setInstructions(result.instructions ?? '');
    setParsed(true);
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setMessage('Schránka je prázdná.');
        return;
      }
      setPasteText(text);
      fillFromText(text);
      setMessage('');
    } catch {
      setMessage('Schránku nejde přečíst – vlož text ručně do pole níže.');
    }
  }

  async function handleSave() {
    const finalName = name.trim() || 'Vložený recept';
    const id = await createRecipeWithContent({
      name: finalName,
      capturedOn: todayIso(),
      ingredientLines: splitIngredientLines(ingredients),
      instructions: instructions.trim() || null,
      rawCapture: combineRawCapture(ingredients, instructions),
      tags: [],
    });
    const servingsValue = parseDecimal(servings);
    if (servingsValue != null && servingsValue > 0) {
      await updateRecipeMeta(id, { servings: servingsValue });
    }
    navigate(`/recept/${id}`, { replace: true });
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-2 py-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg px-3 py-1.5 text-stone-500 transition hover:bg-stone-200/60"
            aria-label="Zavřít"
          >
            ✕
          </button>
          <span className="text-sm font-medium text-stone-600">Vložit recept</span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!parsed}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95 disabled:opacity-40"
          >
            Uložit
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <textarea
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          autoFocus
          placeholder="Sem vlož zkopírovaný recept…"
          className="min-h-[18dvh] w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-relaxed outline-none placeholder:text-stone-300 focus:border-brand"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handlePasteFromClipboard()}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
          >
            Vložit ze schránky
          </button>
          <button
            type="button"
            onClick={() => fillFromText(pasteText)}
            disabled={pasteText.trim() === ''}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95 disabled:opacity-40"
          >
            Rozebrat
          </button>
        </div>
        {message ? <p className="mt-2 text-sm text-stone-500">{message}</p> : null}

        {parsed ? (
          <div className="mt-5 border-t border-stone-200 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Náhled – uprav, co parser netrefil
            </p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Název receptu"
              className="mt-3 w-full border-b border-stone-200 bg-transparent py-2 text-lg font-medium outline-none placeholder:text-stone-400 focus:border-brand"
            />
            <div className="mt-2 flex items-center gap-2 text-sm text-stone-500">
              <label htmlFor="servings">Porcí</label>
              <input
                id="servings"
                value={servings}
                onChange={(event) => setServings(event.target.value)}
                inputMode="decimal"
                placeholder="—"
                className="w-16 rounded-xl border border-stone-200 bg-white px-3 py-1.5 outline-none focus:border-brand"
              />
            </div>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-stone-400">
              Suroviny
            </label>
            <textarea
              value={ingredients}
              onChange={(event) => setIngredients(event.target.value)}
              className="mt-1 min-h-[18dvh] w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 leading-relaxed outline-none focus:border-brand"
            />

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-stone-400">
              Postup
            </label>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              className="mt-1 min-h-[18dvh] w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 leading-relaxed outline-none focus:border-brand"
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
