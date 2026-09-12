/**
 * Review testy UC029 (reviewer) – pořadí a ořez štítků v `CollapsibleTags`.
 *
 * Logika pořadí/capů je uvnitř komponenty (není exportovaná jako čistá funkce),
 * proto ji ověřujeme přes `react-dom/server` (už je závislostí – žádný nový balík,
 * žádné @testing-library, běží v `environment: node`). Renderujeme VÝCHOZÍ (sbalený)
 * stav; interakci s toggle neklikáme (to by chtělo DOM) – testujeme čistou logiku,
 * kterou SSR spolehlivě pokryje: pořadí, viditelnost ve sbaleném stavu, počet „+N".
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CollapsibleTags from './CollapsibleTags';

type Props = {
  tags: string[];
  activeTag: string | null;
  counts: Record<string, number>;
  onToggleTag: (tag: string) => void;
};

function render(props: Omit<Props, 'onToggleTag'>): string {
  return renderToStaticMarkup(createElement(CollapsibleTags, { ...props, onToggleTag: () => {} }));
}

/** Vrátí štítky v pořadí, v jakém jsou v DOM, spolu s třídou jejich wrapperu. */
function chips(html: string): Array<{ tag: string; wrapperClass: string }> {
  const re = /<span class="([^"]*)"><button[^>]*>([^<]+)<\/button><\/span>/g;
  const out: Array<{ tag: string; wrapperClass: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push({ wrapperClass: m[1], tag: m[2] });
  return out;
}

describe('CollapsibleTags – pořadí štítků (Rozhodnutí 2026-09-12, bod 4)', () => {
  it('aktivní první i s nejnižším počtem, pak počet sestupně, při shodě localeCompare(cs)', () => {
    // avokádo má nejnižší počet (1) – přesto musí být PRVNÍ, protože je aktivní.
    // brambory a cuketa mají shodu (9) → abecedně brambory < cuketa.
    const tags = ['avokádo', 'brambory', 'cuketa', 'dýně', 'eidam', 'fazole', 'guláš'];
    const counts = { avokádo: 1, brambory: 9, cuketa: 9, dýně: 2, eidam: 5, fazole: 3, guláš: 7 };
    const order = chips(render({ tags, activeTag: 'avokádo', counts })).map((c) => c.tag);
    expect(order).toEqual(['avokádo', 'brambory', 'cuketa', 'guláš', 'eidam', 'fazole', 'dýně']);
  });

  it('bez aktivního štítku řadí čistě podle počtu, shoda abecedně', () => {
    const tags = ['losos', 'kuře', 'tofu'];
    const counts = { losos: 2, kuře: 2, tofu: 5 };
    const order = chips(render({ tags, activeTag: null, counts })).map((c) => c.tag);
    expect(order).toEqual(['tofu', 'kuře', 'losos']);
  });

  it('chybějící počet ve `counts` se bere jako 0 (nespadne, seřadí abecedně)', () => {
    const tags = ['beta', 'alfa'];
    const order = chips(render({ tags, activeTag: null, counts: {} })).map((c) => c.tag);
    expect(order).toEqual(['alfa', 'beta']);
  });
});

describe('CollapsibleTags – sbalení a toggle (Rozhodnutí bod 4, AK „1–2 řádky")', () => {
  it('≤ MOBILE_CAP (6) štítků: vše viditelné, žádný toggle', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f'];
    const html = render({ tags, activeTag: null, counts: {} });
    // Žádný chip není skrytý a nikde není přepínač.
    expect(chips(html).every((c) => !c.wrapperClass.includes('hidden'))).toBe(true);
    expect(html).not.toContain('dalších');
    expect(html).not.toContain('Méně');
  });

  it('7 štítků: 7. je na desktopu vidět (hidden sm:inline-flex), na mobilu skryt; jen mobilní toggle +1', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const html = render({ tags, activeTag: null, counts: {} });
    const cs = chips(html);
    // Prvních 6 vidět všude, 7. jen na desktopu.
    expect(cs.slice(0, 6).every((c) => c.wrapperClass === '')).toBe(true);
    expect(cs[6].wrapperClass).toContain('hidden');
    expect(cs[6].wrapperClass).toContain('sm:inline-flex');
    // Mobilní toggle (+1 další) ano, desktopní ne (7 ≤ 16). Plurál: 1 → „další".
    expect(html).toContain('+1 další');
    expect(html).toContain('sm:hidden');
    expect(html).not.toContain('hidden sm:inline-flex" aria-expanded');
  });

  it('> DESKTOP_CAP (17 štítků): dva toggly s odlišným počtem (+11 mobil, +1 desktop)', () => {
    const tags = Array.from({ length: 17 }, (_, i) => `t${String(i).padStart(2, '0')}`);
    const html = render({ tags, activeTag: null, counts: {} });
    expect(html).toContain('+11 dalších'); // 17 - 6 → 5+ → „dalších"
    expect(html).toContain('+1 další'); // 17 - 16 → 1 → „další"
  });
});

describe('CollapsibleTags – a11y a prázdný stav', () => {
  it('toggle má aria-expanded="false" a aria-controls míří na id seznamu', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const html = render({ tags, activeTag: null, counts: {} });
    const listId = html.match(/<div id="([^"]+)"/)?.[1];
    const controls = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(listId).toBeTruthy();
    expect(controls).toBe(listId);
    expect(html).toContain('aria-expanded="false"');
  });

  it('0 štítků → komponenta nevykreslí nic (řádek ani toggle)', () => {
    expect(render({ tags: [], activeTag: null, counts: {} })).toBe('');
  });
});
