/** Sdílené konstanty pro domácí míry (UC017). Odděleno od komponent kvůli fast-refresh. */

/** Přednabídnuté názvy měr (gramáž si uživatel doplní sám, je u každé jiná). */
export const COMMON_PORTION_LABELS = [
  'lžíce',
  'lžička',
  'hrnek',
  'plátek',
  'špetka',
  'hrst',
  'kus',
  'sklenice',
  'konzerva',
  'balení',
];

/** Nad tuhle gramáž na 1 míru se ukáže jemné (neblokující) varování. */
export const ABSURD_GRAMS = 500;

/** `id` sdíleného `<datalist>` s běžnými názvy měr (inputy ho berou přes `list=`). */
export const PORTION_DATALIST_ID = 'portion-name-suggestions';
