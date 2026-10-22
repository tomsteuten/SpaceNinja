import { describe, expect, it } from 'vitest';
import {
  DRILL_TIME, MARS_CLOSEST_KM, MARS_EXAMPLE_KM, MARS_FARTHEST_KM, MAX_STEP, MIN_DRIVE, PARK, PLAY_DELAY,
  RESTOCK_TIME, ROCK_SETS, allDrilled, createDrive, delayMinutes, lightMinutes, lightSeconds, messageProgress,
  rocksFor, stepDrive, tap, type Drive,
} from './roverDelay';

function run(d: Drive, seconds: number, dt = 1 / 60) {
  let arrived = 0;
  let sampled = 0;
  let restocked = 0;
  for (let i = Math.round(seconds / dt); i > 0; i--) {
    const events = stepDrive(d, dt);
    if (events.arrived) arrived++;
    if (events.sampled) sampled++;
    if (events.restocked) restocked++;
  }
  return { arrived, sampled, restocked };
}

/** Long enough for any message, drive and drill to finish. */
const WHOLE_TRIP = PLAY_DELAY + 4 + DRILL_TIME;

describe('Earth–Mars signal delay', () => {
  it('takes about 3 to 22 minutes at the speed of light', () => {
    expect(lightMinutes(MARS_CLOSEST_KM)).toBeCloseTo(3.0, 1);
    expect(lightMinutes(MARS_FARTHEST_KM)).toBeGreaterThan(22);
    expect(lightMinutes(MARS_FARTHEST_KM)).toBeLessThan(23);
    // Sunlight to Earth, about 8 minutes 20 seconds, checks the units.
    expect(lightSeconds(149.6e6)).toBeCloseTo(499, 0);
  });

  it('shows a typical 12 minutes on the clock', () => {
    expect(lightMinutes(MARS_EXAMPLE_KM)).toBeCloseTo(12, 0);
    expect(delayMinutes()).toBe(12);
    expect(delayMinutes(MARS_CLOSEST_KM)).toBe(3);
    expect(delayMinutes(1)).toBe(1);
  });
});

describe('tapping a rock', () => {
  it('sends a message that takes the play delay, then drives to the rock and drills it', () => {
    const d = createDrive();
    const rock = d.rocks[1]!;
    expect(tap(d, rock)).toBe('sent');
    expect(messageProgress(d)).toBe(0);
    run(d, PLAY_DELAY - 0.1);
    expect(d.phase).toBe('message');
    expect(messageProgress(d)).toBeGreaterThan(0.9);
    expect([d.x, d.y]).toEqual([0, 3]); // nothing moves until the message lands
    expect(run(d, 0.2).arrived).toBe(1);
    expect(d.phase).toBe('drive');
    expect(messageProgress(d)).toBeNull();
    const { sampled } = run(d, WHOLE_TRIP);
    expect(sampled).toBe(1);
    expect(d.phase).toBe('idle');
    expect(d.samples).toBe(1);
    expect(rock.drilled).toBe(true);
    // Parked beside it, facing it, close enough for the arm.
    expect(d.x).toBeCloseTo(rock.col - PARK, 6);
    expect(d.y).toBe(rock.row);
    expect(d.facing).toBe('right');
  });

  it('parks on the near side when the rock is behind', () => {
    const d = createDrive();
    d.x = 5;
    tap(d, d.rocks[1]!);
    run(d, WHOLE_TRIP);
    expect(d.facing).toBe('left');
    expect(d.x).toBeCloseTo(d.rocks[1]!.col + PARK, 6);
  });

  it('ignores taps while busy instead of queueing them', () => {
    const d = createDrive();
    tap(d, d.rocks[0]!);
    expect(tap(d, d.rocks[1]!)).toBe('busy');
    run(d, PLAY_DELAY + 0.1);
    expect(tap(d, d.rocks[2]!)).toBe('busy');
    run(d, WHOLE_TRIP);
    expect(d.samples).toBe(1);
    expect(d.rocks.map(r => r.drilled)).toEqual([true, false, false]);
    expect(d.phase).toBe('idle');
    expect(tap(d, d.rocks[0]!)).toBe('drilled');
    expect(d.phase).toBe('idle');
  });

  it('even a near rock is a short drive, never a jump', () => {
    const d = createDrive();
    const rock = d.rocks[0]!;
    d.x = rock.col - PARK;
    d.y = rock.row;
    tap(d, rock);
    run(d, PLAY_DELAY + 0.05);
    expect(d.phase).toBe('drive');
    expect(d.duration).toBe(MIN_DRIVE);
  });

  it('three tubes bring a fresh set of rocks, clear of the rover', () => {
    const d = createDrive();
    for (const rock of [...d.rocks]) {
      tap(d, rock);
      while (d.phase !== 'idle' && d.phase !== 'restock') stepDrive(d, 1 / 60);
    }
    expect(d.samples).toBe(3);
    expect(allDrilled(d)).toBe(true);
    expect(d.phase).toBe('restock');
    expect(tap(d, d.rocks[0]!)).toBe('busy');
    const { restocked } = run(d, RESTOCK_TIME + 0.1);
    expect(restocked).toBe(1);
    expect(d.phase).toBe('idle');
    expect(d.rocks).toHaveLength(3);
    expect(d.rocks.every(r => !r.drilled)).toBe(true);
    for (const r of d.rocks) expect(Math.hypot(r.col - d.x, r.row - d.y)).toBeGreaterThanOrEqual(1);
  });

  it('always lays out three rocks on the board, wherever the rover parked last', () => {
    for (let round = 0; round < ROCK_SETS.length; round++) {
      for (const [col, row] of ROCK_SETS[round]!) {
        for (const side of [-PARK, PARK]) {
          const rocks = rocksFor(round + 1, 6, 4, [col + side, row]);
          expect(rocks).toHaveLength(3);
          for (const r of rocks) {
            expect(r.col).toBeLessThan(6);
            expect(r.row).toBeLessThan(4);
            expect(Math.hypot(r.col - col - side, r.row - row)).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
  });

  it('gives the same trip whatever the frame rate, and a stalled frame cannot leap', () => {
    const smooth = createDrive();
    const choppy = createDrive();
    tap(smooth, smooth.rocks[2]!);
    tap(choppy, choppy.rocks[2]!);
    run(smooth, PLAY_DELAY + 1.25, 1 / 144);
    run(choppy, PLAY_DELAY + 1.25, MAX_STEP);
    expect(choppy.phase).toBe(smooth.phase);
    expect(choppy.x).toBeCloseTo(smooth.x, 1);

    const d = createDrive();
    tap(d, d.rocks[0]!);
    stepDrive(d, 60);
    expect(d.phase).toBe('message'); // a quarter second of travel, not a minute
    stepDrive(d, -1);
    stepDrive(d, Number.NaN);
    expect(d.elapsed).toBeCloseTo(MAX_STEP, 6);
  });
});
