/**
 * Pole Doba a Porcí v editoru a ve Vložit. Doba se ukládá v minutách, ale člověk napíše
 * i „1 h" nebo „1 h 30 min" – to se přepočítá. Co nejde přečíst, je 'invalid', ať UI
 * hned řekne „nerozumím" místo tichého uložení prázdné hodnoty.
 */

export type FieldParse = number | null | 'invalid';

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const toNumber = (text: string) => Number(text.replace(',', '.'));

const MINUTES_ONLY = new RegExp(String.raw`^${NUM}\s*(?:m|min|minut[ay]?)?\.?$`, 'iu');
const HOURS_MINUTES = new RegExp(
  String.raw`^${NUM}\s*(?:h|hod|hodin[ay]?|hodinu)\.?\s*(?:(\d+)\s*(?:m|min|minut[ay]?)?\.?)?$`,
  'iu',
);
const CLOCK = /^(\d+):([0-5]\d)$/;

/** Doba přípravy v minutách: „45", „45 min", „1 h", „1,5 h", „1 h 30 min", „1h30", „1:30". */
export function parsePrepInput(input: string): FieldParse {
  const text = input.trim();
  if (text === '') return null;
  let minutes: number | null = null;
  const clock = CLOCK.exec(text);
  const hm = HOURS_MINUTES.exec(text);
  const m = MINUTES_ONLY.exec(text);
  if (clock) minutes = Number(clock[1]) * 60 + Number(clock[2]);
  else if (hm) minutes = toNumber(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);
  else if (m) minutes = toNumber(m[1]);
  return minutes != null && minutes > 0 ? minutes : 'invalid';
}

/** Porce jedním kladným číslem („4", „2,5", „4 porce"). Rozsah „4–6" je 'invalid'. */
export function parseServingsInput(input: string): FieldParse {
  const text = input.trim();
  if (text === '') return null;
  const match = new RegExp(String.raw`^${NUM}(?:\s*\p{L}+)?$`, 'u').exec(text);
  const value = match ? toNumber(match[1]) : NaN;
  return value > 0 ? value : 'invalid';
}

/** Hodnota k uložení: nečitelné se ukládá jako prázdné (recept se uložit musí vždy). */
export function fieldValue(parsed: FieldParse): number | null {
  return parsed === 'invalid' ? null : parsed;
}

/** Text pole po opuštění: přečtená doba se přepíše na minuty („1 h 30 min" → „90"). */
export function normalizedPrepText(input: string): string {
  const parsed = parsePrepInput(input);
  return typeof parsed === 'number' ? String(parsed).replace('.', ',') : input;
}
