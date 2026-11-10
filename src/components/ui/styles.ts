/**
 * Sdílené třídy pro prvky, které nejsou komponentou (pole formuláře, nadpis sekce, popisek,
 * textový odkaz). Jeden zdroj, ať se vzhled nekopíruje po obrazovkách.
 */

const FIELD_BASE =
  'bg-stone-900/[0.06] outline-none transition placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-brand/50 dark:bg-white/[0.08] dark:placeholder:text-stone-500 dark:focus-visible:ring-brand-light/60';

/** Textové pole, textarea, select: plná plocha bez obrysu, fokus = kroužek ve značkové barvě. */
export const FIELD = `rounded-xl ${FIELD_BASE}`;

/** Malé pole uvnitř řádku (gramy, minuty, porce). */
export const FIELD_SM = `rounded-lg ${FIELD_BASE}`;

/** Nadpis sekce na obrazovce (Suroviny, Postup, Poznámky…). */
export const SECTION_TITLE = 'text-lg font-bold tracking-tight';

/** Popisek nad polem nebo skupinou polí ve formuláři. */
export const LABEL = 'text-sm font-semibold text-stone-700 dark:text-stone-200';

/** Vedlejší text: nápověda, datum, doplňující údaj. */
export const MUTED = 'text-stone-500 dark:text-stone-400';

/** Textový odkaz / textová akce ve značkové barvě. */
export const LINK = 'font-semibold text-brand hover:text-brand-dark dark:text-brand-light dark:hover:text-white';

/** Odškrtávací kolečko ve vaření (surovina, krok): velké a kontrastní kvůli čtení od linky. */
export const CHECK = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition';
export const CHECK_ON = 'border-brand bg-brand text-white dark:border-brand-bright dark:bg-brand-bright';
export const CHECK_OFF = 'border-stone-400 dark:border-stone-500';
