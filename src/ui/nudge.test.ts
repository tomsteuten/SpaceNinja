import { describe, expect, it } from 'vitest';
import {
  NUDGE_DELAY_SECONDS,
  NUDGE_SHORT_DELAY_SECONDS,
  dueNudge,
  shorteningPair,
  singleNudge,
} from './nudge';

describe('shorteningPair', () => {
  it('is the full line at 8 s and the short line at 16 s', () => {
    expect(shorteningPair('home-nudge-moon', 'home-nudge-short-moon')).toEqual([
      { at: NUDGE_DELAY_SECONDS, cue: 'home-nudge-moon' },
      { at: NUDGE_SHORT_DELAY_SECONDS, cue: 'home-nudge-short-moon' },
    ]);
  });
});

describe('dueNudge', () => {
  const steps = shorteningPair('find-nudge', 'find-nudge-short');

  it('says nothing before the first delay', () => {
    expect(dueNudge(0, steps, new Set())).toBeNull();
    expect(dueNudge(NUDGE_DELAY_SECONDS - 0.01, steps, new Set())).toBeNull();
  });

  it('gives the full line first, at the first delay', () => {
    expect(dueNudge(NUDGE_DELAY_SECONDS, steps, new Set())).toBe('find-nudge');
  });

  it('gives the short line only once the full one has been given', () => {
    // At the second delay with nothing given yet, the full line is still owed and comes first,
    // so the pair can never play out of order even if the count jumped past both thresholds.
    expect(dueNudge(NUDGE_SHORT_DELAY_SECONDS, steps, new Set())).toBe('find-nudge');
    expect(dueNudge(NUDGE_SHORT_DELAY_SECONDS, steps, new Set(['find-nudge']))).toBe(
      'find-nudge-short',
    );
  });

  it('falls silent once both have been given — the map is not a nag', () => {
    const given = new Set(['find-nudge', 'find-nudge-short']);
    expect(dueNudge(NUDGE_SHORT_DELAY_SECONDS, steps, given)).toBeNull();
    expect(dueNudge(999, steps, given)).toBeNull();
  });

  it('does not offer the short line while only its delay has passed but the full one is given', () => {
    // The full line was given at 8 s; at 12 s the short one is not due yet.
    expect(dueNudge(12, steps, new Set(['find-nudge']))).toBeNull();
  });
});

describe('singleNudge', () => {
  it('is due once at the first delay and then never again', () => {
    const steps = singleNudge('spin-nudge');
    expect(dueNudge(NUDGE_DELAY_SECONDS - 0.01, steps, new Set())).toBeNull();
    expect(dueNudge(NUDGE_DELAY_SECONDS, steps, new Set())).toBe('spin-nudge');
    expect(dueNudge(NUDGE_DELAY_SECONDS, steps, new Set(['spin-nudge']))).toBeNull();
  });
});
