/**
 * Kam vede šipka zpět z receptu: na seznam se stejným hledáním a filtry, jaké
 * byly naposledy. Jen v paměti běžící appky (pravidlo 6 – žádné localStorage);
 * po restartu se začíná z čistého seznamu.
 */
let lastListSearch = '';

/** Volá seznam receptů při každé změně hledání / filtrů (`?q=…&stitek=…`). */
export function rememberListSearch(search: string): void {
  lastListSearch = search;
}

/** Adresa seznamu receptů i s posledním hledáním. */
export function recipeListHref(): string {
  return lastListSearch ? `/?${lastListSearch}` : '/';
}
