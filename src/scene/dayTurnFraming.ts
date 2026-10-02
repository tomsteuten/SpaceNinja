import * as THREE from 'three';
import { SUN_DIRECTION } from '../config';

/** A compressed teaching diagram, not a second astronomical Sun or a light source. */
export const TEACHING_SUN_DISTANCE = 2.5;
export const TEACHING_SUN_RADIUS = 0.3;
export const TEACHING_SUN_GLOW_RADIUS = 0.65;

/** Fits both silhouettes in the clear middle of the viewport, including a ringed world. */
export function dayTurnPose(
  radius: number,
  axis: THREE.Vector3,
  nearest: THREE.Vector3,
  fov: number,
  aspect: number,
) {
  const side = new THREE.Vector3().crossVectors(SUN_DIRECTION, axis);
  if (side.lengthSq() < 1e-6) side.crossVectors(SUN_DIRECTION, new THREE.Vector3(1, 0, 0));
  side.normalize();
  if (side.dot(nearest) < 0) side.negate();
  // A modest sunny-side angle still shows substantial night. Ringed worlds use their
  // silhouette radius; this changes only the shot, never the surface coordinates.
  const view = side.addScaledVector(SUN_DIRECTION, 0.16).normalize();
  // A tall screen has room above the world, not beside it. Roll the diagram toward the
  // light in portrait so the globe can stay large; the return restores the normal up axis.
  const cameraUp = new THREE.Vector3(0, 1, 0).lerp(SUN_DIRECTION, aspect < 1 ? 0.85 : 0).normalize();
  if (aspect > 1.8) {
    // Short landscape needs the opposite arrangement: spend width, preserve height.
    cameraUp.crossVectors(view, SUN_DIRECTION).normalize();
    if (cameraUp.y < 0) cameraUp.negate();
  }
  const right = new THREE.Vector3().crossVectors(cameraUp, view).normalize();
  const up = new THREE.Vector3().crossVectors(view, right).normalize();
  const look = SUN_DIRECTION.clone().multiplyScalar(radius * 0.65);
  const sun = SUN_DIRECTION.clone().multiplyScalar(radius * TEACHING_SUN_DISTANCE);
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  // Short landscape reserves the header and dock; portrait's width is the limiting edge.
  const usableY = aspect > 1.8 ? 0.56 : 0.74;
  const tanH = tanV * aspect * 0.88;
  const tanY = tanV * usableY;
  let distance = 0;
  for (const [position, size] of [
    [new THREE.Vector3(), radius],
    [sun, radius * TEACHING_SUN_GLOW_RADIUS],
  ] as const) {
    const relative = position.clone().sub(look);
    // Signed distance to each frustum plane: fit the sphere tangent, rather than a
    // whole depth-sized box that unnecessarily shrinks the globe on a tablet.
    distance = Math.max(distance, relative.dot(view) + Math.max(
      (Math.abs(relative.dot(right)) + size * Math.sqrt(1 + tanH * tanH)) / tanH,
      (Math.abs(relative.dot(up)) + size * Math.sqrt(1 + tanY * tanY)) / tanY,
    ));
  }
  return { position: look.clone().addScaledVector(view, distance), look, sun, up: cameraUp };
}
