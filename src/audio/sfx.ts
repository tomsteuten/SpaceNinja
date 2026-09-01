/**
 * Two synthesised sound cues: collecting something, and finishing a mission.
 *
 * Generated with the Web Audio API so the project still ships no binary assets, and
 * entirely optional in the same way as narration.ts — if the API is missing, or the
 * browser refuses to start a context, every method becomes a silent no-op and the game
 * is unaffected. Nothing here ever throws at the caller.
 *
 * Deliberately quiet and soft-edged: the target device is a tablet speaker in a small
 * child's hands, so everything runs through a low master gain and a lowpass.
 */

export interface Sfx {
  /** False when Web Audio is absent. Nothing needs to branch on it; calls just no-op. */
  readonly available: boolean;
  /**
   * Create or resume the context. Mobile browsers start audio suspended and only allow
   * it to resume inside a user gesture, so call this from a button press.
   */
  resume(): void;
  /** One rung of the collect chime. `step` (0-based) of `total` raises the pitch. */
  collect(step: number, total: number): void;
  success(): void;
  dispose(): void;
}

type AudioContextConstructor = new () => AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  // Read off the object rather than the global: older iOS only has the prefixed one,
  // and lib.dom declares the unprefixed name as always-present.
  const w = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** C major pentatonic. Any subset of it sounds resolved, so wrong order still sounds nice. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0];

export function createSfx(): Sfx {
  const Ctor = audioContextConstructor();
  const available = Ctor !== null;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let failed = false;

  /** Returns a running-ish context, or null if audio is unavailable in any way. */
  function ensure(): AudioContext | null {
    if (!Ctor || failed) return null;
    if (!ctx) {
      try {
        const created = new Ctor();
        const gain = created.createGain();
        gain.gain.value = 0.2; // small children, tablet speaker: quiet by default
        const soften = created.createBiquadFilter();
        soften.type = 'lowpass';
        soften.frequency.value = 2800;
        gain.connect(soften);
        soften.connect(created.destination);
        ctx = created;
        master = gain;
      } catch {
        failed = true;
        return null;
      }
    }
    if (ctx.state === 'suspended') {
      // Rejects when called outside a gesture. That is fine — the next tap tries again.
      void ctx.resume().catch(() => undefined);
    }
    return ctx;
  }

  /**
   * One enveloped note. Exponential ramps (never to exact zero, which is undefined for
   * them) give a bell-like tail rather than a click.
   */
  function tone(
    at: number,
    frequency: number,
    duration: number,
    peak: number,
    type: OscillatorType = 'sine',
  ) {
    const context = ctx;
    const out = master;
    if (!context || !out) return;

    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(peak, at + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env);
    env.connect(out);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
    try {
      osc.start(at);
      osc.stop(at + duration + 0.03);
    } catch {
      // A context that died between ensure() and here. Nothing to recover, stay silent.
    }
  }

  return {
    available,

    resume() {
      ensure();
    },

    collect(step: number, total: number) {
      const context = ensure();
      if (!context) return;
      const span = Math.max(1, total - 1);
      const index = Math.min(
        SCALE.length - 1,
        Math.max(0, Math.round((Math.max(0, step) / span) * (SCALE.length - 1))),
      );
      const root = SCALE[index] ?? SCALE[0] ?? 523.25;
      const now = context.currentTime;
      tone(now, root, 0.5, 0.5);
      // A quiet octave on top gives it sparkle without raising the perceived loudness.
      tone(now + 0.012, root * 2, 0.34, 0.14, 'triangle');
    },

    success() {
      const context = ensure();
      if (!context) return;
      const now = context.currentTime;
      const notes = [SCALE[0], SCALE[2], SCALE[3], (SCALE[0] ?? 523.25) * 2];
      notes.forEach((frequency, i) => {
        if (!frequency) return;
        tone(now + i * 0.11, frequency, 0.62, 0.42, 'triangle');
      });
      // Soft pad underneath so the arpeggio lands on something rather than in silence.
      tone(now, (SCALE[0] ?? 523.25) / 2, 1.1, 0.16);
    },

    dispose() {
      const context = ctx;
      ctx = null;
      master = null;
      if (!context) return;
      try {
        void context.close().catch(() => undefined);
      } catch {
        // Already closed.
      }
    },
  };
}
