import { describe, expect, it, vi } from 'vitest';
import { keepScreenAwake, type VisibilitySource, type WakeLockSentinelLike } from './wakeLock';

/** Review: závody žádosti o zámek se změnou viditelnosti. */

function fakeDocument() {
  const listeners = new Set<() => void>();
  const doc: VisibilitySource & { visibilityState: DocumentVisibilityState } = {
    visibilityState: 'visible',
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
  };
  return {
    doc,
    setVisibility(state: DocumentVisibilityState) {
      doc.visibilityState = state;
      for (const listener of [...listeners]) listener();
    },
  };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('keepScreenAwake – závody (review)', () => {
  // Review nález 🔵 (opraveno počítadlem generací v keepScreenAwake).
  it('rychlé hidden → visible během visící žádosti, která pak selže: po návratu požádá znovu', async () => {
    const { doc, setVisibility } = fakeDocument();
    let rejectFirst: (error: Error) => void = () => {};
    const request = vi
      .fn<(type: 'screen') => Promise<WakeLockSentinelLike>>()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockImplementation(async () => ({ release: async () => {} }));
    keepScreenAwake({ request }, doc);
    setVisibility('hidden');
    setVisibility('visible'); // acquire() se přeskočí – předchozí žádost pořád visí
    rejectFirst(new Error('NotAllowedError: document hidden'));
    await flush();
    // Appka je vidět a skrytí proběhlo během žádosti → nový pokus.
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('opakované visible bez hidden (některé prohlížeče posílají duplicitně) nežádá podruhé', async () => {
    const { doc, setVisibility } = fakeDocument();
    const request = vi.fn(async () => ({ release: async () => {} }));
    keepScreenAwake({ request }, doc);
    await flush();
    setVisibility('visible');
    setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('release() s chybou (už uvolněný zámek) se spolkne a návrat funguje', async () => {
    const { doc, setVisibility } = fakeDocument();
    const request = vi.fn(async () => ({ release: () => Promise.reject(new Error('už uvolněno')) }));
    const stop = keepScreenAwake({ request }, doc);
    await flush();
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    stop();
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });
});

/** Žádosti, které se dají dokončit ručně v libovolném pořadí; počítá živé zámky. */
function controllableLock() {
  let live = 0;
  let maxLive = 0;
  const pending: { resolve: () => void; reject: () => void }[] = [];
  const request = vi.fn(
    () =>
      new Promise<WakeLockSentinelLike>((resolve, reject) => {
        pending.push({
          resolve: () => {
            let released = false;
            live += 1;
            maxLive = Math.max(maxLive, live);
            resolve({
              release: async () => {
                if (released) return;
                released = true;
                live -= 1;
              },
            });
          },
          reject: () => reject(new Error('NotAllowedError')),
        });
      }),
  );
  return {
    request,
    pending,
    live: () => live,
    maxLive: () => maxLive,
  };
}

describe('keepScreenAwake – druhé kolo (review)', () => {
  it('P2-1: odmítnutí ve viditelné appce (bez skrytí) se neopakuje', async () => {
    const { doc } = fakeDocument();
    const lock = controllableLock();
    keepScreenAwake({ request: lock.request }, doc);
    lock.pending.shift()?.reject();
    for (let i = 0; i < 5; i += 1) await flush();
    expect(lock.request).toHaveBeenCalledTimes(1);
  });

  it('P2-1: systém odmítá vždy; počet žádostí = 1 + počet návratů, žádná smyčka', async () => {
    const { doc, setVisibility } = fakeDocument();
    const request = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    keepScreenAwake({ request }, doc);
    for (let i = 0; i < 3; i += 1) {
      await flush();
      setVisibility('hidden');
      setVisibility('visible');
    }
    for (let i = 0; i < 5; i += 1) await flush();
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('skrytí a návraty během visící žádosti: jedna žádost naráz, nejvýš jeden živý zámek', async () => {
    const { doc, setVisibility } = fakeDocument();
    const lock = controllableLock();
    keepScreenAwake({ request: lock.request }, doc);
    // Tři cykly skrytí/návratu, zatímco první žádost visí.
    for (let i = 0; i < 3; i += 1) {
      setVisibility('hidden');
      setVisibility('visible');
    }
    expect(lock.pending).toHaveLength(1); // nové žádosti se nevrší
    lock.pending.shift()?.resolve(); // zastaralá (skrytí během ní) → uvolní se
    await flush();
    expect(lock.live()).toBe(0);
    expect(lock.pending).toHaveLength(1); // jeden nový pokus po návratu
    // Během druhé žádosti zase skrytí a návrat.
    setVisibility('hidden');
    setVisibility('visible');
    lock.pending.shift()?.resolve();
    await flush();
    expect(lock.live()).toBe(0);
    lock.pending.shift()?.resolve(); // třetí žádost už bez skrytí → drží se
    await flush();
    expect(lock.live()).toBe(1);
    expect(lock.pending).toHaveLength(0);
    expect(lock.maxLive()).toBeLessThanOrEqual(1);
    expect(lock.request).toHaveBeenCalledTimes(3);
  });

  it('skrytí během žádosti a appka zůstane skrytá: zámek se nedrží ani nežádá znovu', async () => {
    const { doc, setVisibility } = fakeDocument();
    const lock = controllableLock();
    keepScreenAwake({ request: lock.request }, doc);
    setVisibility('hidden');
    lock.pending.shift()?.resolve();
    for (let i = 0; i < 3; i += 1) await flush();
    expect(lock.live()).toBe(0);
    expect(lock.request).toHaveBeenCalledTimes(1);
  });

  it('stop() během visící žádosti po skrytí a návratu: žádný nový pokus, nic živého', async () => {
    const { doc, setVisibility } = fakeDocument();
    const lock = controllableLock();
    const stop = keepScreenAwake({ request: lock.request }, doc);
    setVisibility('hidden');
    setVisibility('visible');
    stop();
    lock.pending.shift()?.resolve();
    for (let i = 0; i < 3; i += 1) await flush();
    expect(lock.live()).toBe(0);
    expect(lock.request).toHaveBeenCalledTimes(1);
  });
});
