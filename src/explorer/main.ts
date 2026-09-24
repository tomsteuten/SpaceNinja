/**
 * The default route: the solar system, a real journey out to a world, and close exploration
 * of it.
 *
 * The opening is the adventure's own scene — the Sun and all four worlds in orbit, the ship
 * parked beside Earth — and a world is chosen by touching it or its button. The adventure's
 * scripted flight carries the ship there. On arrival there is no cut: the camera descends
 * from the arrival shot to the explorer's surface view, and the explorer's hold-and-slide
 * flight takes over, run in the destination's own surface space inside the same scene. The
 * ship the child has just flown out is the one they now steer over the ground. Places are
 * pictures pinned to the world; flying over one finds it and puts it in the journal.
 *
 * This file owns the sequence and its single reset path (`restart`). The flight model, the
 * surface maths, the badges, the phases and the interface are separate and tested alone.
 */
import '../ui/ui.css';
import './explorer.css';
import * as THREE from 'three';
import { CAMERA_NEAR, DESTINATIONS, FRAMING_RADIUS_WIDER, SUN_DIRECTION } from '../config';
import { detectQuality, prefersReducedMotion } from '../scene/quality';
import { createStage } from '../scene/Stage';
import { createSky } from '../scene/Starfield';
import { createWorld, type BodyId } from '../scene/Bodies';
import { createSpaceship } from '../scene/Spaceship';
import { createEngineTrail } from '../scene/EngineTrail';
import { createOrbitInput } from '../controls/OrbitInput';
import { createFlightSequence, smootherstep } from '../flight/FlightSequence';
import { createHomeReturn } from '../flight/HomeReturn';
import { freeFlightHref, isFreeFlightShortcut } from '../flight/freeFlightRoute';
import { facingLatitude } from '../mission/CollectMission';
import { createNarrator } from '../audio/narration';
import { createSfx } from '../audio/sfx';
import { createGrownups } from '../ui/grownups';
import { awardSticker, loadProgress, markVisited, recordDiscovery } from '../state/progress';
import { nextWorld } from '../state/replay';
import { loadSoundOn } from '../state/settings';
import { createSessionLifecycle } from './lifecycle';
import { angularDistance, clamp, createFlight, degrees, stepFlight, stopFlight, wrap, type FlightState } from './model';
import { createPhases, type Phase } from './phases';
import { basis, blendPose, descentStart, direction, explorePose, shipPose, subPoint, type Pose } from './surfaceView';
import { createBeacons, type Beacons } from './beacons';
import { createExplorerUI } from './ui';
import { placeView, worldById, WORLDS, type ExplorerWorld, type WorldId, type WorldPlace } from './worlds';

/** Seconds for the camera to come down from the arrival shot to the ground, and back up. */
const DESCENT_SECONDS = 2.4;
const ASCENT_SECONDS = 1.6;
/** How close (radians of arc) the view must pass over a place to find it. */
const FIND_RADIUS = 0.18;
/** The ship model's length at scale 1, nose to engines, in its own units. */
const SHIP_MODEL_LENGTH = 0.42;
/** The solar system's opening elevation: about 35 degrees above the plane of the orbits. */
const SYSTEM_PHI = 0.96;
/** Orbits are nearly flat, so a sphere fitted round them leaves the system small in frame. */
const SYSTEM_FRAMING = FRAMING_RADIUS_WIDER * 0.82;
const ALL_WORLDS = WORLDS.map((world) => world.id) as BodyId[];
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * A starting point on the way from `from` toward `to`: close enough that `to` is ahead in view
 * (APPROACH_GAP of arc), but never more than APPROACH_LIMIT from where the camera arrived, so
 * the descent stays a drop rather than a swing round the globe.
 */
const APPROACH_GAP = 0.35;
const APPROACH_LIMIT = 0.6;
function approach(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const distance = angularDistance(from, to);
  const move = Math.min(Math.max(0, distance - APPROACH_GAP), APPROACH_LIMIT);
  if (move <= 0) return from;
  const a = direction(from.lat, from.lon);
  const b = direction(to.lat, to.lon);
  const axis = new THREE.Vector3().crossVectors(a, b);
  if (axis.lengthSq() < 1e-10) return from;
  const point = subPoint(a.applyAxisAngle(axis.normalize(), move));
  return descentStart(direction(point.lat, point.lon));
}

/** Compass bearing (radians, 0 = north, east positive) from one point to another. */
function bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const dLon = to.lon - from.lon;
  return Math.atan2(
    Math.sin(dLon) * Math.cos(to.lat),
    Math.cos(from.lat) * Math.sin(to.lat) - Math.sin(from.lat) * Math.cos(to.lat) * Math.cos(dLon),
  );
}

export async function startExplorer(canvas: HTMLCanvasElement, root: HTMLElement) {
  const boot = document.getElementById('boot');
  const reduced = prefersReducedMotion();
  // Focusable so arrow keys can fly once a world is reached.
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'The solar system. Choose a world to fly there; once there, hold and slide to fly, or use the arrow keys.');
  const stage = createStage(canvas, detectQuality());
  const { scene, camera } = stage;

  const sky = createSky(stage.quality);
  scene.add(sky.group);
  void sky.applyStarMap();
  const world = await createWorld(stage.quality);
  scene.add(world.group);
  world.setRevealed(ALL_WORLDS);

  const ship = createSpaceship();
  const syncStickers = () => ship.setStickers(loadProgress().stickers);
  syncStickers();
  scene.add(ship.group);
  const trail = createEngineTrail(stage.quality.tier === 'low' ? 24 : 46);
  scene.add(trail.group);

  // An illustrative light that follows the view while exploring, strongest over the night
  // side, so every place stays readable without pretending the Sun has moved.
  const survey = new THREE.DirectionalLight(0xfff5e8, 0);
  scene.add(survey, survey.target);

  const narrator = createNarrator();
  const sfx = createSfx();
  const soundOn = loadSoundOn();
  sfx.setMuted(!soundOn);

  const phases = createPhases();
  const found = new Set(loadProgress().discoveries);
  let follow: BodyId = 'earth';
  let current: ExplorerWorld = worldById('earth');
  let suggested: BodyId | null = null;
  let beacons: Beacons | null = null;
  const state: FlightState = createFlight();
  let arrivalPose: Pose | null = null;
  let shipArrival: { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number } | null = null;
  let progress = 0;
  let exploreTime = 0, lastTouch = 0, hasMoved = false, justFound: string | null = null;
  let navigation: { lat: number; lon: number; alt: number; to: WorldPlace; elapsed: number } | null = null;
  let pointer: { x: number; y: number } | null = null, pointerId: number | null = null;
  const keys = new Set<string>();
  const upgraded = new Set<WorldId>();
  const ownedTextures: THREE.Texture[] = [];

  // The interface comes first: the solar system is framed around the space it leaves.
  const ui = createExplorerUI(root, narrator, () => found, {
    fly: (id) => launch(id),
    home: () => leaveWorld(),
    go: (place) => glideTo(place),
    zoom: (closer) => zoom(closer),
    settings: () => grownups.show(),
    pause: () => release(),
    resume: () => { lastTouch = exploreTime; },
  });

  /* --- framing of the solar system --------------------------------------- */

  // Every world is visible and open from the first launch, so the map is framed to hold them all.
  // The picture is lifted by half the height the world row takes (see the lens shift in the
  // frame loop) and framed into what is left, so no world sits behind the buttons.
  const framingInset = () => Math.min(0.6, reserve() + 0.08);
  const reserve = () => ui.systemReserve();
  // Looking down on the orbits rather than along them, so the worlds spread out around Earth
  // instead of lining up behind one another.
  const controls = createOrbitInput({ camera, element: canvas, reducedMotion: reduced, onTap: handleTap, openingPhi: SYSTEM_PHI });
  const homeFocus = new THREE.Vector3();
  function frameSystem() {
    controls.setFocusRadius(world.bodies.earth.radius);
    controls.setTarget(world.bodies.earth.getWorldPosition(homeFocus), true);
    controls.frame(SYSTEM_FRAMING, true, framingInset());
  }
  frameSystem();

  const flight = createFlightSequence({
    camera, scene, ship, trail, world, controls, home: world.bodies.earth, reducedMotion: reduced,
    onThrottle: (throttle, cruise) => sfx.thruster(throttle, cruise),
    onArrive: (destination) => arrive(destination.id),
  });
  const homeReturn = createHomeReturn({
    camera, controls, reducedMotion: reduced,
    restingPose: () => controls.restingPose(world.bodies.earth.getWorldPosition(homeFocus), SYSTEM_FRAMING, framingInset()),
    currentFocus: () => world.bodies[follow].getWorldPosition(homeFocus),
    onArrive: () => restart(),
  });

  /* --- interface ---------------------------------------------------------- */

  const grownups = createGrownups({
    root,
    narrator,
    onSoundChange: (on) => sfx.setMuted(!on),
    onResetProgress: () => {
      found.clear();
      restart();
    },
    onTryFreeFlight: () => window.location.assign(freeFlightHref(window.location.href)),
    about: {
      lead:
        'A quiet solar system for a child of about five to eight. Tap a world to fly there, ' +
        'then hold and slide to fly over it; let go to stop. There is nothing to lose and no ' +
        'way to get stuck — the Solar system button is always there.',
      teaches:
        'The pictures on each world are real places at their real latitude and longitude — ' +
        'the Sahara, the Amazon, the Apollo 11 landing site, Olympus Mons. Flying over one ' +
        'finds it and puts its real photograph in the journal. Finding all six on a world ' +
        'puts that world’s badge on the ship. Scale and lighting are illustrative.',
      imagery:
        'Imagery: NASA mission photographs, each credited on its postcard. The Moon uses ' +
        'NASA LRO colour and LOLA relief maps; Earth, Mars and Saturn use Solar System Scope ' +
        'maps (CC BY 4.0) based on NASA data. The earlier adventure is still at ?classic.',
    },
  });
  if (/[?&](grownups|voices)\b/.test(window.location.search)) grownups.show();
  function onFreeFlightShortcut(event: KeyboardEvent) {
    if (!isFreeFlightShortcut(event)) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, button'))) return;
    event.preventDefault();
    window.location.assign(freeFlightHref(window.location.href));
  }
  document.addEventListener('keydown', onFreeFlightShortcut);

  function applySuggestion() {
    suggested = nextWorld(loadProgress(), ALL_WORLDS) as BodyId | null;
    world.setSelected(suggested);
    ui.showWorlds(found, suggested);
    const name = suggested ? worldById(suggested).label : null;
    ui.hint(name ? `Tap a world to fly there · ${name} is waiting` : 'Tap a world to fly there');
  }

  /* --- the solar system ---------------------------------------------------- */

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function handleTap(clientX: number, clientY: number) {
    if (phases.current !== 'system') return;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(world.hitMeshes, false)[0];
    const id = hit?.object.userData.bodyId as BodyId | undefined;
    if (id) launch(id);
  }

  function launch(id: WorldId) {
    if (phases.current !== 'system' || ui.modal || grownups.open) return;
    const destination = world.bodies[id];
    const discoveries = DESTINATIONS[id]?.mission.discoveries;
    if (!phases.advance('flying')) return;
    if (!flight.start(destination, discoveries ? facingLatitude(discoveries) : undefined)) {
      phases.reset();
      return;
    }
    follow = id;
    current = worldById(id);
    ui.setWorld(current);
    ui.phase('flying');
    ui.status(`Flying to ${id === 'moon' ? 'the Moon' : current.label}…`);
    // The first reliable gesture of the session: mobile browsers only start audio inside one.
    sfx.resume();
    narrator.resume();
  }

  /* --- arriving and descending --------------------------------------------- */

  const inverse = new THREE.Matrix4();
  function toLocal(point: THREE.Vector3, radius: number) {
    return point.clone().applyMatrix4(inverse).divideScalar(radius);
  }

  function arrive(id: BodyId) {
    if (!phases.advance('descending')) return;
    const body = world.bodies[id];
    // The flight hands orbit control back on landing; close exploration has its own input.
    controls.enabled = false;
    markVisited(id);
    world.setFocus(id);
    world.setSelected(null);
    body.holdSurface();
    body.surface.updateWorldMatrix(true, false);
    inverse.copy(body.surface.matrixWorld).invert();
    arrivalPose = {
      position: toLocal(camera.position, body.radius),
      target: new THREE.Vector3(),
      up: WORLD_UP.clone().transformDirection(inverse),
    };
    // Begin beneath the arrival shot, nudged toward the nearest place still to find so its
    // picture is in view ahead when the descent lands, and facing it.
    const beneath = descentStart(arrivalPose.position);
    const waiting = current.places.filter((place) => !found.has(place.id));
    const aimAt = (waiting.length ? waiting : current.places)
      .map((place) => ({ place, distance: angularDistance(beneath, placeView(place, current)) }))
      .sort((a, b) => a.distance - b.distance)[0]?.place;
    const start = aimAt && !current.orbital ? approach(beneath, placeView(aimAt, current)) : beneath;
    Object.assign(state, createFlight(), start);
    state.altitude = state.targetAltitude = current.startAltitude;
    if (aimAt && !current.orbital) state.heading = wrap(bearing(start, placeView(aimAt, current)));

    const shipQuaternion = new THREE.Quaternion();
    ship.group.getWorldQuaternion(shipQuaternion);
    const surfaceQuaternion = new THREE.Quaternion();
    body.surface.getWorldQuaternion(surfaceQuaternion);
    shipArrival = {
      position: toLocal(ship.group.getWorldPosition(new THREE.Vector3()), body.radius),
      quaternion: surfaceQuaternion.invert().multiply(shipQuaternion),
      scale: ship.group.getWorldScale(new THREE.Vector3()).x,
    };
    if (current.orbital) {
      // Saturn is circled, not skimmed: the ship waits at the arrival point, quietly.
      ship.setContextDimmed(true);
    } else {
      scene.attach(ship.group);
      ship.setContextDimmed(false);
    }
    trail.reset();
    beacons?.dispose();
    beacons = createBeacons({ body, world: current, found, reducedMotion: reduced });
    void upgradeSurface(current, body.surface);
    navigation = null;
    progress = 0;
    exploreTime = 0; lastTouch = 0; hasMoved = false; justFound = null;
    ui.setWorld(current);
    ui.phase('descending');
    ui.status('');
    // Authored arrival narration only; the device voice never starts by itself.
    const cue = `arrival-${id}`;
    const config = DESTINATIONS[id];
    if (soundOnNow() && config && narrator.hasRecording(cue)) narrator.speak(config.fact, cue);
    if (reduced) beginExploring();
  }

  function soundOnNow() { return loadSoundOn(); }

  function beginExploring() {
    if (phases.current === 'descending') phases.advance('exploring');
    progress = 1;
    ui.phase('exploring');
    canvas.focus({ preventScroll: true });
  }

  /** The Moon's sharper NASA map and relief, fetched the first time the Moon is explored. */
  async function upgradeSurface(target: ExplorerWorld, surface: THREE.Object3D) {
    if (!target.detail || upgraded.has(target.id)) return;
    upgraded.add(target.id);
    const material = (surface as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const loader = new THREE.TextureLoader();
    try {
      const [color, relief] = await Promise.all([
        loader.loadAsync(import.meta.env.BASE_URL + 'assets/' + target.detail.color),
        target.detail.relief ? loader.loadAsync(import.meta.env.BASE_URL + 'assets/' + target.detail.relief) : null,
      ]);
      if (disposed) { color.dispose(); relief?.dispose(); return; }
      color.colorSpace = THREE.SRGBColorSpace;
      color.anisotropy = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
      ownedTextures.push(color);
      material.map = color;
      if (relief) {
        ownedTextures.push(relief);
        material.bumpMap = relief;
        material.bumpScale = 1.2;
      }
      material.needsUpdate = true;
    } catch {
      // The standard map is already on the globe; a failed upgrade simply leaves it there.
      upgraded.delete(target.id);
    }
  }

  /* --- exploring ------------------------------------------------------------ */

  function release() {
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointerId = null;
    pointer = null;
    keys.clear();
    ui.steering(0, 0, false);
  }
  function suspend() {
    release();
    stopFlight(state);
    narrator.stop();
    sfx.reset();
  }

  function zoom(closer: boolean) {
    navigation = null;
    state.targetAltitude = clamp(state.targetAltitude * (closer ? 0.57 : 1.75), current.minAltitude, current.maxAltitude);
    lastTouch = exploreTime;
  }

  function glideTo(place: WorldPlace) {
    if (phases.current === 'descending') beginExploring();
    if (phases.current !== 'exploring') return;
    release();
    stopFlight(state);
    const view = placeView(place, current);
    if (reduced) {
      navigation = null;
      state.lat = view.lat; state.lon = view.lon; state.heading = 0;
      state.altitude = state.targetAltitude = view.altitude;
    } else {
      navigation = { lat: state.lat, lon: state.lon, alt: state.altitude, to: place, elapsed: 0 };
    }
    lastTouch = exploreTime;
    // Under reduced motion the view has already cut there; there is no glide to announce.
    ui.status(reduced ? '' : `Gliding to ${place.name}`);
  }

  function steer(x: number, y: number) {
    const sx = (x - innerWidth / 2) / (Math.min(innerWidth, innerHeight) * 0.37);
    const sy = (y - innerHeight / 2) / (Math.min(innerWidth, innerHeight) * 0.37);
    const length = Math.hypot(sx, sy);
    // Near the centre means "straight ahead", so a hold anywhere always moves.
    pointer = length < 0.18 ? { x: 0, y: -1 } : { x: sx / length, y: sy / length };
    ui.steering(x, y, true);
  }

  const events = new AbortController();
  canvas.addEventListener('pointerdown', (event) => {
    const phase = phases.current;
    if (phase !== 'descending' && phase !== 'exploring') return;
    if (ui.modal || pointerId !== null || event.button !== 0) return;
    // The descent is scenery; the first touch should begin exploring at once.
    if (phase === 'descending') beginExploring();
    const place = beacons?.hit(event.clientX, event.clientY, camera);
    if (place) { glideTo(place); return; }
    navigation = null;
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    steer(event.clientX, event.clientY);
    lastTouch = exploreTime;
    hasMoved = true;
    canvas.focus({ preventScroll: true });
  }, { signal: events.signal });
  canvas.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    steer(event.clientX, event.clientY);
    lastTouch = exploreTime;
  }, { signal: events.signal });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, (event) => {
      if ((event as PointerEvent).pointerId === pointerId) release();
    }, { signal: events.signal });
  }
  window.addEventListener('blur', () => { release(); stopFlight(state); }, { signal: events.signal });
  canvas.addEventListener('wheel', (event) => {
    if (phases.current !== 'exploring' || ui.modal) return;
    event.preventDefault();
    zoom(event.deltaY < 0);
  }, { passive: false, signal: events.signal });
  window.addEventListener('keydown', (event) => {
    if (ui.modal || grownups.open || phases.current !== 'exploring') return;
    if (event.target instanceof HTMLElement && event.target.closest('button,a,input,summary')) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      navigation = null;
      keys.add(event.key);
      hasMoved = true;
      lastTouch = exploreTime;
    }
    if (event.key === '+' || event.key === '=') zoom(true);
    if (event.key === '-') zoom(false);
  }, { signal: events.signal });
  window.addEventListener('keyup', (event) => keys.delete(event.key), { signal: events.signal });

  function discover(place: WorldPlace) {
    if (found.has(place.id)) return;
    found.add(place.id);
    recordDiscovery(place.id);
    justFound = place.id;
    beacons?.markFound(place.id, true);
    const onWorld = current.places.filter((item) => found.has(item.id)).length;
    sfx.collect(onWorld - 1, current.places.length);
    const cue = `discovery-${place.id}`;
    if (soundOnNow() && narrator.hasRecording(cue)) narrator.speak(place.words, cue);
    if (onWorld === current.places.length) {
      // Every place on this world: its badge goes on the ship, once.
      const sticker = DESTINATIONS[current.id]?.mission.stickerId;
      if (sticker && awardSticker(sticker)) syncStickers();
      sfx.success();
      ui.status(`You found every place on ${current.id === 'moon' ? 'the Moon' : current.label}!`);
    }
  }

  function leaveWorld() {
    if (phases.current === 'descending') beginExploring();
    if (!phases.advance('ascending')) return;
    release();
    stopFlight(state);
    navigation = null;
    narrator.stop();
    ui.phase('ascending');
    ui.status('');
    progress = reduced ? 1 : 0;
    if (reduced) finishAscent();
  }

  function finishAscent() {
    if (!phases.advance('returning')) return;
    const body = world.bodies[follow];
    beacons?.dispose();
    beacons = null;
    body.releaseSurface();
    survey.intensity = 0;
    setNear(CAMERA_NEAR);
    camera.up.copy(WORLD_UP);
    // Ride along with the world again while the camera pulls back, as after a classic visit.
    body.anchor.attach(ship.group);
    ship.setThrust(0);
    world.setFocus(null);
    ship.setContextDimmed(false);
    ui.phase('returning');
    if (!homeReturn.start()) restart();
  }

  /** The one way back to the opening solar system, from any phase. */
  function restart() {
    phases.reset();
    release();
    navigation = null;
    beacons?.dispose();
    beacons = null;
    arrivalPose = null;
    shipArrival = null;
    flight.reset();
    homeReturn.reset();
    sfx.reset();
    narrator.stop();
    survey.intensity = 0;
    setNear(CAMERA_NEAR);
    camera.up.copy(WORLD_UP);
    scene.attach(ship.group);
    ship.reset();
    syncStickers();
    trail.reset();
    world.reset();
    world.setRevealed(ALL_WORLDS);
    controls.reset();
    frameSystem();
    follow = 'earth';
    ui.phase('system');
    ui.status('');
    applySuggestion();
  }

  function setNear(near: number) {
    if (Math.abs(camera.near - near) < 1e-6) return;
    camera.near = near;
    camera.updateProjectionMatrix();
  }

  /* --- frame loop ------------------------------------------------------------- */

  const smoothed: Pose = { position: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
  let smoothedReady = false;
  const center = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  const worldTarget = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const shipLocal = new THREE.Quaternion();
  const surfaceQuaternion = new THREE.Quaternion();
  const basisMatrix = new THREE.Matrix4();
  let lastAspect = camera.aspect;
  let lensShift = 0;
  let frames = 0;
  let clock = 0;
  let disposed = false;

  function updateSurface(dt: number) {
    const phase = phases.current;
    const body = world.bodies[follow];
    body.surface.updateWorldMatrix(true, false);
    const matrix = body.surface.matrixWorld;
    const radius = body.radius;
    body.getWorldPosition(center);

    if (phase === 'descending' && !ui.modal) {
      progress = Math.min(1, progress + dt / DESCENT_SECONDS);
      if (progress >= 1) beginExploring();
    }
    if (phase === 'ascending') {
      progress = Math.min(1, progress + dt / ASCENT_SECONDS);
    }
    if (phase === 'exploring' && !ui.modal) explore(dt);

    const amount = phase === 'ascending' ? 1 - smootherstep(progress) : smootherstep(progress);
    const goal = explorePose(state, current.orbital);
    const pose = arrivalPose && amount < 1 ? blendPose(arrivalPose, goal, amount) : goal;
    // Exploring eases toward the goal so a turn of heading swings the view rather than snapping.
    const follow_ = phase === 'exploring' && !reduced && smoothedReady ? 1 - Math.exp(-dt * 9) : 1;
    smoothed.position.lerp(pose.position, follow_);
    smoothed.target.lerp(pose.target, follow_);
    smoothed.up.lerp(pose.up, follow_).normalize();
    smoothedReady = true;

    worldPosition.copy(smoothed.position).multiplyScalar(radius).applyMatrix4(matrix);
    worldTarget.copy(smoothed.target).multiplyScalar(radius).applyMatrix4(matrix);
    camera.up.copy(smoothed.up).transformDirection(matrix);
    camera.position.copy(worldPosition);
    camera.lookAt(worldTarget);
    // Close to a small world the ground is nearer than the solar-system near plane.
    setNear(Math.max(0.002, radius * 0.02));

    // The survey light, from above and a little behind the view, brighter on the night side.
    const frame = basis(state.lat, state.lon, state.heading);
    aim.copy(frame.up).multiplyScalar(4).addScaledVector(frame.east, -2).addScaledVector(frame.forward, 2).transformDirection(matrix);
    const sunlit = frame.up.clone().transformDirection(matrix).dot(SUN_DIRECTION);
    survey.target.position.copy(center);
    survey.position.copy(center).addScaledVector(aim, radius * 10);
    survey.intensity = amount * THREE.MathUtils.lerp(0.45, 1.7, clamp(0.35 - sunlit, 0, 1));

    // The ship comes down with the camera and flies just ahead of it.
    if (!current.orbital && shipArrival) {
      const pose_ = shipPose(state);
      const blended = blendPose(
        { position: shipArrival.position, target: new THREE.Vector3(), up: WORLD_UP },
        { position: pose_.position, target: new THREE.Vector3(), up: WORLD_UP },
        amount,
      ).position;
      ship.group.position.copy(blended).multiplyScalar(radius).applyMatrix4(matrix);
      const right = new THREE.Vector3().crossVectors(pose_.up, pose_.forward).normalize();
      basisMatrix.makeBasis(right, pose_.up, pose_.forward);
      shipLocal.setFromRotationMatrix(basisMatrix);
      shipLocal.copy(shipArrival.quaternion).slerp(shipLocal, amount);
      body.surface.getWorldQuaternion(surfaceQuaternion);
      ship.group.quaternion.copy(surfaceQuaternion).multiply(shipLocal);
      const scale = THREE.MathUtils.lerp(shipArrival.scale, (pose_.length * radius) / SHIP_MODEL_LENGTH, amount);
      ship.group.scale.setScalar(scale);
      const cruise = Math.min(state.altitude, 0.65) * 0.3;
      ship.setThrust(phase === 'exploring' ? clamp(state.speed / Math.max(cruise, 1e-6), 0, 1) * 0.8 : 0);
    }

    if (beacons) {
      beacons.update(toLocalCamera(matrix, radius), camera, dt, clock);
    }
    if (phase === 'ascending' && progress >= 1) finishAscent();
  }

  function toLocalCamera(matrix: THREE.Matrix4, radius: number) {
    inverse.copy(matrix).invert();
    return camera.position.clone().applyMatrix4(inverse).divideScalar(radius);
  }

  function explore(dt: number) {
    exploreTime += dt;
    let input = pointer;
    if (keys.size) {
      const x = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
      const y = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
      input = x || y ? { x, y } : null;
    }
    if (navigation) {
      navigation.elapsed += dt;
      const t = Math.min(1, navigation.elapsed / 2.6), e = t * t * (3 - 2 * t);
      const view = placeView(navigation.to, current);
      state.lat = navigation.lat + (view.lat - navigation.lat) * e;
      state.lon = wrap(navigation.lon + wrap(view.lon - navigation.lon) * e);
      state.altitude = state.targetAltitude = navigation.alt + (view.altitude - navigation.alt) * e;
      state.speed = 0;
      if (t === 1) { ui.status(''); navigation = null; }
    } else {
      stepFlight(state, dt, input, { min: current.minAltitude, max: current.maxAltitude });
    }
    if (reduced) state.altitude = state.targetAltitude;
    const near = navigation ? null : current.places.find((place) => angularDistance(state, placeView(place, current)) < FIND_RADIUS) ?? null;
    if (near) discover(near);
    if (!near) justFound = null;
    ui.landmark(near, near !== null && near.id === justFound);
    // The steering tip gives way to the place card: naming the place is the more useful thing.
    ui.coach(!near && !input && !navigation && !hasMoved && (exploreTime < 8 || exploreTime - lastTouch > 16), current.orbital);
    ui.zoomLimits(state.targetAltitude <= current.minAltitude + 0.001, state.targetAltitude >= current.maxAltitude - 0.001);
    if (exploreTime - lastTouch > 4 && !navigation && !ui.modal) ui.status('');
  }

  stage.onFrame((dt, elapsed) => {
    frames++;
    clock = elapsed;
    sky.update(dt);
    world.update(dt, elapsed, camera);
    trail.update(dt);
    const phase: Phase = phases.current;
    if (phase === 'system') {
      // The parked ship points at the world the map is suggesting, never blankly side-on.
      const target = suggested && suggested !== 'earth' ? suggested : 'moon';
      world.bodies[target].getWorldPosition(aim);
      ship.orient(aim.sub(ship.group.position));
    }
    ship.update(dt, elapsed);
    flight.update(dt);
    homeReturn.update(dt);
    if (phase === 'descending' || phase === 'exploring' || phase === 'ascending') updateSurface(dt);
    // In the solar system the picture is lifted a little, so the worlds sit in the clear band
    // above the row of buttons; it eases away as the ship leaves, and back as it returns.
    const shiftGoal = phase === 'system' || phase === 'returning' ? reserve() / 2 : 0;
    lensShift += (shiftGoal - lensShift) * (reduced ? 1 : 1 - Math.exp(-dt * 2.5));
    // setViewOffset also sets the aspect to fullWidth / fullHeight, so pass the real one.
    if (Math.abs(lensShift) < 1e-4) { if (camera.view) camera.clearViewOffset(); }
    else camera.setViewOffset(camera.aspect, 1, 0, lensShift, camera.aspect, 1);
    if (phase === 'system' && !homeReturn.active) {
      if (camera.aspect !== lastAspect) {
        lastAspect = camera.aspect;
        controls.frame(SYSTEM_FRAMING, false, framingInset());
      }
      controls.setTarget(world.bodies.earth.getWorldPosition(homeFocus));
      controls.update(dt);
    }
    if (frames === 1) boot?.classList.add('is-hidden');
  });

  function fail(error: unknown) {
    for (const dialog of root.querySelectorAll<HTMLDialogElement>('dialog[open]')) dialog.close();
    console.error('Space Ninja stopped', error);
    if (!boot) return;
    boot.classList.add('has-error', 'has-crash');
    boot.classList.remove('is-hidden');
    const detail = boot.querySelector('.boot-detail');
    if (detail) detail.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    boot.querySelector('.boot-restart')?.addEventListener('click', () => location.reload(), { once: true });
  }

  const lifetime = createSessionLifecycle({
    stage, document, window, suspend, fail,
    dispose() {
      disposed = true;
      events.abort();
      document.removeEventListener('keydown', onFreeFlightShortcut);
      beacons?.dispose();
      grownups.dispose();
      ui.dispose();
      controls.dispose();
      narrator.dispose();
      sfx.dispose();
      ship.dispose();
      trail.dispose();
      for (const texture of ownedTextures) texture.dispose();
      world.dispose();
      sky.dispose();
      stage.dispose();
      if (import.meta.env.VITE_PLAYTEST === '1') delete (window as Window & { spaceNinjaSnapshot?: unknown }).spaceNinjaSnapshot;
    },
  });

  if (import.meta.env.VITE_PLAYTEST === '1') {
    Object.assign(window, {
      spaceNinjaSnapshot: () => {
        const body = world.bodies[follow];
        const distance = camera.position.distanceTo(body.getWorldPosition(new THREE.Vector3()));
        return Object.freeze({
          phase: phases.current, world: follow, frame: frames,
          draws: stage.renderer.info.render.calls,
          latitude: degrees(state.lat), longitude: degrees(state.lon), heading: state.heading,
          altitude: state.altitude, speed: state.speed, steering: pointer !== null,
          navigating: navigation !== null, modal: ui.modal, reducedMotion: reduced,
          cameraAltitude: distance / body.radius - 1,
          found: [...found],
          beacons: beacons?.screen(camera) ?? [],
          suggested,
          stickers: loadProgress().stickers,
        });
      },
    });
  }

  applySuggestion();
  ui.phase('system');
  lifetime.start();
  return { canReload: () => phases.current === 'system' && !ui.modal && !grownups.open };
}
