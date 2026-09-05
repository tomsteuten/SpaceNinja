/**
 * Reveal-gating decides which worlds are drawn, and it has to track the framing tiers exactly:
 * a world framed for tapping but not drawn is a promise of "tap Mars" pointing at nothing, and
 * a world drawn before its tier looms into a shot it was never composed for (Saturn across a
 * portrait phone at the opening, Mars crossing Saturn's rings). This pins the gate to the same
 * visits the framing widens on.
 */

import { describe, expect, it } from 'vitest';
import { DESTINATIONS, WIDE_FRAMING_VISIT, WIDER_FRAMING_VISIT, revealedDestinations } from './config';

describe('revealedDestinations', () => {
  it('opens on Earth and the Moon alone', () => {
    expect(new Set(revealedDestinations([]))).toEqual(new Set(['earth', 'moon']));
  });

  it('reveals Mars once the Moon has been visited', () => {
    const revealed = new Set(revealedDestinations([WIDE_FRAMING_VISIT]));
    expect(revealed.has('mars')).toBe(true);
    // ...and not Saturn yet, which is the state that removes the Mars-through-rings overlap.
    expect(revealed.has('saturn')).toBe(false);
  });

  it('reveals Saturn once Mars has been visited', () => {
    expect(new Set(revealedDestinations([WIDE_FRAMING_VISIT, WIDER_FRAMING_VISIT]))).toEqual(
      new Set(['earth', 'moon', 'mars', 'saturn']),
    );
  });

  it('gates on the same visits the framing tiers widen on', () => {
    // If these drift, a world is framed for tapping while still hidden, or drawn while the
    // camera has not widened to include it.
    expect(DESTINATIONS.mars?.revealAfterVisiting).toBe(WIDE_FRAMING_VISIT);
    expect(DESTINATIONS.saturn?.revealAfterVisiting).toBe(WIDER_FRAMING_VISIT);
    expect(DESTINATIONS.earth?.revealAfterVisiting).toBeUndefined();
    expect(DESTINATIONS.moon?.revealAfterVisiting).toBeUndefined();
  });
});
