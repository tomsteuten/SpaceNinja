import { describe, expect, it } from 'vitest';
import { adventureHref, isAdventureRoute } from './freeFlightRoute';

describe('prototype routes', () => {
  it('keeps a GitHub Pages repository path while replacing query and hash', () => {
    expect(adventureHref('https://example.test/SpaceNinja/?grownups#old'))
      .toBe('https://example.test/SpaceNinja/?adventure');
  });

  it('treats only an explicit ?adventure as the guided game', () => {
    expect(isAdventureRoute('')).toBe(false);
    expect(isAdventureRoute('?grownups')).toBe(false);
    expect(isAdventureRoute('?adventure')).toBe(true);
    expect(isAdventureRoute('?adventure&grownups')).toBe(true);
    expect(isAdventureRoute('?grownups&adventure')).toBe(true);
  });
});
