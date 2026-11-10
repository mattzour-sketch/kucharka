import { useState, type KeyboardEvent } from 'react';
import { addTag, removeTag } from '../../lib/tags';
import Tag from '../../components/ui/Tag';

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
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl bg-stone-900/[0.06] p-2 ring-brand/50 transition focus-within:ring-2 dark:bg-white/[0.08] dark:ring-brand-light/60">
        {value.map((tag) => (
          <Tag
            key={tag}
            onRemove={() => onChange(removeTag(value, tag))}
            removeLabel={`Odebrat štítek ${tag}`}
          >
            {tag}
          </Tag>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length === 0 ? 'štítek a Enter (rychlovka, oběd, meal prep…)' : ''}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-base outline-none placeholder:text-stone-500"
        />
      </div>
      {unused.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {unused.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => commit(tag)}
              className="inline-flex h-8 items-center rounded-full bg-stone-900/[0.06] px-3 text-sm text-stone-700 transition hover:bg-stone-900/[0.1] dark:bg-white/10 dark:text-stone-200 dark:hover:bg-white/[0.16]"
            >
              + {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
