/**
 * Turning a world to one of its places (the Places card, owner's pick B,
 * `design/places/places-B.png`).
 *
 * Two parts, so the sunlit side stays the side the child is looking at: the world's held
 * surface turns about its own axis until the place's longitude faces the camera (`yaw`, fed
 * to `body.turnSurface`), and the camera tilts up or down about the world part of the way towards
 * the place's latitude (`pitch` about `pitchAxis`, fed to `controls.orbitAround`). A ring
 * place (Saturn) has no latitude of its own; the camera then looks down on the rings.
 *
 * Pure vector maths, no scene: everything is in world space and unit length.
 */
import * as THREE from 'three';

/** Looking down on a ring place from this elevation above the ring plane (radians). */
export const RING_VIEW_ELEVATION = 0.45;
/** The camera never tilts further than this from the world's equator (radians). */
export const MAX_VIEW_ELEVATION = 1.05;
/**
 * The camera tilts only part of the way to a place's latitude, and never more than this per
 * turn (radians): tilting all the way to a place far south swung the camera under the world,
 * onto its night side. A far-south place sits lower on the lit disc instead, with its mark.
 */
export const PITCH_SHARE = 0.5;
export const MAX_PITCH = 0.35;
/** And never closer than this to the scene's own poles, where orbit control clamps (radians). */
export const POLE_MARGIN = 0.22;

export interface PlaceTurn {
  /** Turn of the surface about its own axis (right-handed), radians. */
  yaw: number;
  /** Tilt of the camera about `pitchAxis`, radians. */
  pitch: number;
  pitchAxis: THREE.Vector3;
}

const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _c = new THREE.Vector3();

/**
 * @param place  direction from the world's centre to the place, now
 * @param axis   the world's spin axis (the held surface's +Y)
 * @param view   direction from the world's centre to the camera
 * @param ring   the place is on the ring plane, not the sphere
 */
export function placeTurn(place: THREE.Vector3, axis: THREE.Vector3, view: THREE.Vector3, ring = false): PlaceTurn {
  // Yaw: the angle round the axis from the place to the camera.
  _p.copy(place).addScaledVector(axis, -axis.dot(place));
  _v.copy(view).addScaledVector(axis, -axis.dot(view));
  const yaw = _p.lengthSq() < 1e-10 || _v.lengthSq() < 1e-10
    ? 0
    : Math.atan2(axis.dot(_c.crossVectors(_p, _v)), _p.dot(_v));

  // Pitch: from the camera's elevation above the equator to the place's.
  const current = Math.asin(THREE.MathUtils.clamp(axis.dot(view), -1, 1));
  const wanted = ring
    ? (current < 0 ? -RING_VIEW_ELEVATION : RING_VIEW_ELEVATION)
    : THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(axis.dot(place), -1, 1)), -MAX_VIEW_ELEVATION, MAX_VIEW_ELEVATION);
  const pitchAxis = new THREE.Vector3().crossVectors(view, axis);
  if (pitchAxis.lengthSq() < 1e-10) return { yaw, pitch: 0, pitchAxis: new THREE.Vector3(1, 0, 0) };
  pitchAxis.normalize();
  // Rotating `view` by a positive angle about view × axis moves it towards the axis.
  let pitch = ring ? wanted - current
    : THREE.MathUtils.clamp((wanted - current) * PITCH_SHARE, -MAX_PITCH, MAX_PITCH);
  // Keep clear of the scene's poles, where orbit control clamps and the turn would jump.
  const limit = Math.PI / 2 - POLE_MARGIN;
  for (let i = 0; i < 24; i++) {
    const after = _c.copy(view).applyAxisAngle(pitchAxis, pitch);
    if (Math.abs(Math.asin(THREE.MathUtils.clamp(after.y, -1, 1))) <= limit) break;
    pitch *= 0.85;
  }
  return { yaw, pitch, pitchAxis };
}

/** Ease for the turn: gentle at both ends. */
export function easeTurn(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Direction of a place in the surface mesh's own space. Longitude L sits at
 * atan2(x, z) = pi/2 + L, the convention the world textures are mapped with; a ring place is
 * in the equatorial plane.
 */
export function surfaceDirection(lat: number, lon: number): THREE.Vector3 {
  const latitude = THREE.MathUtils.degToRad(lat);
  const longitude = THREE.MathUtils.degToRad(lon);
  const cosLat = Math.cos(latitude);
  return new THREE.Vector3(
    cosLat * Math.cos(longitude),
    Math.sin(latitude),
    -cosLat * Math.sin(longitude),
  );
}
