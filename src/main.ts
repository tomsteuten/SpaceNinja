/**
 * Entry point. Builds the scene, wires input to the flight sequence and the UI, and owns
 * the teardown path.
 */

import './ui/ui.css';
import * as THREE from 'three';
import { FRAMING_RADIUS, MOON_FACT } from './config';
import { detectQuality, prefersReducedMotion } from './scene/quality';
import { WebGLUnavailableError, createStage } from './scene/Stage';
import { createSky } from './scene/Starfield';
import { createWorld, type BodyId } from './scene/Bodies';
import { createSpaceship } from './scene/Spaceship';
import { createOrbitInput } from './controls/OrbitInput';
import { createFlightSequence } from './flight/FlightSequence';
import { createNarrator } from './audio/narration';
import { createUI } from './ui/ui';
import { awardSticker } from './state/progress';

const boot = document.getElementById('boot');

function fail(message: string, error: unknown) {
  console.error(message, error);
  if (!boot) return;
  boot.classList.add('has-error');
  boot.classList.remove('is-hidden');
}

async function main() {
  const canvasElement = document.getElementById('scene');
  const uiRoot = document.getElementById('ui');
  if (!(canvasElement instanceof HTMLCanvasElement) || !uiRoot) {
    throw new Error('Expected #scene canvas and #ui container in the document.');
  }
  const canvas: HTMLCanvasElement = canvasElement;

  const reducedMotion = prefersReducedMotion();
  const stage = createStage(canvas, detectQuality());
  const { scene, camera } = stage;

  const sky = createSky(stage.quality);
  scene.add(sky.group);
  void sky.applyBackgroundTo(scene);

  const world = await createWorld(stage.quality);
  scene.add(world.group);

  const ship = createSpaceship();
  scene.add(ship.group);

  const controls = createOrbitInput({
    camera,
    element: canvas,
    reducedMotion,
    onTap: handleTap,
  });
  controls.setFocusRadius(world.bodies.earth.radius);
  controls.setTarget(new THREE.Vector3(), true);
  controls.frame(FRAMING_RADIUS, true);

  const narrator = createNarrator();
  const ui = createUI({
    root: uiRoot,
    narrator,
    onFly: () => {
      if (!flight.start()) return;
      ui.enterFlight();
    },
  });

  const flight = createFlightSequence({
    camera,
    scene,
    ship,
    world,
    controls,
    reducedMotion,
    onArrive: () => {
      follow = 'moon';
      selected = null;
      ui.showArrival(MOON_FACT, awardSticker('moon-explorer') ? 'moon-explorer' : null);
    },
  });

  /* --- selection ----------------------------------------------------------- */

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selected: BodyId | null = null;
  let follow: BodyId = 'earth';

  function handleTap(clientX: number, clientY: number) {
    if (flight.phase === 'flying') return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hit = raycaster.intersectObjects(world.hitMeshes, false)[0];
    const id = hit?.object.userData.bodyId as BodyId | undefined;

    selected = id ?? null;
    world.setSelected(selected);

    if (!selected) {
      ui.showSelection(null);
      return;
    }
    ui.setHint(null);
    ui.showSelection({
      label: world.bodies[selected].label,
      flyable: selected === 'moon' && flight.phase === 'idle',
    });
  }

  /* --- park the ship ------------------------------------------------------- */

  const moonPosition = new THREE.Vector3();
  const focusPosition = new THREE.Vector3();
  const shipHeading = new THREE.Vector3();
  ship.group.position.set(2.2, 1.35, 1.4);
  ship.group.scale.setScalar(0.85);

  /* --- hints --------------------------------------------------------------- */

  ui.setHint('Drag to look around ✨');
  const nudge = window.setTimeout(() => {
    if (flight.phase === 'idle' && !selected) ui.setHint('Tap the Moon 🌙');
  }, 6500);

  /* --- frame loop ---------------------------------------------------------- */

  let booted = false;
  let lastAspect = camera.aspect;

  stage.onFrame((dt, elapsed) => {
    sky.update(dt);
    world.update(dt, elapsed, camera);

    if (flight.phase === 'idle') {
      // Idle ship keeps its nose pointed at the destination.
      world.bodies.moon.getWorldPosition(moonPosition);
      shipHeading.subVectors(moonPosition, ship.group.position);
      ship.orient(shipHeading);
    }

    ship.update(dt, elapsed);
    flight.update(dt);

    if (flight.phase !== 'flying') {
      // Rotating the device changes how much fits on screen, so recompose the shot.
      // Deliberately overrides any manual zoom: a rotated view that cuts off the
      // destination is worse than losing the zoom level.
      if (camera.aspect !== lastAspect) {
        lastAspect = camera.aspect;
        controls.frame(follow === 'moon' ? world.bodies.moon.radius * 2.6 : FRAMING_RADIUS);
      }
      controls.setTarget(world.bodies[follow].getWorldPosition(focusPosition));
      controls.update(dt);
    }

    if (!booted) {
      booted = true;
      boot?.classList.add('is-hidden');
      window.setTimeout(() => boot?.remove(), 700);
    }
  });

  stage.start();

  /* --- lifecycle ----------------------------------------------------------- */

  // Stop drawing while backgrounded; on a tablet this is most of the battery win.
  function onVisibilityChange() {
    if (document.hidden) {
      stage.stop();
      narrator.stop();
    } else {
      stage.start();
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  function dispose() {
    window.clearTimeout(nudge);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    controls.dispose();
    ui.dispose();
    narrator.dispose();
    ship.dispose();
    world.dispose();
    sky.dispose();
    stage.dispose();
  }

  window.addEventListener('pagehide', dispose, { once: true });
}

main().catch((error: unknown) => {
  if (error instanceof WebGLUnavailableError) fail('WebGL unavailable', error);
  else fail('Failed to start Space Ninja', error);
});
