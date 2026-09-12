import { describe, expect, it } from 'vitest';
import { adventureHref, freeFlightHref, isFreeFlightShortcut } from './freeFlightRoute';

describe('manual-flight routes', () => {
  it('keeps a GitHub Pages repository path while replacing query and hash', () => {
    expect(freeFlightHref('https://example.test/SpaceNinja/?grownups#help'))
      .toBe('https://example.test/SpaceNinja/?freeflight');
    expect(adventureHref('https://example.test/SpaceNinja/?freeflight#old'))
      .toBe('https://example.test/SpaceNinja/');
  });

  it('uses Shift+F without browser modifier collisions or key repeat', () => {
    const event = { key: 'F', shiftKey: true, altKey: false, ctrlKey: false, metaKey: false, repeat: false };
    expect(isFreeFlightShortcut(event)).toBe(true);
    expect(isFreeFlightShortcut({ ...event, shiftKey: false })).toBe(false);
    expect(isFreeFlightShortcut({ ...event, ctrlKey: true })).toBe(false);
    expect(isFreeFlightShortcut({ ...event, repeat: true })).toBe(false);
  });
});
