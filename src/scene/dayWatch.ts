/**
 * Earth's day/night reference spot: where it starts, and when its change is worth saying.
 *
 * The hands-on turn showed a whole globe changing at once, with nothing to point at and say
 * "that went dark". One small marker on the surface gives the change a subject: it starts in
 * sunlight just before the visible sunset line, a short drag takes it into night, and
 * dragging back (or turning on round) brings it into morning. Nothing is counted, and no
 * full rotation is needed (DECISIONS.md, line 4).
 *
 * Pure apart from vector maths, so the placement and the acknowledgement rules are tested
 * without a renderer.
 */

import * as THREE from 'three';

/** How far into daylight the spot starts, measured round the spin axis from the sunset line. */
export const START_INTO_DAY = THREE.MathUtils.degToRad(35);
/**
 * Hysteresis on the sunlight test (the dot product of the spot's outward direction with the
 * Sun direction), so a slow drag along the terminator does not flicker between day and night.
 */
export const ENTER_NIGHT = -0.06;
export const ENTER_DAY = 0.06;
/**
 * The spot must face the camera at least this much for a change to be acknowledged. A change
 * that happens round the back is reported when the spot comes back into view, so the words
 * always describe something the child can see.
 */
export const IN_VIEW = 0.2;

/**
 * World direction for the spot: on the equator, `START_INTO_DAY` on the sunlit side of the
 * terminator that faces `view` (the camera's offset from the body when the turn starts, the
 * same side `dayTurnPose` frames). The equator crosses the terminator cleanly whatever the
 * tilt, and starts facing the camera.
 */
export function referenceDirection(
  sun: THREE.Vector3,
  axis: THREE.Vector3,
  view: THREE.Vector3,
  intoDay = START_INTO_DAY,
): THREE.Vector3 {
  const terminator = new THREE.Vector3().crossVectors(sun, axis);
  if (terminator.lengthSq() < 1e-8) terminator.crossVectors(sun, new THREE.Vector3(1, 0, 0));
  terminator.normalize();
  if (terminator.dot(view) < 0) terminator.negate();
  // The Sun's direction within the equatorial plane: the way "into daylight" points there.
  const sunward = sun.clone().addScaledVector(axis, -sun.dot(axis));
  if (sunward.lengthSq() < 1e-8) return terminator;
  sunward.normalize();
  return terminator.multiplyScalar(Math.cos(intoDay)).addScaledVector(sunward, Math.sin(intoDay)).normalize();
}

/**
 * What the child has just seen happen to the spot. `roundTrip` is the first return to
 * morning after a night: the moment the activity acknowledges and suggests what is next.
 */
export type DayEvent = 'night' | 'morning' | 'roundTrip';

export interface DayWatch {
  /** The spot's actual state, with hysteresis. Drives its sun/moon badge. */
  readonly lit: boolean;
  /** Night and then morning have both been seen this session. */
  readonly roundTrip: boolean;
  /** Start a session with the spot in daylight. */
  reset(): void;
  /**
   * One frame: `sunDot` is the spot's outward direction against the Sun direction, `viewDot`
   * against the direction to the camera. Returns a change once, when it can be seen.
   */
  observe(sunDot: number, viewDot: number): DayEvent | null;
}

export function createDayWatch(): DayWatch {
  let lit = true;
  let acknowledged = true;
  let sawNight = false;
  let roundTrip = false;
  return {
    get lit() { return lit; },
    get roundTrip() { return roundTrip; },
    reset() {
      lit = true;
      acknowledged = true;
      sawNight = false;
      roundTrip = false;
    },
    observe(sunDot, viewDot) {
      if (!Number.isFinite(sunDot) || !Number.isFinite(viewDot)) return null;
      if (lit && sunDot < ENTER_NIGHT) lit = false;
      else if (!lit && sunDot > ENTER_DAY) lit = true;
      if (lit === acknowledged || viewDot < IN_VIEW) return null;
      acknowledged = lit;
      if (!lit) {
        sawNight = true;
        return 'night';
      }
      if (sawNight && !roundTrip) {
        roundTrip = true;
        return 'roundTrip';
      }
      return 'morning';
    },
  };
}
