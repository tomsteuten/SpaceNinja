/**
 * Nothing is locked: every destination is drawn and tappable from the first second. This
 * pins the destination list to the scene's bodies; src/map/model.test.ts pins every one of
 * them to exactly one page of the Space map.
 */

import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './config';
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
});
