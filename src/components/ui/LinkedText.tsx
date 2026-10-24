import { splitLinks } from '../../lib/links';

/** Text s klikacími odkazy (např. recept uložený jako odkaz na reel). Otevírá se mimo appku. */
export default function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, index) =>
        part.href ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-brand underline dark:text-amber-400"
          >
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
