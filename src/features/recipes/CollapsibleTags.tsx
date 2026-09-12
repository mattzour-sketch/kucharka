import { useId, useMemo, useState } from 'react';
import FilterChip from '../../components/ui/FilterChip';
import { cx } from '../../components/ui/cx';

// Kolik štítků ukázat ve sbaleném stavu – laditelné konstanty.
// Mobil ~1–2 řádky na 375 px; desktop výrazně víc (sbalí se jen při opravdu mnoha štítcích).
const MOBILE_CAP = 6;
const DESKTOP_CAP = 16;

// Přepínač „+N dalších / Méně" – je to expander, ne filtr: přerušovaný okraj a neutrální
// text, aby se vizuálně odlišil od filtrovacích chipů. Dark varianty + focus-ring a respekt
// k motion-reduce jako ve FilterChip.
const TOGGLE =
  'rounded-full border border-dashed border-stone-300 px-3 py-1 text-xs font-medium text-stone-500 transition hover:border-stone-400 hover:text-stone-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-stone-600 dark:text-stone-400 dark:hover:text-stone-200 motion-reduce:transition-none motion-reduce:active:scale-100';

// Popisek „+N další/dalších" – český plurál elidovaného „štítky/štítků": 1–4 → další, 5+ → dalších.
function moreLabel(hidden: number): string {
  return `+${hidden} ${hidden < 5 ? 'další' : 'dalších'}`;
}

interface CollapsibleTagsProps {
  /** Všechny štítky napříč recepty (smazané recepty jsou už odfiltrované). */
  tags: string[];
  /** Aktivní (zvolený) štítek – z kolabování je vyjmutý, nikdy se neschová. */
  activeTag: string | null;
  /** Počet receptů na štítek (tag → count) pro řazení „nejpoužívanější". */
  counts: Record<string, number>;
  onToggleTag: (tag: string) => void;
}

/**
 * Řádek filtrovacích štítků, který se při velkém počtu sbalí za přepínač „+N dalších".
 * Pořadí: aktivní štítek první (vždy vidět), pak podle počtu receptů sestupně, při shodě
 * abecedně. Stav rozbaleno/sbaleno je jen v paměti (pravidlo 6 – žádný localStorage).
 */
export default function CollapsibleTags({ tags, activeTag, counts, onToggleTag }: CollapsibleTagsProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  // Aktivní štítek první, zbytek podle počtu receptů (sestupně), při shodě abecedně.
  const ordered = useMemo(() => {
    const rest = tags
      .filter((tag) => tag !== activeTag)
      .sort((a, b) => {
        const byCount = (counts[b] ?? 0) - (counts[a] ?? 0);
        return byCount !== 0 ? byCount : a.localeCompare(b, 'cs');
      });
    return activeTag ? [activeTag, ...rest] : rest;
  }, [tags, activeTag, counts]);

  if (ordered.length === 0) return null;

  // Aktivní štítek je vždy na indexu 0, takže zůstává vidět i ve sbaleném stavu.
  const mobileHidden = Math.max(0, ordered.length - MOBILE_CAP);
  const desktopHidden = Math.max(0, ordered.length - DESKTOP_CAP);
  const hasMobileToggle = ordered.length > MOBILE_CAP;
  const hasDesktopToggle = ordered.length > DESKTOP_CAP;

  return (
    <div id={listId} className="mt-2 flex flex-wrap gap-1.5">
      {ordered.map((tag, index) => {
        const active = tag === activeTag;
        // Sbaleno: prvních MOBILE_CAP vidět všude, další do DESKTOP_CAP jen na desktopu,
        // zbytek skrytý. Rozbaleno → vše vidět.
        const visibility = expanded
          ? ''
          : index < MOBILE_CAP
            ? ''
            : index < DESKTOP_CAP
              ? 'hidden sm:inline-flex'
              : 'hidden';
        return (
          <span key={tag} className={visibility}>
            <FilterChip active={active} onClick={() => onToggleTag(tag)}>
              {tag}
            </FilterChip>
          </span>
        );
      })}

      {hasMobileToggle ? (
        <button
          type="button"
          className={cx('inline-flex sm:hidden', TOGGLE)}
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Méně' : moreLabel(mobileHidden)}
        </button>
      ) : null}

      {hasDesktopToggle ? (
        <button
          type="button"
          className={cx('hidden sm:inline-flex', TOGGLE)}
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Méně' : moreLabel(desktopHidden)}
        </button>
      ) : null}
    </div>
  );
}
