import { describe, expect, it } from 'vitest';
import {
  BUMP_TIME, DRILL_TIME, MARS_CLOSEST_KM, MARS_EXAMPLE_KM, MARS_FARTHEST_KM, MAX_QUEUE, MAX_STEP, MOVE_TIME,
  PLAY_DELAY, allDrilled, createDrive, lightMinutes, lightSeconds, progress, realDelayLabel, rockAt, rocksFor,
  roverPosition, send, stepDrive, type Drive,
} from './roverDelay';

function run(d: Drive, seconds: number, dt = 1 / 60) {
  const arrived: number[] = [];
  let sampled = 0;
  let bumped = 0;
  for (let i = Math.round(seconds / dt); i > 0; i--) {
    const events = stepDrive(d, dt);
    arrived.push(...events.arrived.map(m => m.id));
    if (events.sampled) sampled++;
    if (events.bumped) bumped++;
  }
  return { arrived, sampled, bumped };
}

describe('Earth–Mars signal delay', () => {
  it('takes about 3 to 22 minutes at the speed of light', () => {
    expect(lightMinutes(MARS_CLOSEST_KM)).toBeCloseTo(3.0, 1);
    expect(lightMinutes(MARS_FARTHEST_KM)).toBeGreaterThan(22);
    expect(lightMinutes(MARS_FARTHEST_KM)).toBeLessThan(23);
    // Sunlight to Earth, about 8 minutes 20 seconds, checks the units.
    expect(lightSeconds(149.6e6)).toBeCloseTo(499, 0);
  });

  it('says the real number on the clock', () => {
    expect(lightMinutes(MARS_EXAMPLE_KM)).toBeCloseTo(12, 0);
    expect(realDelayLabel()).toBe('really: 12 minutes');
    expect(realDelayLabel(MARS_CLOSEST_KM)).toBe('really: 3 minutes');
    expect(realDelayLabel(1)).toBe('really: 1 minute');
  });
});

describe('driving the rover', () => {
  it('does nothing until the message arrives, then drives one square', () => {
    const d = createDrive();
    expect([d.col, d.row]).toEqual([0, 3]);
    send(d, 'right');
    run(d, PLAY_DELAY - 0.1);
    expect([d.col, d.row]).toEqual([0, 3]);
    expect(d.action).toBeNull();
    expect(roverPosition(d)).toEqual({ col: 0, row: 3 });
    const { arrived } = run(d, 0.2);
    expect(arrived).toEqual([1]);
    expect(d.action?.kind).toBe('drive');
    run(d, MOVE_TIME);
    expect([d.col, d.row]).toEqual([1, 3]);
    expect(d.action).toBeNull();
  });

  it('carries several moves in flight at once, in order, and queues them at the rover', () => {
    const d = createDrive();
    send(d, 'up');
    run(d, 0.2);
    send(d, 'up');
    send(d, 'right');
    expect(d.messages).toHaveLength(3);
    expect(progress(d, d.messages[0]!)).toBeGreaterThan(progress(d, d.messages[1]!));
    const { arrived } = run(d, PLAY_DELAY + MOVE_TIME * 3 + 0.2);
    expect(arrived).toEqual([1, 2, 3]);
    expect([d.col, d.row]).toEqual([1, 1]);
    expect(d.facing).toBe('right');
  });

  it('bumps at the crater edge instead of leaving the board', () => {
    const d = createDrive();
    send(d, 'left');
    send(d, 'down');
    const { bumped } = run(d, PLAY_DELAY + BUMP_TIME * 2 + 0.2);
    expect(bumped).toBe(2);
    expect([d.col, d.row]).toEqual([0, 3]);
    expect(d.facing).toBe('left');
  });

  it('drills a sample tube from a rock, once per rock', () => {
    const d = createDrive();
    const rock = d.rocks[1]!;
    for (let i = 0; i < rock.col; i++) send(d, 'right');
    for (let i = rock.row; i < d.rows - 1; i++) send(d, 'up');
    send(d, 'drill');
    send(d, 'drill');
    const { sampled } = run(d, PLAY_DELAY + MOVE_TIME * 4 + DRILL_TIME * 2 + 0.5);
    expect([d.col, d.row]).toEqual([rock.col, rock.row]);
    expect(sampled).toBe(1);
    expect(d.samples).toBe(1);
    expect(rockAt(d, rock.col, rock.row)?.drilled).toBe(true);
  });

  it('drilling plain ground finds only dust', () => {
    const d = createDrive();
    send(d, 'drill');
    let dusty = false;
    for (let i = 0; i < 400; i++) dusty ||= stepDrive(d, 1 / 60).dusty;
    expect(dusty).toBe(true);
    expect(d.samples).toBe(0);
  });

  it('keeps the list of sent moves finite', () => {
    const d = createDrive();
    for (let i = 0; i < MAX_QUEUE; i++) expect(send(d, 'up')).not.toBeNull();
    expect(send(d, 'up')).toBeNull();
    run(d, PLAY_DELAY + 0.1);
    expect(send(d, 'up')).toBeNull(); // arrived but still waiting their turn
    run(d, MOVE_TIME + 0.05);
    expect(send(d, 'up')).not.toBeNull();
  });

  it('gives the same drive whatever the frame rate, and a stalled frame cannot leap', () => {
    const plan = ['right', 'right', 'up', 'drill', 'left'] as const;
    const smooth = createDrive();
    const choppy = createDrive();
    for (const c of plan) { send(smooth, c); send(choppy, c); }
    run(smooth, 8, 1 / 144);
    run(choppy, 8, MAX_STEP);
    expect([choppy.col, choppy.row, choppy.samples]).toEqual([smooth.col, smooth.row, smooth.samples]);

    const d = createDrive();
    send(d, 'right');
    stepDrive(d, 60);
    expect(d.messages).toHaveLength(1); // a quarter second of travel, not a minute
    stepDrive(d, -1);
    stepDrive(d, Number.NaN);
    expect(d.messages[0]!.age).toBeCloseTo(MAX_STEP, 6);
  });

  it('lays out a fresh set of rocks on the board and off the rover', () => {
    for (let round = 0; round < 6; round++) {
      const rocks = rocksFor(round, 6, 4, [2, 1]);
      expect(rocks.length).toBeGreaterThan(1);
      for (const r of rocks) {
        expect(r.col).toBeLessThan(6);
        expect(r.row).toBeLessThan(4);
        expect([r.col, r.row]).not.toEqual([2, 1]);
      }
    }
    const d = createDrive();
    expect(allDrilled(d)).toBe(false);
    for (const r of d.rocks) r.drilled = true;
    expect(allDrilled(d)).toBe(true);
  });
});
