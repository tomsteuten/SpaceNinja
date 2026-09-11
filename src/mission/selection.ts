/**
 * Which places a world shows *this* visit.
 *
 * The game had no reason to be played twice. `CollectMission` never read progress, so every
 * arrival re-presented the same three places at the same coordinates with the same words,
 * and the arrival composition is deliberately pinned identical — twelve discoveries, one tap
 * each, was the whole game. The fix is content plus this: worlds carry more places than they
 * show, and each visit picks a set.
 *
 * Picking is not free, because the arrival composition is not arbitrary. A set has to satisfy
 * every rule the hand-authored triples satisfied, and those rules were previously guaranteed
 * by a person checking a test. Now they have to be guaranteed by construction on a set nobody
 * chose in advance:
 *
 * - Exactly one place over the horizon, and it must be the **last** in the list. That one is
 *   the drag lesson — the whole reason the placement design exists — and more than one hidden
 *   leaves the arrival looking empty.
 * - That hidden one past the limb but within a single drag. Far past it is a half-turn across
 *   an unlit hemisphere, which a five-year-old abandons.
 * - The ones in view genuinely apart, not stacked on each other.
 * - Nothing near a pole, where a hit sphere foreshortens to nothing and cannot be tapped.
 * - No two hit spheres overlapping, or a tap silently scores the wrong place.
 * - The hidden one never a ring place. A ring or a pole does not swing behind the limb the
 *   way a longitude does, so it cannot teach the drag (see `Discovery.ring`).
 *
 * `placementAngles` is the oracle for the angular rules rather than a reimplementation of
 * them, so the picker and the tests cannot drift apart: if the arrival maths changes, this
 * changes with it.
 */

import * as THREE from 'three';

import type { Discovery } from '../config';
import { arrivalComposition, hitRadiusFor, markerPlacement, placementAngles } from './CollectMission';

/** How many places a world shows on one visit. The count the mission HUD has always drawn. */
export const PLACES_PER_VISIT = 3;

/**
 * Half the angle subtended by the visible face at arrival, in radians (~72°).
 *
 * Was 1.4 (~80°) when the flight stopped 9.6 body-radii out. It arrives at ~3.2 now, and a
 * nearer camera sees *less* of a sphere, not more: acos(1/3.2) is 71.7°.
 */
export const VISIBLE_LIMB = 1.25;
/**
 * How far past the limb the hidden one may be (~132°).
 *
 * The Moon's far side sits at 180 and needed about 100 degrees of dragging before this bound
 * existed; the collectible it replaced sat at 116, needing about 45, which is the feel being
 * preserved.
 */
export const DRAG_BOUND = 2.3;
/** Below this the two in view read as one target with a smudge beside it. */
export const MIN_YAW_SEPARATION = 0.3;
/** Nearer the pole than this and the hit sphere foreshortens away (see the pole test). */
export const POLE_GUARD = Math.PI / 2 - 0.6;

/** A source of randomness, injected so a test can pin the choice. */
export type Random = () => number;

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i <= items.length - size; i++) {
    const head = items[i] as T;
    for (const rest of combinations(items.slice(i + 1), size - 1)) out.push([head, ...rest]);
  }
  return out;
}

/**
 * Does this ordered set play the way an arrival has to?
 *
 * Ordered, because the last entry is the hidden one by contract — `placementAngles` faces the
 * body at the mean of all *but* the last, so the order is what decides the composition rather
 * than merely describing it.
 */
export function isPlayableSet(set: readonly Discovery[], bodyRadius: number): boolean {
  if (set.length < 2) return false;
  const hidden = set[set.length - 1] as Discovery;
  // A ring place cannot be the hidden one: it does not swing behind the limb the way a
  // longitude does, so it would ask for a drag that never reveals anything.
  if (hidden.ring !== undefined) return false;

  // A longitude check alone misses low targets on a tilted globe and edge-on rings.
  if (arrivalComposition(set as Discovery[]).clearance < 0.46) return false;
  const angles = placementAngles(set as Discovery[]);
  const beyond = angles.filter(([yaw]) => Math.abs(yaw) > VISIBLE_LIMB);
  if (beyond.length !== 1) return false;

  const last = angles[angles.length - 1] as [number, number];
  if (Math.abs(last[0]) <= VISIBLE_LIMB || Math.abs(last[0]) >= DRAG_BOUND) return false;
  if (angles.some(([, pitch]) => Math.abs(pitch) >= POLE_GUARD)) return false;

  const inView = angles.slice(0, -1).map(([yaw]) => yaw);
  for (const [i, yaw] of inView.entries()) {
    for (const other of inView.slice(i + 1)) {
      if (Math.abs(yaw - other) <= MIN_YAW_SEPARATION) return false;
    }
  }

  // And the hit spheres, which are invisible and deliberately enormous. Two growing into
  // each other is a bug nobody would see: the tap simply scores the wrong place, sometimes.
  const clearance = hitRadiusFor(bodyRadius) * 2;
  const points = set.map((discovery) => markerPlacement(discovery, bodyRadius).position);
  for (const [i, a] of points.entries()) {
    for (const b of points.slice(i + 1)) {
      if ((a as THREE.Vector3).distanceTo(b as THREE.Vector3) <= clearance) return false;
    }
  }
  return true;
}

/**
 * Every ordered set of `count` places from this pool that plays.
 *
 * Brute force on purpose. A pool of eight yields 168 candidates for a set of three, each
 * check is a handful of trig, and it runs once per arrival — so the honest, obviously correct
 * enumeration is cheaper than the cleverness that would replace it. Exported because the
 * tests need it to establish the property that actually matters: that *every* place a world
 * carries appears in at least one playable set, or the journal could never be filled and the
 * game could never be finished.
 */
export function playableSets(
  pool: readonly Discovery[],
  bodyRadius: number,
  count = PLACES_PER_VISIT,
): Discovery[][] {
  if (pool.length < count) return [];
  const sets: Discovery[][] = [];
  for (const inView of combinations(pool, count - 1)) {
    const chosen = new Set(inView.map((discovery) => discovery.id));
    for (const hidden of pool) {
      if (chosen.has(hidden.id)) continue;
      const candidate = [...inView, hidden];
      if (isPlayableSet(candidate, bodyRadius)) sets.push(candidate);
    }
  }
  return sets;
}

/**
 * The world's own triple: the opening places plus the last one, which is the hidden entry by
 * the authoring convention every list follows. The floor when nothing else plays.
 */
export function authoredSet(pool: readonly Discovery[], count = PLACES_PER_VISIT): Discovery[] {
  if (pool.length <= count) return [...pool];
  return [...pool.slice(0, count - 1), pool[pool.length - 1] as Discovery];
}

/**
 * The places for this visit: playable, and weighted towards ones not yet found.
 *
 * Unfound-first rather than unfound-only. A child who has found nine of a world's twelve
 * should not be handed a set that is impossible to complete because the three that remain
 * cannot legally share an arrival, and being shown a place you have already found is not a
 * failure — the badge is still on it, and it is a moment of "I know this one".
 *
 * Falls back to `authoredSet`, which is the triple this game shipped with: the first places
 * in the list plus the *last* one as the hidden entry, because last-is-hidden is the authoring
 * convention every world's list already follows. A floor of the previous behaviour rather than
 * a broken arrival. Taking simply the first `count` would not do it — the extra places were
 * inserted in the middle, so the last authored entry is still the one written to be found by
 * dragging.
 */
export function chooseDiscoveries(
  pool: readonly Discovery[],
  found: readonly string[],
  bodyRadius: number,
  random: Random = Math.random,
  count = PLACES_PER_VISIT,
): Discovery[] {
  if (pool.length <= count) return [...pool];
  const sets = playableSets(pool, bodyRadius, count);
  if (sets.length === 0) return authoredSet(pool, count);

  const foundIds = new Set(found);
  let best = -1;
  let bestSets: Discovery[][] = [];
  for (const set of sets) {
    const fresh = set.filter((discovery) => !foundIds.has(discovery.id)).length;
    if (fresh > best) {
      best = fresh;
      bestSets = [set];
    } else if (fresh === best) {
      bestSets.push(set);
    }
  }
  const index = Math.min(bestSets.length - 1, Math.floor(random() * bestSets.length));
  return bestSets[index] as Discovery[];
}
