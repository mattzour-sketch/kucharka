/**
 * Odkazy v textu receptu (např. recept uložený jen jako odkaz na reel). Text se jen
 * rozdělí na kousky pro zobrazení – v datech zůstává beze změny (pravidlo 2).
 */

export interface TextPart {
  text: string;
  /** Kam odkaz vede; u obyčejného textu chybí. */
  href?: string;
}

const LINK = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;
/** Tečka nebo závorka za odkazem patří větě, ne adrese. */
const TRAILING_PUNCTUATION = /[.,;:!?)\]'"]+$/;

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const start = match.index ?? 0;
    const link = match[0].replace(TRAILING_PUNCTUATION, '');
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: link, href: /^www\./i.test(link) ? `https://${link}` : link });
    last = start + link.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

const SITE_NAMES: [RegExp, string][] = [
  [/(^|\.)(instagram\.com|instagr\.am)$/, 'Instagramu'],
  [/(^|\.)tiktok\.com$/, 'TikToku'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)(facebook\.com|fb\.watch)$/, 'Facebooku'],
];

/** Název receptu uloženého jen jako odkaz: „Recept z Instagramu", jinak „Recept z web.cz". */
export function linkRecipeName(url: string): string {
  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`).hostname;
  } catch {
    return 'Recept z odkazu';
  }
  host = host.toLowerCase().replace(/^(www|m)\./, '');
  const site = SITE_NAMES.find(([pattern]) => pattern.test(host));
  if (site) return `Recept z ${site[1]}`;
  return host ? `Recept z ${host}` : 'Recept z odkazu';
}
