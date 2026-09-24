/**
 * Where the camera, the ship and the place badges sit while exploring a world close up.
 *
 * Everything here is in the explored body's own *surface space*, scaled to a unit radius:
 * the same frame `surfaceDirection` in the collect mission uses, so a latitude and longitude
 * mean exactly what they mean on the texture. The caller converts to the scene with the
 * surface mesh's world matrix and the body's radius. Keeping the maths pure is what lets the
 * descent, the flight and the badges be tested without a renderer.
 */
import * as THREE from 'three';
import type { FlightState } from './model';
import { LATITUDE_LIMIT, clamp } from './model';

/** Unit vector for a latitude/longitude in radians, in surface space. */
export function direction(lat: number, lon: number, target = new THREE.Vector3()) {
  return target.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
}

/** The latitude and longitude directly beneath a surface-space position. */
export function subPoint(position: THREE.Vector3) {
  const length = position.length() || 1;
  return { lat: Math.asin(clamp(position.y / length, -1, 1)), lon: Math.atan2(-position.z, position.x) };
}

export function basis(lat: number, lon: number, heading = 0) {
  const up = direction(lat, lon);
  const north = new THREE.Vector3(-Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon));
  const east = new THREE.Vector3(-Math.sin(lon), 0, -Math.cos(lon));
  return { up, forward: north.multiplyScalar(Math.cos(heading)).addScaledVector(east, Math.sin(heading)), east };
}

export interface Pose { position: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3 }

/**
 * The exploring camera: a little behind and above the point being flown over, looking ahead
 * along the heading with the ground as the horizon. An orbital world (Saturn) is a subject to
 * circle rather than a ground to skim, so it looks at the centre with the planet's axis up.
 */
export function explorePose(state: FlightState, orbital: boolean): Pose {
  const frame = basis(state.lat, state.lon, state.heading);
  const height = state.altitude;
  return {
    position: frame.up.clone().multiplyScalar(1 + height).addScaledVector(frame.forward, -height * 0.35),
    target: orbital ? new THREE.Vector3() : frame.up.clone().addScaledVector(frame.forward, height * 0.4),
    up: orbital ? new THREE.Vector3(0, 1, 0) : frame.up,
  };
}

/** The ship rides just below the camera's line of sight, nose along the heading. */
export function shipPose(state: FlightState) {
  const frame = basis(state.lat, state.lon, state.heading);
  const height = state.altitude;
  return {
    position: frame.up.clone().multiplyScalar(1 + height * 0.42).addScaledVector(frame.forward, height * 0.05),
    forward: frame.forward,
    up: frame.up,
    /** In body radii; the caller multiplies by the model's own length. */
    length: height * 0.11,
  };
}

/**
 * Blend between two poses without cutting through the body: the camera's direction from the
 * centre and its distance are eased separately, so a descent bows round the globe rather than
 * taking the straight chord between the two points.
 */
export function blendPose(from: Pose, to: Pose, t: number): Pose {
  const distance = THREE.MathUtils.lerp(from.position.length(), to.position.length(), t);
  const heading = from.position.clone().normalize().lerp(to.position.clone().normalize(), t);
  if (heading.lengthSq() < 1e-8) heading.copy(to.position).normalize();
  const up = from.up.clone().lerp(to.up, t);
  if (up.lengthSq() < 1e-8) up.copy(to.up);
  return {
    position: heading.normalize().multiplyScalar(distance),
    target: from.target.clone().lerp(to.target, t),
    up: up.normalize(),
  };
}

/**
 * The place to begin exploring after arriving: directly beneath the arrival camera, which the
 * flight already put on the lit face, so the descent drops straight down rather than swinging
 * round to a far-side place. Kept away from the poles the flight model steers clear of.
 */
export function descentStart(arrivalCamera: THREE.Vector3) {
  const point = subPoint(arrivalCamera);
  return { lat: clamp(point.lat, -LATITUDE_LIMIT * 0.85, LATITUDE_LIMIT * 0.85), lon: point.lon };
}

/** True when the straight line from the camera to the point passes through the body. */
export function occluded(camera: THREE.Vector3, point: THREE.Vector3, radius = 0.995) {
  const ray = point.clone().sub(camera);
  const length = ray.length();
  if (length < 1e-9) return false;
  ray.divideScalar(length);
  const b = camera.dot(ray);
  const c = camera.lengthSq() - radius * radius;
  const disc = b * b - c;
  if (disc <= 0) return false;
  const near = -b - Math.sqrt(disc);
  return near > 1e-6 && near < length;
}

/**
 * How visible a surface badge is from here: 1 on the open face, fading to 0 just before the
 * limb, where the body would hide it. Lifted points (rings) only need to be unobstructed.
 */
export function badgeVisibility(camera: THREE.Vector3, point: THREE.Vector3) {
  if (occluded(camera, point)) return 0;
  const lift = point.length();
  if (lift > 1.1) return 1;
  // Angle between the point and the horizon seen from the camera: 0 at the limb.
  const horizon = Math.acos(clamp(1 / camera.length(), -1, 1));
  const angle = camera.angleTo(point);
  return clamp((horizon - angle) / 0.12, 0, 1);
}
