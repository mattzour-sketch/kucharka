import { isIngredientHeading } from './ingredientSection';
import { splitStepByDurations } from './duration';

/**
 * Klasifikace a úklid řádků vloženého receptu (UC031). Jednotlivá pravidla parseru
 * (`parseRecipe.ts`) jako malé čisté funkce: značky sekcí CZ/EN, hashtagy, výzvy,
 * porce, doba, metadata, odrážky, číslování seznamu a podsekce surovin.
 *
 * Zásada: obsah řádku se NIKDY nenormalizuje (NFKD by změnil „½" na „1⁄2").
 * `normalizeMarkerText` slouží jen k rozpoznání, ven jde vždy původní text.
 */

export type SectionKind = 'ingredients' | 'instructions' | 'other';

export interface SectionMarker {
  section: SectionKind;
  /** Obsah za dvojtečkou na stejném řádku („Ingredients: 90g flour" → „90g flour"); '' když není. */
  inline: string;
  /** Porce ze závorky („Ingredients (makes 8):", „Suroviny (na 4 porce):"). */
  servings?: number;
}

export type TimeKind = 'prep' | 'cook' | 'total';

export interface TimeEntry {
  kind: TimeKind;
  /** Minuty; null = řádek doby, ale délku nejde spolehlivě přečíst („a few minutes"). */
  minutes: number | null;
}

// Úvodní znaky, které nejsou písmeno ani číslice (emoji, odrážky, ZWJ, mezery).
const LEADING_NON_WORD_RE = /^[^\p{L}\p{N}]+/u;
// Koncové emoji / ozdoby za značkou („Ingredients 👇", „**Ingredients**").
const TRAILING_DECOR_RE = /[\s*_\p{Extended_Pictographic}\p{M}‍]+$/u;

/**
 * JEN pro porovnávání: NFKD (tučné Unicode písmo → ASCII) → bez diakritiky → lowercase →
 * typografické apostrofy na ' → bez úvodních emoji/odrážek a koncových ozdob.
 * Na obsah se NIKDY nepoužívá.
 */
export function normalizeMarkerText(line: string): string {
  return line
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(LEADING_NON_WORD_RE, '')
    .replace(TRAILING_DECOR_RE, '')
    .trim();
}

const INGREDIENT_MARKERS =
  "ingredients?|ingredient list|what you(?:'?ll)? need|you'?ll need|suroviny|ingredience|potrebujeme|budete potrebovat";
const INSTRUCTION_MARKERS =
  'instructions?|directions?|method|process|steps?|how to make(?: it)?|preparation|postup|priprava|instrukce|navod|jak na to';
const OTHER_MARKERS =
  'notes?|tips?|poznamk[ay]|equipment|vybaveni|nutrition(?: info| facts)?|key points?|traditional option|variations?|substitutions?|storage|skladovani';

const MARKER_RE = new RegExp(
  `^(?:(${INGREDIENT_MARKERS})|(${INSTRUCTION_MARKERS})|(${OTHER_MARKERS}))\\s*(\\([^)]*\\))?\\s*(?::\\s*(.*))?$`,
);

// Porce ze závorky jen se slovem porcí („makes 8", „na 4 porce", „pro 4 osoby"), ne „na formu 24 cm".
const PAREN_SERVINGS_RE = /(?:serves|servings?|makes|yields?|porce|porci)\D{0,5}(\d+)|(\d+)\s*(?:serv|porc|osob)/;

/** Řádek, který je CELÝ značkou (+ volitelně „(…)" a „: obsah"). „Mix the ingredients well." → null. */
export function matchSectionMarker(line: string): SectionMarker | null {
  const match = normalizeMarkerText(line).match(MARKER_RE);
  if (!match) return null;
  const [, ingredients, instructions, , paren, inlineNormalized] = match;
  const hasInline = Boolean(inlineNormalized && inlineNormalized.trim());
  const section: SectionKind = ingredients ? 'ingredients' : instructions ? 'instructions' : 'other';
  // Ostatní sekce jen jako holá značka: „Tip: …" s obsahem uprostřed postupu by jinak
  // spolkl všechny další kroky.
  if (section === 'other' && hasInline) return null;

  // Obsah za dvojtečkou v původním znění (ne normalizovaný).
  let inline = '';
  if (hasInline) {
    const colonAt = line.search(/[:：]/);
    inline = colonAt === -1 ? '' : line.slice(colonAt + 1).trim();
  }

  const result: SectionMarker = { section, inline };
  if (paren) {
    const servingsMatch = paren.match(PAREN_SERVINGS_RE);
    const value = servingsMatch ? Number(servingsMatch[1] ?? servingsMatch[2]) : NaN;
    if (Number.isFinite(value) && value > 0) result.servings = value;
  }
  return result;
}

/** Řádek tvořený jen `#slovy` („#vegan #protein"). Nadpis sekce „# Na těsto" NE. */
export function isHashtagLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => /^#[\p{L}\p{N}_]+$/u.test(token));
}

/** Číslovaný krok („1.", „2)", „Step 3", „1️⃣") – nikdy se nebere jako výzva ani metadata. */
function isNumberedStep(line: string): boolean {
  return /^\s*(?:\d+\s*[.)]|\d️?⃣|(?:step|krok)\s*\d)/i.test(line);
}

const PROMO_RES: RegExp[] = [
  /^follow\b(?:\s+(?:me|us))?(?:\s+(?:for|on)\b|.*@)/,
  /^(?:save|bookmark|pin) this\b/,
  /^save for later\b/,
  /^comment\s+\S+\s+(?:for|to|and|below|if)\b/,
  /\blink in (?:my |the )?bio\b/,
  /^(?:recipe|credits?|via|inspired by|video|photo|original)\b[^@]*@[\w.]/,
  /^tag (?:a|your|someone|me|us|them)\b/,
  /^share (?:this|with)\b/,
  /^double tap\b/,
];

/** Výzva / credit („Follow @x", „Save this…", „Comment X for…", „Link in bio", samotné „@x"). */
export function isPromoLine(line: string): boolean {
  if (isNumberedStep(line)) return false;
  // Samotný handle se testuje na původním řádku (normalizace uřízne úvodní „@").
  if (/^\s*@[\w.]+\s*$/.test(line)) return true;
  const normalized = normalizeMarkerText(line);
  return normalized !== '' && PROMO_RES.some((re) => re.test(normalized));
}

/** „@autor" – jen z řádku výzvy / creditu (ne „1 scoop @myprotein whey"). */
export function extractAuthorHandle(line: string): string | undefined {
  if (!isPromoLine(line)) return undefined;
  const match = line.match(/@([A-Za-z0-9._]+)/);
  if (!match) return undefined;
  const handle = match[1].replace(/\.+$/, '');
  return handle ? `@${handle}` : undefined;
}

// Řádek porcí je krátký údaj, ne věta postupu.
const SERVINGS_MAX_LENGTH = 40;
const SERVINGS_RES: RegExp[] = [
  /^(?:serves|servings?|makes|yields?|porce|pocet porci|porci)\s*[:\-–]?\s*(?:about\s+|cca\s+)?(\d+)/,
  /^(\d+)\s*(?:servings?|porc[a-z]*)\b/,
  /^pro\s+(\d+)\s+(?:osob|lidi)/,
  /^na\s+(\d+)\s+porc/,
];

/** Porce z řádku metadat (Serves/Servings/Makes/Yield/Porce/„4 servings"/„Pro 4 osoby"/„Na 4 porce"). */
export function parseServingsLine(line: string): number | undefined {
  const normalized = normalizeMarkerText(line);
  if (normalized.length > SERVINGS_MAX_LENGTH) return undefined;
  for (const re of SERVINGS_RES) {
    const match = normalized.match(re);
    if (match) {
      const value = Number(match[1]);
      return value > 0 ? value : undefined;
    }
  }
  return undefined;
}

// Jednoznačná klíčová slova doby (řádek doby i bez čitelné délky).
const TIME_KEYWORDS: [RegExp, TimeKind][] = [
  [/^(?:prep(?:aration)?|preparation) time\b/, 'prep'],
  [/^(?:doba|cas) pripravy\b/, 'prep'],
  [/^(?:cook(?:ing)?|bake|baking) time\b/, 'cook'],
  [/^doba (?:vareni|peceni)\b/, 'cook'],
  [/^total time\b/, 'total'],
  [/^ready in\b/, 'total'],
  [/^(?:celkovy cas|celkova doba)\b/, 'total'],
];
// Víceznačná slova („Příprava" je i značka postupu, „Bake 20 min" krok): jen s dvojtečkou
// a délkou hned za ní („Příprava: 20 min", „Prep: 10 min").
const AMBIGUOUS_TIME_RE = /^(prep|preparation|priprava|cook|bake|total|celkem)\s*:\s*(?=(?:cca|about|asi)?\s*[~≈]?\s*\d)/;
// Výplňová slova, která smí v údaji doby stát kolem délky („cca 20 min", „10–15 min").
const TIME_FILLER_RE = /\b(?:cca|ca|about|approx|approximately|asi|zhruba|priblizne|and|a|plus)\b/g;
// Údaj doby bez čitelné délky („a few minutes") smí být jen krátký, jinak je to věta.
const UNREADABLE_TIME_MAX_LENGTH = 20;
const AMBIGUOUS_KIND: Record<string, TimeKind> = {
  prep: 'prep',
  preparation: 'prep',
  priprava: 'prep',
  cook: 'cook',
  bake: 'cook',
  total: 'total',
  celkem: 'total',
};

function durationMinutes(text: string): number | null {
  const seconds = splitStepByDurations(text).reduce((sum, segment) => sum + (segment.seconds ?? 0), 0);
  return seconds > 0 ? seconds / 60 : null;
}

/** Je za klíčovým slovem jen délka („: 10–15 min", „cca 20 min")? Věta postupu za údajem → ne. */
function isOnlyDuration(rest: string): boolean {
  const leftover = splitStepByDurations(rest)
    .filter((segment) => segment.seconds === null)
    .map((segment) => segment.text)
    .join(' ')
    .replace(TIME_FILLER_RE, '')
    .replace(/\d+(?:[.,]\d+)?/g, '');
  return !/\p{L}/u.test(leftover);
}

function parseTimePart(part: string): TimeEntry | null {
  const normalized = normalizeMarkerText(part);
  for (const [re, kind] of TIME_KEYWORDS) {
    const match = normalized.match(re);
    if (!match) continue;
    const rest = normalized.slice(match[0].length);
    const minutes = durationMinutes(rest);
    if (minutes !== null) return isOnlyDuration(rest) ? { kind, minutes } : null;
    // „Prep time: a few minutes" – údaj doby, jen nečitelný; delší text je věta postupu.
    return rest.replace(/^[\s:–-]+/, '').length <= UNREADABLE_TIME_MAX_LENGTH ? { kind, minutes: null } : null;
  }
  const ambiguous = normalized.match(AMBIGUOUS_TIME_RE);
  if (ambiguous) {
    const rest = normalized.slice(ambiguous[0].length);
    const minutes = durationMinutes(rest);
    // Za dvojtečkou má být jen délka („20 min"), ne věta postupu („15 min pečeme na 180 °C").
    if (minutes === null || !isOnlyDuration(rest)) return null;
    return { kind: AMBIGUOUS_KIND[ambiguous[1]], minutes };
  }
  return null;
}

/**
 * Řádek doby („Prep time: 10 min", „Doba přípravy: 20 min", „Prep: 10 min | Cook: 25 min").
 * Vrací null, když řádek dobou není. Víc údajů na řádku se dělí podle `|`, `•`, `·`.
 */
export function parseTimeLine(line: string): TimeEntry[] | null {
  const parts = line.split(/[|•·]/).filter((part) => part.trim() !== '');
  if (parts.length === 0) return null;
  const first = parseTimePart(parts[0]);
  if (!first) return null;
  const entries: TimeEntry[] = [first];
  for (const part of parts.slice(1)) {
    const entry = parseTimePart(part);
    if (entry) entries.push(entry);
  }
  return entries;
}

// „Macros per roll: …", „Macros 1 roll: …", „Calories: 150", „Nutrition (per serving): …" –
// slovo, krátký doplněk a hned dvojtečka s hodnotou.
const MACRO_HEADER_RE =
  /^(?:macros?|nutrition(?:al)?(?: info| facts| values)?|calories|kcal|per serving|makra|nutricni hodnoty|vyzivove hodnoty|energie)\b[^:]{0,30}:\s*\S/;
// Holá hlavička maker („❇️ Macros Per Ball :") – hodnoty jsou až na dalším řádku.
const BARE_MACRO_HEADER_RE = /^(?:macros?|makra)\b[^:\d]{0,30}:?$/;
// „Protein: 12g" ano; „Protein 30 g" / „Protein powder: 30g" (suroviny) ne – dvojtečka a hodnota hned za slovem.
const NUTRIENT_VALUE_RE = /^(?:protein|carbs?|fats?|bilkoviny|sacharidy|tuky)\s*:\s*~?\d+(?:[.,]\d+)?\s*g$/;
// Jeden údaj v řádku maker: „150 kcal", „12g protein", „5g of Protein", „25C", „2 g fat".
const NUTRIENT_TOKEN_RE =
  /^~?\d+(?:[.,]\d+)?\s*(?:k?cals?|calories|g\s*(?:of\s+)?(?:protein|carbs?|fats?|fiber|sugars?)|g?\s*[pcf]|(?:protein|carbs?|fats?))$/;
const CALORIE_TOKEN_RE = /^~?\d+(?:[.,]\d+)?\s*(?:k?cals?|calories)$/;

/**
 * Makra / nutriční údaje autora – nikdy nejsou surovinou ani krokem (a nikdy hodnotou receptu).
 * Jen řádek, který je CELÝ nutričním údajem; surovina s kaloriemi v závorce („30g protein
 * powder (110 cal)", „100 g low-fat tvaroh (80 kcal)") zůstává surovinou.
 */
export function isMetaLine(line: string): boolean {
  if (isNumberedStep(line)) return false;
  const normalized = normalizeMarkerText(line);
  if (BARE_MACRO_HEADER_RE.test(normalized)) return true;
  if (!/\d/.test(normalized)) return false;
  if (MACRO_HEADER_RE.test(normalized) || NUTRIENT_VALUE_RE.test(normalized)) return true;
  // Řádek složený jen z údajů („150 kcal | 12g protein | 25g carbs | 2g fat"), aspoň jeden s kaloriemi.
  const tokens = normalized
    .split(/[|,/•·;]/)
    .map((token) => token.trim())
    .filter(Boolean);
  return (
    tokens.length > 0 &&
    tokens.every((token) => NUTRIENT_TOKEN_RE.test(token)) &&
    tokens.some((token) => CALORIE_TOKEN_RE.test(token))
  );
}

// Odrážka = úvodní interpunkce/symbol/emoji, KROMĚ znaků, které nesou význam:
// `#` (nadpis sekce), `~ ≈` (přibližně), `( [` (poznámka), uvozovky a desetinná tečka/čárka
// před číslicí („.5 cup" – bez tečky by bylo 10× víc).
const LEADING_BULLET_RE = /^(?:(?![#~≈([„"“']|[.,]\d)[\s\p{P}\p{S}\p{Z}\p{M}‍])+/u;

/** „* 90g flour" → „90g flour". Emoji uvnitř řádku zůstávají, číslice a zlomky se nedotknou. */
export function stripLeadingBullet(line: string): string {
  return line.replace(LEADING_BULLET_RE, '').trim();
}

const LIST_NUMBER_RE = /^(\d+)[.)]\s+(?=\S)/;

/**
 * „1. 90 g mouky" → „90 g mouky", ale jen když jsou očíslované všechny suroviny a čísla jdou
 * 1, 2, 3… (po nadpisu sekce smí začít znovu od 1). „1.5 kg" ani „3. vejce, 7. mouka" nemění.
 */
export function stripListNumbers(lines: string[]): string[] {
  let expected = 1;
  let numbered = 0;
  for (const line of lines) {
    if (isIngredientHeading(line)) {
      expected = 1;
      continue;
    }
    const match = line.match(LIST_NUMBER_RE);
    if (!match || Number(match[1]) !== expected) return lines;
    expected += 1;
    numbered += 1;
  }
  if (numbered === 0) return lines;
  return lines.map((line) => (isIngredientHeading(line) ? line : line.replace(LIST_NUMBER_RE, '')));
}

const SUBSECTION_MAX_LENGTH = 60;

/**
 * Podsekce surovin (UC023 konvence): „For the icing:" / „[Sauce]" → „# For the icing" / „# Sauce".
 * Konzervativně jen řádek zakončený dvojtečkou nebo celý v hranatých závorkách, bez vedoucího
 * množství, ≤ 60 znaků, který ještě není nadpisem.
 */
export function toSubsectionHeading(line: string): string {
  const trimmed = line.trim();
  if (isIngredientHeading(trimmed)) return line;
  const bracketed = trimmed.match(/^\[([^\]]+)\][:：]?$/);
  if (!bracketed && !/[:：]$/.test(trimmed)) return line;
  const body = (bracketed ? bracketed[1] : trimmed.replace(/[:：]+$/, '')).trim();
  if (!body || body.length > SUBSECTION_MAX_LENGTH || /^[\p{N}~≈]/u.test(body)) return line;
  return `# ${body}`;
}
