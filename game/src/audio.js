// Tiny synthesised sounds (Web Audio, no audio files): a blip for a pour, a chime for a
// serve, a buzz for a mistake, a sizzle tick while something cooks. Created lazily on the
// first user gesture, so the browser's autoplay rules never block the game.

export function createAudio() {
  let context = null;
  let muted = false;
  let sizzleTimer = 0;

  function ensure() {
    if (context === null) {
      try {
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        context = Ctor ? new Ctor() : null;
      } catch {
        context = null;
      }
    }
    if (context !== null && context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freq, dur, type, gain, when = 0) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, gain, freq) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(amp).connect(ctx.destination);
    src.start(t0);
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; return muted; },
    /** A station finished cooking and is ready to take. */
    ready() { tone(880, 0.12, 'sine', 0.16); tone(1318, 0.18, 'sine', 0.14, 0.09); },
    /** Something was poured, dropped in or picked up. */
    blip() { tone(520, 0.07, 'triangle', 0.12); },
    pour() { noise(0.25, 0.1, 900); tone(340, 0.18, 'sine', 0.07); },
    /** A dish was served: coins. */
    serve() { tone(659, 0.1, 'sine', 0.16); tone(988, 0.22, 'sine', 0.16, 0.08); },
    /** Wrong dish, burnt food or a walkout. */
    error() { tone(180, 0.18, 'square', 0.08); tone(140, 0.22, 'square', 0.08, 0.1); },
    /** A new customer sat down. */
    arrive() { tone(392, 0.09, 'triangle', 0.1); tone(523, 0.12, 'triangle', 0.1, 0.08); },
    /** Short sizzle tick while the pot or fryer is busy; call once per frame, it throttles itself. */
    sizzle(dt) {
      sizzleTimer -= dt;
      if (sizzleTimer <= 0) {
        sizzleTimer = 0.28;
        noise(0.08, 0.03, 3200);
      }
    },
  };
}
