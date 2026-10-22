import { PHOTO_JPEG_QUALITY, planPhotoResize } from '../../lib/photoSize';

/**
 * Zmenší fotku na delší stranu 1600 px a překóduje do JPEGu (rozměry viz `lib/photoSize.ts`).
 * Když se fotka nedá přečíst (např. HEIC v prohlížeči bez podpory) nebo by výsledek
 * nebyl menší, vrátí původní blob – přidání fotky kvůli tomu nikdy neselže.
 * `recompressHeavy: false` viz `planPhotoResize` (pro už uložené fotky).
 */
export async function shrinkPhoto(
  blob: Blob,
  options?: { recompressHeavy?: boolean },
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return blob;
  }

  try {
    const target = planPhotoResize(
      { width: bitmap.width, height: bitmap.height },
      blob.size,
      options,
    );
    if (!target) return blob;

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    // JPEG nemá průhlednost – podklad bílý, ať průhledné PNG nezčerná.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    const shrunk = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY),
    );
    return shrunk && shrunk.size < blob.size ? shrunk : blob;
  } catch {
    return blob;
  } finally {
    bitmap.close();
  }
}
