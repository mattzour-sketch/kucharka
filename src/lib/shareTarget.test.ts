import { describe, expect, it } from 'vitest';
import { isBareUrl } from './parseRecipe';
import { sharedTextFromParams } from './shareTarget';

function share(params: Record<string, string>): string | null {
  return sharedTextFromParams(new URLSearchParams(params));
}

describe('sharedTextFromParams', () => {
  it('bez sdílených parametrů vrací null (běžné otevření Vložit)', () => {
    expect(share({})).toBeNull();
    expect(share({ text: '   ', title: '' })).toBeNull();
  });

  it('zpráva z WhatsAppu přijde jen v `text`', () => {
    const text = 'Bábovka\n250 g mouky\n200 g cukru\n\nVšechno smíchat a péct 45 min.';
    expect(share({ text })).toBe(text);
  });

  it('poznámka z Keep: titulek je název receptu → první řádek', () => {
    expect(share({ title: 'Bábovka', text: '250 g mouky\n200 g cukru' })).toBe('Bábovka\n250 g mouky\n200 g cukru');
  });

  it('titulek, kterým text už začíná, se nezdvojí', () => {
    expect(share({ title: 'Bábovka', text: 'Bábovka\n250 g mouky' })).toBe('Bábovka\n250 g mouky');
  });

  it('odkaz vedle skutečného textu se zahodí – parser by z něj udělal surovinu', () => {
    expect(share({ text: '250 g mouky\n200 g cukru', url: 'https://example.com/babovka' })).toBe(
      '250 g mouky\n200 g cukru',
    );
    expect(share({ text: '250 g mouky\nhttps://example.com/babovka' })).toBe('250 g mouky');
  });

  it('Instagram pošle jen odkaz → výsledek je holé URL (UI ukáže nápovědu)', () => {
    const result = share({ text: 'https://www.instagram.com/p/abc123/?igsh=xyz' });
    expect(result).toBe('https://www.instagram.com/p/abc123/?igsh=xyz');
    expect(isBareUrl(result ?? '')).toBe(true);
  });

  it('stránka z prohlížeče (titulek + odkaz, žádný text) → holé URL, ne recept z titulku', () => {
    const result = share({ title: 'Nejlepší bábovka | Recepty.cz', url: 'https://recepty.cz/babovka' });
    expect(result).toBe('https://recepty.cz/babovka');
    expect(isBareUrl(result ?? '')).toBe(true);
    // Chrome občas posílá odkaz v `text` místo `url`.
    expect(share({ title: 'Nejlepší bábovka', text: 'https://recepty.cz/babovka' })).toBe('https://recepty.cz/babovka');
  });

  it('sjednotí konce řádků z Windows/starších appek', () => {
    expect(share({ text: '250 g mouky\r\n200 g cukru' })).toBe('250 g mouky\n200 g cukru');
  });
});
