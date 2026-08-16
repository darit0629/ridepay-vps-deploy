// Synthesizes a repeating two-tone alarm beep with the Web Audio API instead
// of shipping an external audio file — no asset to source/license, and it
// works offline. Used to alert a driver that a new ride request has come in.
let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

function beep(ctx: AudioContext, atTime: number, freq: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, atTime);
  gain.gain.exponentialRampToValueAtTime(0.22, atTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, atTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(atTime);
  osc.stop(atTime + duration);
}

/**
 * Starts a repeating "new ride" alarm pattern (two quick beeps, repeated
 * roughly once a second) and returns a stop function. Safe to call the
 * stop function multiple times or after the pattern has already finished.
 */
export function playNewRideAlarm(repeats = 12): () => void {
  const ctx = getContext();
  if (!ctx) return () => {};
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  let stopped = false;
  const startedAt = ctx.currentTime;
  const patternSeconds = 1.1;

  for (let i = 0; i < repeats; i++) {
    const base = startedAt + i * patternSeconds;
    beep(ctx, base, 880, 0.18);
    beep(ctx, base + 0.22, 1175, 0.18);
  }

  return () => {
    if (stopped) return;
    stopped = true;
    // Mute anything still scheduled by ramping the whole context's future
    // output down isn't possible per-node after the fact, so instead we
    // simply suspend the context — halts all pending scheduled sound.
    ctx.suspend().catch(() => {});
  };
}
