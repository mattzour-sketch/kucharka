import { isIngredientHeading } from './ingredientSection';
import { czechPlural } from './plural';
import { splitIngredientLines } from './recipeText';
import { normalizeForSearch } from './search';

/**
 * Ruční rozdělení diktátu z jednoho řádku: suroviny podle čárek, středníků a odrážek,
 * postup podle vět (bez teček podle čárek před slovesem). Jen nabídka, rozdělí se až ťuknutím (pravidlo 2: mění se jen
 * oddělovač na zalomení řádku, slova zůstanou znak po znaku). Čistá logika, O(n) bez
 * regexů s backtrackingem, ať nezdrží psaní ani u dlouhého vloženého textu.
 */

export interface SplitProposal {
  /** Nový obsah celého pole (ostatní řádky beze změny, i prázdné a v původním pořadí). */
  text: string;
  /** N do nabídky: suroviny bez nadpisů, resp. všechny kroky v poli, po rozdělení. */
  count: number;
}

const DIGIT_RE = /\d/;
/** Kolik vět musí mít řádek postupu, aby se nabídlo rozdělení (dvouvětý krok je běžný). */
const MIN_STEP_SENTENCES = 3;

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && DIGIT_RE.test(ch);
}

/**
 * Části jednoho řádku surovin. Oddělovač je `,`, `;` a `•` mimo závorky; čárka mezi
 * dvěma číslicemi bez mezery („1,5") je desetinná. Části jsou ořezané, prázdné zahozené.
 */
export function splitIngredientLine(line: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let partStart = 0;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === ';' || ch === '•' || ch === ',')) {
      if (ch === ',' && isDigit(line[i - 1]) && isDigit(line[i + 1])) continue;
      parts.push(line.slice(partStart, i));
      partStart = i + 1;
    }
  }
  parts.push(line.slice(partStart));
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/** Řádek surovin stojí za rozdělení: ≥ 3 části, nebo 2 části, které obě začínají číslicí. */
function isIngredientSplitWorthy(parts: string[]): boolean {
  if (parts.length >= 3) return true;
  return parts.length === 2 && parts.every((part) => isDigit(part[0]));
}

export function proposeIngredientSplit(text: string): SplitProposal | null {
  let changed = false;
  const lines = text.split('\n').map((line) => {
    if (isIngredientHeading(line)) return line;
    const parts = splitIngredientLine(line);
    if (!isIngredientSplitWorthy(parts)) return line;
    changed = true;
    return parts.join('\n');
  });
  if (!changed) return null;
  const next = lines.join('\n');
  const count = splitIngredientLines(next).filter((line) => !isIngredientHeading(line)).length;
  return { text: next, count };
}

const SENTENCE_END = new Set(['.', '!', '?']);
const CLOSERS = new Set([')', '"', '“', '”', '»', "'", '’']);
const OPENERS_RE = /^[("„“'‚»«]+/u;
const SENTENCE_START_RE = /^[\p{Lu}\d]/u;
/** Zkratky, za jejichž tečkou věta nekončí („cca. 2 lžíce"). */
const ABBREVIATIONS = new Set(['cca', 'např', 'tzv', 'tj', 'resp', 'popř', 'příp']);

function isSpace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t' || ch === ' ';
}

/** Slovo před samotnou tečkou, za kterou věta nekončí: zkratka, nebo pořadové číslo („1."). */
function isNonTerminalWord(word: string): boolean {
  const bare = word.replace(OPENERS_RE, '').toLowerCase();
  if (bare.length === 0) return false;
  if (ABBREVIATIONS.has(bare)) return true;
  for (const ch of bare) if (!isDigit(ch)) return false;
  return true;
}

/**
 * Věty jednoho řádku postupu. Konec věty je běh `.`/`!`/`?` (případně s uzavírací
 * závorkou nebo uvozovkou), pak mezera a velké písmeno nebo číslice. Věta si nechá
 * svou tečku, zmizí jen mezera mezi větami.
 */
export function splitSentences(line: string): string[] {
  const sentences: string[] = [];
  let sentenceStart = 0;
  let wordStart = 0;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (isSpace(ch)) {
      i += 1;
      wordStart = i;
      continue;
    }
    if (!SENTENCE_END.has(ch)) {
      i += 1;
      continue;
    }
    const runStart = i;
    let end = i;
    while (end < line.length && SENTENCE_END.has(line[end])) end += 1;
    const onlyDot = end - runStart === 1 && ch === '.';
    while (end < line.length && CLOSERS.has(line[end])) end += 1;
    let next = end;
    while (next < line.length && isSpace(line[next])) next += 1;
    if (next === end) {
      // Bez mezery („1.5", „a.b") to konec věty není a slovo pokračuje.
      i = end;
      continue;
    }
    const startsSentence = next < line.length && SENTENCE_START_RE.test(line[next]);
    if (startsSentence && !(onlyDot && isNonTerminalWord(line.slice(wordStart, runStart)))) {
      sentences.push(line.slice(sentenceStart, end).trim());
      sentenceStart = next;
    }
    i = next;
    wordStart = next;
  }
  const rest = line.slice(sentenceStart).trim();
  if (rest.length > 0) sentences.push(rest);
  return sentences;
}

/** Slovesa a spojky, které po čárce začínají další krok (bez diakritiky, celé slovo). */
const STEP_START_WORDS = new Set([
  'dej', 'dat', 'nech', 'nechte', 'vloz', 'vlozte', 'slij', 'vlij', 'osol', 'pak', 'potom',
  'pote', 'nakonec', 'nasledne', 'mezitim',
]);
/** Kmeny sloves vaření (začátek slova bez diakritiky). Příčestí odfiltruje koncovka. */
const STEP_VERB_STEMS = [
  'prid', 'smaz', 'osmaz', 'orest', 'restuj', 'restov', 'uvar', 'povar', 'pect', 'upect',
  'opect', 'zapect', 'pecem', 'nechat', 'nechej', 'zamich', 'promich', 'vmich', 'smich', 'nakraj',
  'pokraj', 'zalij', 'zalit', 'prelij', 'prelit', 'opepr', 'vlozit', 'vlozim', 'podavej', 'podavat',
  'rozpal', 'rozehr', 'nastrouh', 'vymack', 'rozmack', 'posyp', 'ozdob', 'ochut', 'dochut',
  'scedit', 'sced', 'vyndej', 'vyndat', 'vyjm', 'vyklop', 'vysleh', 'usleh', 'dusit', 'dusim',
  'podus', 'zadus', 'vypn', 'stahn', 'odstav', 'prikryj', 'prikryt', 'zakryj', 'zakryt', 'obrat',
  'otoc', 'vyval', 'vytvar', 'tvaruj', 'namoc', 'zahrej', 'ohrej', 'zahrat', 'ohrat', 'privest',
  'prived', 'zahust', 'zapraz', 'vlit', 'oloup', 'nasek', 'vychlad', 'zchlad', 'nalij', 'nalit',
  'rozpust', 'rozval',
];
/**
 * Koncovky přídavných jmen z příčestí („nakrájenou cibuli", „rozpuštěné máslo", „prolité")
 * – nejsou krok. Před n/t je samohláska, takže „přidejte" ani „vypni" sem nespadnou.
 */
const PARTICIPLE_END_RE = /[aeiouy][nt](?:y|a|e|i|ou|ym|ych|em|eho|emu)$/;
const LETTER_RE = /\p{L}/u;

function isStepStartWord(word: string): boolean {
  const normalized = normalizeForSearch(word);
  if (STEP_START_WORDS.has(normalized)) return true;
  if (PARTICIPLE_END_RE.test(normalized)) return false;
  return STEP_VERB_STEMS.some((stem) => normalized.startsWith(stem));
}

/**
 * Úseky diktovaného kroku bez teček: dělí se u čárky mimo závorky, za kterou začíná
 * sloveso vaření nebo „pak / potom / nakonec". Čárka (oddělovač) zmizí, slova zůstanou.
 */
export function splitClauses(line: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let partStart = 0;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && ch === ',') {
      let wordStart = i + 1;
      while (isSpace(line[wordStart])) wordStart += 1;
      let wordEnd = wordStart;
      while (wordEnd < line.length && LETTER_RE.test(line[wordEnd])) wordEnd += 1;
      if (wordEnd > wordStart && isStepStartWord(line.slice(wordStart, wordEnd))) {
        parts.push(line.slice(partStart, i));
        partStart = i + 1;
      }
    }
  }
  parts.push(line.slice(partStart));
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

export function proposeStepSplit(text: string): SplitProposal | null {
  let changed = false;
  const lines = text.split('\n').map((line) => {
    const sentences = splitSentences(line);
    // Jedna věta = diktát bez teček → zkusí se čárky před slovesem.
    const steps = sentences.length === 1 ? splitClauses(line) : sentences;
    if (steps.length < MIN_STEP_SENTENCES) return line;
    changed = true;
    return steps.join('\n');
  });
  if (!changed) return null;
  const next = lines.join('\n');
  // Kroky se počítají jako ve vaření a v souhrnu náhledu: neprázdné řádky.
  const count = next.split('\n').filter((line) => line.trim().length > 0).length;
  return { text: next, count };
}

export function ingredientSplitLabel(count: number): string {
  return `Rozdělit na ${count} ${czechPlural(count, ['surovinu', 'suroviny', 'surovin'])}`;
}

export function stepSplitLabel(count: number): string {
  return `Rozdělit na ${count} ${czechPlural(count, ['krok', 'kroky', 'kroků'])}`;
}
