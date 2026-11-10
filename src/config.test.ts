/**
 * Nothing is locked: every destination is drawn and tappable from the first second, and the
 * home map's framing has to fit exactly that set. A world framed for tapping but not drawn is
 * a promise pointing at nothing; a world drawn outside the shot cannot be tapped at all. This
 * pins the destination list to the scene's bodies and the map framing to all of them.
 */

import { describe, expect, it } from 'vitest';
import { DESTINATIONS, MAP_FRAMING_RADIUS, framingRadiusFor } from './config';
import { BODY_IDS } from './scene/Bodies';

describe('open exploring', () => {
  it('has copy for every built scene body', () => {
    expect(Object.keys(DESTINATIONS).sort()).toEqual([...BODY_IDS].sort());
  });

  it('gates no destination on a visit', () => {
    for (const config of Object.values(DESTINATIONS)) {
      expect(Object.keys(config)).not.toContain('revealAfterVisiting');
    }
  });

  it('frames the home map on every world it draws', () => {
    // main.ts draws every body and frames with framingRadiusFor over the same ids.
    expect(framingRadiusFor(BODY_IDS)).toBeCloseTo(MAP_FRAMING_RADIUS);
    for (const id of BODY_IDS) {
      expect(framingRadiusFor(BODY_IDS)).toBeGreaterThanOrEqual(framingRadiusFor([id]));
    }
  });
});
