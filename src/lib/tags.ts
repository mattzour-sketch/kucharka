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
