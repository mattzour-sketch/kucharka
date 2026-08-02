/**
 * Fáze 0: jediná obrazovka. Prázdný seznam receptů se stálým tlačítkem
 * „+ Nový recept", které zatím nic nedělá. Zachycení receptu přijde ve Fázi 1.
 */
export default function RecipeListScreen() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight">Recepty</h1>
          <button
            type="button"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
          >
            + Nový recept
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4">
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-3xl">
            🍲
          </div>
          <h2 className="text-lg font-medium">Zatím žádné recepty</h2>
          <p className="max-w-xs text-sm text-stone-500">
            Až budeš u babičky v kuchyni, přibude sem první recept. Zachycení do 60 sekund, i bez
            signálu.
          </p>
        </div>
      </main>
    </div>
  );
}
