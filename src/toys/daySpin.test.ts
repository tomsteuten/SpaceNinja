import { describe, expect, it } from 'vitest';
import { daysPassed, dragTurn, hourAt, houseAngle, isNight, partOfDay, turnForHour } from './daySpin';

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
