/**
 * Časy v krocích receptu (§7). Z textu kroku vytáhne délky („20 min", „1 h",
 * „90 s") a rozdělí ho na segmenty, aby šly udělat klikací. Čistá logika.
 */

export interface DurationSegment {
  text: string;
  /** Sekundy, když je segment délka (→ klikací časovač); jinak null (běžný text). */
  seconds: number | null;
}

function unitToSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return 3600; // h, hod, hodina/y
  if (u.startsWith('min') || u === 'm') return 60; // min, minut(a/y), m
  if (u.startsWith('s')) return 1; // s, sek, sekund(a/y)
  return 0;
}

// pořadí v alternaci: delší tvary dřív (minut před min, hodin před h)
const DURATION_RE =
  /(\d+(?:[.,]\d+)?)\s*(hodin[a-z]*|hod|h|minut[a-z]*|min|m|sekund[a-z]*|sek|s)\b/gi;

export function splitStepByDurations(step: string): DurationSegment[] {
  const segments: DurationSegment[] = [];
  let last = 0;
  for (const match of step.matchAll(DURATION_RE)) {
    const start = match.index ?? 0;
    const whole = match[0];
    const seconds = Math.round(Number(match[1].replace(',', '.')) * unitToSeconds(match[2]));
    if (seconds <= 0) continue;
    if (start > last) segments.push({ text: step.slice(last, start), seconds: null });
    segments.push({ text: whole, seconds });
    last = start + whole.length;
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
