import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * Jediná sada ikon appky – čárové SVG v mřížce 24 px, kreslené `currentColor`, takže
 * barvu i tmavý režim řeší rodič (na rozdíl od emoji, které vypadají na každém
 * systému jinak a nejdou obarvit). Bez knihovny: přidat ikonu = přidat řádek sem.
 */
const PATHS = {
  back: <path d="M15 5l-7 7 7 7" />,
  forward: <path d="M9 5l7 7-7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  bolt: <path d="M13 3L5.5 13.5H11l-1 7.5 7.5-10.5H12z" />,
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <circle cx="8.75" cy="8.75" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.25" cy="15.25" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M4.5 17.5l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  menu: <path d="M5 7h14M5 12h14M5 17h14" />,
  cart: (
    <>
      <path d="M3.5 5h2.2l2 9.5h9.300l1.8-6.500H7" />
      <circle cx="9" cy="18.5" r="1.3" />
      <circle cx="16.5" cy="18.5" r="1.3" />
    </>
  ),
  chart: <path d="M5 19V11M10 19V5M15 19v-6M20 19V8" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.8 11.500a1.5 1.5 0 0 0 1.5 1.400h6.400a1.5 1.5 0 0 0 1.5-1.400L17.5 7" />
      <path d="M10 11v5.500M14 11v5.5" />
    </>
  ),
  // Záložky: Recepty = otevřený sešit, Potraviny = jablko.
  book: (
    <path d="M12 6.5c-1.8-1.2-4-1.7-7-1.5v12.5c3-.2 5.2.3 7 1.5 1.8-1.2 4-1.7 7-1.5V5c-3-.2-5.2.3-7 1.5zM12 6.5V19" />
  ),
  apple: (
    <>
      <path d="M12 8.2c-1.5-1.3-3.4-1.6-5-.6-2 1.3-2.4 4.2-1.2 7.2 1 2.5 2.7 4.4 4.4 4.4.7 0 1.2-.3 1.8-.3s1.1.3 1.8.3c1.7 0 3.4-1.9 4.4-4.4 1.2-3 .8-5.9-1.2-7.2-1.6-1-3.5-.7-5 .6z" />
      <path d="M12 8.2c0-1.8.8-3.2 2.5-4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  filled = false,
  className,
}: {
  name: IconName;
  /** Plná výplň (oblíbená hvězda, aktivní záložka). */
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx('h-5 w-5 shrink-0', className)}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
