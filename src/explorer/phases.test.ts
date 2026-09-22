import { describe, expect, it } from 'vitest';
import { createPhases, type Phase } from './phases';

const ORDER: Phase[] = ['system', 'flying', 'descending', 'exploring', 'ascending', 'returning'];

describe('explorer phases', () => {
  it('advances only one step at a time', () => {
    const phases = createPhases();
    expect(phases.advance('exploring')).toBe(false);
    for (const phase of ORDER.slice(1)) expect(phases.advance(phase)).toBe(true);
    expect(phases.advance('flying')).toBe(false);
    expect(phases.current).toBe('returning');
  });

  it('resets to the solar system from every phase, and can fly again afterwards', () => {
    for (let stop = 0; stop < ORDER.length; stop++) {
      const seen: Phase[] = [];
      const phases = createPhases((phase) => seen.push(phase));
      for (const phase of ORDER.slice(1, stop + 1)) phases.advance(phase);
      phases.reset();
      expect(phases.current).toBe('system');
      expect(phases.advance('flying')).toBe(true);
      expect(seen.at(-2)).toBe('system');
    }
  });
});
