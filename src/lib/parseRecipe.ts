import { addCelsiusToFahrenheit } from './temperature';
import {
  extractAuthorHandle,
  isHashtagLine,
  isMetaLine,
  isPromoLine,
  matchSectionMarker,
  parseServingsLine,
  parseTimeLine,
  stripLeadingBullet,
  stripListNumbers,
  toSubsectionHeading,
  type SectionKind,
} from './recipeImportLines';

/**
 * Rozebrání vloženého textu na recept (§11, UC031). Čte formát, který appka sama
 * vypisuje (sekce „Suroviny:" / „Postup:"), anglické i české značky sekcí z cizích
 * textů (Instagram, web) a jako záloha zvládne i běžně nakopírovaný recept
 * (heuristika – nedokonalé, ale vždy se ukáže náhled k úpravě).
 * Suroviny zůstávají volný text (řádky), na potraviny se nepárují.
 *
 * Postup: klasifikace každého řádku (pravidla v `recipeImportLines.ts`) → průchod
 * sekcemi podle značek (sekce končí jen další značkou) → úklid surovin a postupu.
 */

export interface ParsedRecipe {
  name: string;
  servings: number | null;
  ingredients: string[];
  instructions: string | null;
  /** UC031: „@autor", jen když se našel. Klíč chybí = nenalezeno. */
  source?: string;
  /** UC031: minuty z „Total time", jinak „Prep time"; jen když jdou spolehlivě přečíst. */
  prepMinutes?: number;
}

type ClassifiedLine =
  | { kind: 'blank' }
  | { kind: 'text'; text: string }
  /** Čistý údaj doby („Prep time: 10 min"): v sekci postupu zůstane krokem, jinde vypadne. */
  | { kind: 'time'; text: string }
  | { kind: 'marker'; section: SectionKind; inline: string };

const NAME_MAX_LENGTH = 80;

/** Celý vstup je jen URL (IG „Kopírovat odkaz") → UI ukáže nápovědu, nic se nerozebírá. */
export function isBareUrl(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === '' || /\s/.test(trimmed)) return false;
  return /^(?:https?:\/\/|www\.)\S+$/i.test(trimmed) || /^(?:[\w-]+\.)+[a-z]{2,}\/\S*$/i.test(trimmed);
}

/** Název z řádku: bez `#hashtagů`, zkrácený na 80 znaků (jako `deriveName` v editaci). */
function cleanName(line: string): string {
  const withoutTags = line
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return withoutTags.length > NAME_MAX_LENGTH ? withoutTags.slice(0, NAME_MAX_LENGTH).trimEnd() : withoutTags;
}

/** Postup: řádky beze změny, víc prázdných za sebou → jeden, °F doplněné o °C. */
function buildInstructions(lines: string[]): string | null {
  const collapsed: string[] = [];
  for (const line of lines) {
    const blank = line.trim() === '';
    if (blank && (collapsed.length === 0 || collapsed[collapsed.length - 1] === '')) continue;
    collapsed.push(blank ? '' : line);
  }
  return addCelsiusToFahrenheit(collapsed.join('\n')).trim() || null;
}

/**
 * Poznámka pod čarou („Beef*: 250g" … „* Ribeye or any well-marbled cut works best.") není
 * surovina. Bere se jen řádek začínající hvězdičkou, když jiný řádek na hvězdičku odkazuje
 * a hvězdička není odrážkou celého seznamu. Zůstává v originále.
 */
function dropFootnotes(lines: string[]): string[] {
  const starLines = lines.filter((line) => /^\s*\*\s*\S/.test(line));
  const referenced = lines.some((line) => /[\p{L}\p{N})]\*/u.test(line));
  const listLines = lines.filter((line) => line.trim() !== '').length;
  if (!referenced || starLines.length === 0 || starLines.length * 2 >= listLines) return lines;
  return lines.filter((line) => !/^\s*\*\s*\S/.test(line));
}

/** Suroviny: odrážka pryč → podsekce „X:" na „# X" → číslo seznamu pryč → bez prázdných. */
function buildIngredients(lines: string[]): string[] {
  const cleaned = dropFootnotes(lines)
    .map(stripLeadingBullet)
    .filter((line) => line !== '')
    .map(toSubsectionHeading);
  return stripListNumbers(cleaned);
}

export function parseRecipeText(text: string): ParsedRecipe {
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd());

  // 1) Klasifikace. Hashtagy, výzvy, porce a metadata vypadnou ze všech sekcí; čistý
  //    údaj doby jen mimo postup. Pořadí je důležité („Příprava: 20 min" je doba, ne
  //    značka postupu s obsahem).
  let servings: number | null = null;
  let source: string | undefined;
  let prepTime: number | undefined;
  let totalTime: number | undefined;
  const classified: ClassifiedLine[] = [];

  for (const line of rawLines) {
    // Řádek bez písmen a číslic (prázdný, „.", samotné emoji) nic nenese.
    if (!/[\p{L}\p{N}]/u.test(line)) {
      classified.push({ kind: 'blank' });
      continue;
    }
    if (isHashtagLine(line)) continue;
    if (isPromoLine(line)) {
      source ??= extractAuthorHandle(line);
      continue;
    }
    const lineServings = parseServingsLine(line);
    if (lineServings !== undefined) {
      servings ??= lineServings;
      continue;
    }
    const times = parseTimeLine(line);
    if (times) {
      for (const entry of times) {
        if (entry.minutes === null) continue;
        if (entry.kind === 'prep') prepTime ??= entry.minutes;
        if (entry.kind === 'total') totalTime ??= entry.minutes;
      }
      classified.push({ kind: 'time', text: line });
      continue;
    }
    if (isMetaLine(line)) continue;
    const marker = matchSectionMarker(line);
    if (marker) {
      if (marker.servings !== undefined) servings ??= marker.servings;
      classified.push({ kind: 'marker', section: marker.section, inline: marker.inline });
      continue;
    }
    classified.push({ kind: 'text', text: line });
  }

  const extras: Pick<ParsedRecipe, 'source' | 'prepMinutes'> = {};
  if (source) extras.source = source;
  const prepMinutes = totalTime ?? prepTime;
  if (prepMinutes !== undefined) extras.prepMinutes = prepMinutes;

  // Sekce řídí jen značky surovin/postupu. Samotné „Poznámka:"/„Tip"/„Notes" v jinak
  // neoznačeném receptu jen vyřízne svůj blok (zůstane v originále).
  const hasSectionMarker = classified.some((line) => line.kind === 'marker' && line.section !== 'other');
  const parsed = hasSectionMarker
    ? parseBySections(classified)
    : parseByHeuristic(dropOtherBlocks(classified));
  return { ...parsed, servings, ...extras };
}

/**
 * Bez značek surovin/postupu: značka „ostatní" (Poznámka, Tip, Notes…) + její blok do nejbližšího
 * prázdného řádku pryč. Na začátku textu (před ní nic) vypadne jen řádek značky – blok by tam
 * mohl spolknout název i suroviny („Poznámka:\nod babičky\nBábovka\n- mouka").
 */
function dropOtherBlocks(classified: ClassifiedLine[]): ClassifiedLine[] {
  const result: ClassifiedLine[] = [];
  let skipping = false;
  let skippedContent = false;
  for (const line of classified) {
    if (line.kind === 'marker') {
      skipping = result.some((kept) => kept.kind === 'text');
      skippedContent = false;
      continue;
    }
    if (skipping) {
      // Blok končí prázdným řádkem po aspoň jednom řádku obsahu („Poznámka:\n\nText" – i Text patří k poznámce).
      if (line.kind === 'blank' && skippedContent) {
        skipping = false;
        result.push(line);
      } else if (line.kind !== 'blank') {
        skippedContent = true;
      }
      continue;
    }
    result.push(line);
  }
  return result;
}

/** Bloky neprázdných řádků oddělené prázdnými řádky. */
function toBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

const LABEL_MAX_WORDS = 5;
const LABEL_MAX_LENGTH = 40;
const LEADING_QUANTITY_RE = /^[\p{N}½¼¾⅓⅔⅛~≈]/u;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Krátký řádek bez odrážky, množství a koncové tečky („Na kuře", „Filling"). */
function isShortLabel(line: string): boolean {
  const trimmed = line.trim();
  return (
    !hasLeadingBullet(line) &&
    trimmed.length <= LABEL_MAX_LENGTH &&
    wordCount(trimmed) <= LABEL_MAX_WORDS &&
    !LEADING_QUANTITY_RE.test(trimmed) &&
    !/[.!?]$/.test(trimmed)
  );
}

/** Blok „krátký nadpis + odrážky" („Na omáčku\n* 100 ml sójové omáčky\n…"). */
function isLabelledBulletBlock(block: string[]): boolean {
  return block.length >= 2 && isShortLabel(block[0]) && block.slice(1).every(hasLeadingBullet);
}

/** Řádek, který vypadá jako surovina: odrážka, vedoucí množství, nebo krátký bez tečky. */
function isIngredientLike(line: string): boolean {
  const trimmed = line.trim();
  if (hasLeadingBullet(line) || LEADING_QUANTITY_RE.test(trimmed)) return true;
  return wordCount(trimmed) <= LABEL_MAX_WORDS && !/[.!?]$/.test(trimmed);
}

/**
 * Heuristika bez značek surovin/postupu nad řádky ('' = prázdný řádek), UC031b:
 * - Nadpis sekce je „Dough:" / „[Sauce]", nebo – když se v textu aspoň dvakrát opakuje blok
 *   „krátký řádek + odrážky" – ten krátký řádek („Na kuře"). Nadpis není název receptu.
 * - Jinak první neprázdný řádek = název.
 * - Suroviny = první blok + každý další blok, který začíná nadpisem sekce a pod ním jsou jen
 *   suroviny. Postup začíná prvním jiným blokem (odstavce vět).
 * - Jediný blok bez prázdných řádků: suroviny do prvního řádku bez odrážky (jako dřív).
 */
function splitByHeuristic(lines: string[]): { name: string; ingredientLines: string[]; restLines: string[] } {
  const blocks = toBlocks(lines);
  if (blocks.length === 0) return { name: '', ingredientLines: [], restLines: [] };

  const labelMode = blocks.filter(isLabelledBulletBlock).length >= 2;
  function sectionHeading(block: string[]): string | null {
    const first = stripLeadingBullet(block[0]);
    const colonHeading = toSubsectionHeading(first);
    if (colonHeading !== first) return colonHeading;
    if (labelMode && isLabelledBulletBlock(block)) return `# ${block[0].trim()}`;
    return null;
  }
  function isSectionBlock(block: string[]): boolean {
    return block.length > 1 && sectionHeading(block) !== null && block.slice(1).every(isIngredientLike);
  }

  let name = '';
  if (sectionHeading(blocks[0]) === null) {
    name = cleanName(blocks[0][0]);
    blocks[0] = blocks[0].slice(1);
    if (blocks[0].length === 0) blocks.shift();
  }
  if (blocks.length === 0) return { name, ingredientLines: [], restLines: [] };

  if (blocks.length === 1) {
    const body = blocks[0];
    const firstProse = body.findIndex((line) => !hasLeadingBullet(line));
    if (firstProse > 0) {
      return { name, ingredientLines: body.slice(0, firstProse), restLines: body.slice(firstProse) };
    }
    return { name, ingredientLines: body, restLines: [] };
  }

  const withHeading = (block: string[]): string[] => {
    const heading = sectionHeading(block);
    return heading && isSectionBlock(block) ? [heading, ...block.slice(1)] : block;
  };
  const ingredientLines = withHeading(blocks[0]);
  let next = 1;
  while (next < blocks.length && isSectionBlock(blocks[next])) {
    ingredientLines.push(...withHeading(blocks[next]));
    next += 1;
  }
  const restLines = blocks.slice(next).flatMap((block, index) => (index === 0 ? block : ['', ...block]));
  return { name, ingredientLines, restLines };
}

function hasLeadingBullet(line: string): boolean {
  return stripLeadingBullet(line) !== line.trim();
}

/** Suroviny z heuristiky: jen bez odrážek (nadpisy sekcí převedl už `splitByHeuristic`). */
function heuristicIngredients(lines: string[]): string[] {
  return lines.map(stripLeadingBullet).filter((line) => line !== '');
}

/** 2) Se značkami: stavový automat úvod → (suroviny | postup | ostatní)*. */
function parseBySections(classified: ClassifiedLine[]): Omit<ParsedRecipe, 'servings'> {
  let section: SectionKind | 'preamble' = 'preamble';
  const preamble: string[] = [];
  const ingredientLines: string[] = [];
  const instructionLines: string[] = [];

  function push(line: string) {
    if (section === 'preamble') preamble.push(line);
    else if (section === 'ingredients') ingredientLines.push(line);
    else if (section === 'instructions') instructionLines.push(line);
    // 'other' (Notes, Tips, Equipment…) se do náhledu nedostane – zůstává v originále.
  }

  for (const line of classified) {
    if (line.kind === 'marker') {
      section = line.section;
      if (line.inline) push(line.inline);
    } else if (line.kind === 'time') {
      // Údaj doby v postupu je krok autora – zůstává; jinde je to metadato.
      if (section === 'instructions') push(line.text);
    } else {
      push(line.kind === 'text' ? line.text : '');
    }
  }

  const instructions = buildInstructions(instructionLines);
  const hasIngredientMarker = classified.some(
    (line) => line.kind === 'marker' && line.section === 'ingredients',
  );
  if (hasIngredientMarker) {
    // Název = první řádek úvodu; značka se názvem nikdy nestane. Zbytek úvodu je v originále.
    const firstPreamble = preamble.find((line) => line.trim() !== '');
    return {
      name: firstPreamble ? cleanName(firstPreamble) : '',
      ingredients: buildIngredients(ingredientLines),
      instructions,
    };
  }

  // Chybí značka surovin („Bábovka\n200 g mouky\n\nPostup:…"): první řádek úvodu je název,
  // VŠECHNY další neprázdné řádky až po značku postupu jsou suroviny (i přes prázdné řádky),
  // podsekce „Těsto:" → „# Těsto" jako v sekci surovin. Marketingovou větu navíc uživatel
  // v náhledu vidí a smaže; ztracenou surovinu by neviděl.
  const nameAt = preamble.findIndex((line) => line.trim() !== '');
  if (nameAt === -1) return { name: '', ingredients: [], instructions };
  const first = stripLeadingBullet(preamble[nameAt]);
  // Úvod začíná rovnou podsekcí („Dough:") → název chybí, podsekce patří do surovin.
  if (toSubsectionHeading(first) !== first) {
    return { name: '', ingredients: buildIngredients(preamble.slice(nameAt)), instructions };
  }
  return {
    name: cleanName(preamble[nameAt]),
    ingredients: buildIngredients(preamble.slice(nameAt + 1)),
    instructions,
  };
}

/** 3) Bez značek surovin/postupu: dnešní heuristika nad celým textem. */
function parseByHeuristic(classified: ClassifiedLine[]): Omit<ParsedRecipe, 'servings'> {
  const lines = classified
    .filter((line) => line.kind !== 'time')
    .map((line) => (line.kind === 'text' ? line.text : ''));
  const { name, ingredientLines, restLines } = splitByHeuristic(lines);
  return {
    name,
    ingredients: heuristicIngredients(ingredientLines),
    instructions: buildInstructions(restLines),
  };
}
