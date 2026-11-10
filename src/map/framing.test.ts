import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SUN_DIRECTION, fovForAspect } from '../config';
import { worldGeometry, viewRadius } from '../worlds/catalogue';
import {
  choosePhase, companionAim, composeShot, mapViewDirection, ringPhase, screenSilhouette, shipSpot, viewBasis,
  type Silhouette, type FramedBody, type ScreenRect,
} from './framing';

/** An orbit built the way Bodies.ts builds one: tilt group, orbit group, anchor at the radius. */
function orbit(id: string) {
  const spec = worldGeometry(id).orbit!;
  const tilt = new THREE.Group();
  tilt.rotation.x = spec.tilt;
  const turn = new THREE.Group();
  const anchor = new THREE.Group();
  anchor.position.x = spec.radius;
  turn.add(anchor);
  tilt.add(turn);
  return (phase: number) => {
    turn.rotation.y = phase;
    tilt.updateMatrixWorld(true);
    return anchor.getWorldPosition(new THREE.Vector3());
  };
}

const at = (v: THREE.Vector3, radius: number): FramedBody => ({ x: v.x, y: v.y, z: v.z, radius });

function inside(shape: Silhouette, rect: ScreenRect, slack = 0.5) {
  return shape.left >= rect.left - slack && shape.right <= rect.right + slack &&
    shape.top >= rect.top - slack && shape.bottom <= rect.bottom + slack;
}

/** Home's page posed and framed as the map does it, with the parked ship beside Earth. */
function homePage(width: number, height: number, rect: ScreenRect) {
  const aspect = width / height;
  const direction = mapViewDirection(aspect);
  // Earth wearing its hint ring (the widest it gets), and the ship staged beside it.
  const home = new THREE.Vector3();
  const ring = 1.48;
  const placed: FramedBody[] = [at(home, ring), at(shipSpot(home, direction, aspect, ring + 0.3 + 0.4), 0.3)];
  (['moon', 'mars'] as const).forEach((id, n) => {
    const positionAt = orbit(id);
    const radius = worldGeometry(id).radius;
    const phase = choosePhase({ positionAt, radius, anchor: new THREE.Vector3(), placed, direction, aim: companionAim(n, aspect) });
    placed.push(at(positionAt(phase), radius));
  });
  const shot = composeShot(placed, direction, { width, height, fov: fovForAspect(aspect) }, rect);
  return { shot, earth: shot.silhouettes[0]!, ship: shot.silhouettes[1]!, moon: shot.silhouettes[2]!, mars: shot.silhouettes[3]! };
}

const PHONES: [string, number, number, ScreenRect][] = [
  ['portrait 360x740', 360, 740, { left: 22, right: 338, top: 82, bottom: 534 }],
  ['landscape 800x360', 800, 360, { left: 98, right: 702, top: 74, bottom: 258 }],
];

describe('map view', () => {
  it('looks from the sunlit side, higher in portrait so a page can stack', () => {
    const portrait = mapViewDirection(360 / 740);
    const landscape = mapViewDirection(800 / 360);
    expect(portrait.y).toBeGreaterThan(landscape.y);
    for (const view of [portrait, landscape]) {
      expect(view.length()).toBeCloseTo(1);
      expect(view.dot(SUN_DIRECTION)).toBeGreaterThan(0.6);
    }
  });

  it('keeps world up upright on screen', () => {
    const { right, up, forward } = viewBasis(mapViewDirection(1.5));
    expect(right.y).toBeCloseTo(0);
    expect(up.y).toBeGreaterThan(0);
    expect(forward.dot(mapViewDirection(1.5))).toBeCloseTo(-1);
  });
});

describe('page staging', () => {
  it('turns a companion along its orbit towards its aim, clear of what is placed', () => {
    const direction = mapViewDirection(2);
    const { right, up } = viewBasis(direction);
    const earth = { x: 0, y: 0, z: 0, radius: 1 };
    const positionAt = orbit('moon');
    const phase = choosePhase({ positionAt, radius: 0.27, anchor: new THREE.Vector3(), placed: [earth], direction, aim: { x: 1, y: 0 } });
    const moon = positionAt(phase);
    // Out to the right of Earth on screen, nearly the whole orbit radius across.
    expect(moon.dot(right)).toBeGreaterThan(2.3);
    expect(Math.abs(moon.dot(up))).toBeLessThan(0.6);
  });

  it('never lays a companion over a world already placed', () => {
    const direction = mapViewDirection(2);
    const { right, up } = viewBasis(direction);
    const positionAt = orbit('moon');
    // Something sits exactly where the Moon would most like to go.
    const best = positionAt(choosePhase({ positionAt, radius: 0.27, anchor: new THREE.Vector3(), placed: [], direction, aim: { x: 1, y: 0 } }));
    const blocker = at(best, 0.5);
    const moon = positionAt(choosePhase({ positionAt, radius: 0.27, anchor: new THREE.Vector3(), placed: [blocker], direction, aim: { x: 1, y: 0 } }));
    const gap = moon.clone().sub(best);
    expect(Math.hypot(gap.dot(right), gap.dot(up))).toBeGreaterThan(0.77 * 1.25);
  });

  it('turns a ringed world to show its rings at a three-quarter tilt, not edge-on', () => {
    // Saturn's rig as Bodies.ts builds it: orbit tilt, orbit turn, anchor, axial tilt.
    const saturn = worldGeometry('saturn');
    const tilt = new THREE.Group();
    tilt.rotation.x = saturn.orbit!.tilt;
    const turn = new THREE.Group();
    const anchor = new THREE.Group();
    anchor.position.x = saturn.orbit!.radius;
    const axis = new THREE.Group();
    axis.rotation.z = saturn.axialTilt!;
    anchor.add(axis); turn.add(anchor); tilt.add(turn);
    const rimAt = (phase: number) => {
      turn.rotation.y = phase;
      tilt.updateMatrixWorld(true);
      return Array.from({ length: 32 }, (_, i) => axis.localToWorld(new THREE.Vector3(
        Math.cos((i / 32) * Math.PI * 2) * viewRadius(saturn), 0, Math.sin((i / 32) * Math.PI * 2) * viewRadius(saturn))));
    };
    for (const aspect of [800 / 360, 360 / 740]) {
      const direction = mapViewDirection(aspect);
      const { right, up } = viewBasis(direction);
      const rim = rimAt(ringPhase(rimAt, direction));
      const tall = Math.max(...rim.map((p) => p.dot(up))) - Math.min(...rim.map((p) => p.dot(up)));
      const wide = Math.max(...rim.map((p) => p.dot(right))) - Math.min(...rim.map((p) => p.dot(right)));
      expect(tall / wide).toBeGreaterThan(0.4);
      expect(tall / wide).toBeLessThan(0.65);
    }
  });

  it('zigzags companions to alternate sides of the long axis', () => {
    expect(companionAim(0, 2).y).toBeGreaterThan(0);
    expect(companionAim(1, 2).y).toBeLessThan(0);
    expect(companionAim(0, 0.5).x).toBeGreaterThan(0);
    expect(companionAim(1, 0.5).x).toBeLessThan(0);
    expect(companionAim(0, 0.5).y).toBeGreaterThan(0.9);
  });
});

describe('page framing', () => {
  it('measures a silhouette the way the renderer draws it, off-axis stretch included', () => {
    const viewport = { width: 800, height: 360, fov: 52 };
    const direction = mapViewDirection(viewport.width / viewport.height);
    const { right, up } = viewBasis(direction);
    const position = new THREE.Vector3(2, 3, 9);
    const camera = new THREE.PerspectiveCamera(viewport.fov, viewport.width / viewport.height, 0.05, 800);
    camera.position.copy(position);
    camera.lookAt(position.clone().sub(direction));
    camera.updateMatrixWorld(true);
    // Well out towards the right edge of a wide landscape view, and a little up.
    const centre = position.clone().addScaledVector(direction, -8).addScaledVector(right, 6).addScaledVector(up, 1.5);
    const body = { x: centre.x, y: centre.y, z: centre.z, radius: 0.9 };
    const drawn = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (let i = 0; i <= 120; i++) for (let j = 0; j < 240; j++) {
      const theta = (i / 120) * Math.PI;
      const phi = (j / 240) * Math.PI * 2;
      const point = new THREE.Vector3().setFromSphericalCoords(body.radius, theta, phi).add(centre).project(camera);
      const x = (point.x + 1) * viewport.width / 2;
      const y = (1 - point.y) * viewport.height / 2;
      drawn.left = Math.min(drawn.left, x); drawn.right = Math.max(drawn.right, x);
      drawn.top = Math.min(drawn.top, y); drawn.bottom = Math.max(drawn.bottom, y);
    }
    const measured = screenSilhouette(body, position, direction, viewport);
    expect(Math.abs(measured.left - drawn.left)).toBeLessThan(0.5);
    expect(Math.abs(measured.right - drawn.right)).toBeLessThan(0.5);
    expect(Math.abs(measured.top - drawn.top)).toBeLessThan(0.5);
    expect(Math.abs(measured.bottom - drawn.bottom)).toBeLessThan(0.5);
    // Wider than a circle of its on-axis size: the stretch the framing must allow for.
    expect(measured.right - measured.left).toBeGreaterThan(measured.bottom - measured.top);
  });

  it('frames a lone world as large as the clear area allows, centred in it', () => {
    const rect = { left: 100, right: 700, top: 70, bottom: 250 };
    const saturn = { x: 4, y: 1, z: -5, radius: viewRadius(worldGeometry('saturn')) };
    const shot = composeShot([saturn], mapViewDirection(800 / 360), { width: 800, height: 360, fov: 52 }, rect);
    const [circle] = shot.silhouettes;
    expect(circle!.x).toBeCloseTo(400, 0);
    expect(circle!.y).toBeCloseTo(160, 0);
    expect(circle!.radius * 2).toBeCloseTo(180, 0);
    // The camera looks along the map direction at the subject.
    const seen = screenSilhouette(saturn, shot.position, mapViewDirection(800 / 360), { width: 800, height: 360, fov: 52 });
    expect(seen.x).toBeCloseTo(circle!.x);
    expect(shot.look.clone().sub(shot.position).normalize().dot(mapViewDirection(800 / 360))).toBeCloseTo(-1);
  });

  for (const [name, width, height, rect] of PHONES) {
    it(`fits home's page on a ${name} phone: big, apart, clear of the controls`, () => {
      const { shot, earth, moon, mars } = homePage(width, height, rect);
      for (const shape of shot.silhouettes) expect(inside(shape, rect)).toBe(true);
      // Tight in one direction: as large as the room allows.
      const box = {
        w: Math.max(...shot.silhouettes.map((c) => c.right)) - Math.min(...shot.silhouettes.map((c) => c.left)),
        h: Math.max(...shot.silhouettes.map((c) => c.bottom)) - Math.min(...shot.silhouettes.map((c) => c.top)),
      };
      expect(Math.max(box.w / (rect.right - rect.left), box.h / (rect.bottom - rect.top))).toBeCloseTo(1, 2);
      // No two silhouettes touch, ship included.
      shot.silhouettes.forEach((a, i) => shot.silhouettes.slice(i + 1).forEach((b) => {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius + 4);
      }));
      // Clearly visible: Earth big, the Moon and Mars well past a speck.
      expect(earth.radius * 2).toBeGreaterThan(100);
      expect(mars.radius * 2).toBeGreaterThan(40);
      expect(moon.radius * 2).toBeGreaterThan(24);
      // The Moon belongs to Earth: it is nearer Earth than Mars is.
      expect(Math.hypot(moon.x - earth.x, moon.y - earth.y)).toBeLessThan(Math.hypot(mars.x - earth.x, mars.y - earth.y));
    });
  }
});
