import { describe, expect, it, vi } from 'vitest';
import { keepScreenAwake, type VisibilitySource, type WakeLockLike } from './wakeLock';

/** Podvržený `document`: nastavitelná viditelnost a ruční vyvolání `visibilitychange`. */
function fakeDocument(initial: DocumentVisibilityState = 'visible') {
  const listeners = new Set<() => void>();
  const doc: VisibilitySource & { visibilityState: DocumentVisibilityState } = {
    visibilityState: initial,
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
  function setVisibility(state: DocumentVisibilityState) {
    doc.visibilityState = state;
    for (const listener of [...listeners]) listener();
  }
  return { doc, setVisibility, listenerCount: () => listeners.size };
}

interface FakeSentinel {
  release: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

/** Podvržený `navigator.wakeLock`: počítá živé zámky, žádost jde nechat viset. */
function fakeWakeLock() {
  let live = 0;
  const sentinels: FakeSentinel[] = [];
  let pendingFinish: (() => void) | null = null;
  let holdNext = false;

  function makeSentinel(): FakeSentinel {
    let released = false;
    live += 1;
    const sentinel: FakeSentinel = {
      release: vi.fn(async () => {
        if (released) return;
        released = true;
        live -= 1;
      }),
    };
    sentinels.push(sentinel);
    return sentinel;
  }

  const request = vi.fn(
    () =>
      new Promise<FakeSentinel>((resolve) => {
        const finish = () => resolve(makeSentinel());
        if (holdNext) {
          holdNext = false;
          pendingFinish = finish;
        } else {
          finish();
        }
      }),
  );
  const wakeLock: WakeLockLike = { request };

  return {
    wakeLock,
    request,
    sentinels,
    liveCount: () => live,
    /** Další žádost nechá viset; vrátí funkci, která ji dokončí. */
    hold(): () => void {
      holdNext = true;
      return () => pendingFinish?.();
    },
    /** Systém zámek uvolní sám (zamknutí telefonu, úspora baterie). */
    systemRelease() {
      for (const sentinel of sentinels) void sentinel.release();
    },
  };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('keepScreenAwake', () => {
  it('ve viditelné appce požádá o zámek jednou', async () => {
    const { doc } = fakeDocument();
    const lock = fakeWakeLock();
    keepScreenAwake(lock.wakeLock, doc);
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(1);
    expect(lock.request).toHaveBeenCalledWith('screen');
    expect(lock.liveCount()).toBe(1);
  });

  it('visible → hidden (systém uvolní) → visible: požádá podruhé', async () => {
    const { doc, setVisibility } = fakeDocument();
    const lock = fakeWakeLock();
    keepScreenAwake(lock.wakeLock, doc);
    await flush();
    lock.systemRelease();
    setVisibility('hidden');
    await flush();
    setVisibility('visible');
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(2);
    expect(lock.liveCount()).toBe(1);
  });

  it('i když systém zámek při skrytí neuvolní, appka ho uvolní sama', async () => {
    const { doc, setVisibility } = fakeDocument();
    const lock = fakeWakeLock();
    keepScreenAwake(lock.wakeLock, doc);
    await flush();
    setVisibility('hidden');
    await flush();
    expect(lock.sentinels[0].release).toHaveBeenCalledTimes(1);
    expect(lock.liveCount()).toBe(0);
  });

  it('tři návraty po sobě: zámek po každém znovu, nikdy víc než jeden živý', async () => {
    const { doc, setVisibility } = fakeDocument();
    const lock = fakeWakeLock();
    keepScreenAwake(lock.wakeLock, doc);
    await flush();
    for (let i = 0; i < 3; i += 1) {
      setVisibility('hidden');
      await flush();
      expect(lock.liveCount()).toBe(0);
      setVisibility('visible');
      await flush();
      expect(lock.liveCount()).toBe(1);
    }
    expect(lock.request).toHaveBeenCalledTimes(4);
  });

  it('stop() zámek uvolní a po návratu z pozadí už o něj nežádá', async () => {
    const { doc, setVisibility, listenerCount } = fakeDocument();
    const lock = fakeWakeLock();
    const stop = keepScreenAwake(lock.wakeLock, doc);
    await flush();
    stop();
    await flush();
    expect(lock.liveCount()).toBe(0);
    expect(listenerCount()).toBe(0);
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(1);
  });

  it('bez Wake Lock API nic nevyhodí', async () => {
    const { doc, setVisibility } = fakeDocument();
    const stop = keepScreenAwake(undefined, doc);
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(() => stop()).not.toThrow();
  });

  it('odmítnutá žádost: tiše bez zámku a bez dalšího pokusu do příštího návratu', async () => {
    const { doc, setVisibility } = fakeDocument();
    const request = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    keepScreenAwake({ request }, doc);
    await flush();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('systém uvolní zámek ve viditelné appce → žádná nová žádost hned (P2-1)', async () => {
    const { doc } = fakeDocument();
    const lock = fakeWakeLock();
    keepScreenAwake(lock.wakeLock, doc);
    await flush();
    lock.systemRelease();
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(1);
  });

  it('skrytá appka při startu o zámek nežádá, až po návratu', async () => {
    const { doc, setVisibility } = fakeDocument('hidden');
    const lock = fakeWakeLock();
    keepScreenAwake(lock.wakeLock, doc);
    await flush();
    expect(lock.request).not.toHaveBeenCalled();
    setVisibility('visible');
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(1);
  });

  it('závod: žádost doběhne až po skrytí → zámek se hned uvolní, po návratu nová žádost', async () => {
    const { doc, setVisibility } = fakeDocument();
    const lock = fakeWakeLock();
    const finish = lock.hold();
    keepScreenAwake(lock.wakeLock, doc);
    setVisibility('hidden');
    finish();
    await flush();
    expect(lock.liveCount()).toBe(0);
    setVisibility('visible');
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(2);
    expect(lock.liveCount()).toBe(1);
  });

  it('závod: hidden → visible během visící žádosti, která se pak splní → starý zámek pryč, nový jeden', async () => {
    const { doc, setVisibility } = fakeDocument();
    const lock = fakeWakeLock();
    const finish = lock.hold();
    keepScreenAwake(lock.wakeLock, doc);
    setVisibility('hidden');
    setVisibility('visible');
    finish();
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(2);
    expect(lock.sentinels[0].release).toHaveBeenCalled();
    expect(lock.liveCount()).toBe(1);
  });

  it('stop() během visící žádosti → po jejím doběhnutí uvolněno', async () => {
    const { doc } = fakeDocument();
    const lock = fakeWakeLock();
    const finish = lock.hold();
    const stop = keepScreenAwake(lock.wakeLock, doc);
    stop();
    finish();
    await flush();
    expect(lock.liveCount()).toBe(0);
  });
});
