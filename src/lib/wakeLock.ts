/**
 * Zámek displeje (Screen Wake Lock) pro režim vaření (E-15) – čistá logika bez globálů.
 * `navigator.wakeLock` a `document` dodá volající (hook `useWakeLock`), v testu podvrhy.
 */

export interface WakeLockSentinelLike {
  release(): Promise<void>;
}
export interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}
export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

function releaseQuietly(sentinel: WakeLockSentinelLike): void {
  // Uvolnění už uvolněného zámku je neškodné; chyba tu nemá komu co říct.
  void sentinel.release().catch(() => {});
}

/**
 * Drží displej rozsvícený, dokud se nezavolá vrácená funkce `stop`. Při skrytí appky
 * zámek sám uvolní a zapomene (prohlížeč ho stejně pouští), po návratu požádá znovu.
 * Když ho systém uvolní ve viditelné appce, znovu se nežádá hned, až po příštím návratu
 * (ochrana proti smyčce při úspoře baterie). Chybějící API nebo odmítnutí = tiše bez zámku.
 */
export function keepScreenAwake(
  wakeLock: WakeLockLike | undefined,
  doc: VisibilitySource,
): () => void {
  let stopped = false;
  let pending = false;
  let sentinel: WakeLockSentinelLike | null = null;
  // Počítadlo skrytí: žádost, během které appka odešla do pozadí, už neplatí.
  let generation = 0;

  async function acquire() {
    if (stopped || pending || !wakeLock || sentinel || doc.visibilityState !== 'visible') return;
    pending = true;
    const started = generation;
    try {
      const next = await wakeLock.request('screen');
      // Žádost doběhla po odchodu z vaření nebo po skrytí appky (i když se mezitím vrátila) → nedržet.
      if (stopped || generation !== started || doc.visibilityState !== 'visible')
        releaseQuietly(next);
      else sentinel = next;
    } catch {
      // nepodporováno nebo odmítnuto – bez wake locku, nevadí (fallback)
    } finally {
      pending = false;
    }
    // Appka během visící žádosti odešla a vrátila se: to je nový návrat, požádat znovu.
    // Bez skrytí mezi tím se po odmítnutí neopakuje (P2-1, žádná smyčka).
    if (generation !== started) void acquire();
  }

  function onVisibilityChange() {
    if (doc.visibilityState === 'visible') {
      void acquire();
      return;
    }
    generation += 1;
    if (sentinel) releaseQuietly(sentinel);
    sentinel = null;
  }

  doc.addEventListener('visibilitychange', onVisibilityChange);
  void acquire();

  return () => {
    stopped = true;
    doc.removeEventListener('visibilitychange', onVisibilityChange);
    if (sentinel) releaseQuietly(sentinel);
    sentinel = null;
  };
}
