import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SUN_DIRECTION, fovForAspect } from '../config';
import { dayTurnPose, TEACHING_SUN_GLOW_RADIUS } from './dayTurnFraming';

describe('day-turn teaching composition', () => {
  for (const [width, height] of [[390, 844], [1024, 768], [844, 390]]) {
    it(`fits both subjects and their gap at ${width} × ${height}, for plain and ringed worlds`, () => {
      const aspect = width! / height!;
      const camera = new THREE.PerspectiveCamera(fovForAspect(aspect), aspect, 0.05, 800);
      for (const radius of [0.27, 1, 3.45]) {
        const axis = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.41);
        const pose = dayTurnPose(radius, axis, SUN_DIRECTION, camera.fov, aspect);
        camera.position.copy(pose.position);
        camera.up.copy(pose.up);
        camera.lookAt(pose.look);
        camera.updateMatrixWorld(true);
        // Sample the complete bounding spheres, not just their centres.
        for (const [center, r] of [[new THREE.Vector3(), radius], [pose.sun, radius * TEACHING_SUN_GLOW_RADIUS]] as const) {
          for (let lat = -90; lat <= 90; lat += 15) {
            for (let lon = 0; lon < 360; lon += 15) {
              const point = new THREE.Vector3().setFromSphericalCoords(r,
                THREE.MathUtils.degToRad(90 - lat), THREE.MathUtils.degToRad(lon)).add(center).project(camera);
              expect(Math.abs(point.x)).toBeLessThan(0.9);
              expect(Math.abs(point.y)).toBeLessThan(aspect > 1.8 ? 0.57 : 0.75);
              expect(point.z).toBeGreaterThan(-1);
              expect(point.z).toBeLessThan(1);
            }
          }
        }
        const view = camera.position.clone().normalize();
        expect(Math.abs(view.dot(SUN_DIRECTION))).toBeLessThan(0.35);
        expect(Math.abs(view.dot(axis))).toBeLessThan(0.2);
        // The cue is beyond the limb and along exactly the direction used by the shaders.
        expect(pose.sun.clone().normalize().dot(SUN_DIRECTION)).toBeCloseTo(1, 10);
        expect(pose.sun.clone().cross(view).length()).toBeGreaterThan(radius * 1.8);
      }
    });
  }
});
