/**
 * Zvonění časovače (§7) přes Web Audio – žádný zvukový soubor. Zvoní opakovaně,
 * dokud se nezastaví (§7: „zvonění, které neutichne po dvou vteřinách").
 * AudioContext se musí odemknout z uživatelského gesta → `primeAlarm` volej při
 * založení časovače. Když zvuk prohlížeč nepovolí, tiše se nic nepřehraje (fallback
 * je velký vizuální odpočet na nezhasínajícím displeji).
 */

let ctx: AudioContext | null = null;
let loop: ReturnType<typeof setInterval> | null = null;

function ensureContext(): AudioContext | null {
  try {
    if (!ctx) {
      const win = window as typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? win.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Odemkne zvuk – volat z uživatelského gesta (klik na časovač). */
export function primeAlarm(): void {
  ensureContext();
}

function beep(): void {
  const audio = ensureContext();
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  gain.gain.value = 0.15;
  oscillator.connect(gain).connect(audio.destination);
  const start = audio.currentTime;
  oscillator.start(start);
  oscillator.stop(start + 0.25);
}

export function startAlarm(): void {
  if (loop != null) return;
  beep();
  loop = setInterval(beep, 700);
}

export function stopAlarm(): void {
  if (loop != null) {
    clearInterval(loop);
    loop = null;
  }
}
