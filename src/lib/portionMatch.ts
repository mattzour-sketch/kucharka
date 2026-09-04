import { parseLeadingQuantity } from './scale';
import { normalizeForSearch } from './search';

/**
 * Rozpoznání domácí míry na začátku volného textu suroviny (UC017, OO5).
 * „2 lžíce oleje" + míra „lžíce" u napojené potraviny → návrh míra=lžíce, počet=2.
 *
 * Slouží jen jako **návrh** (předvyplnění výběru při napojování a při znovuotevření).
 * `raw_text` se tímhle nikdy nemění (pravidlo 2). Matching je omezený na míry té
 * konkrétní potraviny, takže falešná shoda nemůže sáhnout mimo její vlastní názvy měr.
 */
export interface PortionMatch {
  portionId: string;
  count: number;
}

/**
 * Volný klíč názvu míry: bez diakritiky, malá písmena, odseknutá koncová
 * samohláska (skloňování „lžíce/lžíci/lžic"). Záměrně konzervativní – porovnává se
 * na ROVNOST klíčů, ne prefix, aby „lžíce" nespadlo na „lžička" (falešná shoda je
 * horší než žádná, viz user-advocate). Fleeting-e („hrnek/hrnku") se vědomě neřeší.
 */
function portionKey(text: string): string {
  const normalized = normalizeForSearch(text).trim();
  const stripped = normalized.replace(/[aeiouy]+$/, '');
  return stripped.length >= 3 ? stripped : normalized;
}

/**
 * Vrátí první míru potraviny, jejíž název odpovídá slovu za vedoucím číslem textu.
 * Bez čísla, bez slova nebo beze shody → `null` (volající spadne na ruční výběr).
 */
export function matchPortionInText(
  rawText: string,
  portions: readonly { id: string; label: string }[],
): PortionMatch | null {
  const parsed = parseLeadingQuantity(rawText);
  if (!parsed) return null;
  const rest = parsed.rest.trim();
  if (!rest) return null;
  const firstWord = rest.split(/\s+/)[0];
  if (!firstWord) return null;
  const key = portionKey(firstWord);
  for (const portion of portions) {
    if (portion.label.trim() === '') continue;
    if (portionKey(portion.label) === key) {
      return { portionId: portion.id, count: parsed.amount };
    }
  }
  return null;
}
