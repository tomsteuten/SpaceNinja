/**
 * Every sound the game makes: two cues, the engine, and the sunrise.
 *
 * Generated with the Web Audio API so the project still ships no binary assets, and
 * entirely optional in the same way as narration.ts — if the API is missing, or the
 * browser refuses to start a context, every method becomes a silent no-op and the game
 * is unaffected. Nothing here ever throws at the caller.
 *
 * Deliberately quiet and soft-edged: the target device is a tablet speaker in a small
 * child's hands, so everything runs through a low master gain and a lowpass.
 *
 * **The two continuous sounds are driven per frame, not scheduled.** `thruster` and
 * `dawn` take a value the picture is already using and follow it, rather than starting a
 * timed ramp of their own. That is deliberate: `Stage.tick` clamps dt to 0.05s, so on a
 * struggling tablet a flight takes longer in wall-clock than it does in flight-time, and
 * anything scheduled against the audio clock would finish early and leave the ship
 * gliding home in silence. Following the value costs a parameter set per frame and cannot
 * drift.
 *
 * **`prefers-reduced-motion` mutes nothing here, deliberately.** The preference is about
 * discomfort from *movement* — vestibular, not auditory — and silencing sound for it
 * answers a question nobody asked. It no longer shortens these moments either (it used to,
 * and that was worse: the same camera move played fast is more motion per second, not
 * less). Following a normalised value rather than a clock is still what keeps the sound
 * with the picture when the frame rate drops, which is the case that actually happens.
 * If sound should be silenceable, that wants its own control, not this flag.
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
  /**
   * The engine, while a flight is running. Call every frame with the same throttle the
   * exhaust is drawn from and the same cruise value the view widens on; a throttle of 0
   * fades it out and takes the nodes down. Building and stopping are handled here, so the
   * caller only ever reports what the ship is doing.
   */
  thruster(throttle: number, cruise: number): void;
  /**
   * The day turn, as the light comes round. Call every frame the turn is active with its
   * progress: 0 through the camera swing, then 0 → 1 across the turn itself.
   */
  dawn(progress: number): void;
  /**
   * Silence, or not. A muted context is still built and still driven — only the master
   * gain goes to zero — so unmuting takes effect on the very next frame without having to
   * find a user gesture again, which on mobile is not a thing that can be arranged on
   * demand.
   */
  setMuted(muted: boolean): void;
  /**
   * Stops everything continuous, now. Cues already ringing are left to ring out — they
   * are short and stopping them mid-tail is what a click sounds like.
   *
   * Every stateful module owns a reset() and main.ts is the only caller; without this one
   * a Fly Home mid-flight would leave the engine running for the rest of the session.
   */
  reset(): void;
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

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/* --- the engine ----------------------------------------------------------- */

/*
 * The flight computes two curves and they are not the same shape, which decides what the
 * engine can be driven by. `thrust` is a plateau — up over the first 14% of the flight and
 * down over the last 16% — and it is what the exhaust trail and the ship's own glow are
 * drawn from. `cruise` is a bell peaking in the middle, and it drives the chase camera
 * closing in and the field-of-view punch.
 *
 * So: level follows `thrust`, because that is the flame you can see, and gaining the
 * engine by the bell instead would fade it to silence while the exhaust is still plainly
 * firing at both ends of the trip. Timbre follows `cruise`, because that is the speed you
 * can see. Neither is a new curve invented for the sound, so the sound cannot disagree
 * with the picture.
 */

/** Ceiling for the engine, under the master gain again. It plays under everything else. */
const THRUSTER_PEAK = 0.42;

export function thrusterGain(throttle: number): number {
  // Not linear. Loudness is roughly a power law, so a linear gain sounds like it reaches
  // full almost immediately and then has nowhere left to go through the whole cruise.
  return THRUSTER_PEAK * Math.pow(clamp01(throttle), 0.7);
}

/** Hz. Opens up at cruise, which is the same thing the widening view is saying. */
export function thrusterCutoff(cruise: number): number {
  return 320 + 830 * clamp01(cruise);
}

/** Hz. The rumble underneath, rising by about a fifth across the cruise. */
export function thrusterPitch(cruise: number): number {
  return 48 + 22 * clamp01(cruise);
}

/* --- the day turn --------------------------------------------------------- */

/*
 * A pad that brightens and lifts, and six bells climbing the same pentatonic the collect
 * chime uses, so this belongs to the same instrument as everything else in the game.
 *
 * The pad sits two octaves below the chime, on the root and the fifth, and glides up a
 * whole tone across the turn: C+G becomes D+A, both still in the scale, so the rise
 * resolves rather than souring. It is one gesture with a beginning and an end — a moment,
 * not a loop that has to be faded out of.
 */

const DAWN_ROOT = (SCALE[0] ?? 523.25) / 4;
/** Climbing to the octave, so the turn lands somewhere rather than stopping. */
const DAWN_BELLS = [...SCALE, (SCALE[0] ?? 523.25) * 2];

/** Level of the pad. Swells a little as the light comes round, never loud. */
export function dawnLevel(progress: number): number {
  return 0.07 + 0.06 * clamp01(progress);
}

/** Hz. The brightening, which is the sound of the terminator crossing the disc. */
export function dawnCutoff(progress: number): number {
  return 220 + 1280 * clamp01(progress);
}

/** Multiplier on the pad's root: a whole tone up across the whole turn. */
export function dawnPitch(progress: number): number {
  return 1 + 0.1225 * clamp01(progress);
}

/**
 * Which bell `progress` has reached, or -1 before the turn starts moving.
 *
 * The caller rings one when this *increases*, so the bells are spaced by how far the
 * planet has actually turned rather than by a timer — a slow tablet stretches the turn and
 * the bells stretch with it. -1 for a progress of exactly 0 is what keeps the camera
 * swing silent apart from the pad: nothing has turned yet, so nothing has arrived.
 */
export function dawnBell(progress: number): number {
  if (progress <= 0) return -1;
  return Math.min(DAWN_BELLS.length - 1, Math.floor(clamp01(progress) * DAWN_BELLS.length));
}

/**
 * A sound that runs until it is told to stop, and the handful of things about it that get
 * moved while it does. `sources` is everything that needs stopping — the oscillators are
 * in there too, and are listed separately only because their pitch is driven.
 */
interface Voice {
  level: GainNode;
  filter: BiquadFilterNode;
  oscillators: OscillatorNode[];
  sources: AudioScheduledSourceNode[];
}

/**
 * How fast a driven parameter chases the value it was given, in seconds.
 *
 * Assigning `.value` sixty times a second steps the parameter, and a stepped gain is
 * audible as a buzz on the signal it is gaining. setTargetAtTime glides instead, and at
 * this time constant it arrives well inside a frame, so the sound still tracks the picture.
 */
const FOLLOW = 0.02;

/** Small children, tablet speaker: quiet by default. Everything is mixed under this. */
const MASTER_GAIN = 0.2;

export function createSfx(): Sfx {
  const Ctor = audioContextConstructor();
  const available = Ctor !== null;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let failed = false;
  let muted = false;

  /** Returns a running-ish context, or null if audio is unavailable in any way. */
  function ensure(): AudioContext | null {
    if (!Ctor || failed) return null;
    if (!ctx) {
      try {
        const created = new Ctor();
        const gain = created.createGain();
        gain.gain.value = muted ? 0 : MASTER_GAIN;
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

  /**
   * Two seconds of white noise, looped. Made once and kept: it is the only allocation of
   * any size here, and a flight can start every time a child taps Fly.
   */
  function noiseBuffer(context: AudioContext): AudioBuffer | null {
    if (noise) return noise;
    try {
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 2), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      noise = buffer;
      return buffer;
    } catch {
      return null;
    }
  }

  /**
   * Fades a continuous voice out and takes it down.
   *
   * Never a bare disconnect: cutting a running oscillator at whatever point of its cycle
   * it happens to be at is a click, and a click on a tablet speaker is the loudest thing
   * in the game. The sources are stopped a little past the end of the fade, and each
   * disconnects itself in onended, so a caller that stops and immediately restarts cannot
   * leave the old graph attached.
   */
  function fadeOut(voice: Voice | null, release: number) {
    if (!voice || !ctx) return;
    const now = ctx.currentTime;
    try {
      voice.level.gain.cancelScheduledValues(now);
      voice.level.gain.setTargetAtTime(0, now, release);
      for (const source of voice.sources) source.stop(now + release * 4 + 0.05);
    } catch {
      // A context that died under us. The nodes go with it; nothing to recover.
    }
  }

  /** Null whenever the sound is not running. Nothing else records that it is. */
  let engine: Voice | null = null;
  let sunrise: Voice | null = null;
  let lastBell = -1;

  function startEngine(context: AudioContext, out: GainNode): Voice | null {
    const buffer = noiseBuffer(context);
    if (!buffer) return null;
    try {
      // Rush and rumble through one filter, so they open up together and read as a single
      // engine rather than as a hiss with a note behind it.
      const colour = context.createBiquadFilter();
      colour.type = 'lowpass';
      colour.frequency.value = thrusterCutoff(0);
      colour.Q.value = 0.9;

      const level = context.createGain();
      level.gain.value = 0;

      const rush = context.createBufferSource();
      rush.buffer = buffer;
      rush.loop = true;
      const rushLevel = context.createGain();
      rushLevel.gain.value = 0.5;

      const rumble = context.createOscillator();
      rumble.type = 'sawtooth';
      rumble.frequency.value = thrusterPitch(0);
      const rumbleLevel = context.createGain();
      rumbleLevel.gain.value = 0.62;

      rush.connect(rushLevel).connect(colour);
      rumble.connect(rumbleLevel).connect(colour);
      colour.connect(level).connect(out);

      const nodes = [colour, level, rushLevel, rumbleLevel];
      const sources = [rush, rumble];
      for (const source of sources) {
        source.onended = () => {
          source.disconnect();
          for (const node of nodes) node.disconnect();
        };
      }
      rush.start();
      rumble.start();
      return { level, filter: colour, oscillators: [rumble], sources };
    } catch {
      return null;
    }
  }

  function startSunrise(context: AudioContext, out: GainNode): Voice | null {
    try {
      const colour = context.createBiquadFilter();
      colour.type = 'lowpass';
      colour.frequency.value = dawnCutoff(0);
      colour.Q.value = 0.7;

      const level = context.createGain();
      // Starts silent and is walked up to dawnLevel() every frame from here. The swing
      // takes 2.2 seconds, so the pad is already breathing by the time anything turns.
      level.gain.value = 0.0001;

      const oscillators: OscillatorNode[] = [];
      const nodes = [colour, level];
      // Root and fifth, the upper one detuned a few cents so the pair beats slowly
      // against each other instead of sitting still.
      for (const [ratio, detune] of [
        [1, 0],
        [1.5, 6],
      ] as const) {
        const osc = context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = DAWN_ROOT * ratio;
        osc.detune.value = detune;
        osc.connect(colour);
        oscillators.push(osc);
      }

      colour.connect(level).connect(out);
      for (const osc of oscillators) {
        osc.onended = () => {
          osc.disconnect();
          for (const node of nodes) node.disconnect();
        };
        osc.start();
      }
      return { level, filter: colour, oscillators, sources: oscillators };
    } catch {
      return null;
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

    thruster(throttle: number, cruise: number) {
      // Nothing to build for a ship that is not burning. This is also the whole of the
      // stop path: the flight reports a throttle of 0 when it arrives.
      if (!(throttle > 0)) {
        if (engine) {
          fadeOut(engine, 0.05);
          engine = null;
        }
        return;
      }

      const context = ensure();
      if (!context || !master) return;
      if (!engine) engine = startEngine(context, master);
      const voice = engine;
      if (!voice) return;

      const now = context.currentTime;
      try {
        voice.level.gain.setTargetAtTime(thrusterGain(throttle), now, FOLLOW);
        voice.filter.frequency.setTargetAtTime(thrusterCutoff(cruise), now, FOLLOW);
        for (const osc of voice.oscillators) {
          osc.frequency.setTargetAtTime(thrusterPitch(cruise), now, FOLLOW);
        }
      } catch {
        // Context died mid-flight. Drop the voice so the next frame builds a fresh one.
        engine = null;
      }
    },

    dawn(progress: number) {
      const context = ensure();
      if (!context || !master) return;
      if (!sunrise) {
        sunrise = startSunrise(context, master);
        lastBell = -1;
      }
      const voice = sunrise;
      if (!voice) return;

      const now = context.currentTime;
      const p = clamp01(progress);
      try {
        // A longer follow than the engine: this is a pad swelling, and chasing it as
        // tightly would put the frame rate into the sound.
        voice.level.gain.setTargetAtTime(dawnLevel(p), now, 0.25);
        voice.filter.frequency.setTargetAtTime(dawnCutoff(p), now, 0.25);
        for (const [i, osc] of voice.oscillators.entries()) {
          osc.frequency.setTargetAtTime(DAWN_ROOT * (i === 0 ? 1 : 1.5) * dawnPitch(p), now, 0.25);
        }
      } catch {
        sunrise = null;
        return;
      }

      const bell = dawnBell(p);
      if (bell > lastBell) {
        lastBell = bell;
        tone(now, DAWN_BELLS[bell] ?? DAWN_ROOT, 1.3, 0.2, 'triangle');
      }

      // The turn is over. A long release rather than a stop, so the last bell rings out
      // over a pad that is going rather than one that went.
      if (p >= 1) {
        fadeOut(voice, 0.35);
        sunrise = null;
        lastBell = -1;
      }
    },

    setMuted(value: boolean) {
      muted = value;
      const context = ctx;
      const out = master;
      if (!context || !out) return; // Nothing built yet; ensure() will honour the flag.
      try {
        // Ramped rather than assigned: cutting a running engine to zero in one sample is
        // a click, which on a tablet speaker is louder than the thing being silenced.
        out.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, context.currentTime, 0.03);
      } catch {
        // Context died. It will come back with the flag applied.
      }
    },

    reset() {
      fadeOut(engine, 0.05);
      engine = null;
      // Quicker than the release a finished turn gets: this is Fly Home, and the sound of
      // the thing being left should not follow the child out of it.
      fadeOut(sunrise, 0.08);
      sunrise = null;
      lastBell = -1;
    },

    dispose() {
      const context = ctx;
      engine = null;
      sunrise = null;
      lastBell = -1;
      noise = null;
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
