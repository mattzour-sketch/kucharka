import { describe, expect, it } from 'vitest';
import { PHOTO_MAX_BYTES, planPhotoResize } from './photoSize';

describe('planPhotoResize', () => {
  it('zmenší fotku z mobilu na šířku na 1600 px a zachová poměr stran', () => {
    expect(planPhotoResize({ width: 4032, height: 3024 }, 4_000_000)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it('u fotky na výšku omezí výšku', () => {
    expect(planPhotoResize({ width: 3024, height: 4032 }, 4_000_000)).toEqual({
      width: 1200,
      height: 1600,
    });
  });

  it('malou a lehkou fotku nechá být', () => {
    expect(planPhotoResize({ width: 1200, height: 900 }, 200_000)).toBeNull();
    expect(planPhotoResize({ width: 1600, height: 1600 }, PHOTO_MAX_BYTES)).toBeNull();
  });

  it('velký rozměr zmenší i při malém souboru', () => {
    expect(planPhotoResize({ width: 3200, height: 800 }, 100_000)).toEqual({
      width: 1600,
      height: 400,
    });
  });

  it('těžký soubor s malými rozměry jen překóduje (rozměry stejné)', () => {
    expect(planPhotoResize({ width: 1080, height: 1920 }, 2_000_000)).toEqual({
      width: 900,
      height: 1600,
    });
    expect(planPhotoResize({ width: 1000, height: 800 }, 2_000_000)).toEqual({
      width: 1000,
      height: 800,
    });
  });

  it('bez recompressHeavy překóduje jen příliš velké rozměry', () => {
    const opts = { recompressHeavy: false };
    expect(planPhotoResize({ width: 1600, height: 1200 }, 2_000_000, opts)).toBeNull();
    expect(planPhotoResize({ width: 4032, height: 3024 }, 100_000, opts)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it('už zmenšenou fotku podruhé nepřekóduje (start appky je idempotentní)', () => {
    const once = planPhotoResize({ width: 4031, height: 3023 }, 9_000_000);
    expect(once).not.toBeNull();
    expect(planPhotoResize(once!, 9_000_000, { recompressHeavy: false })).toBeNull();
  });

  it('úzký pruh nespadne na nulu', () => {
    expect(planPhotoResize({ width: 10000, height: 2 }, 100_000)).toEqual({
      width: 1600,
      height: 1,
    });
  });

  it('nesmyslné rozměry neplánuje', () => {
    expect(planPhotoResize({ width: 0, height: 100 }, 5_000_000)).toBeNull();
    expect(planPhotoResize({ width: Number.NaN, height: 100 }, 5_000_000)).toBeNull();
  });
});
