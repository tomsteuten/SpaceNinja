import { describe, expect, it } from 'vitest';
import {
  bedtimeLayout, daylight, daysPassed, dragTurn, hourAt, houseAngle, isNight, partOfDay, skyColours,
  starAlpha, sunInSky, TAG_WIDTH, turnForHour,
} from './daySpin';

const TAU = Math.PI * 2;

describe('bedtime spin maths', () => {
  it('one full turn is one day', () => {
    expect(hourAt(0)).toBeCloseTo(12);
    expect(hourAt(TAU / 4)).toBeCloseTo(18);
    expect(hourAt(TAU / 2)).toBeCloseTo(0);
    expect(hourAt(TAU)).toBeCloseTo(12);
    expect(hourAt(-TAU / 4)).toBeCloseTo(6);
  });

  it('turnForHour inverts hourAt', () => {
    for (const hour of [0, 3, 6, 9.5, 12, 17, 23]) {
      expect(hourAt(turnForHour(hour))).toBeCloseTo(hour);
    }
  });

  it('an equator house has twelve hours of light and twelve of dark', () => {
    let night = 0;
    for (let i = 0; i < 2400; i++) if (isNight(i / 100)) night++;
    expect(night).toBe(1200);
    expect(isNight(5.9)).toBe(true);
    expect(isNight(6)).toBe(false);
    expect(isNight(18)).toBe(true);
  });

  it('names the parts of the day around sunrise and sunset', () => {
    expect(partOfDay(6)).toBe('morning');
    expect(partOfDay(12)).toBe('day');
    expect(partOfDay(18)).toBe('evening');
    expect(partOfDay(0)).toBe('night');
  });

  it('counts whole days only', () => {
    expect(daysPassed(0)).toBe(0);
    expect(daysPassed(TAU * 0.99)).toBe(0);
    expect(daysPassed(TAU)).toBe(1);
    expect(daysPassed(TAU * 2.5)).toBe(2);
  });

  it('drags turn Earth eastward only', () => {
    // Counter-clockwise on screen lowers the canvas angle and turns Earth forward.
    expect(dragTurn(1, 0.8)).toBeCloseTo(0.2);
    expect(dragTurn(0.8, 1)).toBe(0);
    // Across the ±π seam the short way round is used.
    expect(dragTurn(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(0.2);
  });

  it('puts the house facing the Sun at noon and on the far side at midnight', () => {
    expect(houseAngle(0)).toBeCloseTo(Math.PI);
    expect(Math.cos(houseAngle(turnForHour(0)))).toBeCloseTo(1);
    // Six in the evening: the bottom of the disc (canvas y down), on the line between light and dark.
    expect(Math.sin(houseAngle(turnForHour(18)))).toBeCloseTo(1);
  });
});

describe('the view from the house', () => {
  it('has the Sun rise at the left at 6, overhead at noon, and set at the right at 18', () => {
    const rise = sunInSky(6);
    expect(rise.x).toBeCloseTo(-1);
    expect(rise.y).toBeCloseTo(0);
    const noon = sunInSky(12);
    expect(noon.x).toBeCloseTo(0);
    expect(noon.y).toBeCloseTo(1);
    expect(noon.above).toBe(true);
    const set = sunInSky(18);
    expect(set.x).toBeCloseTo(1);
    expect(set.y).toBeCloseTo(0);
    expect(sunInSky(9).x).toBeLessThan(0);
    expect(sunInSky(15).x).toBeGreaterThan(0);
  });

  it('keeps the Sun below the ground all night and above it all day, in step with isNight', () => {
    for (let i = 0; i < 2400; i += 7) {
      const hour = i / 100;
      if (hour > 6.01 && hour < 17.99) expect(sunInSky(hour).above, `hour ${hour}`).toBe(true);
      if (hour < 5.99 || hour > 18.01) expect(sunInSky(hour).above, `hour ${hour}`).toBe(false);
    }
    expect(sunInSky(0).y).toBeCloseTo(-1);
  });

  it('is in step with the spinning Earth: the hour the house reads is the hour the sky shows', () => {
    // A quarter turn after noon is six in the evening, and the Sun sits on the western horizon.
    expect(sunInSky(hourAt(TAU / 4)).x).toBeCloseTo(1);
    expect(sunInSky(hourAt(-TAU / 4)).x).toBeCloseTo(-1);
  });

  it('is a deep dark sky with stars at night and a blue one with none at noon', () => {
    const night = skyColours(0);
    const noon = skyColours(12);
    expect(night.top[2]).toBeLessThan(60);
    expect(noon.top[2]).toBeGreaterThan(200);
    expect(noon.low[0]).toBeGreaterThan(night.low[0] + 100);
    expect(starAlpha(0)).toBe(1);
    expect(starAlpha(12)).toBe(0);
    expect(starAlpha(6)).toBeGreaterThan(0);
    expect(starAlpha(6)).toBeLessThan(1);
    expect(daylight(0)).toBe(0);
    expect(daylight(12)).toBe(1);
  });

  it('glows at the horizon at dawn and dusk', () => {
    for (const hour of [6, 18]) {
      const low = skyColours(hour).low;
      expect(low[0]).toBeGreaterThan(low[2] + 80); // orange, not blue
    }
  });

  it('blends the sky smoothly through the day: no jumps between neighbouring moments', () => {
    let previous = skyColours(0);
    let biggest = 0;
    for (let tick = 1; tick <= 24 * 600; tick++) {
      const now = skyColours(tick / 600);
      for (let c = 0; c < 3; c++) {
        biggest = Math.max(biggest, Math.abs(now.top[c]! - previous.top[c]!), Math.abs(now.low[c]! - previous.low[c]!));
      }
      previous = now;
    }
    // Six seconds of the day never changes any colour by even one step of 255.
    expect(biggest).toBeLessThan(1);
  });
});

describe('the bedtime spin layout', () => {
  interface Box { x: number; y: number; w: number; h: number }
  const box = (cx: number, cy: number, d: number): Box => ({ x: cx - d / 2, y: cy - d / 2, w: d, h: d });
  const apart = (a: Box, b: Box) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
  /** A box and a disc (centre, radius) do not overlap. */
  const clearOfDisc = (b: Box, cx: number, cy: number, r: number) => {
    const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
    const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
    return Math.hypot(nx - cx, ny - cy) >= r;
  };

  for (const [name, width, height] of [['portrait phone', 360, 740], ['landscape phone', 800, 360]] as const) {
    it(`keeps the From the house window clear of Earth, the house, the clock and the controls on a ${name}`, () => {
      const L = bedtimeLayout(width, height);
      const win = box(L.window.cx, L.window.cy, L.window.d);
      const tag: Box = { x: L.tag.left, y: L.tag.top, w: TAG_WIDTH, h: 36 };
      // On screen.
      for (const b of [win, tag]) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(width);
        expect(b.y + b.h).toBeLessThanOrEqual(height);
        // Not over Earth or anywhere the house rides.
        expect(clearOfDisc(b, L.earth.cx, L.earth.cy, L.reach), 'Earth and the house').toBe(true);
        // Not over the clock.
        expect(clearOfDisc(b, L.clock.x, L.clock.y, L.clock.r + 4), 'the clock').toBe(true);
      }
      expect(apart(win, tag)).toBe(true);
      // The buttons and the days counter (sizes from bedtimeSpin.css).
      const short = height <= 480;
      const buttonH = short ? 62 : width <= 520 ? 72 : 76;
      const bottom = short ? 12 : 18;
      const back: Box = { x: 12, y: height - bottom - buttonH, w: 120, h: buttonH };
      const turn: Box = { x: width / 2 - 100, y: height - bottom - buttonH, w: 200, h: buttonH };
      const days: Box = { x: width / 2 - 90, y: height - bottom - (short ? 76 : 100) - 34, w: 180, h: 34 };
      for (const control of [back, turn, days]) {
        expect(apart(win, control), 'window vs control').toBe(true);
        expect(apart(tag, control), 'label vs control').toBe(true);
      }
      expect(L.window.d).toBeGreaterThanOrEqual(96);
    });
  }
});
