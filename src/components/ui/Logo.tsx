/**
 * Značka appky – hrnec s párou (navazuje na motiv 🍲). Kreslí se `currentColor`,
 * takže barvu určí rodič (typicky `text-brand dark:text-amber-400`). Čistý tvar, čitelný i malý.
 */
export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Kuchařka"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* pára */}
      <path
        d="M20 10c-1.8-1.6-1.8-3.6 0-5.2M28 10c-1.8-1.6-1.8-3.6 0-5.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* poklice + knoflík */}
      <rect x="10" y="14" width="28" height="6" rx="3" fill="currentColor" />
      <rect x="21.5" y="9.5" width="5" height="5" rx="2.5" fill="currentColor" />
      {/* ucha */}
      <path
        d="M10 24c-2.8 0-4.5 1.8-4.5 4.5S7.2 33 10 33M38 24c2.8 0 4.5 1.8 4.5 4.5S40.8 33 38 33"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* tělo hrnce */}
      <path
        d="M11 22h26l-2.1 14A3 3 0 0 1 31.9 38.5H16.1A3 3 0 0 1 13.1 36L11 22z"
        fill="currentColor"
      />
    </svg>
  );
}
