/**
 * Entry point. Builds the scene, wires input to the flight sequence, the missions and the
 * UI, and owns both the restart and the teardown paths.
 *
 * Destinations are data. Every body listed in DESTINATIONS gets a flight, a fact and a
 * collect mission built the same way, so adding the next planet is a config entry plus a
 * body in Bodies.ts — there is no per-destination branching below.
 */

import './ui/ui.css';
import * as THREE from 'three';
import {
  DESTINATIONS,
  FRAMING_RADIUS,
  FRAMING_RADIUS_WIDE,
  WIDE_FRAMING_VISIT,
} from './config';
import { detectQuality, prefersReducedMotion } from './scene/quality';
import { WebGLUnavailableError, createStage } from './scene/Stage';
import { createSky } from './scene/Starfield';
import { createWorld, type BodyId, type CelestialBody } from './scene/Bodies';
import { createSpaceship } from './scene/Spaceship';
import { createEngineTrail } from './scene/EngineTrail';
import { createDayTurn } from './scene/DayTurn';
import { createOrbitInput } from './controls/OrbitInput';
import { createFlightSequence } from './flight/FlightSequence';
import {
  createCollectMission,
  facingLatitude,
  type CollectMission,
} from './mission/CollectMission';
import { createNarrator } from './audio/narration';
import { createSfx } from './audio/sfx';
import { createUI } from './ui/ui';
import { createGrownups, shouldGreet } from './ui/grownups';
import { awardSticker, loadProgress, markVisited, recordDiscovery } from './state/progress';
import { loadSoundOn } from './state/settings';

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
  void sky.applyStarMap();

  const world = await createWorld(stage.quality);
  scene.add(world.group);

  const ship = createSpaceship();
  scene.add(ship.group);

  // World space, not parented to the ship: exhaust has to stay where it was laid down
  // while the ship flies on. Sized off the quality tier like every other particle count.
  const trail = createEngineTrail(stage.quality.tier === 'low' ? 24 : 46);
  scene.add(trail.group);

  /**
   * The opening shot only takes in Earth and the Moon until the Moon has been visited.
   * Fitting Mars from the first frame would shrink the first destination to a speck for
   * no reason a five-year-old could understand yet; going there is what makes the world
   * visibly get bigger. Going, not finishing — flying out and looking is enough.
   */
  function framingRadius(): number {
    return loadProgress().visited.includes(WIDE_FRAMING_VISIT)
      ? FRAMING_RADIUS_WIDE
      : FRAMING_RADIUS;
  }

  const controls = createOrbitInput({
    camera,
    element: canvas,
    reducedMotion,
    onTap: handleTap,
  });
  controls.setFocusRadius(world.bodies.earth.radius);
  controls.setTarget(new THREE.Vector3(), true);
  controls.frame(framingRadius(), true);

  const narrator = createNarrator();
  const sfx = createSfx();

  /*
   * The one screen written for the adult: what the game is, and the reading voice, which
   * cannot be chosen from a development machine because quality is a property of the
   * device. Shown once on a device's first load, and after that only when someone holds
   * the journal button down — or asks for it by address, which is the way back in if
   * storage was cleared. `?voices` still works, since that is what the README said first.
   */
  const asked = /[?&](grownups|voices)\b/.test(window.location.search);
  const grownups = createGrownups({
    root: uiRoot,
    narrator,
    // The panel stores the choice; making the game obey it is this file's job, as with
    // every other setting the modules do not own.
    onSoundChange: (on) => {
      sfx.setMuted(!on);
      ui.setSoundOn(on);
    },
  });
  if (shouldGreet(asked)) grownups.show();

  const ui = createUI({
    root: uiRoot,
    narrator,
    onFly: () => {
      const destination = selected ? world.bodies[selected] : null;
      if (!destination) return;
      // The flight is told which latitude to arrive over; it does not know why. Matching
      // destinations to their copy is this file's job, exactly as it is for the fact and
      // the mission.
      const discoveries = DESTINATIONS[destination.id]?.mission.discoveries;
      const aim = discoveries ? facingLatitude(discoveries) : undefined;
      if (!flight.start(destination, aim)) return;
      // The first reliable user gesture of the session, and the last one before the ship
      // arrives somewhere with sounds to make. Mobile browsers start an AudioContext
      // suspended and only let it resume inside a gesture like this one.
      sfx.resume();
      ui.enterFlight();
    },
    onExploreAgain: () => {
      restart();
    },
    onGrownups: () => grownups.show(),
    onSpin: () => {
      const body = world.bodies[follow];
      const spin = DESTINATIONS[follow]?.spin;
      if (!spin || dayTurn.active) return;
      // Nothing to say until it starts moving, and then the card explains what is being
      // watched rather than instructing anyone to watch it.
      ui.showNote(spin.name, spin.fact);
      ui.setSpinBusy(true);
      dayTurn.start(body);
    },
  });

  /*
   * Turning a destination through one day, which is the thing children asked about.
   *
   * The mission holds the surface still so its markers stay under a finger; this drives
   * the held value instead of fighting it, so the terminator sweeps and the city lights
   * come on with no new physics at all. Exactly one turn, so every marker ends where it
   * started.
   */
  const dayTurn = createDayTurn({
    camera,
    controls,
    // The quietest thing in the game gets the sound that most needs one. Driven by the
    // turn's own progress rather than started and left to run, so the light and the sound
    // arrive together however slowly the frames are coming.
    onProgress: (progress) => {
      sfx.dawn(progress);
      /*
       * Get the words off the planet the moment it starts turning.
       *
       * The card explains what is about to happen, and it is a full-width block across
       * the bottom of the dock — which is where the lower third of a destination framed
       * to fill the frame actually is. Reported from a tablet: it covered much of the
       * Earth for the whole turn, which is the one moment in the game whose entire point
       * is watching. Folded on the first frame that turns rather than on a timer, because
       * the swing before it is 2.2 seconds normally and 0.7 under reduced motion. The
       * speaker button stays, so the words are one tap away.
       */
      if (progress > 0) ui.foldFact();
    },
    onFinish: () => ui.setSpinBusy(false),
  });

  const flight = createFlightSequence({
    camera,
    scene,
    ship,
    trail,
    world,
    controls,
    home: world.bodies.earth,
    reducedMotion,
    // The engine, from the same two numbers the exhaust and the widening view are drawn
    // from. The context was created by the Fly press that started this flight.
    onThrottle: (throttle, cruise) => sfx.thruster(throttle, cruise),
    onArrive: (destination) => {
      follow = destination.id;
      selected = null;
      // Arriving is the achievement that opens the rest of the system up. The sticker is
      // still the collection's, and is still awarded by finishing it.
      markVisited(destination.id);

      const config = DESTINATIONS[destination.id];
      if (!config) return;
      ui.showArrival(destination.label, config.fact);

      // The places to find are simply part of the destination, marked on arrival rather
      // than behind a button. Nothing waits on them: the child can look, find, or fly home.
      const mission = missions[destination.id];
      if (!mission) return;
      activeMission = mission;
      mission.start();
      ui.beginMission(mission.definition.instruction, mission.definition.discoveries.length);
      // Offered from arrival, not held back until the places are found. The day/night
      // question is the one children actually bring to this, so it does not go behind a
      // task — and the mission holding the surface still is what makes turning it legible.
      ui.showSpin(config.spin?.label ?? null);
    },
  });

  /* --- missions ------------------------------------------------------------ */

  // One per destination, built up front. Construction is only bookkeeping; a mission
  // creates no geometry until it is started.
  const missions: Partial<Record<BodyId, CollectMission>> = {};
  let activeMission: CollectMission | null = null;

  for (const [id, config] of Object.entries(DESTINATIONS)) {
    const body = world.bodies[id as BodyId] as CelestialBody | undefined;
    if (!body) continue;
    missions[body.id] = createCollectMission({
      definition: { body, ...config.mission },
      camera,
      quality: stage.quality,
      reducedMotion,
      onCollect: (discovery, found, total, at) => {
        sfx.collect(found - 1, total);
        ui.setMissionProgress(found);
        // The mission reports where the marker was in normalised device coordinates,
        // because it holds a camera and not a canvas. This is handleTap's maths run
        // backwards, and it is what lets the place be named where it was actually found.
        const rect = canvas.getBoundingClientRect();
        ui.showFindLabel(
          rect.left + ((at.x + 1) / 2) * rect.width,
          rect.top + ((1 - at.y) / 2) * rect.height,
          discovery.emoji,
          discovery.name,
        );
        recordDiscovery(discovery.id);
        // What the place is, read out, replacing the arrival fact in the same card. The
        // hunt line would talk over it, so it waits for the last one instead — and when
        // it is the last one, the success line is already about to say the same thing.
        ui.showDiscovery(discovery);
        // Only the hidden one left: name the gesture now that the child needs it.
        if (found === total - 1) ui.setMissionCaption(config.mission.huntLine);
      },
      onComplete: () => {
        sfx.success();
        // The celebration keys off finishing, not off the award: a child who earned this
        // sticker on an earlier visit still gets the party, just not a second sticker.
        const isNew = awardSticker(config.mission.stickerId);
        ui.completeMission(config.mission.successLine, isNew ? config.mission.stickerId : null);
      },
    });
  }

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

    if (activeMission?.active) {
      // Collectibles float well inside the body's own (deliberately generous) hit sphere,
      // so they get the tap to themselves. A miss simply does nothing: there is no wrong
      // answer to punish here.
      const target = raycaster.intersectObjects(activeMission.hitMeshes, false)[0];
      if (target) activeMission.collectFrom(target.object);
      else ui.showTapEcho(clientX, clientY);
      return;
    }

    const hit = raycaster.intersectObjects(world.hitMeshes, false)[0];
    const id = hit?.object.userData.bodyId as BodyId | undefined;

    selected = id ?? null;
    world.setSelected(selected);

    if (!selected) {
      ui.showSelection(null);
      ui.showTapEcho(clientX, clientY);
      return;
    }
    ui.setHint(null);
    const config = DESTINATIONS[selected];
    ui.showSelection({
      label: world.bodies[selected].label,
      flyLabel: config && flight.phase === 'idle' ? config.flyLabel : null,
    });
  }

  /* --- scratch ------------------------------------------------------------- */

  const aimPosition = new THREE.Vector3();
  const focusPosition = new THREE.Vector3();
  const shipHeading = new THREE.Vector3();

  /* --- hints --------------------------------------------------------------- */

  let nudge = 0;

  function showOpeningHints() {
    window.clearTimeout(nudge);
    // Once the shot has widened there is a new thing on screen, so the nudge points at
    // that rather than at the Moon the child has already finished.
    const wide = framingRadius() === FRAMING_RADIUS_WIDE;
    ui.setHint(wide ? 'A new world is out there 🔴' : 'Drag to look around ✨');
    nudge = window.setTimeout(() => {
      if (flight.phase !== 'idle' || selected) return;
      ui.setHint(wide ? 'Tap Mars 🔴' : 'Tap the Moon 🌙');
    }, 6500);
  }

  // Whatever was chosen last time, applied before anything can make a noise.
  const soundOn = loadSoundOn();
  sfx.setMuted(!soundOn);
  ui.setSoundOn(soundOn);

  showOpeningHints();

  /* --- restart ------------------------------------------------------------- */

  /**
   * "Explore Again" without a page reload. Every stateful module owns its own reset;
   * this is the only place that calls them, so there is one order to reason about.
   *
   * The bodies are deliberately not put back where they were: they have kept orbiting,
   * and the next flight simply aims at wherever the destination is now.
   */
  function restart() {
    for (const mission of Object.values(missions)) mission.reset();
    activeMission = null;
    dayTurn.reset();
    flight.reset();
    // Both of those were being *driven* by the modules above, so stopping them stops
    // nothing on its own: a Fly Home mid-flight leaves the engine running otherwise.
    sfx.reset();
    // The ship was re-parented to the destination on arrival; the scene has to take it
    // back before the ship can restore its own parked transform.
    scene.attach(ship.group);
    ship.reset();
    // Or the last flight's exhaust hangs in space, still out at the destination.
    trail.reset();
    world.reset();

    controls.reset();
    controls.setFocusRadius(world.bodies.earth.radius);
    controls.setTarget(world.bodies.earth.getWorldPosition(focusPosition), true);
    controls.frame(framingRadius(), true);

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
    trail.update(dt);
    activeMission?.update(dt, elapsed);
    dayTurn.update(dt);

    /*
     * Point at the last place, while it is round the back.
     *
     * Driven per frame rather than fired once, because the whole point is that it goes
     * away the moment the child has dragged far enough to see the thing — which is a
     * property of where the camera is now, not of an event. Nothing to point at during a
     * flight or a day turn, when the camera is not theirs to move.
     */
    const hint =
      flight.phase === 'flying' || dayTurn.active ? null : (activeMission?.remainingHint() ?? null);
    ui.setHuntArrow(hint && !hint.visible ? hint.side : null);

    if (flight.phase === 'idle') {
      // The idle ship keeps its nose pointed at whichever destination is selected, and
      // at the Moon otherwise, so it never sits blankly side-on.
      const aim = selected && selected !== 'earth' ? selected : 'moon';
      world.bodies[aim].getWorldPosition(aimPosition);
      shipHeading.subVectors(aimPosition, ship.group.position);
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
        controls.frame(follow === 'earth' ? framingRadius() : world.bodies[follow].radius * 2.6);
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
      // Continuous sound is driven a frame at a time, and stopping the loop stops the
      // driving — leaving the engine held at whatever gain it had reached, droning out of
      // a backgrounded tab forever. Both sounds rebuild themselves on the next frame.
      sfx.reset();
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
    grownups.dispose();
    narrator.dispose();
    sfx.dispose();
    for (const mission of Object.values(missions)) mission.dispose();
    ship.dispose();
    trail.dispose();
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
