import { useState, type KeyboardEvent } from 'react';
import { addTag, removeTag } from '../../lib/tags';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Štítky použité jinde – nabídnou se k rychlému přidání. */
  suggestions?: string[];
}

/** Vstup štítků: chipy s křížkem + přidávání Enterem/čárkou + našeptávač (R-16). */
export default function TagInput({ value, onChange, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commit(raw: string) {
    onChange(addTag(value, raw));
    setDraft('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const unused = suggestions.filter(
    (tag) => !value.some((existing) => existing.toLowerCase() === tag.toLowerCase()),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-2 focus-within:border-brand">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-sm text-brand-dark"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(removeTag(value, tag))}
              className="text-brand-dark/60 hover:text-brand-dark"
              aria-label={`Odebrat štítek ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length === 0 ? 'štítek a Enter (rychlovka, oběd, meal prep…)' : ''}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-stone-400"
        />
      </div>
      {unused.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {unused.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => commit(tag)}
              className="rounded-full border border-stone-200 px-2 py-0.5 text-xs text-stone-500 transition hover:border-stone-300 hover:text-stone-700"
            >
              + {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
