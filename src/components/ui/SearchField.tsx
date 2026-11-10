import Icon from './Icon';

/**
 * Vyhledávací pole se lupou a křížkem na vymazání – jedna podoba pro Recepty i Potraviny.
 * Písmo 16 px, ať mobilní prohlížeč při zaměření stránku nepřiblíží.
 */
export default function SearchField({
  value,
  onChange,
  placeholder,
  clearLabel = 'Vymazat hledání',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel?: string;
}) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-xl bg-stone-900/[0.06] pl-3 pr-1 text-stone-500 ring-brand/50 transition focus-within:ring-2 dark:bg-white/[0.08] dark:text-stone-400 dark:ring-brand-light/60">
      <Icon name="search" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-base text-stone-900 outline-none placeholder:text-stone-500 dark:text-stone-100 dark:placeholder:text-stone-400"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-stone-900/[0.06] hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 dark:hover:bg-white/10 dark:hover:text-stone-200"
          aria-label={clearLabel}
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
