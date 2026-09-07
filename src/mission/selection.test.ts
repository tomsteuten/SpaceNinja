/**
 * Placement is the load-bearing idea of the mission, and it used to be guaranteed by a
 * person: three places were written per world, and a test checked that those three happened
 * to compose. Worlds now carry twice as many and a *set* is chosen per visit, so the rules
 * have to hold for a combination nobody looked at.
 *
 * Two properties matter more than the rest.
 *
 * Every chosen set must play — one place over the horizon and no more, within a single drag,
 * the rest spread out and tappable. Get that wrong and an arrival opens on an empty screen,
 * or with nothing left to drag for, or with two hit spheres overlapping so a tap scores the
 * wrong place.
 *
 * And every place a world carries must appear in *some* playable set. This one is the
 * genuinely invisible failure: `JOURNAL_SLOTS` counts every discovery and `foundEverything`
 * requires all of them, so a place that can never be chosen makes the journal impossible to
 * fill and the game impossible to finish, with nothing anywhere reporting a problem. It has
 * already caught one — Greenland at 72 north, when POLE_GUARD is 55.6 degrees rather than the
 * 80 it looks like at a glance.
 */

import { describe, expect, it } from 'vitest';

import {
  DESTINATIONS,
  EARTH_RADIUS,
  MARS_RADIUS,
  MOON_RADIUS,
  SATURN_RADIUS,
  type Discovery,
} from '../config';
import { hitRadiusFor, markerPlacement, placementAngles } from './CollectMission';
import {
  DRAG_BOUND,
  MIN_YAW_SEPARATION,
  PLACES_PER_VISIT,
  POLE_GUARD,
  VISIBLE_LIMB,
  authoredSet,
  chooseDiscoveries,
  isPlayableSet,
  playableSets,
} from './selection';

const RADII: Record<string, number> = {
  earth: EARTH_RADIUS,
  moon: MOON_RADIUS,
  mars: MARS_RADIUS,
  saturn: SATURN_RADIUS,
};

/** Every destination, so a new world is covered the day it lands. */
const WORLDS: Array<[string, Discovery[], number]> = Object.entries(DESTINATIONS).map(
  ([id, config]) => {
    const radius = RADII[id];
    if (radius === undefined) throw new Error(`No radius for ${id}; add it here.`);
    return [id, config.mission.discoveries, radius];
  },
);

/** The rules, checked directly rather than through the function under test. */
function assertPlays(set: readonly Discovery[], radius: number) {
  const angles = placementAngles(set as Discovery[]);
  const hidden = angles.filter(([yaw]) => Math.abs(yaw) > VISIBLE_LIMB);
  expect(hidden).toHaveLength(1);

  const last = angles[angles.length - 1];
  expect(Math.abs(last?.[0] ?? 0)).toBeGreaterThan(VISIBLE_LIMB);
  expect(Math.abs(last?.[0] ?? 0)).toBeLessThan(DRAG_BOUND);
  // The drag has to actually reveal something, so the hidden one is never a ring place.
  expect(set[set.length - 1]?.ring).toBeUndefined();

  for (const [, pitch] of angles) expect(Math.abs(pitch)).toBeLessThan(POLE_GUARD);

  const inView = angles.slice(0, -1).map(([yaw]) => yaw);
  for (let i = 1; i < inView.length; i++) {
    expect(Math.abs((inView[i] ?? 0) - (inView[i - 1] ?? 0))).toBeGreaterThan(MIN_YAW_SEPARATION);
  }

  const clearance = hitRadiusFor(radius) * 2;
  const points = set.map((discovery) => markerPlacement(discovery, radius).position);
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      expect(points[i]?.distanceTo(points[j] as never)).toBeGreaterThan(clearance);
    }
  }
}

describe.each(WORLDS)('%s', (_id, pool, radius) => {
  it('carries more places than it shows, or there is nothing to vary', () => {
    expect(pool.length).toBeGreaterThan(PLACES_PER_VISIT);
  });

  it('can reach every place it carries', () => {
    // The invisible one. A place in no playable set can never be found, so the journal can
    // never be filled and the game can never be finished — silently.
    const reachable = new Set(playableSets(pool, radius).flat().map((d) => d.id));
    expect(pool.filter((d) => !reachable.has(d.id)).map((d) => d.id)).toEqual([]);
  });

  it('offers several genuinely different arrivals', () => {
    // Two would technically vary and would still feel like the same world twice.
    expect(playableSets(pool, radius).length).toBeGreaterThanOrEqual(4);
  });

  it('produces only playable sets, whatever has been found', () => {
    const sets = playableSets(pool, radius);
    for (const set of sets) assertPlays(set, radius);
  });

  it('keeps the triple the world was authored with playable', () => {
    // The fallback, and the composition a person actually looked at. If this ever fails the
    // world's own list has drifted, whatever the picker does.
    expect(isPlayableSet(authoredSet(pool), radius)).toBe(true);
  });

  it('chooses a playable set from every progress state it can be in', () => {
    // Including the states that only arise on a replay: everything found, all but one found,
    // and each single place outstanding. The last is where a naive unfound-only picker breaks
    // — one remaining place cannot legally fill an arrival on its own.
    const states: string[][] = [[], pool.map((d) => d.id)];
    for (const d of pool) {
      states.push([d.id]);
      states.push(pool.filter((other) => other.id !== d.id).map((other) => other.id));
    }
    for (const found of states) {
      for (let roll = 0; roll < 12; roll++) {
        const set = chooseDiscoveries(pool, found, radius, () => roll / 12);
        expect(set).toHaveLength(PLACES_PER_VISIT);
        expect(new Set(set.map((d) => d.id)).size).toBe(PLACES_PER_VISIT);
        assertPlays(set, radius);
      }
    }
  });

  it('prefers places that have not been found yet', () => {
    const sets = playableSets(pool, radius);
    // Take a set that exists, mark its members found, and ask again: the picker should walk
    // away from them wherever a set with more fresh places is available.
    const seen = sets[0] as Discovery[];
    const found = seen.map((d) => d.id);
    const best = Math.max(
      ...sets.map((set) => set.filter((d) => !found.includes(d.id)).length),
    );
    for (let roll = 0; roll < 12; roll++) {
      const set = chooseDiscoveries(pool, found, radius, () => roll / 12);
      expect(set.filter((d) => !found.includes(d.id)).length).toBe(best);
    }
  });

  it('varies across rolls rather than always returning one set', () => {
    const seen = new Set<string>();
    for (let roll = 0; roll < 24; roll++) {
      seen.add(
        chooseDiscoveries(pool, [], radius, () => roll / 24)
          .map((d) => d.id)
          .join(),
      );
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('isPlayableSet', () => {
  const moon = DESTINATIONS.moon?.mission.discoveries ?? [];

  it('rejects a set with nothing over the horizon', () => {
    // Two places side by side and a third between them: nothing to drag for.
    const flat: Discovery[] = [
      { id: 'a', name: 'a', emoji: '', lat: 0, lon: -20, short: '', fact: '' },
      { id: 'b', name: 'b', emoji: '', lat: 0, lon: 20, short: '', fact: '' },
      { id: 'c', name: 'c', emoji: '', lat: 0, lon: 0, short: '', fact: '' },
    ];
    expect(isPlayableSet(flat, MOON_RADIUS)).toBe(false);
  });

  it('rejects a hidden one too far round to be worth the drag', () => {
    const tooFar: Discovery[] = [
      { id: 'a', name: 'a', emoji: '', lat: 0, lon: -10, short: '', fact: '' },
      { id: 'b', name: 'b', emoji: '', lat: 0, lon: 10, short: '', fact: '' },
      { id: 'c', name: 'c', emoji: '', lat: 0, lon: 180, short: '', fact: '' },
    ];
    expect(isPlayableSet(tooFar, MOON_RADIUS)).toBe(false);
  });

  it('rejects a ring place as the hidden one', () => {
    // A ring point does not swing behind the limb the way a longitude does, so the drag it
    // asks for would never reveal anything. Saturn is the only world this can arise on.
    const saturn = DESTINATIONS.saturn?.mission.discoveries ?? [];
    const ringPlace = saturn.find((d) => d.ring !== undefined);
    expect(ringPlace).toBeDefined();
    const surface = saturn.filter((d) => d.ring === undefined).slice(0, 2);
    expect(isPlayableSet([...surface, ringPlace as Discovery], SATURN_RADIUS)).toBe(false);
  });

  it('rejects a place too near a pole to be tapped', () => {
    const polar: Discovery[] = [
      { id: 'a', name: 'a', emoji: '', lat: 0, lon: -30, short: '', fact: '' },
      { id: 'b', name: 'b', emoji: '', lat: 85, lon: 30, short: '', fact: '' },
      { id: 'c', name: 'c', emoji: '', lat: 0, lon: 100, short: '', fact: '' },
    ];
    expect(isPlayableSet(polar, MOON_RADIUS)).toBe(false);
  });

  it('accepts the Moon list the game shipped with', () => {
    expect(isPlayableSet(authoredSet(moon), MOON_RADIUS)).toBe(true);
  });
});

describe('chooseDiscoveries', () => {
  const moon = DESTINATIONS.moon?.mission.discoveries ?? [];

  it('hands back a short pool untouched rather than inventing a rule for it', () => {
    const three = moon.slice(0, 3);
    expect(chooseDiscoveries(three, [], MOON_RADIUS).map((d) => d.id)).toEqual(
      three.map((d) => d.id),
    );
  });

  it('never returns a partial set', () => {
    for (let roll = 0; roll < 20; roll++) {
      expect(chooseDiscoveries(moon, [], MOON_RADIUS, () => roll / 20)).toHaveLength(
        PLACES_PER_VISIT,
      );
    }
  });

  it('survives a random that returns exactly 1', () => {
    // Math.random() never does, but a stubbed one might, and the index would be off the end.
    expect(chooseDiscoveries(moon, [], MOON_RADIUS, () => 1)).toHaveLength(PLACES_PER_VISIT);
  });
});
