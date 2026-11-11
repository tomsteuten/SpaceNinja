import * as THREE from 'three';
import { fovForAspect } from '../config';
import { smootherstep } from '../flight/FlightSequence';
import type { HomePose } from '../flight/HomeReturn';
import type { OrbitInput } from '../controls/OrbitInput';
import { BODY_IDS, type BodyId, type World } from '../scene/Bodies';
import { choosePhase, companionAim, composeShot, mapViewDirection, ringPhase, shipSpot, type FramedBody } from './framing';
import { childPages, hintDirection, homePage, pageOf, stepPage, suggestionOrder } from './model';
import { createMapUI, type MapChoice } from './ui';

/** A page change is a short move, cut under reduced motion. */
export const MAP_PAGE_SECONDS = 0.6;
const SWIPE_DISTANCE = 50;
const TAP_DISTANCE = 12;
const TAP_MS = 400;

export interface SpaceMapOptions {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  world: World;
  controls: OrbitInput;
  /** The parked ship: drawn on home's page beside Earth, where every journey departs from. */
  ship: THREE.Object3D;
  reducedMotion: boolean;
  /** A panel, toy or the grown-ups screen has the child's attention: the map takes no input. */
  covered(): boolean;
  /** A world's card: its name and what has been done there. */
  describe(id: BodyId): MapChoice;
  /** A card was pressed: one tap, one journey. */
  launch(id: BodyId): void;
  /** A clean tap on the scene; the caller raycasts it (a world there launches too). */
  tap(clientX: number, clientY: number): void;
  /** The page changed, so the heading should say what the hint now says. */
  onPage(): void;
  /** Where the heading ends at the top of the screen, in client pixels. */
  headingBottom(): number;
}

export type SpaceMap = ReturnType<typeof createSpaceMap>;

/**
 * The home Space map: one neighbourhood of worlds per page (src/map/model.ts), paged with
 * the big arrows, a swipe on the scene or the Left/Right keys.
 *
 * While it is up it owns the camera, and only then: it takes over after a return has landed
 * and lets go before a journey starts, and nothing can page while either is running. Each
 * page is a posed shot (src/map/framing.ts): orbits pause, companions are turned along their
 * own orbits into place and the camera is fitted to the clear part of the screen.
 */
export function createSpaceMap(options: SpaceMapOptions) {
  const { canvas, camera, world, controls, ship, reducedMotion } = options;
  const pages = childPages<BodyId>(BODY_IDS);
  /** The hint's order: home's neighbourhood, then outward from the Sun. */
  const order = suggestionOrder(pages);

  let page = homePage(pages);
  let active = false;
  let suggested: BodyId | null = null;
  const look = new THREE.Vector3();
  let move: {
    fromPosition: THREE.Vector3; fromLook: THREE.Vector3;
    toPosition: THREE.Vector3; toLook: THREE.Vector3;
    t: number;
  } | null = null;
  let returning: { from: Map<BodyId, number>; to: Map<BodyId, number> } | null = null;

  const ui = createMapUI(options.root, {
    choose(id) {
      if (!active || options.covered()) return;
      options.launch(id as BodyId);
    },
    step,
  });

  function worldsOn(index: number): readonly BodyId[] {
    return pages[index] ?? [];
  }

  function hint(): -1 | 0 | 1 | null {
    return hintDirection(pages, page, suggested);
  }

  function render() {
    const neighbour = (index: number) => {
      const first = pages[index]?.[0];
      return first ? options.describe(first) : null;
    };
    const direction = hint();
    ui.render({
      page,
      pageCount: pages.length,
      choices: worldsOn(page).map((id) => options.describe(id)),
      previous: page > 0 ? neighbour(page - 1) : null,
      next: page < pages.length - 1 ? neighbour(page + 1) : null,
      suggested: direction === 0 ? suggested : null,
      hintArrow: direction === -1 || direction === 1 ? direction : null,
    });
  }

  /**
   * The parked ship's size, measured once while it is parked. It is staged too: it waits
   * beside Earth on the side away from the companions (`shipSpot`), so it never covers a
   * world, and every journey departs from there.
   */
  const shipRadius = (() => {
    const bounds = new THREE.Box3();
    ship.updateWorldMatrix(true, true);
    ship.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) bounds.expandByObject(object);
    });
    const size = bounds.getSize(new THREE.Vector3());
    return Math.max(size.x, size.y, size.z) / 2;
  })();

  /** Where the ship waits for this screen shape: clear of Earth and its ring. */
  function parkedShip(): THREE.Vector3 {
    const earth = world.bodies.earth.getWorldPosition(new THREE.Vector3());
    const aspect = innerWidth / innerHeight;
    return shipSpot(earth, mapViewDirection(aspect), aspect, world.mapFootprint('earth', true).radius + shipRadius + 0.4);
  }

  /** A world as something to keep companions clear of: its whole reach, rings included. */
  function obstacle(id: BodyId): FramedBody {
    const position = world.bodies[id].getWorldPosition(new THREE.Vector3());
    return { x: position.x, y: position.y, z: position.z, radius: world.mapFootprint(id, id === suggested).reach };
  }

  /** A world as the shot fits it: its sphere (or hint ring), and any rings by their rim. */
  function framed(id: BodyId): FramedBody[] {
    const position = world.bodies[id].getWorldPosition(new THREE.Vector3());
    const { radius, outline } = world.mapFootprint(id, id === suggested);
    return [
      { x: position.x, y: position.y, z: position.z, radius },
      ...outline.map((point) => ({ x: point.x, y: point.y, z: point.z, radius: 0.02 })),
    ];
  }

  /**
   * Pose a page: its first world stays where it is, and each companion is turned along its
   * own orbit to lie across the screen from it. Leaves the bodies there; returns what the
   * shot must fit (the ship included on home's page).
   */
  function stage(index: number): FramedBody[] {
    const ids = worldsOn(index);
    const direction = mapViewDirection(innerWidth / innerHeight);
    // A ringed first world is turned along its orbit until its rings face the camera at a
    // three-quarter tilt; a plain sphere looks the same anywhere, so it stays where it is.
    const first = ids[0]!;
    if (world.orbitPhase(first) !== null && world.mapFootprint(first, false).outline.length) {
      world.setOrbitPhase(first, ringPhase((angle) => {
        world.setOrbitPhase(first, angle);
        return world.mapFootprint(first, false).outline;
      }, direction));
    }
    const anchor = world.bodies[ids[0]!].getWorldPosition(new THREE.Vector3());
    const placed: FramedBody[] = [obstacle(ids[0]!)];
    const parked: FramedBody[] = [];
    if (ids.includes('earth')) {
      const spot = parkedShip();
      parked.push({ x: spot.x, y: spot.y, z: spot.z, radius: shipRadius });
      placed.push(...parked);
    }
    ids.slice(1).forEach((id, n) => {
      if (world.orbitPhase(id) !== null) {
        const phase = choosePhase({
          positionAt: (angle) => {
            world.setOrbitPhase(id, angle);
            return world.bodies[id].getWorldPosition(new THREE.Vector3());
          },
          radius: world.mapFootprint(id, id === suggested).reach,
          anchor,
          placed,
          direction,
          aim: companionAim(n, innerWidth / innerHeight),
        });
        world.setOrbitPhase(id, phase);
      }
      placed.push(obstacle(id));
    });
    return [...ids.flatMap(framed), ...parked];
  }

  /** Where the camera goes for a staged page. The controls must already show that page. */
  function shot(bodies: readonly FramedBody[]): HomePose {
    const aspect = innerWidth / innerHeight;
    return composeShot(bodies, mapViewDirection(aspect),
      { width: innerWidth, height: innerHeight, fov: fovForAspect(aspect) },
      ui.clearRect(options.headingBottom()));
  }

  function place(pose: HomePose) {
    camera.position.copy(pose.position);
    look.copy(pose.look);
    camera.lookAt(look);
    camera.updateMatrixWorld(true);
  }

  function showOnly(ids: Iterable<BodyId>) {
    const shown = new Set(ids);
    world.setShown(shown);
    ship.visible = shown.has('earth');
  }

  function finishMove() {
    if (!move) return;
    place({ position: move.toPosition, look: move.toLook });
    move = null;
    showOnly(worldsOn(page));
  }

  /** Glide from wherever the camera is to a pose, or cut there under reduced motion. */
  function moveTo(pose: HomePose, glide: boolean) {
    if (!glide || reducedMotion || camera.position.distanceTo(pose.position) < 1e-3) {
      move = null;
      place(pose);
      showOnly(worldsOn(page));
      return;
    }
    // From where the camera is actually looking: after a return that is not the last pose
    // this map set, and mid-glide it is the glide's own look point.
    const reach = move ? camera.position.distanceTo(look) : pose.position.distanceTo(pose.look);
    const fromLook = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(reach).add(camera.position);
    move = {
      fromPosition: camera.position.clone(), fromLook,
      toPosition: pose.position.clone(), toLook: pose.look.clone(), t: 0,
    };
  }

  function step(direction: -1 | 1) {
    if (!active || options.covered()) return;
    const next = stepPage(page, direction, pages.length);
    if (next === page) return;
    clearGesture();
    // Both pages are drawn while the camera travels between them.
    showOnly([...worldsOn(page), ...worldsOn(next)]);
    page = next;
    const bodies = stage(page);
    render();
    options.onPage();
    moveTo(shot(bodies), true);
  }

  /* --- swipe and tap on the scene ------------------------------------------------ */

  let gesture: { id: number; x: number; y: number; at: number; moved: number; multi: boolean } | null = null;

  function clearGesture() {
    const id = gesture?.id;
    gesture = null;
    try {
      if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    } catch { /* Already released by the browser. */ }
  }
  // Capture phase, so orbit input (disabled on the map anyway) never sees the map's touches.
  function down(event: PointerEvent) {
    if (!active) return;
    event.stopImmediatePropagation();
    if (options.covered()) return;
    if (gesture) {
      gesture.multi = true;
      return;
    }
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp, moved: 0, multi: false };
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch { /* A pointer the browser no longer considers active. */ }
  }
  function moved(event: PointerEvent) {
    if (!active || !gesture) return;
    event.stopImmediatePropagation();
    if (event.pointerId !== gesture.id) return;
    gesture.moved = Math.max(gesture.moved, Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y));
  }
  function up(event: PointerEvent) {
    if (!active || !gesture) return;
    event.stopImmediatePropagation();
    if (event.pointerId !== gesture.id) return;
    const held = gesture;
    clearGesture();
    if (held.multi || options.covered()) return;
    const dx = event.clientX - held.x;
    const dy = event.clientY - held.y;
    // Swipe left for the next page, as a picture book turns.
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    else if (held.moved < TAP_DISTANCE && event.timeStamp - held.at < TAP_MS) options.tap(held.x, held.y);
  }
  function cancel(event: PointerEvent) {
    if (gesture && event.pointerId === gesture.id) clearGesture();
  }
  function key(event: KeyboardEvent) {
    if (!active || options.covered() || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  }
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', moved, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', cancel, true);
  canvas.addEventListener('lostpointercapture', cancel, true);
  window.addEventListener('keydown', key);

  return {
    get active() { return active; },
    get page() { return page; },
    get pageCount() { return pages.length; },
    get pageWorlds() { return worldsOn(page); },
    /** The order the gentle hint suggests worlds in. */
    order,
    /** Where the suggested world is from this page: 0 here, -1/1 an arrow, null none. */
    get hint() { return hint(); },

    /** The world the hint points at; re-renders the cards and arrows. */
    setSuggestion(id: BodyId | null) {
      suggested = id;
      render();
    },

    /** Open on a world's page (home's page when it is on none, or for null). */
    openAt(id: BodyId | null) {
      const index = id ? pageOf(pages, id) : -1;
      page = index >= 0 ? index : homePage(pages);
      render();
    },

    /**
     * Take the screen and the camera. With `glide`, ease from wherever the camera is (a
     * return that framed the page with slightly different heading room); otherwise cut.
     */
    show(glide = false) {
      returning = null;
      active = true;
      ui.setVisible(true);
      render();
      world.setFocus(null);
      world.setOrbitSpeedScale(0);
      controls.cancelGesture();
      controls.enabled = false;
      ship.position.copy(parkedShip());
      const bodies = stage(page);
      showOnly(worldsOn(page));
      moveTo(shot(bodies), glide);
    },

    /** Give the camera and the scene back for a journey: every world drawn, orbits to the flight. */
    hide() {
      active = false;
      move = null;
      clearGesture();
      ui.setVisible(false);
      world.setShown(BODY_IDS);
      ship.visible = true;
    },

    /**
     * The pull-back home is starting from `id`: land on its page. Returns the pose the
     * return eases to, and slides the page's worlds into their places along with it
     * (`blendReturn`), so the hand-over at the end does not move anything.
     */
    beginReturn(id: BodyId): HomePose {
      page = Math.max(0, pageOf(pages, id));
      const from = new Map<BodyId, number>();
      for (const body of worldsOn(page)) {
        const phase = world.orbitPhase(body);
        if (phase !== null) from.set(body, phase);
      }
      // Measured as it will be: the page's controls laid out but not yet shown.
      render();
      ui.section.style.visibility = 'hidden';
      ui.setVisible(true);
      const pose = shot(stage(page));
      ui.setVisible(false);
      ui.section.style.visibility = '';
      const to = new Map<BodyId, number>();
      for (const [body, phase] of from) {
        to.set(body, world.orbitPhase(body)!);
        world.setOrbitPhase(body, phase);
      }
      returning = { from, to };
      world.setOrbitSpeedScale(0);
      world.setShown(worldsOn(page));
      return pose;
    },

    /** The return's eased progress, 0 → 1. */
    blendReturn(t: number) {
      if (!returning) return;
      for (const [body, from] of returning.from) {
        const to = returning.to.get(body)!;
        // The short way round: a world that has orbited for a while must not unwind.
        const delta = THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
        world.setOrbitPhase(body, from + delta * t);
      }
    },

    /** Per frame while the map is up: the page glide, if one is running. */
    update(dt: number) {
      if (!active || !move) return;
      move.t = Math.min(1, move.t + dt / MAP_PAGE_SECONDS);
      const t = smootherstep(move.t);
      camera.position.lerpVectors(move.fromPosition, move.toPosition, t);
      look.lerpVectors(move.fromLook, move.toLook, t);
      camera.lookAt(look);
      if (move.t >= 1) finishMove();
    },

    /** The screen changed shape: pose and frame the page again for it. */
    resize() {
      if (!active) return;
      finishMove();
      render();
      ship.position.copy(parkedShip());
      moveTo(shot(stage(page)), false);
    },

    /** Background, crash or teardown: drop the touch and land any glide where it was going. */
    suspend() {
      clearGesture();
      finishMove();
    },

    dispose() {
      clearGesture();
      move = null;
      canvas.removeEventListener('pointerdown', down, true);
      canvas.removeEventListener('pointermove', moved, true);
      canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', cancel, true);
      canvas.removeEventListener('lostpointercapture', cancel, true);
      window.removeEventListener('keydown', key);
      ui.dispose();
    },
  };
}
