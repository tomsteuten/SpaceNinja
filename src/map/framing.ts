import * as THREE from 'three';

/**
 * The Space map's staging and framing, as pure maths.
 *
 * The map is not to scale and does not try to be: each page is a posed shot. The camera
 * looks from one fixed direction per screen shape, every companion world is turned along
 * its own orbit to a phase that lays the page out across the clear part of the screen, and
 * the camera is then placed so every silhouette fits between the heading, the arrows and
 * the cards. Orbits are paused while the map is up, so the composition holds still.
 */

/** A world as the map shot sees it: where it is and how much room its silhouette needs. */
export interface FramedBody {
  x: number;
  y: number;
  z: number;
  radius: number;
}

/** The clear part of the screen the worlds must fit inside, in CSS pixels. */
export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The viewport the shot is for: CSS size and vertical field of view in degrees. */
export interface Viewport {
  width: number;
  height: number;
  fov: number;
}

/**
 * A world's silhouette on screen, in CSS pixels: its exact extents, and the middle and half
 * size of those. Off the axis of a wide view a sphere projects as an ellipse stretched away
 * from the centre, so the extents are what the framing fits, not a circle round the centre.
 */
export interface Silhouette {
  left: number;
  right: number;
  top: number;
  bottom: number;
  x: number;
  y: number;
  radius: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/** The home view's bearing, kept so the map is lit the way the game always has been. */
const MAP_AZIMUTH = 0.9;
/**
 * How far above the orbits the camera sits. Landscape lays a page out side by side, so a
 * low camera is enough. Portrait stacks it, which needs a camera looking down: a world
 * further out along its orbit is then higher on screen as well as further away.
 */
const LANDSCAPE_ELEVATION = THREE.MathUtils.degToRad(20);
const PORTRAIT_ELEVATION = THREE.MathUtils.degToRad(60);

/** Unit vector from the shot's subject towards the camera, for a viewport shape. */
export function mapViewDirection(aspect: number): THREE.Vector3 {
  const elevation = aspect < 1 ? PORTRAIT_ELEVATION : LANDSCAPE_ELEVATION;
  return new THREE.Vector3(
    Math.cos(elevation) * Math.sin(MAP_AZIMUTH),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(MAP_AZIMUTH),
  );
}

/** The camera's right, up and forward for a view direction, with world up kept upright. */
export function viewBasis(direction: THREE.Vector3) {
  const forward = direction.clone().normalize().negate();
  const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  return { right, up, forward };
}

/**
 * Which way on screen the n-th companion of a page is laid out from the page's first world:
 * along the screen's long axis (right in landscape, up in portrait), alternately a little to
 * one side and the other so three worlds read as a gentle zigzag rather than a row of beads.
 */
export function companionAim(index: number, aspect: number): { x: number; y: number } {
  // Portrait is narrow, so its zigzag is tighter.
  const swing = THREE.MathUtils.degToRad((aspect < 1 ? [10, -8, 8, -10] : [20, -12, 12, -20])[index % 4]!);
  return aspect < 1
    ? { x: Math.sin(swing), y: Math.cos(swing) }
    : { x: Math.cos(swing), y: Math.sin(swing) };
}

/**
 * Where the parked ship waits beside home: on the far side of it from the companions (up and
 * to the left in landscape, down and to the left in portrait), in the plane facing the camera,
 * `distance` from home's centre. Every journey departs from here.
 */
export function shipSpot(home: THREE.Vector3, direction: THREE.Vector3, aspect: number, distance: number): THREE.Vector3 {
  const { right, up } = viewBasis(direction);
  const angle = THREE.MathUtils.degToRad(aspect < 1 ? 235 : 160);
  return home.clone()
    .addScaledVector(right, Math.cos(angle) * distance)
    .addScaledVector(up, Math.sin(angle) * distance);
}

/**
 * The orbit phase that puts a companion furthest along its aim from the page's first world,
 * without its silhouette touching anything already placed (seen orthographically along the
 * view, with room to spare). `positionAt` is the scene's own answer for where the body is at
 * a phase, so this never duplicates the scene graph's maths.
 */
export function choosePhase(options: {
  positionAt(phase: number): THREE.Vector3;
  radius: number;
  anchor: THREE.Vector3;
  placed: readonly FramedBody[];
  direction: THREE.Vector3;
  aim: { x: number; y: number };
  samples?: number;
}): number {
  const { right, up } = viewBasis(options.direction);
  const samples = options.samples ?? 360;
  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < samples; i++) {
    const phase = (i / samples) * Math.PI * 2;
    const position = options.positionAt(phase);
    const offset = position.clone().sub(options.anchor);
    let score = offset.dot(right) * options.aim.x + offset.dot(up) * options.aim.y;
    for (const other of options.placed) {
      const gap = position.clone().sub(new THREE.Vector3(other.x, other.y, other.z));
      const across = Math.hypot(gap.dot(right), gap.dot(up));
      if (across < (options.radius + other.radius) * 1.25 + 0.2) score -= 1000;
    }
    if (score > bestScore) {
      bestScore = score;
      best = phase;
    }
  }
  return best;
}

/**
 * The two slopes (screen coordinate over depth) of the planes through the camera that touch a
 * sphere at `across` sideways and `depth` ahead: the exact edges of its projection on one axis.
 */
function tangentSlopes(across: number, depth: number, radius: number): [number, number] {
  const ahead = Math.max(depth, radius * 1.001);
  const denominator = ahead * ahead - radius * radius;
  const spread = radius * Math.sqrt(Math.max(0, across * across + ahead * ahead - radius * radius));
  return [(across * ahead - spread) / denominator, (across * ahead + spread) / denominator];
}

/**
 * For a world with rings: the orbit phase at which its rings, seen from the map, open to the
 * classic three-quarter view (about as tall as `openness` times their width) rather than
 * showing edge-on as a line or face-on as a disc. `outlineAt` gives the ring rim at a phase.
 */
export function ringPhase(
  outlineAt: (phase: number) => THREE.Vector3[],
  direction: THREE.Vector3,
  openness = 0.45,
  samples = 120,
): number {
  const { right, up } = viewBasis(direction);
  let best = 0;
  let bestError = Infinity;
  for (let i = 0; i < samples; i++) {
    const phase = (i / samples) * Math.PI * 2;
    const rim = outlineAt(phase);
    if (rim.length < 3) return 0;
    const across = rim.map((point) => point.dot(right));
    const tall = rim.map((point) => point.dot(up));
    const ratio = (Math.max(...tall) - Math.min(...tall)) / Math.max(1e-6, Math.max(...across) - Math.min(...across));
    const error = Math.abs(ratio - openness);
    if (error < bestError - 1e-9) {
      bestError = error;
      best = phase;
    }
  }
  return best;
}

/** One world's silhouette on screen from a camera at `position` looking along `-direction`. */
export function screenSilhouette(
  body: FramedBody,
  position: THREE.Vector3,
  direction: THREE.Vector3,
  viewport: Viewport,
): Silhouette {
  const { right, up, forward } = viewBasis(direction);
  const tanY = Math.tan(THREE.MathUtils.degToRad(viewport.fov) / 2);
  const tanX = tanY * (viewport.width / viewport.height);
  const relative = new THREE.Vector3(body.x, body.y, body.z).sub(position);
  const depth = relative.dot(forward);
  const [xLow, xHigh] = tangentSlopes(relative.dot(right), depth, body.radius);
  const [yLow, yHigh] = tangentSlopes(relative.dot(up), depth, body.radius);
  const left = (xLow / tanX + 1) * viewport.width / 2;
  const rightEdge = (xHigh / tanX + 1) * viewport.width / 2;
  const top = (1 - yHigh / tanY) * viewport.height / 2;
  const bottom = (1 - yLow / tanY) * viewport.height / 2;
  return {
    left, right: rightEdge, top, bottom,
    x: (left + rightEdge) / 2,
    y: (top + bottom) / 2,
    radius: Math.max(rightEdge - left, bottom - top) / 2,
  };
}

/**
 * Where to put the camera so every world on the page fits the clear rectangle, as large as
 * it will go and centred in it. Iterative because perspective makes size depend on where the
 * camera ends up; it settles in a handful of steps for any page this game can have.
 */
export function composeShot(
  bodies: readonly FramedBody[],
  direction: THREE.Vector3,
  viewport: Viewport,
  rect: ScreenRect,
): { position: THREE.Vector3; look: THREE.Vector3; silhouettes: Silhouette[] } {
  const { right, up, forward } = viewBasis(direction);
  const view = direction.clone().normalize();
  const centre = new THREE.Vector3();
  let extent = 0;
  for (const body of bodies) centre.add(new THREE.Vector3(body.x, body.y, body.z));
  if (bodies.length) centre.divideScalar(bodies.length);
  for (const body of bodies) {
    extent = Math.max(extent, centre.distanceTo(new THREE.Vector3(body.x, body.y, body.z)) + body.radius);
  }
  extent = Math.max(extent, 0.5);
  const tanY = Math.tan(THREE.MathUtils.degToRad(viewport.fov) / 2);
  const tanX = tanY * (viewport.width / viewport.height);
  const targetX = (rect.left + rect.right) / 2;
  const targetY = (rect.top + rect.bottom) / 2;
  const width = Math.max(1, rect.right - rect.left);
  const height = Math.max(1, rect.bottom - rect.top);

  let distance = extent / Math.min(tanX, tanY) * 1.5;
  let across = 0;
  let lift = 0;
  const position = new THREE.Vector3();
  let silhouettes: Silhouette[] = [];
  for (let step = 0; step < 120; step++) {
    position.copy(centre).addScaledVector(view, distance).addScaledVector(right, across).addScaledVector(up, lift);
    silhouettes = bodies.map((body) => screenSilhouette(body, position, direction, viewport));
    const left = Math.min(...silhouettes.map((s) => s.left));
    const rightEdge = Math.max(...silhouettes.map((s) => s.right));
    const top = Math.min(...silhouettes.map((s) => s.top));
    const bottom = Math.max(...silhouettes.map((s) => s.bottom));
    const scale = Math.max((rightEdge - left) / width, (bottom - top) / height);
    // Moving the camera sideways moves the picture the other way, by the subject's depth.
    // Damped, because near and far worlds move by different amounts.
    across += 0.7 * (((left + rightEdge) / 2 - targetX) / (viewport.width / 2)) * tanX * distance;
    lift -= 0.7 * (((top + bottom) / 2 - targetY) / (viewport.height / 2)) * tanY * distance;
    distance *= Math.pow(scale, 0.7);
  }
  position.copy(centre).addScaledVector(view, distance).addScaledVector(right, across).addScaledVector(up, lift);
  silhouettes = bodies.map((body) => screenSilhouette(body, position, direction, viewport));
  return { position, look: position.clone().addScaledVector(forward, distance), silhouettes };
}
