import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';

/** Všechny štítky nesmazaných receptů, česky seřazené – našeptávač pro `TagInput`. */
export function useTagSuggestions(): string[] {
  const tags = useLiveQuery(async () => {
    const recipes = await db.recipes.toArray();
    const set = new Set<string>();
    for (const recipe of recipes) {
      if (!recipe.deletedAt) recipe.tags.forEach((tag) => set.add(tag));
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'cs'));
  }, []);
  return tags ?? [];
}
