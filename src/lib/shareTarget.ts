/**
 * Sdílení DO appky (Web Share Target, manifest `share_target`). Android otevře
 * `vlozit?title=…&text=…&url=…`; každá appka plní pole jinak (WhatsApp jen `text`,
 * Keep `title` + `text`, prohlížeč `title` + odkaz v `url` nebo v `text`).
 * Tady se z nich složí jeden text pro obrazovku Vložit.
 */

const URL_LINE = /^(?:https?:\/\/|www\.)\S+$/i;

/**
 * Text ke vložení, nebo null, když nic sdíleno nebylo. Když kromě odkazu nepřišel
 * žádný text, vrátí holé URL – obrazovka pak ukáže nápovědu „Odkaz neotevřu" (IG sdílí
 * jen odkaz, ne popisek). Odkaz vedle skutečného textu se zahodí, ať se z něj nestane
 * surovina nebo krok.
 */
export function sharedTextFromParams(params: URLSearchParams): string | null {
  const title = (params.get('title') ?? '').trim();
  const text = (params.get('text') ?? '').replace(/\r\n?/g, '\n').trim();
  const url = (params.get('url') ?? '').trim();

  const lines = text.split('\n');
  const links = lines.map((line) => line.trim()).filter((line) => URL_LINE.test(line));
  const body = lines
    .filter((line) => !URL_LINE.test(line.trim()))
    .join('\n')
    .trim();

  if (body === '') {
    // Jen titulek stránky + odkaz: recept z titulku by byl prázdný → raději nápověda.
    const link = url || links[0] || '';
    if (link !== '') return link;
    return title === '' ? null : title;
  }

  const firstLine = body.split('\n')[0].trim();
  if (title !== '' && firstLine !== title) return `${title}\n${body}`;
  return body;
}
