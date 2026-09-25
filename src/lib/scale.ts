/**
 * Přepočet množství v surovinách podle počtu porcí (R-19). Suroviny jsou volný
 * text, takže z řádku vytáhneme vedoucí množství a vynásobíme ho. Co nezačíná
 * číslem („hrst mouky"), zůstane beze změny. Původní text se nemění – tohle je
 * jen zobrazení (E-17), zaokrouhluje se až tady (pravidlo 9).
 */

export interface LeadingQuantity {
  amount: number;
  /** Horní mez rozsahu („2–3 lžíce" → amount 2, high 3). */
  high?: number;
  rest: string;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
};

// Množství: smíšené číslo „1 1/2", zlomek „1/2", unicode „½" / „1½", číslo „1,5" / „200".
// Delší tvary musí být v alternaci dřív, jinak by se „1 1/2" chytlo jen jako „1".
const AMOUNT = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|\d*[½¼¾⅓⅔⅛]|\d+(?:[.,]\d+)?`;
const LEADING = new RegExp(String.raw`^\s*(${AMOUNT})(?:\s*([–-])\s*(${AMOUNT}))?\s*(.*)$`, 's');

function parseAmount(raw: string): number | null {
  const unicode = raw.match(/^(\d*)([½¼¾⅓⅔⅛])$/);
  if (unicode) return Number(unicode[1] || 0) + UNICODE_FRACTIONS[unicode[2]];
  const mixed = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[3]) ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) : null;
  if (raw.includes('/')) {
    const [num, den] = raw.split('/').map(Number);
    return den ? num / den : null;
  }
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** Vytáhne vedoucí množství (číslo, zlomek, smíšené číslo, unicode zlomek, rozsah). */
export function parseLeadingQuantity(text: string): LeadingQuantity | null {
  const match = LEADING.exec(text);
  if (!match) return null;
  const amount = parseAmount(match[1]);
  if (amount === null) return null;
  const high = match[3] !== undefined ? parseAmount(match[3]) : null;
  const result: LeadingQuantity = { amount, rest: match[4] };
  if (high !== null) result.high = high;
  return result;
}

type UnitKind = 'fine' | 'coarse' | 'other';

// Jednotka hned za číslem. „l" nesmí chytit „lžíce" – za jednotkou nesmí následovat písmeno.
const FINE_UNIT_RE = /^(?:g|gr|gramů?|grams?|ml|dkg|dag)(?!\p{L})/iu;
const COARSE_UNIT_RE = /^(?:kg|l|dl|cl)(?!\p{L})/iu;

function unitKind(rest: string): UnitKind {
  if (FINE_UNIT_RE.test(rest)) return 'fine';
  if (COARSE_UNIT_RE.test(rest)) return 'coarse';
  return 'other';
}

function czech(value: number): string {
  return String(value).replace('.', ',');
}

/**
 * Zaokrouhlení pro zobrazení: gramy/ml na celé (pod 10 na desetiny), kg/l na setiny,
 * kusy a lžíce na půlky – když půlka číslo změní, vrátí `approx` (zobrazí se „~").
 */
function roundScaled(value: number, kind: UnitKind): { value: number; approx: boolean } {
  if (kind === 'fine') {
    return { value: value >= 10 ? Math.round(value) : Math.round(value * 10) / 10, approx: false };
  }
  const hundredths = Math.round(value * 100) / 100;
  if (kind === 'coarse' || value < 1) return { value: hundredths, approx: false };
  const halves = Math.round(value * 2) / 2;
  return { value: halves, approx: Math.abs(halves - value) > 0.01 };
}

/** Vrátí text suroviny s množstvím vynásobeným faktorem. Faktor 1 nechá text beze změny. */
export function scaleQuantityText(text: string, factor: number): string {
  if (factor === 1) return text;
  const parsed = parseLeadingQuantity(text);
  if (!parsed) return text;
  const kind = unitKind(parsed.rest);
  const low = roundScaled(parsed.amount * factor, kind);
  let scaled = czech(low.value);
  let approx = low.approx;
  if (parsed.high !== undefined) {
    const high = roundScaled(parsed.high * factor, kind);
    const dash = LEADING.exec(text)?.[2] ?? '–';
    scaled = `${scaled}${dash}${czech(high.value)}`;
    approx = approx || high.approx;
  }
  const withApprox = approx ? `~${scaled}` : scaled;
  return parsed.rest ? `${withApprox} ${parsed.rest}` : withApprox;
}
