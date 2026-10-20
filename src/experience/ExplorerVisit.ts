import * as THREE from 'three';
import type { CelestialBody } from '../scene/Bodies';
import {
  angularDistance,
  clamp,
  createFlight,
  degrees,
  dragGlobe,
  stepFlight,
  stopFlight,
  wrap,
  type ControlMode,
  type FlightState,
} from '../moon/model';
import { basis } from '../moon/scene';
import { createMoonUI } from '../moon/ui';
import { placeView, worldById, type WorldId } from '../moon/worlds';
import type { Place } from '../moon/places';
import '../moon/moon.css';

export interface ExplorerVisitSnapshot {
  phase: 'approach' | 'explore';
  world: WorldId;
  latitude: number;
  longitude: number;
  altitude: number;
  mode: ControlMode;
  navigating: boolean;
  modal: boolean;
  placeCount: number;
  landmark: string | null;
}

export interface ExplorerVisit {
  readonly active: boolean;
  update(dt: number): void;
  suspend(): void;
  snapshot(): ExplorerVisitSnapshot;
  dispose(): void;
}

export interface ExplorerVisitOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  body: CelestialBody;
  worldId: WorldId;
  reducedMotion: boolean;
  ship: THREE.Object3D;
  onHome(): void;
}

/**
 * Close exploration hosted by the adventure Stage.
 *
 * The solar-system renderer, bodies and frame loop stay alive. This controller temporarily
 * owns only the camera, pointer mapping and explorer DOM. Its latitude/longitude state lives
 * outside Three.js and is projected onto the selected body's real surface each frame, so an
 * orbiting destination can keep moving without the camera or authored places drifting away.
 */
export function createExplorerVisit(options: ExplorerVisitOptions): ExplorerVisit {
  const { scene, camera, canvas, body, worldId, reducedMotion, ship, onHome } = options;
  const explorerWorld = worldById(worldId);
  const events = new AbortController();
  const state: FlightState = createFlight();
  let phase: 'approach' | 'explore' = reducedMotion ? 'explore' : 'approach';
  let active = true;
  let leaving = false;
  let approach = 0;
  let exploreTime = 0;
  let lastTouch = 0;
  let hasMoved = false;
  let pointer: { x: number; y: number } | null = null;
  let pointerId: number | null = null;
  let previous = { x: 0, y: 0 };
  let navigation: { lat: number; lon: number; alt: number; to: Place; elapsed: number } | null = null;
  let landmark: Place | null = null;
  const keys = new Set<string>();

  const center = new THREE.Vector3();
  const localDirection = new THREE.Vector3();
  const worldUp = new THREE.Vector3();
  const worldForward = new THREE.Vector3();
  const desiredPosition = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const desiredCameraUp = new THREE.Vector3();
  const surfaceRotation = new THREE.Quaternion();
  const inverseSurfaceRotation = new THREE.Quaternion();
  const startCamera = camera.position.clone();
  const startLook = new THREE.Vector3();
  const startUp = camera.up.clone();
  camera.getWorldDirection(startLook);
  body.getWorldPosition(center);
  startLook.multiplyScalar(Math.max(body.radius, camera.position.distanceTo(center))).add(camera.position);

  // Begin on the part of the map the cinematic arrival is already showing. The approach
  // then closes the distance without rotating the planet underneath the child.
  body.holdSurface();
  body.surface.getWorldQuaternion(surfaceRotation);
  inverseSurfaceRotation.copy(surfaceRotation).invert();
  localDirection.copy(camera.position).sub(center).normalize().applyQuaternion(inverseSurfaceRotation);
  state.lat = Math.asin(clamp(localDirection.y, -1, 1));
  state.lon = Math.atan2(-localDirection.z, localDirection.x);
  state.heading = 0;
  state.altitude = Math.max(explorerWorld.startAltitude, camera.position.distanceTo(center) / body.radius - 1);
  state.targetAltitude = explorerWorld.startAltitude;
  state.mode = 'fly';

  const overlay = document.createElement('div');
  overlay.id = 'explorer-visit-ui';
  document.body.append(overlay);

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
  }

  function zoom(closer: boolean) {
    navigation = null;
    state.targetAltitude = clamp(
      state.targetAltitude * (closer ? 0.57 : 1.75),
      explorerWorld.minAltitude,
      explorerWorld.maxAltitude,
    );
    lastTouch = exploreTime;
  }

  function go(place: Place) {
    suspend();
    const view = placeView(place, explorerWorld);
    if (reducedMotion) {
      navigation = null;
      state.lat = view.lat;
      state.lon = view.lon;
      state.heading = 0;
      state.altitude = state.targetAltitude = view.altitude;
    } else {
      navigation = { lat: state.lat, lon: state.lon, alt: state.altitude, to: place, elapsed: 0 };
    }
    lastTouch = exploreTime;
    ui.status(`Gliding to ${place.name}`);
  }

  function setMode(mode: ControlMode) {
    suspend();
    navigation = null;
    state.mode = mode;
    state.heading = 0;
    hasMoved = false;
    lastTouch = exploreTime;
    state.targetAltitude = mode === 'drag'
      ? Math.max(0.4, state.altitude)
      : explorerWorld.startAltitude;
    ui.status(mode === 'fly' ? 'Assisted flight' : 'Turn the globe');
  }

  const ui = createMoonUI(overlay, explorerWorld, {
    start() {},
    home() {
      if (leaving) return;
      leaving = true;
      suspend();
      onHome();
    },
    choose() {},
    zoom,
    go,
    mode: setMode,
    pause: suspend,
    resume() { lastTouch = exploreTime; },
  }, { embedded: true });

  const surveyLight = new THREE.HemisphereLight(0xd8f3f2, 0x11182a, 0.55);
  scene.add(surveyLight);
  const shipWasVisible = ship.visible;
  ship.visible = false;
  canvas.setAttribute(
    'aria-label',
    `Explore ${explorerWorld.label}. Hold and slide to fly, release to stop. Arrow keys also move.`,
  );
  canvas.tabIndex = 0;
  ui.phase(phase);

  function steer(x: number, y: number) {
    const sx = (x - innerWidth / 2) / (Math.min(innerWidth, innerHeight) * 0.37);
    const sy = (y - innerHeight / 2) / (Math.min(innerWidth, innerHeight) * 0.37);
    const length = Math.hypot(sx, sy);
    pointer = length < 0.18 ? { x: 0, y: -1 } : { x: sx / length, y: sy / length };
    ui.steering(x, y, state.mode === 'fly');
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!active || ui.modal || phase !== 'explore' || pointerId !== null || event.button !== 0) return;
    navigation = null;
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    previous = { x: event.clientX, y: event.clientY };
    steer(event.clientX, event.clientY);
    lastTouch = exploreTime;
    hasMoved = true;
    canvas.focus({ preventScroll: true });
  }, { signal: events.signal });

  canvas.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    if (state.mode === 'drag') {
      dragGlobe(state, event.clientX - previous.x, event.clientY - previous.y, Math.min(innerWidth, innerHeight));
    }
    previous = { x: event.clientX, y: event.clientY };
    steer(event.clientX, event.clientY);
    lastTouch = exploreTime;
  }, { signal: events.signal });

  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, (event) => {
      if ((event as PointerEvent).pointerId === pointerId) release();
    }, { signal: events.signal });
  }

  canvas.addEventListener('wheel', (event) => {
    if (phase !== 'explore' || ui.modal) return;
    event.preventDefault();
    zoom(event.deltaY < 0);
  }, { passive: false, signal: events.signal });

  window.addEventListener('blur', suspend, { signal: events.signal });
  window.addEventListener('keydown', (event) => {
    if (ui.modal || phase !== 'explore' ||
        (event.target instanceof HTMLElement && event.target.closest('button,a,input,summary'))) return;
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

  function calculatePose(altitude: number) {
    const frame = basis(state.lat, state.lon, state.heading);
    body.getWorldPosition(center);
    body.surface.getWorldQuaternion(surfaceRotation);
    worldUp.copy(frame.up).applyQuaternion(surfaceRotation).normalize();
    worldForward.copy(frame.forward).applyQuaternion(surfaceRotation).normalize();
    const radius = body.radius;
    desiredPosition.copy(center)
      .addScaledVector(worldUp, radius * (1 + altitude))
      .addScaledVector(worldForward, -radius * altitude * 0.35);
    if (explorerWorld.orbital) desiredTarget.copy(center);
    else desiredTarget.copy(center)
      .addScaledVector(worldUp, radius)
      .addScaledVector(worldForward, state.mode === 'drag' ? 0 : radius * altitude * 0.4);
    desiredCameraUp.set(0, 1, 0).lerp(worldUp, explorerWorld.orbital ? 0 : 1).normalize();
  }

  function renderCamera(dt: number) {
    calculatePose(state.altitude);
    const smoothing = reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
    camera.position.lerp(desiredPosition, smoothing);
    camera.up.lerp(desiredCameraUp, smoothing).normalize();
    camera.lookAt(desiredTarget);
  }

  return {
    get active() { return active; },

    update(dt: number) {
      if (!active) return;
      if (phase === 'approach') {
        approach = Math.min(1, approach + dt / 1.35);
        const eased = approach * approach * (3 - 2 * approach);
        calculatePose(explorerWorld.startAltitude);
        camera.position.lerpVectors(startCamera, desiredPosition, eased);
        const look = startLook.clone().lerp(desiredTarget, eased);
        camera.up.copy(startUp).lerp(desiredCameraUp, eased).normalize();
        camera.lookAt(look);
        if (approach >= 1) {
          state.altitude = state.targetAltitude = explorerWorld.startAltitude;
          phase = 'explore';
          ui.phase('explore');
          canvas.focus({ preventScroll: true });
        }
        return;
      }

      exploreTime += dt;
      let input = pointer;
      if (keys.size) {
        const x = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
        const y = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
        input = x || y ? { x, y } : null;
        if (state.mode === 'drag') dragGlobe(state, -x * dt * 180, -y * dt * 180, 500);
      }
      if (navigation) {
        navigation.elapsed += dt;
        const t = Math.min(1, navigation.elapsed / 2.2);
        const eased = t * t * (3 - 2 * t);
        const view = placeView(navigation.to, explorerWorld);
        state.lat = navigation.lat + (view.lat - navigation.lat) * eased;
        state.lon = wrap(navigation.lon + wrap(view.lon - navigation.lon) * eased);
        state.heading = 0;
        state.altitude = state.targetAltitude = navigation.alt + (view.altitude - navigation.alt) * eased;
        if (t >= 1) {
          ui.status('');
          navigation = null;
        }
      } else {
        stepFlight(state, dt, input, { min: explorerWorld.minAltitude, max: explorerWorld.maxAltitude });
      }
      if (reducedMotion) state.altitude = state.targetAltitude;
      landmark = explorerWorld.places.find((place) =>
        angularDistance(state, placeView(place, explorerWorld)) < 0.18) ?? null;
      ui.landmark(navigation ? null : landmark);
      ui.coach(
        !input && !navigation && ((!hasMoved && exploreTime < 8) || (!hasMoved && exploreTime - lastTouch > 16)),
        state.mode,
      );
      ui.zoomLimits(
        state.targetAltitude <= explorerWorld.minAltitude + 0.001,
        state.targetAltitude >= explorerWorld.maxAltitude - 0.001,
      );
      if (exploreTime - lastTouch > 4 && !navigation) ui.status('');
      renderCamera(dt);
    },

    suspend,

    snapshot() {
      return Object.freeze({
        phase,
        world: worldId,
        latitude: degrees(state.lat),
        longitude: degrees(state.lon),
        altitude: state.altitude,
        mode: state.mode,
        navigating: navigation !== null,
        modal: ui.modal,
        placeCount: explorerWorld.places.length,
        landmark: landmark?.id ?? null,
      });
    },

    dispose() {
      if (!active) return;
      active = false;
      events.abort();
      release();
      stopFlight(state);
      body.releaseSurface();
      ship.visible = shipWasVisible;
      scene.remove(surveyLight);
      ui.dispose();
      overlay.remove();
      camera.up.set(0, 1, 0);
    },
  };
}
