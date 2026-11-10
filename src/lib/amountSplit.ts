import { parseLeadingQuantity } from './scale';

/**
 * Rozdělení řádku suroviny na množství a název – JEN pro zobrazení ve dvou sloupcích
 * (množství zarovnané pod sebou). Text se nepřepisuje (pravidlo 2): oba kusy jsou výřezy
 * původního řádku. Co nezačíná číslem („sůl, pepř", „Mouka hladká 500 g"), vrátí `null`
 * a zobrazí se celé.
 */
export interface AmountSplit {
  amount: string;
  name: string;
}

// Jednotka hmotnosti/objemu/kusů hned za číslem jde do sloupce množství. Za jednotkou nesmí
// být písmeno („l" ≠ „lžíce").
const UNIT_RE = /^(?:g|gr|kg|dkg|dag|ml|dl|cl|l|ks)(?!\p{L})\.?/iu;

export function splitLeadingAmount(text: string): AmountSplit | null {
  const trimmed = text.trim();
  // „~" přidává přepočet porcí (`scaleQuantityText`) před zaokrouhlené množství.
  const approx = trimmed.startsWith('~') ? '~' : '';
  const body = approx ? trimmed.slice(1) : trimmed;
  const parsed = parseLeadingQuantity(body);
  if (!parsed) return null;

  let rest = parsed.rest;
  const restStart = body.length - rest.length;
  let number = body.slice(0, restStart).trim();
  const unit = UNIT_RE.exec(rest);
  if (unit) {
    // Mezeru mezi číslem a jednotkou bereme z původního textu („250g" i „250 g").
    number = body.slice(0, restStart + unit[0].length).trim();
    rest = rest.slice(unit[0].length);
  } else if (!/\s/.test(body[restStart - 1] ?? '')) {
    return null; // „2x cibule" – číslo přilepené ke slovu není množství
  }
  const name = rest.trim();
  // Bez názvu není co zarovnávat; „1. vejce" je číslování, ne množství.
  if (!name || !/^[\p{L}(„"]/u.test(name)) return null;
  return { amount: approx + number, name };
}

/**
 * Sloupec množství má smysl jen tehdy, když ho aspoň jedna surovina má – jinak by
 * vlevo zbyla díra („hrst mouky", „sůl").
 */
export function hasAmountColumn(texts: readonly string[]): boolean {
  return texts.some((text) => splitLeadingAmount(text) !== null);
}
