/**
 * Časy v krocích receptu (§7). Z textu kroku vytáhne délky („20 min", „1 h",
 * „90 s", rozsah „50–55 min" na dolní mez) a rozdělí ho na segmenty, aby šly udělat
 * klikací. Čistá logika.
 */

export interface DurationSegment {
  text: string;
  /** Sekundy, když je segment délka (→ klikací časovač); jinak null (běžný text). */
  seconds: number | null;
  /** Jen u rozsahu („50–55 min"): horní mez v sekundách; `seconds` je dolní mez. */
  maxSeconds?: number;
}

function unitToSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return 3600; // h, hod, hodina/y, hour(s), hr(s)
  if (u.startsWith('min') || u === 'm') return 60; // min, minut(a/y), minutes, mins, m
  if (u.startsWith('s')) return 1; // s, sek, sekund(a/y), seconds, sec(s)
  return 0;
}

/** Pořadí jednotky pro spojování „1 h 30 min 10 s": h = 0, min = 1, s = 2. */
function unitRank(unit: string): number {
  const seconds = unitToSeconds(unit);
  if (seconds === 3600) return 0;
  if (seconds === 60) return 1;
  return 2;
}

// pořadí v alternaci: delší tvary dřív (minut před min, hodin před h);
// UC031: i anglické tvary (hours/hrs, mins, seconds/secs).
// Konec `(?![a-z])` místo `\b`: za jednotkou smí hned být číslice („1h30min"),
// diakritika za ní se chová jako dřív („5 minutách" = „5 minut").
const DURATION_RE =
  /(\d+(?:[.,]\d+)?)\s*(hodin[a-z]*|hod|hours?|hrs?|h|minut[a-z]*|mins?|m|sekund[a-z]*|sek|seconds?|secs?|s)(?![a-z])/gi;

// Sousední časy se spojí, jen když mezi nimi jsou mezery nebo nic („1 h 30 min", „1h30min").
// Spojka („1 h a 30 min"), čárka ani jiné slovo je nespojí.
const JOIN_GAP_RE = /^\s*$/;

interface DurationMatch {
  start: number;
  end: number;
  seconds: number;
  /** Horní mez rozsahu (jinak stejné jako `seconds`). */
  maxSeconds: number;
  rank: number;
}

// Dolní mez rozsahu těsně před časem („50–55 minut", „10 až 15 min", „12 to 15 minutes").
const RANGE_LOW_RE = /(\d+(?:[.,]\d+)?)\s*(?:[-–—]|\s(?:až|az|to)\s)\s*$/i;

function toNumber(text: string): number {
  return Number(text.replace(',', '.'));
}

export function splitStepByDurations(step: string): DurationSegment[] {
  const groups: DurationMatch[][] = [];
  for (const match of step.matchAll(DURATION_RE)) {
    let start = match.index ?? 0;
    const unitSeconds = unitToSeconds(match[2]);
    const maxSeconds = Math.round(toNumber(match[1]) * unitSeconds);
    let seconds = maxSeconds;
    // Nulový čas není klikací; zůstane textem, a tím spojení přeruší.
    if (seconds <= 0) continue;
    // Rozsah: klikací je celý „50–55 minut", časovač na dolní mez (kontrola včas).
    const lastGroup = groups[groups.length - 1];
    const searchFrom = lastGroup ? lastGroup[lastGroup.length - 1].end : 0;
    const range = RANGE_LOW_RE.exec(step.slice(searchFrom, start));
    if (range) {
      const lowSeconds = Math.round(toNumber(range[1]) * unitSeconds);
      if (lowSeconds > 0 && lowSeconds < seconds) {
        start = searchFrom + range.index;
        seconds = lowSeconds;
      }
    }
    const current: DurationMatch = {
      start,
      end: (match.index ?? 0) + match[0].length,
      seconds,
      maxSeconds,
      rank: unitRank(match[2]),
    };
    const group = groups[groups.length - 1];
    const previous = group?.[group.length - 1];
    // Spojit jen v pořadí h → min → s, každou jednotku nejvýš jednou.
    if (
      previous &&
      current.rank > previous.rank &&
      JOIN_GAP_RE.test(step.slice(previous.end, start))
    ) {
      group.push(current);
    } else {
      groups.push([current]);
    }
  }

  const segments: DurationSegment[] = [];
  let last = 0;
  for (const group of groups) {
    const start = group[0].start;
    const end = group[group.length - 1].end;
    if (start > last) segments.push({ text: step.slice(last, start), seconds: null });
    const seconds = group.reduce((sum, m) => sum + m.seconds, 0);
    const maxSeconds = group.reduce((sum, m) => sum + m.maxSeconds, 0);
    segments.push({
      text: step.slice(start, end),
      seconds,
      ...(maxSeconds > seconds ? { maxSeconds } : {}),
    });
    last = end;
  }
  if (last < step.length) segments.push({ text: step.slice(last), seconds: null });
  if (segments.length === 0) segments.push({ text: step, seconds: null });
  return segments;
}

/** Odpočet v ms na „M:SS" (nebo „H:MM:SS" nad hodinu). Záporné → „0:00". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}
