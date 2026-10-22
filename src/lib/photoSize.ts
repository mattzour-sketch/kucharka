/**
 * Zmenšení fotky receptu – čistý výpočet rozměrů (bez canvasu, kvůli testům).
 *
 * Fotka z mobilu má 3–5 MB a v záloze je jako base64 ještě o třetinu větší.
 * Na náhled receptu stačí delší strana 1600 px a JPEG, tj. zhruba 200–400 kB.
 */

/** Delší strana zmenšené fotky v pixelech. */
export const PHOTO_MAX_SIDE = 1600;

/** Fotka nad tuhle velikost se překóduje i tehdy, když má malé rozměry (např. PNG). */
export const PHOTO_MAX_BYTES = 500 * 1024;

/** Kvalita JPEGu při překódování (0–1). */
export const PHOTO_JPEG_QUALITY = 0.8;

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Cílové rozměry fotky, nebo `null`, když se fotka nemá překódovat
 * (je dost malá rozměrem i velikostí souboru). Poměr stran se zachová.
 *
 * `recompressHeavy: false` překóduje jen fotku s příliš velkými rozměry. To platí
 * pro už uložené fotky: po zmenšení mají delší stranu 1600 px, takže se nebudou
 * překódovávat při každém startu dokola (každé překódování JPEGu ubírá kvalitu).
 */
export function planPhotoResize(
  size: ImageSize,
  bytes: number,
  { recompressHeavy = true }: { recompressHeavy?: boolean } = {},
): ImageSize | null {
  const { width, height } = size;
  if (!(width > 0) || !(height > 0)) return null;

  const longest = Math.max(width, height);
  const tooHeavy = recompressHeavy && bytes > PHOTO_MAX_BYTES;
  if (longest <= PHOTO_MAX_SIDE && !tooHeavy) return null;

  const ratio = Math.min(1, PHOTO_MAX_SIDE / longest);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}
