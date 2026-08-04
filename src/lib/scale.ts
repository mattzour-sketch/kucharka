/**
 * Přepočet množství v surovinách podle počtu porcí (R-19). Suroviny jsou volný
 * text, takže z řádku vytáhneme vedoucí číslo a vynásobíme ho. Co nezačíná
 * číslem („hrst mouky"), zůstane beze změny. Původní text se nemění – tohle je
 * jen zobrazení (E-17).
 */

export interface LeadingQuantity {
  amount: number;
  rest: string;
}

// Zlomek musí být v alternaci první, jinak by se „1/2" chytlo jen jako „1".
const LEADING = /^\s*(\d+\/\d+|\d+(?:[.,]\d+)?)\s*(.*)$/;

/** Vytáhne vedoucí množství (číslo, desetinné s tečkou/čárkou, nebo zlomek a/b). */
export function parseLeadingQuantity(text: string): LeadingQuantity | null {
  const match = LEADING.exec(text);
  if (!match) return null;
  const raw = match[1];
  let amount: number;
  if (raw.includes('/')) {
    const [num, den] = raw.split('/').map(Number);
    if (!den) return null;
    amount = num / den;
  } else {
    amount = Number(raw.replace(',', '.'));
  }
  if (!Number.isFinite(amount)) return null;
  return { amount, rest: match[2] };
}

/** Zaokrouhlí na 2 desetinná místa a napíše česky s čárkou, bez zbytečných nul. */
function formatScaled(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',');
}

/** Vrátí text suroviny s množstvím vynásobeným faktorem. Faktor 1 nechá text beze změny. */
export function scaleQuantityText(text: string, factor: number): string {
  if (factor === 1) return text;
  const parsed = parseLeadingQuantity(text);
  if (!parsed) return text;
  const scaled = formatScaled(parsed.amount * factor);
  return parsed.rest ? `${scaled} ${parsed.rest}` : scaled;
}
