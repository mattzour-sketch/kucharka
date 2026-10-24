/**
 * Kam se vrací editor potraviny: na seznam s posledním hledáním (doplňování hodnot
 * z obalů po jedné). Jen v paměti běžící appky (pravidlo 6), stejně jako `listReturn`.
 */
let lastFoodsSearch = '';

/** Volá seznam potravin při každé změně hledání (`?q=…`). */
export function rememberFoodsSearch(search: string): void {
  lastFoodsSearch = search;
}

/** Adresa seznamu potravin i s posledním hledáním. */
export function foodsListHref(): string {
  return lastFoodsSearch ? `/potraviny?${lastFoodsSearch}` : '/potraviny';
}
