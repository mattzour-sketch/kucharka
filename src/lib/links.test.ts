import { describe, expect, it } from 'vitest';
import { linkRecipeName, splitLinks } from './links';

describe('splitLinks', () => {
  it('text bez odkazu zůstane jedním kouskem', () => {
    expect(splitLinks('Smíchej a peč.')).toEqual([{ text: 'Smíchej a peč.' }]);
  });

  it('holý odkaz je jeden klikací kousek', () => {
    const url = 'https://www.instagram.com/reel/abc123/?igsh=xyz';
    expect(splitLinks(url)).toEqual([{ text: url, href: url }]);
  });

  it('odkaz uprostřed textu, tečka za ním patří větě', () => {
    expect(splitLinks('Video: https://youtu.be/x1. Pak peč.')).toEqual([
      { text: 'Video: ' },
      { text: 'https://youtu.be/x1', href: 'https://youtu.be/x1' },
      { text: '. Pak peč.' },
    ]);
  });

  it('www. dostane https a víc odkazů na řádcích', () => {
    expect(splitLinks('www.recepty.cz/a\nhttp://b.cz')).toEqual([
      { text: 'www.recepty.cz/a', href: 'https://www.recepty.cz/a' },
      { text: '\n' },
      { text: 'http://b.cz', href: 'http://b.cz' },
    ]);
  });

  it('prázdný text → žádné kousky', () => {
    expect(splitLinks('')).toEqual([]);
  });
});

describe('linkRecipeName', () => {
  it.each([
    ['https://www.instagram.com/reel/abc/', 'Recept z Instagramu'],
    ['https://instagr.am/p/abc', 'Recept z Instagramu'],
    ['https://vm.tiktok.com/xyz/', 'Recept z TikToku'],
    ['https://m.youtube.com/shorts/1', 'Recept z YouTube'],
    ['https://youtu.be/1', 'Recept z YouTube'],
    ['https://fb.watch/abc', 'Recept z Facebooku'],
    ['https://www.toprecepty.cz/recept/1', 'Recept z toprecepty.cz'],
    ['www.recepty.cz/a', 'Recept z recepty.cz'],
    ['https://', 'Recept z odkazu'],
  ])('%s → %s', (url, name) => {
    expect(linkRecipeName(url)).toBe(name);
  });
});
