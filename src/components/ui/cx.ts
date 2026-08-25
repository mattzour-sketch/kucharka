/** Spojení tříd bez závislosti (žádný clsx): vyhodí prázdné/false hodnoty. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
