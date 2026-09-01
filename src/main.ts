/**
 * Entry point. Builds the scene, wires input to the flight sequence, the mission and the
 * UI, and owns both the restart and the teardown paths.
 */

import './ui/ui.css';
import * as THREE from 'three';
import { FRAMING_RADIUS, MOON_FACT, MOON_MISSION } from './config';
import { detectQuality, prefersReducedMotion } from './scene/quality';
import { WebGLUnavailableError, createStage } from './scene/Stage';
import { createSky } from './scene/Starfield';
import { createWorld, type BodyId } from './scene/Bodies';
import { createSpaceship } from './scene/Spaceship';
import { createOrbitInput } from './controls/OrbitInput';
import { createFlightSequence } from './flight/FlightSequence';
import { createCollectMission } from './mission/CollectMission';
import { createNarrator } from './audio/narration';
import { createSfx } from './audio/sfx';
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
  const sfx = createSfx();

  const ui = createUI({
    root: uiRoot,
    narrator,
    onFly: () => {
      if (!flight.start()) return;
      ui.enterFlight();
    },
    onMissionStart: () => {
      // The one reliable user gesture between page load and the first sound effect.
      // Mobile browsers start an AudioContext suspended and only let it resume here.
      sfx.resume();
      mission.start();
      ui.beginMission(mission.definition.instruction, mission.definition.count);
    },
    onExploreAgain: () => {
      restart();
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
      // The sticker is no longer earned by arriving — the mission awards it.
      ui.showArrival(MOON_FACT);
      ui.offerMission(mission.definition.label);
    },
  });

  const mission = createCollectMission({
    definition: { body: world.bodies.moon, ...MOON_MISSION },
    camera,
    quality: stage.quality,
    reducedMotion,
    onCollect: (collected, total) => {
      sfx.collect(collected - 1, total);
      ui.setMissionProgress(collected);
      // Only the hidden one left: name the gesture now that the child needs it.
      if (collected === total - 1) ui.setMissionCaption(mission.definition.huntLine);
    },
    onComplete: () => {
      sfx.success();
      // The celebration keys off finishing, not off the award: a child who earned this
      // sticker on an earlier visit still gets the party, just not a second sticker.
      const isNew = awardSticker(mission.definition.stickerId);
      ui.completeMission(mission.definition.successLine, isNew ? mission.definition.stickerId : null);
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

    if (mission.active) {
      // Collectibles float well inside the Moon's own (deliberately generous) hit
      // sphere, so they get the tap to themselves. A miss simply does nothing: there is
      // no wrong answer to punish here.
      const target = raycaster.intersectObjects(mission.hitMeshes, false)[0];
      if (target) mission.collectFrom(target.object);
      return;
    }

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

  /* --- scratch ------------------------------------------------------------- */

  const moonPosition = new THREE.Vector3();
  const focusPosition = new THREE.Vector3();
  const shipHeading = new THREE.Vector3();

  /* --- hints --------------------------------------------------------------- */

  let nudge = 0;

  function showOpeningHints() {
    window.clearTimeout(nudge);
    ui.setHint('Drag to look around ✨');
    nudge = window.setTimeout(() => {
      if (flight.phase === 'idle' && !selected) ui.setHint('Tap the Moon 🌙');
    }, 6500);
  }

  showOpeningHints();

  /* --- restart ------------------------------------------------------------- */

  /**
   * "Explore Again" without a page reload. Every stateful module owns its own reset;
   * this is the only place that calls them, so there is one order to reason about.
   *
   * The Moon is deliberately not put back where it was: it has kept orbiting, and the
   * next flight simply aims at wherever it is now.
   */
  function restart() {
    mission.reset();
    flight.reset();
    // The ship was re-parented to the Moon on arrival; the scene has to take it back
    // before the ship can restore its own parked transform.
    scene.attach(ship.group);
    ship.reset();
    world.reset();

    controls.reset();
    controls.setFocusRadius(world.bodies.earth.radius);
    controls.setTarget(world.bodies.earth.getWorldPosition(focusPosition), true);
    controls.frame(FRAMING_RADIUS, true);

    selected = null;
    follow = 'earth';

    ui.reset();
    showOpeningHints();
  }

  /* --- frame loop ---------------------------------------------------------- */

  let booted = false;
  let lastAspect = camera.aspect;

  stage.onFrame((dt, elapsed) => {
    sky.update(dt);
    world.update(dt, elapsed, camera);
    mission.update(dt, elapsed);

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
    sfx.dispose();
    mission.dispose();
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
