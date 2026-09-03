/**
 * What can honestly be checked about sound from a machine that cannot play any.
 *
 * Not whether it sounds good — that is a property of a tablet speaker in a child's hands
 * and the only way to know is to listen. What *is* decidable here is the part that goes
 * wrong silently: a second engine layered on the first because a frame built one twice, a
 * voice that is faded but never stopped, a Fly Home that leaves the thruster running for
 * the rest of the session. Those are graph facts, and a fake AudioContext records them.
 *
 * The fake is installed as `window.AudioContext`, which is where sfx.ts looks, so nothing
 * in the module needs a seam for testing. The envelope maths is pinned separately as pure
 * functions, the way FlightSequence's easing is.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSfx,
  dawnBell,
  dawnCutoff,
  dawnLevel,
  dawnPitch,
  thrusterCutoff,
  thrusterGain,
  thrusterPitch,
} from './sfx';

/* --- a recording AudioContext --------------------------------------------- */

/** Every way of setting a param collapses to "the value it was last asked for". */
class FakeParam {
  readonly history: number[] = [];
  constructor(public value = 0) {}
  private to(target: number) {
    this.value = target;
    this.history.push(target);
    return this;
  }
  setValueAtTime(target: number) {
    return this.to(target);
  }
  setTargetAtTime(target: number) {
    return this.to(target);
  }
  linearRampToValueAtTime(target: number) {
    return this.to(target);
  }
  exponentialRampToValueAtTime(target: number) {
    return this.to(target);
  }
  cancelScheduledValues() {
    return this;
  }
  get last() {
    return this.history[this.history.length - 1] ?? this.value;
  }
}

class FakeNode {
  readonly outputs: FakeNode[] = [];
  disconnects = 0;
  constructor(readonly kind: string) {}
  connect(target: FakeNode) {
    this.outputs.push(target);
    return target;
  }
  disconnect() {
    this.disconnects++;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
  constructor() {
    super('gain');
  }
}

class FakeFilter extends FakeNode {
  type = 'lowpass';
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);
  constructor() {
    super('filter');
  }
}

class FakeSource extends FakeNode {
  starts = 0;
  stops = 0;
  onended: (() => void) | null = null;
  start() {
    this.starts++;
  }
  stop() {
    // A real source ends once. Firing onended here is what lets the test see whether the
    // module actually disconnects what it stops.
    if (this.stops++ > 0) return;
    this.onended?.();
  }
  get running() {
    return this.starts > 0 && this.stops === 0;
  }
}

class FakeOscillator extends FakeSource {
  type = 'sine';
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);
  constructor() {
    super('oscillator');
  }
}

class FakeBufferSource extends FakeSource {
  buffer: unknown = null;
  loop = false;
  constructor() {
    super('buffer-source');
  }
}

class FakeAudioContext {
  static constructed = 0;
  static latest: FakeAudioContext | null = null;
  static throwOnConstruct = false;

  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  readonly destination = new FakeNode('destination');
  readonly nodes: FakeNode[] = [];

  constructor() {
    if (FakeAudioContext.throwOnConstruct) throw new Error('no audio hardware');
    FakeAudioContext.constructed++;
    FakeAudioContext.latest = this;
  }

  private track<T extends FakeNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
  createGain() {
    return this.track(new FakeGain());
  }
  createBiquadFilter() {
    return this.track(new FakeFilter());
  }
  createOscillator() {
    return this.track(new FakeOscillator());
  }
  createBufferSource() {
    return this.track(new FakeBufferSource());
  }
  createBuffer(_channels: number, length: number) {
    return { length, getChannelData: () => new Float32Array(length) };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }

  of(kind: string) {
    return this.nodes.filter((node) => node.kind === kind);
  }
}

type Global = { window?: unknown };
const originalWindow = (globalThis as Global).window;

function install(constructor: unknown) {
  (globalThis as Global).window = constructor === null ? {} : { AudioContext: constructor };
}

/** The context the module built, which only exists once something has asked for sound. */
function context(): FakeAudioContext {
  const created = FakeAudioContext.latest;
  if (!created) throw new Error('no AudioContext was created');
  return created;
}

/** Oscillators and buffer sources that have been started and not stopped. */
function running() {
  return context()
    .nodes.filter((node): node is FakeSource => node instanceof FakeSource)
    .filter((source) => source.running);
}

/*
 * The master gain and the softening lowpass are built with the context and everything else
 * hangs off them, so they are always the first of their kind. Skipping them is what keeps
 * "the engine's filter" from quietly meaning "the master filter" — which reads as a passing
 * test right up until it asserts 2800Hz is close to 320.
 */
function voiceFilters() {
  return context().of('filter').slice(1) as FakeFilter[];
}
function voiceGains() {
  return context().of('gain').slice(1) as FakeGain[];
}
function oscillators() {
  return context().of('oscillator') as FakeOscillator[];
}

/** Sets up sound and returns it already resumed, as the Fly button does. */
function started() {
  const sfx = createSfx();
  sfx.resume();
  return sfx;
}

beforeEach(() => {
  FakeAudioContext.constructed = 0;
  FakeAudioContext.latest = null;
  FakeAudioContext.throwOnConstruct = false;
  install(FakeAudioContext);
});

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as Global).window;
  else (globalThis as Global).window = originalWindow;
});

/* --- the context ---------------------------------------------------------- */

describe('createSfx', () => {
  it('creates no context until something asks for sound', () => {
    // Mobile browsers only let a context start inside a gesture. Creating one at boot
    // would spend the one attempt that matters before the child has touched anything.
    createSfx();
    expect(FakeAudioContext.constructed).toBe(0);
  });

  it('creates exactly one context, however many times it is asked', () => {
    const sfx = started();
    sfx.resume();
    sfx.collect(0, 3);
    sfx.thruster(0.5, 0.5);
    sfx.dawn(0.2);
    expect(FakeAudioContext.constructed).toBe(1);
  });

  it('is unavailable and silent when the browser has no Web Audio at all', () => {
    install(null);
    const sfx = createSfx();
    expect(sfx.available).toBe(false);
    expect(() => {
      sfx.resume();
      sfx.collect(1, 3);
      sfx.success();
      sfx.thruster(1, 1);
      sfx.dawn(0.5);
      sfx.reset();
      sfx.dispose();
    }).not.toThrow();
  });

  it('stays silent rather than throwing when the context refuses to start', () => {
    FakeAudioContext.throwOnConstruct = true;
    const sfx = createSfx();
    expect(() => {
      sfx.thruster(1, 1);
      sfx.dawn(0.5);
      sfx.success();
    }).not.toThrow();
    // And gives up rather than retrying a failure sixty times a second for a whole flight.
    expect(FakeAudioContext.constructed).toBe(0);
  });
});

/* --- the engine ----------------------------------------------------------- */

describe('thruster', () => {
  it('builds one engine and keeps it, however many frames go by', () => {
    // The failure this catches is a second engine layered on the first every frame, which
    // is inaudible as a mistake and simply sounds like the game got loud.
    const sfx = started();
    for (let i = 0; i < 40; i++) sfx.thruster(0.6, 0.4);
    expect(context().of('buffer-source')).toHaveLength(1);
    expect(context().of('oscillator')).toHaveLength(1);
  });

  it('gains the engine by the throttle it is given', () => {
    const sfx = started();
    const levels: number[] = [];
    for (const throttle of [0.2, 0.5, 1]) {
      sfx.thruster(throttle, 0.5);
      levels.push((voiceGains()[0] as FakeGain).gain.last);
    }
    expect(levels[0]).toBeCloseTo(thrusterGain(0.2), 10);
    expect(levels[1]).toBeCloseTo(thrusterGain(0.5), 10);
    expect(levels[2]).toBeCloseTo(thrusterGain(1), 10);
    expect(levels[0]).toBeLessThan(levels[1] as number);
    expect(levels[1]).toBeLessThan(levels[2] as number);
  });

  it('opens the engine up on cruise, not on throttle', () => {
    // The two curves are different shapes on purpose: the flame you see is the plateau,
    // the speed you see is the bell. Reading the timbre off the wrong one is the bug.
    const sfx = started();
    sfx.thruster(1, 0);
    const filter = voiceFilters()[0] as FakeFilter;
    const osc = oscillators()[0] as FakeOscillator;
    const shut = filter.frequency.last;

    sfx.thruster(1, 1);
    expect(shut).toBeCloseTo(thrusterCutoff(0), 6);
    expect(filter.frequency.last).toBeCloseTo(thrusterCutoff(1), 6);
    expect(filter.frequency.last).toBeGreaterThan(shut);
    expect(osc.frequency.last).toBeCloseTo(thrusterPitch(1), 6);
  });

  it('stops when the flight reports no throttle, and leaves nothing connected', () => {
    const sfx = started();
    sfx.thruster(0.8, 0.5);
    const sources = running();
    expect(sources).toHaveLength(2); // the rush and the rumble

    sfx.thruster(0, 0); // what arrival reports
    expect(running()).toHaveLength(0);
    for (const source of sources) expect(source.disconnects).toBeGreaterThan(0);
  });

  it('does not build an engine for a ship that is not burning', () => {
    const sfx = started();
    sfx.thruster(0, 0);
    expect(context().of('buffer-source')).toHaveLength(0);
  });

  it('stops on reset, which is what Fly Home mid-flight does', () => {
    // The one that matters most: nothing else in the game would ever turn it off, and a
    // stuck thruster does not stop until the tab does.
    const sfx = started();
    sfx.thruster(0.9, 0.8);
    expect(running()).toHaveLength(2);
    sfx.reset();
    expect(running()).toHaveLength(0);
  });

  it('flies again cleanly after a reset', () => {
    const sfx = started();
    sfx.thruster(0.9, 0.8);
    sfx.reset();
    sfx.thruster(0.4, 0.2);
    // A fresh pair, and only that pair: the old one must not have been revived alongside.
    expect(running()).toHaveLength(2);
    expect(context().of('buffer-source')).toHaveLength(2);
  });
});

/* --- the day turn --------------------------------------------------------- */

/**
 * Runs a whole turn and returns the pitch of every bell it rang.
 *
 * Primed with the swing frame DayTurn always sends first, so the pad's own two oscillators
 * are built before counting starts and cannot be mistaken for bells.
 */
function turnThrough(sfx: ReturnType<typeof createSfx>, frames: number) {
  sfx.dawn(0);
  const bells: number[] = [];
  for (let i = 1; i <= frames; i++) {
    const before = oscillators().length;
    sfx.dawn(i / frames);
    const after = oscillators();
    for (let n = before; n < after.length; n++) {
      bells.push((after[n] as FakeOscillator).frequency.last);
    }
  }
  return bells;
}

describe('dawn', () => {
  it('brings the pad in during the swing without ringing anything', () => {
    // The swing is 2.2 seconds of camera move before the planet turns at all. The pad
    // belongs there — it is the sound arriving before the thing it is about — but a bell
    // would announce a sunrise that has not started.
    const sfx = started();
    for (let i = 0; i < 30; i++) sfx.dawn(0);
    expect(context().of('oscillator')).toHaveLength(2); // the pad's root and fifth
    expect(running()).toHaveLength(2);
  });

  it('rings each bell once, climbing, across one turn', () => {
    const sfx = started();
    const bells = turnThrough(sfx, 540); // 9 seconds at 60fps

    expect(bells).toHaveLength(6);
    for (let i = 1; i < bells.length; i++) {
      expect(bells[i]).toBeGreaterThan(bells[i - 1] as number);
    }
  });

  it('rings the same six however many frames the turn takes', () => {
    // A struggling tablet stretches the turn; a fast one compresses it. The bells are
    // spaced by how far the planet has turned, so neither changes what is heard.
    for (const frames of [40, 180, 540, 2000]) {
      FakeAudioContext.latest = null;
      const sfx = started();
      expect(turnThrough(sfx, frames)).toHaveLength(6);
    }
  });

  it('brightens and lifts as the light comes round', () => {
    const sfx = started();
    sfx.dawn(0);
    const filter = voiceFilters()[0] as FakeFilter;
    const level = voiceGains()[0] as FakeGain;
    const root = oscillators()[0] as FakeOscillator;
    const shut = filter.frequency.last;
    const quiet = level.gain.last;
    const low = root.frequency.last;

    // Just short of the end: a progress of exactly 1 releases the pad, and the last thing
    // written to its gain would then be the release rather than the swell.
    sfx.dawn(0.999);
    expect(filter.frequency.last).toBeGreaterThan(shut);
    expect(level.gain.last).toBeGreaterThan(quiet);
    expect(root.frequency.last).toBeGreaterThan(low);
  });

  it('releases the pad when the turn completes', () => {
    // A moment, not a loop. Nothing else would ever stop it: DayTurn reports progress and
    // then goes quiet, so a pad still running at 1 runs for the rest of the visit.
    const sfx = started();
    turnThrough(sfx, 120);
    expect(running()).toHaveLength(0);
  });

  it('starts a fresh turn after one has finished', () => {
    const sfx = started();
    turnThrough(sfx, 120);
    expect(turnThrough(sfx, 120)).toHaveLength(6);
  });

  it('stops on reset, which is Fly Home part-way through a turn', () => {
    const sfx = started();
    for (let i = 1; i <= 20; i++) sfx.dawn(i / 100);
    expect(running()).toHaveLength(2);
    sfx.reset();
    expect(running()).toHaveLength(0);
  });
});

describe('reset', () => {
  it('silences both continuous sounds at once', () => {
    // main.ts is the only caller and calls it once; it cannot be made to stop them singly.
    const sfx = started();
    sfx.thruster(0.7, 0.5);
    sfx.dawn(0.3);
    expect(running()).toHaveLength(4);
    sfx.reset();
    expect(running()).toHaveLength(0);
  });

  it('is harmless before anything has made a sound', () => {
    const sfx = createSfx();
    expect(() => sfx.reset()).not.toThrow();
    expect(FakeAudioContext.constructed).toBe(0);
  });
});

/* --- the envelopes, as maths ---------------------------------------------- */

describe('thruster envelope', () => {
  it('is silent at no throttle and never louder than its ceiling', () => {
    expect(thrusterGain(0)).toBe(0);
    for (let i = 0; i <= 100; i++) {
      const gain = thrusterGain(i / 100);
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(thrusterGain(1));
    }
  });

  it('rises faster at the bottom than a linear gain would', () => {
    // Loudness is roughly a power law. Linear spends the whole cruise sounding like it is
    // already at full, which is the same as having no cruise at all.
    expect(thrusterGain(0.5)).toBeGreaterThan(thrusterGain(1) * 0.5);
  });

  it('clamps rather than extrapolating, for a curve that can land a hair outside 0..1', () => {
    expect(thrusterGain(-1)).toBe(0);
    expect(thrusterGain(2)).toBe(thrusterGain(1));
    expect(thrusterCutoff(-1)).toBe(thrusterCutoff(0));
    expect(thrusterCutoff(2)).toBe(thrusterCutoff(1));
    expect(thrusterPitch(-1)).toBe(thrusterPitch(0));
    expect(thrusterPitch(2)).toBe(thrusterPitch(1));
  });

  it('stays under the master lowpass, so opening up cannot make it harsh', () => {
    // sfx.ts softens everything at 2800Hz. An engine brighter than that is being shaped by
    // that filter rather than by its own, which is a thing you notice only by ear.
    expect(thrusterCutoff(1)).toBeLessThan(2800);
  });
});

describe('dawn envelope', () => {
  it('is quiet throughout, and quietest at the start', () => {
    expect(dawnLevel(0)).toBeLessThan(dawnLevel(1));
    expect(dawnLevel(1)).toBeLessThan(0.2);
  });

  it('opens up and lifts across the turn', () => {
    expect(dawnCutoff(0)).toBeLessThan(dawnCutoff(1));
    expect(dawnPitch(0)).toBe(1);
    // A whole tone. Against a C pentatonic that lands the pad on the second degree, which
    // is in the scale — a rise that resolves rather than one that sours.
    expect(dawnPitch(1)).toBeCloseTo(2 ** (2 / 12), 2);
  });

  it('rings nothing until the planet has actually moved', () => {
    expect(dawnBell(0)).toBe(-1);
    expect(dawnBell(-1)).toBe(-1);
    expect(dawnBell(0.0001)).toBe(0);
  });

  it('steps up once per sixth of a turn and stops at the last bell', () => {
    expect(dawnBell(0.1)).toBe(0);
    expect(dawnBell(0.2)).toBe(1);
    expect(dawnBell(0.5)).toBe(3);
    expect(dawnBell(0.99)).toBe(5);
    expect(dawnBell(1)).toBe(5);
    // Progress cannot exceed 1, but a caller that rounded up must not index off the end.
    expect(dawnBell(1.5)).toBe(5);
  });

  it('never goes backwards, so no bell can ring twice', () => {
    let previous = -1;
    for (let i = 0; i <= 1000; i++) {
      const bell = dawnBell(i / 1000);
      expect(bell).toBeGreaterThanOrEqual(previous);
      previous = bell;
    }
  });
});
