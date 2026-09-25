/** Štítky receptu (R-16). Čistá logika pro přidávání/odebírání bez duplicit. */

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Přidá štítek, pokud není prázdný a ještě tam není (bez ohledu na velikost písmen). */
export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag) return tags;
  if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return tags;
  return [...tags, tag];
}

export function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((existing) => existing !== tag);
}

/**
 * Pořadí štítků ve filtru seznamu (UC029, Rozhodnutí 2026-09-12 bod 4): aktivní štítek první
 * (vždy vidět), zbytek podle počtu receptů sestupně, při shodě abecedně (cs).
 */
export function orderFilterTags(tags: string[], activeTag: string | null, counts: Record<string, number>): string[] {
  const rest = tags
    .filter((tag) => tag !== activeTag)
    .sort((a, b) => {
      const byCount = (counts[b] ?? 0) - (counts[a] ?? 0);
      return byCount !== 0 ? byCount : a.localeCompare(b, 'cs');
    });
  return activeTag && tags.includes(activeTag) ? [activeTag, ...rest] : rest;
}
