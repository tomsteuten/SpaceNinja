import { createSessionLifecycle } from './session/lifecycle';
import { fail } from './session/failure';
import { registerOffline } from './session/offline';
import { nextWorld, worldCollections } from './state/replay';
/**
 * Entry point. Builds the scene, wires input to the flight sequence, the missions and the
 * UI. Session lifecycle owns browser transitions; this route supplies reset and disposal.
 *
 * Common destination behavior is data-driven; unusual bodies may expose explicit scene
 * capabilities instead of being forced through a false one-size-fits-all abstraction.
 */

import './ui/ui.css';
import './ui/theme.css';
import './ui/adventure.css';
import './ui/storybook.css';
import { adventureViewOffset } from './ui/viewport';
import * as THREE from 'three';
import { DESTINATIONS, SUN_DIRECTION } from './config';
import { detectQuality, prefersReducedMotion } from './scene/quality';
import { WebGLUnavailableError, createStage } from './scene/Stage';
import { createSky } from './scene/Starfield';
import { createWorld, type BodyId, type CelestialBody } from './scene/Bodies';
import { createSpaceship } from './scene/Spaceship';
import { createEngineTrail } from './scene/EngineTrail';
import { createDayTurn } from './scene/DayTurn';
import { TEACHING_SUN_RADIUS } from './scene/dayTurnFraming';
import { createOrbitInput } from './controls/OrbitInput';
import { createSpaceMap } from './map';
import { createFlightSequence } from './flight/FlightSequence';
import { createHomeReturn } from './flight/HomeReturn';
import {
  createCollectMission,
  facingLatitude,
  type CollectMission,
} from './mission/CollectMission';
import { createNarrator } from './audio/narration';
import { cueText } from './audio/script';
import { createSfx } from './audio/sfx';
import { createUI } from './ui/ui';
import { chooseDiscoveries } from './mission/selection';
import { createCoach, shouldInviteSpin } from './ui/coach';
import { dueNudge, shorteningPair, singleNudge } from './ui/nudge';
import { createGrownups, shouldGreet } from './ui/grownups';
import {
  FINALE_STICKER,
  awardSticker,
  foundEverything,
  loadProgress,
  markVisited,
  recordDiscovery,
} from './state/progress';
import { loadSoundOn } from './state/settings';
import { DISCOVERIES } from './config';

const boot = document.getElementById('boot');

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

  /*
   * Earth's bedtime spin: into night, back into morning, each change said once. Once the
   * visit's places are found (Space map is then the ringed next step) the round trip suggests
   * the Moon if it is still unvisited; otherwise it suggests turning more. Nothing is counted
   * or saved.
   */
  /** This opening of Earth's bedtime spin has reached night, then morning again. */
  let bedtimeNight = false;
  let bedtimeRoundTrip = false;

  const ship = createSpaceship();
  const syncShipStickers = () => ship.setStickers(loadProgress().stickers);
  syncShipStickers();
  scene.add(ship.group);

  // World space, not parented to the ship: exhaust has to stay where it was laid down
  // while the ship flies on. Sized off the quality tier like every other particle count.
  const trail = createEngineTrail(stage.quality.tier === 'low' ? 24 : 46);
  scene.add(trail.group);

  const controls = createOrbitInput({
    camera,
    element: canvas,
    reducedMotion,
    onTap: handleTap,
  });
  controls.setFocusRadius(world.bodies.earth.radius);
  controls.setTarget(new THREE.Vector3(), true);

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
  const greeting = shouldGreet(asked);
  // With the splash up, the map is hidden behind it, so its opening line must not play yet —
  // it did, over the parents' screen before space was visible. Hold it until "Start playing".
  let mapIntroPending = greeting;
  const grownups = createGrownups({
    root: uiRoot,
    narrator,
    // The panel stores the choice; making the game obey it is this file's job, as with
    // every other setting the modules do not own.
    onSoundChange: (on) => {
      sfx.setMuted(!on);
      ui.setSoundOn(on);
    },
    onResetProgress: () => restart(),
    onStart: () => {
      // The first real gesture: unlock audio, then speak the deferred opening line once, over
      // the now-visible map. A later close of the grown-ups panel mid-game must not re-announce.
      narrator.resume();
      if (mapIntroPending) {
        mapIntroPending = false;
        announceMap(false);
      }
    },
  });
  if (greeting) grownups.show();

  const ui = createUI({
    root: uiRoot,
    narrator,
    onExploreAgain: () => {
      // A Fly Home during a day turn: stop the turn first so it is not still writing the
      // camera as the pull-back takes it. dayTurn.reset() is a no-op otherwise.
      cameraReturn = null;
      huntViewTurn = null;
      dayTurn.reset();
      sfx.reset();
      // The visit's controls go first, so the map's page is framed for its own layout.
      ui.enterFlight();
      // Ease the camera out to the map first; restart() runs when the pull-back lands, on the
      // world's own page. Under reduced motion start() declines and this cuts straight home.
      map.openAt(follow);
      if (homeReturn.start()) {
        // Bring the page's worlds back to full strength as the camera leaves the destination.
        world.setFocus(null);
        ship.setContextDimmed(false);
      } else restart();
    },
    onGrownups: () => grownups.show(),
    // The whole game finished. Played when the overlay lands, not when the last world
    // completes, or it would run under the world's own chime.
    onFinale: () => sfx.fanfare(),
    onTurnToHidden: () => {
      // Only while the arrow is genuinely on screen: the camera is the child's, the hunt is
      // live and the last place is round the back. A late press on a fading arrow does
      // nothing, which is the right nothing.
      const hint = activeMission?.remainingHint();
      if (!hint || hint.visible || !cameraIsOurs()) return;
      // Move around the surface without changing its sunlight. In particular, finding
      // Earth's night side must not turn that place into daytime.
      const axis = new THREE.Vector3(0, 1, 0).transformDirection(world.bodies[follow].surface.matrixWorld);
      huntViewTurn = { axis, direction: hint.turn, t: 0, applied: 0 };
    },
    onSpin: () => {
      if (dayTurn.active) {
        if (follow === 'earth') dayTurn.skip();
        return;
      }
      startDayTurn();
    },
    onStopSpin: () => dayTurn.skip(),
    onFindPlaces: () => {
      earthDayNightPrompt = false;
      spinTried = true; // A deliberate choice to explore needs no repeated lesson invitation.
      ui.setEarthWelcome(false);
      ui.setSpinAttention(false);
      activeMission?.setPresentation(true);
      beginGuidedHunt(true);
    },
    // The house's night and morning get the same spoken feedback the old 3D activity gave.
    // "You can fly to the Moon next" only while it is true and agrees with the screen: the
    // Moon is still unvisited and Space map is the ringed next step (the places are found).
    onBedtimePart: (part) => {
      if (part === 'night' && !bedtimeNight) {
        bedtimeNight = true;
        ui.speakGuide(cueText('day-night-night'), 'day-night-night', true);
      } else if (part === 'morning' && bedtimeNight && !bedtimeRoundTrip) {
        bedtimeRoundTrip = true;
        const onToMoon = ui.mapIsNext && suggestedDestination() === 'moon';
        const next = onToMoon ? 'day-night-moon' : 'day-night-done';
        ui.speakGuide(cueText(next), next, true);
      }
    },
    onBedtimeClose: () => {
      if (follow !== 'earth') return;
      // The gold places are still there to find, never required.
      activeMission?.setPresentation(true);
      beginGuidedHunt(true);
    },
  });

  /**
   * Earth's Day & night is the bedtime spin toy (src/toys/bedtimeSpin.ts): Earth seen from
   * above the North Pole, turned by the child, with a house riding into night and back into
   * morning. It replaced the 3D side-on turn, where a sideways drag hid the house round the
   * back of the planet. The 3D scene is left alone while it is open.
   */
  function startBedtime() {
    huntViewTurn = null;
    controls.cancelGesture();
    earthDayNightPrompt = false;
    ui.setEarthWelcome(false);
    ui.setHint(null);
    ui.setHuntArrow(null);
    coach.clear();
    spinTried = true;
    bedtimeNight = false;
    bedtimeRoundTrip = false;
    ui.openBedtime();
    ui.speakGuide(cueText('day-night-start'), 'day-night-start', true);
  }

  /**
   * Start Day & night from the child's press. Store its explanation for replay/Words,
   * then give the turn exclusive camera ownership until stop, completion or return.
   */
  function startDayTurn() {
    const body = world.bodies[follow];
    const spin = DESTINATIONS[follow]?.spin;
    if (!spin || dayTurn.active) return;
    if (follow === 'earth') {
      startBedtime();
      return;
    }
    huntViewTurn = null;
    controls.cancelGesture();
    // A replay pressed during the hand-back must not create two camera owners. Keep the
    // original return destination; the new turn starts from the current interpolated pose.
    const returning = Boolean(cameraReturn);
    cameraReturn = null;
    // Where the child was looking from before the turn swung the camera side-on, so it can
    // be handed back to them there. Relative to the body, which keeps orbiting throughout.
    body.getWorldPosition(focusPosition);
    if (!returning) preTurnCameraOffset.copy(camera.position).sub(focusPosition);
    ui.showNote(`spin-${follow}`, spin.name, spin.fact);
    spinTried = true;
    ui.setSpinBusy(true);
    dayTurn.start(body);
  }

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
    teachingSun: world.teachingSun,
    reducedMotion,
    // The quietest thing in the game gets the sound that most needs one. Driven by the
    // turn's own progress rather than started and left to run, so the light and the sound
    // arrive together however slowly the frames are coming.
    onProgress: (progress) => {
      sfx.dawn(progress);
      // The button's own globe, driven by the same number the picture and the sound are.
      ui.setSpinProgress(progress);
    },
    onFinish: () => onDayTurnFinish(),
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
    // Playtest builds only: `?fast` shortens the flight so browser checks and style captures
    // that are not about the flight skip the slow software-rendered travel. A normal build
    // compiles this away, so the flag does nothing for a child.
    duration: import.meta.env.VITE_PLAYTEST === '1' && /[?&]fast\b/.test(window.location.search)
      ? 0.3 : undefined,
    // The engine, from the same two numbers the exhaust and the widening view are drawn
    // from. The context was created by the press that started this flight.
    onThrottle: (throttle, cruise) => sfx.thruster(throttle, cruise),
    onArrive: (destination) => {
      follow = destination.id;
      suggested = null;
      world.setSelected(null);
      spinInvited = false;
      // Each visit gets its nudges afresh; the clock for the spin follow-up starts here too.
      arrivalNudgesGiven.clear();
      spinIdle = 0;
      // Read before the visit is recorded: a first visit is one that has not been.
      const firstVisit = !loadProgress().visited.includes(destination.id);
      // Recorded for the map's tick and its suggestion; it opens nothing, since nothing is
      // locked. The sticker is still the collection's, and is still awarded by finishing it.
      markVisited(destination.id);

      // The destination and its real-coordinate targets are the subject now. Other
      // worlds and the parked ship remain visible enough to preserve context, but cannot
      // become opaque foreground objects when a child drags around to the hidden place.
      world.setFocus(destination.id);
      ship.setContextDimmed(true);

      const config = DESTINATIONS[destination.id];
      if (!config) return;
      // The welcome never takes the camera automatically. Earth's first invitation
      // offers a lesson or direct exploration; other arrivals show places at once.
      ui.showArrival(`arrival-${destination.id}`, destination.label, config.fact, config.emoji, destination.id);

      // The departure chose this visit already, so the camera and targets share one set.
      const mission = missions[destination.id];
      if (!mission) {
        ui.showSpin(null);
        return;
      }
      activeMission = mission;
      // Prepare the real places. Earth's first invitation temporarily sets them aside
      // so its two choices don't compete with another set of tap targets.
      mission.start();
      revealHunt();
      // Supported Day & night is visible on settled arrival for every mission world.
      // Earth's first-visit invitation can pulse and speak, but the child starts the turn.
      earthDayNightPrompt = destination.id === 'earth' && firstVisit;
      // The first Earth visit's choice is on screen and pulsing from the start; its spoken
      // invitation would only queue behind the welcome, so the welcome is the one line.
      if (earthDayNightPrompt) spinInvited = true;
      if (destination.id === 'earth') {
        ui.setEarthWelcome(earthDayNightPrompt);
        mission.setPresentation(!earthDayNightPrompt);
      }
    },
  });

  /*
   * The animated "Fly Home". It owns the camera for its pull-back the way the flight does,
   * so the frame loop suspends orbit control while it runs, and restart() — the one teardown
   * path — happens only once it lands, on exactly the pose it eases to.
   */
  const homeFocus = new THREE.Vector3();
  const homeReturn = createHomeReturn({
    camera,
    controls,
    reducedMotion,
    // The map's pose for the visited world's page, with its worlds sliding into place as the
    // camera goes, so restart() lands on exactly this picture.
    restingPose: () => map.beginReturn(follow),
    currentFocus: () => world.bodies[follow].getWorldPosition(homeFocus),
    onProgress: (t) => map.blendReturn(t),
    onArrive: () => restart(),
  });

  /* --- missions ------------------------------------------------------------ */

  /*
   * Built per *visit*, not once up front.
   *
   * A world carries more places than it shows and `chooseDiscoveries` picks a playable set
   * each time — so which places exist is no longer a property of the destination, it is a
   * property of this arrival. A mission built at boot would pin one set for the session and
   * hand back the same three every time, which is the thing this whole change exists to stop.
   *
   * Construction is only bookkeeping: a mission creates no geometry until `start()`, and the
   * previous one is disposed before the next is made, so nothing accumulates across flights.
   */
  const missions: Partial<Record<BodyId, CollectMission>> = {};
  let activeMission: CollectMission | null = null;

  function buildMission(id: BodyId): CollectMission | null {
    const config = DESTINATIONS[id];
    const body = world.bodies[id] as CelestialBody | undefined;
    const definition = config?.mission;
    if (!config || !definition || !body) return null;
    missions[id]?.dispose();
    const discoveries = chooseDiscoveries(
      definition.discoveries,
      loadProgress().discoveries,
      body.radius,
    );
    const mission = createCollectMission({
      definition: { body, ...definition, discoveries },
      camera,
      quality: stage.quality,
      reducedMotion,
      onCollect: (discovery, found, total, at) => {
        beginGuidedHunt();
        sfx.collect(found - 1, total);
        ui.setMissionProgress(found);
        // The mission reports where the marker was in normalised device coordinates,
        // because it holds a camera and not a canvas. This is handleTap's maths run
        // backwards, and it is what lets the place be named where it was actually found.
        const rect = canvas.getBoundingClientRect();
        ui.showFindLabel(
          rect.left + ((at.x + 1) / 2) * rect.width,
          rect.top + ((1 - at.y) / 2) * rect.height,
          discovery.id,
          discovery.name,
        );
        const isNew = recordDiscovery(discovery.id);
        // What the place is, read out, replacing the arrival fact in the same card. The
        // hunt line would talk over it, so it waits for the last one instead — and when
        // it is the last one, the success line is already about to say the same thing.
        ui.showDiscovery(discovery, true, !isNew);
        // Only the hidden one left: name the gesture now that the child needs it.
        if (found === total - 1) {
          ui.setMissionCaption(definition.huntLine, `hunt-${body.id}`);
        }
      },
      onComplete: () => {
        sfx.success();
        /*
         * Finding this visit's three is always the party. The world's *badge* now waits for
         * every place the world carries, across however many visits that takes.
         *
         * It used to be the same event, because a world had exactly three places and showed
         * all of them. Now it shows three of six, and awarding "Moon Explorer" for half the
         * Moon would make the badge mean less each time a place is added — and would leave a
         * child with nothing to come back for, which is the whole problem being fixed. The
         * moment-to-moment reward is unchanged: the celebration still fires every visit.
         */
        const found = loadProgress().discoveries;
        const worldComplete = definition.discoveries.every((d) => found.includes(d.id));
        const isNew = worldComplete && awardSticker(definition.stickerId);
        if (isNew) syncShipStickers();
        const next = suggestedDestination();
        const nextConfig = next ? DESTINATIONS[next] : undefined;
        const namesNextWorld = Boolean(nextConfig && next !== body.id);
        ui.completeMission(
          `success-${body.id}`,
          definition.successLine,
          isNew ? definition.stickerId : null,
          body.label,
          // "You can fly home and pick another world." — behind the success line, but only when
          // the hint below actually points at a next world to go to.
          namesNextWorld ? { text: cueText('success-next'), cueId: 'success-next' } : undefined,
        );
        /*
         * And when this was the last place on the last world, the finale — once.
         *
         * It used to fire on *any* completion that left the book full, badge or no badge.
         * Since nothing about a world is remembered between visits, every later visit
         * re-completed it, so the reward for playing again was the victory party again,
         * meaning nothing: replay was not merely absent, it was actively spoiled. The
         * sticker award is already the "first time" test — it returns true once per save —
         * so the moment now rides on it rather than sitting beside it. A grown-ups reset
         * clears the sticker with everything else, so a fresh adventure earns it again.
         */
        if (
          foundEverything(loadProgress().discoveries, Object.keys(DISCOVERIES)) &&
          awardSticker(FINALE_STICKER)
        ) {
          syncShipStickers();
          ui.completeGame(FINALE_STICKER);
        }
      },
    });
    missions[id] = mission;
    return mission;
  }

  /* --- selection ----------------------------------------------------------- */

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  /**
   * The world the map is currently pointing a child at — not a selection, since there is no
   * longer such a thing. It drives the ring in the scene, the highlighted destination button
   * and the parked ship's nose, so all three agree on one suggestion instead of the hint text
   * naming a world while the ship points at another.
   */
  let suggested: BodyId | null = null;
  let follow: BodyId = 'earth';

  /* --- the hunt ------------------------------------------------------------ */

  const HUNT_INVITE_HINT_DELAY = 5;
  const HUNT_GUIDANCE_AUTO_START = 12;
  let huntGuidance:
    | {
      world: BodyId;
      elapsed: number;
      inviteShown: boolean;
      active: boolean;
    }
    | null = null;

  /**
   * A day turn has finished (or been tapped through). Hand the camera back where the child
   * was looking from, rather than leaving them side-on to the Sun with the targets they were
   * reaching for round the side of the world. Reduced motion cuts back; other devices ease.
   */
  function onDayTurnFinish() {
    ui.setSpinBusy(false);
    ui.setSpinProgress(null);
    // Ensure hunt guidance has begun after the optional turn. Targets were revealed on
    // arrival; this only adds guidance and is a no-op if guidance is already running.
    beginGuidedHunt();
    const body = world.bodies[follow];
    body.getWorldPosition(focusPosition);
    if (reducedMotion) {
      camera.position.copy(focusPosition).add(preTurnCameraOffset);
      camera.lookAt(focusPosition);
      camera.updateMatrixWorld(true);
      controls.syncFromCamera();
      controls.enabled = true;
      return;
    }
    cameraReturn = { from: camera.position.clone().sub(focusPosition), rotation: camera.quaternion.clone(), t: 0 };
    controls.enabled = false;
  }

  /** `speak`: say the find instruction (a press or a quiet spell started it, not a tap on a place). */
  function beginGuidedHunt(speak = false) {
    if (!huntGuidance || huntGuidance.world !== follow || huntGuidance.active) return;
    const config = DESTINATIONS[follow];
    const mission = missions[follow];
    if (!config?.mission || !mission) return;
    huntGuidance.active = true;
    ui.setHint(null);
    ui.beginMission(config.mission.instruction, mission.definition.discoveries.length, `find-${follow}`, speak);
    // Refresh the supported activity label; revealHunt already made it visible on arrival.
    if (follow !== 'earth') ui.showSpin(config.spin?.label ?? null, config.spin?.tint);
  }

  function revealHunt() {
    const mission = missions[follow];
    if (!DESTINATIONS[follow] || !mission) return;
    mission.reveal();
    // A short roam-first beat keeps arrivals calmer: the world and targets are already live,
    // while explicit score/counter language enters only after interaction or a short pause.
    huntGuidance = { world: follow, elapsed: 0, inviteShown: false, active: false };
    if (follow === 'earth') {
      ui.showSpin('Day and night on Earth', DESTINATIONS.earth?.spin?.tint);
      ui.setHint(null);
    } else {
      const spin = DESTINATIONS[follow]?.spin;
      ui.showSpin(spin?.label ?? null, spin?.tint);
      ui.setHint('Tap a gold place', 'target');
    }
  }

  /*
   * Tap-to-skip during a day turn. The turn disables orbit control, so OrbitInput's tap path
   * is dead for its whole duration — this covers exactly that window. On pointerup, not down,
   * so OrbitInput's own (disabled, no-op) handler runs first and this gesture cannot also
   * land as a collect.
   */
  function onDayTurnSkipTap() {
    if (dayTurn.active) dayTurn.skip();
  }
  canvas.addEventListener('pointerup', onDayTurnSkipTap);

  function handleTap(clientX: number, clientY: number) {
    if (flight.phase === 'flying') return;
    // A tap during a day turn is "I have seen enough": end the turn as a completion, so the
    // markers land back on their real coordinates, rather than raycasting at a swinging
    // camera. The turn is always a deliberate press now, but a child is allowed to change
    // their mind about one.
    if (dayTurn.active) {
      dayTurn.skip();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    if (earthDayNightPrompt) {
      const earth = raycaster.intersectObjects(world.hitMeshes, false)
        .some(hit => hit.object.userData.bodyId === 'earth');
      if (earth) startDayTurn();
      else ui.showTapEcho(clientX, clientY);
      return;
    }

    if (activeMission?.active) {
      // Collectibles float well inside the body's own (deliberately generous) hit sphere,
      // so they get the tap to themselves. A miss simply does nothing: there is no wrong
      // answer to punish here.
      const target = raycaster.intersectObjects(activeMission.hitMeshes, false)[0];
      if (target) activeMission.collectFrom(target.object);
      else ui.showTapEcho(clientX, clientY);
      return;
    }

    if (flight.phase === 'arrived') {
      ui.showTapEcho(clientX, clientY);
      return;
    }
    const hit = raycaster.intersectObjects(world.hitMeshes, false)[0];
    const id = hit?.object.userData.bodyId as BodyId | undefined;

    if (!id) {
      ui.showTapEcho(clientX, clientY);
      return;
    }
    launch(id);
  }

  /**
   * Touch a world, go to that world. One tap, one journey.
   *
   * This used to be two steps — a tap selected a body and revealed a *separately placed*
   * Fly button, so a child who touched Mars watched something glow and nothing happen, and
   * tapped it again to the same effect. It was the most reliably counter-intuitive thing in
   * the build, for adults as well as children: the verb was in a different place from the
   * noun. Both routes in (the destination bar and the body itself) now launch directly.
   *
   * A stray launch is the accepted cost, and it is a small one: OrbitInput only calls
   * `onTap` for a clean single-finger press under 12px and 400ms, so looking around never
   * fires this, and Fly Home is on screen from the moment the ship arrives.
   */
  function launch(id: BodyId | null) {
    if (!id) return;
    if (flight.phase !== 'idle' || activeMission?.active || homeReturn.active) return;
    const destination = world.bodies[id];
    if (!destination) return;
    // The flight is told which latitude to arrive over; it does not know why. Matching
    // destinations to their copy is this file's job, exactly as it is for the fact and
    // the mission.
    const discoveries = buildMission(id)?.definition.discoveries;
    const aim = discoveries ? facingLatitude(discoveries) : undefined;
    if (!flight.start(destination, aim)) return;
    // The map lets go of the camera and draws every world again for the journey.
    map.hide();
    huntGuidance = null;
    // The first reliable user gesture of the session, and the last one before the ship
    // arrives somewhere with sounds to make. Mobile browsers start an AudioContext
    // suspended and only let it resume inside a gesture like this one.
    sfx.resume();
    narrator.resume();
    ui.enterFlight();
  }

  /* --- scratch ------------------------------------------------------------- */

  const aimPosition = new THREE.Vector3();
  const focusPosition = new THREE.Vector3();
  const shipHeading = new THREE.Vector3();
  /*
   * The camera's offset from the destination at the moment a day turn begins. The turn
   * deliberately ends side-on to the Sun (it is tested to), which is the wrong pose to be
   * handed back mid-hunt: the targets a child was reaching for are round the side of the
   * world by then. Captured relative to the body's *current* position, since it keeps
   * orbiting through the turn, and eased back to when the turn finishes.
   *
   * This used to be captured only for the automatic arrival turn, so a *manual* replay left
   * the camera wherever it had swung to. Now that every turn is a manual one, every turn
   * gets the ease back.
   */
  const preTurnCameraOffset = new THREE.Vector3();
  /*
   * The smooth hand-back from the side-on day-turn pose to the arrival composition. Rather
   * than cutting (which read as a jerk on the tablet), the camera eases its offset from where
   * the turn left it back to the arrival offset over CAMERA_RETURN_MS, relative to the still-
   * orbiting body. Null when no ease is running. `from` is the starting offset; `t` runs 0→1.
   */
  const CAMERA_RETURN_MS = 950;
  const returnOffset = new THREE.Vector3();
  const returnLookMatrix = new THREE.Matrix4();
  const returnRotation = new THREE.Quaternion();
  let cameraReturn: { from: THREE.Vector3; rotation: THREE.Quaternion; t: number } | null = null;

  // The hunt arrow orbits the camera by a quarter turn. Surface orientation and
  // illumination stay fixed; ordinary dragging can add to the viewpoint change.
  /** The spoken invitation to turn the world has been given this visit. */
  let spinInvited = false;
  /** First Earth offers Turn Earth or Find places, with Space map always available. */
  let earthDayNightPrompt = false;

  const QUARTER_TURN = Math.PI / 2;
  const HUNT_VIEW_TURN_MS = 700;
  let huntViewTurn: { axis: THREE.Vector3; direction: -1 | 1; t: number; applied: number } | null = null;

  function cameraIsOurs(): boolean {
    return flight.phase !== 'flying' && !dayTurn.active && !homeReturn.active && !cameraReturn;
  }

  /* --- hints --------------------------------------------------------------- */

  /*
   * The idle coach. Shows the gesture on the thing the gesture applies to, after a while
   * with nothing touched — see ui/coach.ts for why an arrow and a sentence were not enough.
   */
  const coach = createCoach({
    root: uiRoot,
    measure: () => {
      const rect = canvas.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    },
    reducedMotion,
  });

  let idleFor = 0;
  let spinTried = false;
  /*
   * The spoken layer's idle nudges (docs/current-implementation.md, "The spoken layer").
   *
   * Two clocks that reset on any press, and two "given" sets that do not, so a press quiets
   * the nagging but the same words are never spoken twice in one visit or one map view. The
   * arrival nudges (find/hunt/spin) run off `idleFor`, which already accumulates from arrival;
   * `spinIdle` is the separate wait after the spin invitation; `mapIdle` is the map's own idle.
   */
  const arrivalNudgesGiven = new Set<string>();
  const mapNudgesGiven = new Set<string>();
  let spinIdle = 0;
  let mapIdle = 0;

  /** The hunt arrow button's centre in the canvas's NDC, the unit the coach places hands in. */
  function arrowInCanvas(): { x: number; y: number } | null {
    const centre = ui.huntArrowCentre();
    if (!centre) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((centre.x - rect.left) / rect.width) * 2 - 1,
      y: -(((centre.y - rect.top) / rect.height) * 2 - 1),
    };
  }
  /*
   * Any press at all, anywhere, is the child doing something — a tap on a target, a drag, a
   * pinch, a dock button. Listened for on the window in the capture phase rather than wired
   * through OrbitInput, because a drag that the controls are ignoring (during a day turn,
   * say) is still a child trying, and a coach that kept demonstrating over it would be
   * telling them they had not moved.
   */
  function onAnyPress() {
    idleFor = 0;
    spinIdle = 0;
    mapIdle = 0;
    coach.clear();
    // The first real gesture of the session unlocks the audio context, so a map cue attempted
    // before any touch (it fails silently) is picked up by the nudge once the child taps.
    narrator.resume();
  }
  window.addEventListener('pointerdown', onAnyPress, true);

  /**
   * The one world the map is pointing at: the first unvisited world in the map's hint order
   * (Earth, the Moon, Mars, the Sun, Saturn). When everywhere has been visited an incomplete
   * collection becomes the invitation; once every place has been found, the map stops
   * suggesting anything. Only ever a hint: every world can be flown to at any time.
   */
  function suggestedDestination(): BodyId | null {
    return nextWorld(loadProgress(), map.order) as BodyId | null;
  }

  /**
   * The gold card (or, when the world is on another page, the arrow towards it), its pointer,
   * the ring round the world in the scene and the parked ship's nose share one suggestion
   * (playtest 2: a spoken "Mars is ready" alone was not enough).
   */
  function applySuggestion() {
    suggested = suggestedDestination();
    map.setSuggestion(suggested);
    world.setSelected(suggested, !reducedMotion);
    // A fresh suggestion is a fresh set of map nudges: the cue ids name this world, so the old
    // "given" flags no longer apply, and the idle clock starts again.
    mapIdle = 0;
    mapNudgesGiven.clear();
  }

  /**
   * The one spoken line on landing at the map, once per arrival there. A brand-new save uses
   * the `home-earth` cue; a Fly Home uses `fly-home`; any other map `home-<suggested>` (or
   * `home-any` when nothing is suggested).
   */
  function announceMap(viaFlyHome: boolean) {
    const visited = loadProgress().visited;
    // "Tap it" is only true while the suggested world is on the page being shown.
    const cue =
      visited.length === 0
        ? 'home-earth'
        : viaFlyHome
          ? 'fly-home'
          : suggested && map.hint === 0
            ? `home-${suggested}`
            : 'home-any';
    ui.speakGuide(cueText(cue), cue);
  }

  /** The heading says what the hint shows: the world's card here, or the arrow towards it. */
  function showMapHeading() {
    const next = suggested;
    if (!next) {
      ui.setHint('Tap a world to fly there', 'rocket');
      return;
    }
    const label = shortLabel(next);
    const revisit = loadProgress().visited.includes(next);
    // Going back for more: the gold place the child hunts there, not the journal.
    const icon = revisit ? 'target' : 'rocket';
    if (map.hint !== 0) ui.setHint(`Tap the arrow for ${label}`, icon);
    else ui.setHint(revisit ? 'More to find · Tap ' + label : 'Tap ' + label, icon);
  }

  /** "Moon", not "The Moon": a card has room for the identity, not the article. */
  function shortLabel(id: BodyId): string {
    return world.bodies[id].label.replace(/^The /, '');
  }

  /*
   * The Space map: one neighbourhood per page. It owns the camera only while it is up, between
   * a landed return and the next launch, and never pages while a flight or return runs.
   */
  const map = createSpaceMap({
    root: uiRoot,
    canvas,
    camera,
    world,
    controls,
    ship: ship.group,
    reducedMotion,
    covered: () => ui.activityCovered || grownups.open,
    describe: (id) => {
      const progress = loadProgress();
      const collection = worldCollections(progress.discoveries).find((page) => page.id === id);
      return {
        id,
        label: shortLabel(id),
        // Been there: a tick, so a pre-reader can see what is done. It opens nothing.
        done: progress.visited.includes(id),
        found: collection?.found,
        total: collection?.total,
      };
    },
    launch: (id) => launch(id),
    tap: (x, y) => handleTap(x, y),
    onPage: () => {
      showMapHeading();
      mapIdle = 0;
    },
    headingBottom: () => ui.headingBottom(),
  });

  // Whatever was chosen last time, applied before anything can make a noise.
  const soundOn = loadSoundOn();
  sfx.setMuted(!soundOn);
  ui.setSoundOn(soundOn);
  applySuggestion();
  // A new session opens where the hint points (a new save: home's page, Earth).
  map.openAt(suggested);
  ui.setHome(true);
  showMapHeading();
  map.show();
  // The map's opening line. Only when no splash is covering the map: with the grown-ups screen
  // up, this is deferred to the "Start playing" press (onStart above), so it never talks over
  // the splash. Without a splash (a later load, storage remembered), there has been no gesture
  // yet, so it fails silently and the map nudge repeats it once the child touches anything.
  if (!greeting) announceMap(false);

  /* --- restart ------------------------------------------------------------- */

  /**
   * "Explore Again" without a page reload. Every stateful module owns its own reset;
   * this is the only place that calls them, so there is one order to reason about.
   *
   * The bodies are deliberately not put back where they were: they have kept orbiting,
   * and the next flight simply aims at wherever the destination is now.
   */
  function resetAdventure() {
    cameraReturn = null;
    huntViewTurn = null;
    spinInvited = false;
    earthDayNightPrompt = false;
    huntGuidance = null;
    coach.clear();
    idleFor = 0;
    spinTried = false;
    spinIdle = 0;
    arrivalNudgesGiven.clear();
    for (const mission of Object.values(missions)) mission.reset();
    activeMission = null;
    dayTurn.reset();
    flight.reset();
    // Idle whether it drove us here or Explore Again cut straight in; it holds no scene state.
    homeReturn.reset();
    // Both of those were being *driven* by the modules above, so stopping them stops
    // nothing on its own: a Fly Home mid-flight leaves the engine running otherwise.
    sfx.reset();
    // The ship was re-parented to the destination on arrival; the scene has to take it
    // back before the ship can restore its own parked transform.
    scene.attach(ship.group);
    ship.reset();
    // A normal Explore Again keeps the earned livery; a grown-ups progress reset removes it.
    syncShipStickers();
    // Or the last flight's exhaust hangs in space, still out at the destination.
    trail.reset();
    world.reset();

    controls.reset();
    controls.setFocusRadius(world.bodies.earth.radius);
    controls.setTarget(world.bodies.earth.getWorldPosition(focusPosition), true);

    follow = 'earth';

    ui.reset();
    applySuggestion();
    // Back on the visited world's page (remembered for the session); a progress reset is a
    // new save, which opens on home's page.
    if (loadProgress().visited.length === 0) map.openAt(null);
    ui.setHome(true);
    showMapHeading();
    map.show(true);
    // Landing back at the map: a Fly Home says so, a progress reset (visited now empty) gets
    // the first-run welcome.
    announceMap(true);
  }

  /* --- frame loop ---------------------------------------------------------- */

  let booted = false;
  let lastAspect = camera.aspect;

  let viewOffset = 0;
  stage.onFrame((dt, elapsed) => {
    // Off-center projection reserves the row without changing camera ownership or
    // translating the canvas. Projection, marker picking and screenshots stay in sync.
    const desiredOffset = adventureViewOffset(innerWidth, innerHeight,
      flight.phase !== 'idle' && !homeReturn.active, dayTurn.active);
    const nextOffset = THREE.MathUtils.damp(viewOffset, desiredOffset, 8, dt);
    viewOffset = Math.abs(nextOffset - desiredOffset) < 0.05 ? desiredOffset : nextOffset;
    stage.setVerticalViewOffset(viewOffset);
    sky.update(dt);
    world.update(dt, elapsed, camera);
    trail.update(dt);
    activeMission?.update(dt, elapsed);
    dayTurn.update(dt);

    if (huntViewTurn) {
      huntViewTurn.t = reducedMotion ? 1 : Math.min(1, huntViewTurn.t + (dt * 1000) / HUNT_VIEW_TURN_MS);
      const eased = 1 - Math.pow(1 - huntViewTurn.t, 3);
      const total = QUARTER_TURN * eased;
      controls.orbitAround(huntViewTurn.axis, -huntViewTurn.direction * (total - huntViewTurn.applied));
      huntViewTurn.applied = total;
      if (huntViewTurn.t >= 1) huntViewTurn = null;
    }

    /*
     * Point at the last place, while it is round the back.
     *
     * Driven per frame rather than fired once, because the whole point is that it goes
     * away the moment the child has dragged far enough to see the thing — which is a
     * property of where the camera is now, not of an event. Nothing to point at during a
     * flight or a day turn, when the camera is not theirs to move.
     */
    const cameraOurs = cameraIsOurs();
    // Paused while a toy or panel covers the world: the "find the places" line must not
    // start over a child who is busy jumping on the Moon.
    if (cameraOurs && !earthDayNightPrompt && !ui.activityCovered && activeMission?.active && huntGuidance && huntGuidance.world === follow && !huntGuidance.active) {
      huntGuidance.elapsed += dt;
      if (!huntGuidance.inviteShown && huntGuidance.elapsed >= HUNT_INVITE_HINT_DELAY) {
        huntGuidance.inviteShown = true;
        ui.setHint('Tap a gold place');
      }
      if (huntGuidance.elapsed >= HUNT_GUIDANCE_AUTO_START) beginGuidedHunt(true);
    }

    const huntGuidanceActive =
      Boolean(activeMission?.active) &&
      huntGuidance?.active === true &&
      huntGuidance.world === follow;
    const hint = cameraOurs && huntGuidanceActive ? (activeMission?.remainingHint() ?? null) : null;
    const hiddenSide = hint && !hint.visible ? hint.side : null;
    ui.setHuntArrow(hiddenSide);
    if (hint) {
      ui.setHint(hint.visible ? 'One more! Tap the gold place.' : 'One more! Tap the arrow.');
    }

    /*
     * And the hand, on the same terms as the arrow: only while the camera is the child's to
     * move. Idle time accumulates only then too, so a seven-second flight does not arrive
     * with the coach already convinced nobody is playing. It accumulates from arrival, not
     * from the guided hunt, so the day/night invitation on Earth can come during the calm
     * first beat; the hand itself still waits for the guided hunt.
     */
    if (cameraOurs && activeMission?.active && !ui.activityCovered) {
      idleFor += dt;
      const spin = DESTINATIONS[follow]?.spin;
      const inviting =
        // First Earth visit: invite from arrival (until a turn runs), not after an idle wait.
        (earthDayNightPrompt && !dayTurn.active) ||
        shouldInviteSpin({
          idleFor,
          huntComplete: activeMission.collected >= activeMission.definition.discoveries.length,
          // Not while another control is the ringed next step: on the Moon, Mars and Saturn
          // the toy is ringed after the finds, and a pulsing Day & night beside it would make
          // two. Earth's toy *is* Day & night, so there the two agree.
          spinOffered: Boolean(spin) && ui.spinAvailable && !(ui.toyIsNext && follow !== 'earth'),
          spinBusy: dayTurn.active || narrator.speaking,
          spinTried,
          spinIsPrimary: follow === 'earth',
        });
      const target = activeMission.nextTarget();
      coach.update({
        idleFor,
        huntActive: huntGuidanceActive && !inviting,
        target,
        hiddenSide,
        arrow: hiddenSide === null ? null : arrowInCanvas(),
      });
      /*
       * The spoken find/hunt nudges, once the guided hunt is live: 8s and 16s idle name the
       * gesture that fits right now — the arrow when the last place is round the back, else a
       * gold place in view. The visual hand shows it too; these speak it for a child not
       * watching. Each level once per visit, spoken alongside the hand.
       */
      if (huntGuidanceActive && !inviting) {
        const nudge =
          hiddenSide !== null
            ? dueNudge(idleFor, shorteningPair('hunt-nudge', 'hunt-nudge-short'), arrivalNudgesGiven)
            : target
              ? dueNudge(idleFor, shorteningPair('find-nudge', 'find-nudge-short'), arrivalNudgesGiven)
              : null;
        if (nudge) {
          arrivalNudgesGiven.add(nudge);
          ui.speakGuide(cueText(nudge), nudge);
        }
      }
      /*
       * The day turn asking to be noticed: after every hunt, and during the hunt on Earth,
       * where it is the arrival's primary action. The button pulses and its globe turns; the
       * world's spoken invitation is given once per visit, the first time this comes true.
       */
      ui.setSpinAttention(inviting);
      if (inviting && !spinInvited) {
        spinInvited = true;
        spinIdle = 0;
        if (spin?.invite) ui.speakGuide(spin.invite, `spin-invite-${follow}`);
      } else if (inviting && spinInvited) {
        // 8s after the invitation, still inviting and nothing pressed: one short "the little
        // globe" and then silence. The clock resets on any press, the flag does not.
        // Counted only in silence, so the follow-up never queues behind a line being read.
        if (!narrator.speaking) spinIdle += dt;
        const nudge = dueNudge(spinIdle, singleNudge('spin-nudge'), arrivalNudgesGiven);
        if (nudge) {
          arrivalNudgesGiven.add(nudge);
          ui.speakGuide(cueText(nudge), nudge);
        }
      }
    } else {
      idleFor = 0;
      coach.update({ idleFor: 0, huntActive: false, target: null, hiddenSide: null });
      ui.setSpinAttention(false);
      /*
       * At the home map (no visit in progress and the camera settled): its own gentle nudges,
       * naming the suggested world at 8s and shortening at 16s, then silence — the map is not a
       * nag. `activeMission` is null only between arriving home and the next launch, which is
       * exactly the map.
       */
      const atMap = activeMission === null && cameraOurs && flight.phase === 'idle' && map.active;
      if (atMap && suggested) {
        mapIdle += dt;
        // "Tap Saturn" is only true on Saturn's page. Elsewhere the page arrow carries the
        // hint, and the existing "You can tap the arrow" pair says exactly that.
        const nudge = dueNudge(
          mapIdle,
          map.hint === 0
            ? shorteningPair(`home-nudge-${suggested}`, `home-nudge-short-${suggested}`)
            : shorteningPair('hunt-nudge', 'hunt-nudge-short'),
          mapNudgesGiven,
        );
        if (nudge) {
          mapNudgesGiven.add(nudge);
          ui.speakGuide(cueText(nudge), nudge);
        }
      } else if (!atMap) {
        mapIdle = 0;
      }
    }

    // Ease the camera from the side-on day-turn pose back to the arrival composition. Owns
    // the camera while it runs (orbit control is suspended below), interpolating the offset
    // as a direction so the path bows around the body rather than dipping through it.
    if (cameraReturn) {
      cameraReturn.t = Math.min(1, cameraReturn.t + (dt * 1000) / CAMERA_RETURN_MS);
      const e = cameraReturn.t * cameraReturn.t * (3 - 2 * cameraReturn.t);
      world.bodies[follow].getWorldPosition(focusPosition);
      const length = THREE.MathUtils.lerp(cameraReturn.from.length(), preTurnCameraOffset.length(), e);
      returnOffset.copy(cameraReturn.from).lerp(preTurnCameraOffset, e).setLength(length);
      camera.position.copy(focusPosition).add(returnOffset);
      returnLookMatrix.lookAt(camera.position, focusPosition, camera.up);
      returnRotation.setFromRotationMatrix(returnLookMatrix);
      camera.quaternion.copy(cameraReturn.rotation).slerp(returnRotation, e);
      if (cameraReturn.t >= 1) {
        cameraReturn = null;
        controls.syncFromCamera();
        controls.enabled = true;
      }
    }

    if (flight.phase === 'idle') {
      // The idle ship keeps its nose pointed at the world the map is pointing at, so the
      // ship, the ring and the card's arrow all agree — Earth included, nose down towards
      // the planet it is parked beside (playtest 2). The Moon only when nothing is suggested.
      const aim = suggested ?? 'moon';
      world.bodies[aim].getWorldPosition(aimPosition);
      shipHeading.subVectors(aimPosition, ship.group.position);
      ship.orient(shipHeading);
    }

    ship.update(dt, elapsed);
    flight.update(dt);
    // The pull-back owns the camera while it runs, like the flight does; suspend orbit
    // control for it so the two are not both writing the camera on the same frame.
    homeReturn.update(dt);

    if (map.active) {
      // The map owns the camera while it is up: its page glide, and a fresh pose and framing
      // when the device rotates.
      if (camera.aspect !== lastAspect) {
        lastAspect = camera.aspect;
        map.resize();
      }
      map.update(dt);
    } else if (flight.phase !== 'flying' && !homeReturn.active && !cameraReturn && !dayTurn.active) {
      // Rotating the device changes how much fits on screen, so recompose the shot.
      // Deliberately overrides any manual zoom: a rotated view that cuts off the
      // destination is worse than losing the zoom level.
      if (camera.aspect !== lastAspect) {
        lastAspect = camera.aspect;
        const body = world.bodies[follow];
        // viewRadius so a rotation while at Saturn reframes the whole ring system, not the
        // sphere alone; it falls back to the plain radius for every other body. Match the
        // arrival composition after rotation: 1.4 is the breathing room arrivalDistance
        // authors. The inset keeps the subject out from under the dock.
        controls.frame((body.viewRadius ?? body.radius) * 1.4, false, camera.aspect < 1 ? 0.3 : 0.16);
      }
      controls.setTarget(world.bodies[follow].getWorldPosition(focusPosition));
      controls.update(dt);
    }

    if (!booted) {
      booted = true;
      // Hidden rather than removed: it comes back as the crash screen.
      boot?.classList.add('is-hidden');
      // Now and not at load, so installing the worker never competes with the textures
      // for the connection while the first frame is still being got ready. The guard lets
      // a fresh build refresh the page only at the title, never over a flight or day turn.
      registerOffline(() => flight.phase === 'idle' && !dayTurn.active);
    }
  });

  // Read-only instrumentation exists only in the dedicated browser-test build. Tests
  // still launch, drag and collect through ordinary pointer events, never state setters.
  if (import.meta.env.VITE_PLAYTEST === '1') {
    Object.assign(window, { spaceNinjaSnapshot: () => {
      const center = world.bodies[follow].getWorldPosition(new THREE.Vector3());
      const view = camera.position.clone().sub(center).normalize();
      const screenCircle = (position: THREE.Vector3, radius: number) => {
        const point = position.clone().project(camera);
        const edge = position.clone().addScaledVector(
          new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), radius,
        ).project(camera);
        return { x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2,
          radius: Math.abs(edge.x - point.x) * innerWidth / 2 };
      };
      return {
        phase: flight.phase,
        mapBodyIds: [...new Set(world.hitMeshes.map(mesh => mesh.userData.bodyId))],
        mapPage: map.active ? map.page : null,
        mapPageCount: map.pageCount,
        mapHint: map.active ? map.hint : null,
        world: follow,
        draws: stage.renderer.info.render.calls,
        frame: stage.renderer.info.render.frame,
        speaking: narrator.speaking,
        guidedHunt: huntGuidance?.active ?? false,
        cameraReturning: Boolean(cameraReturn),
        dayTurning: dayTurn.active,
        earthWelcome: earthDayNightPrompt,
        bodyScreen: screenCircle(center, world.bodies[follow].viewRadius ?? world.bodies[follow].radius),
        // The page's worlds' silhouettes on screen, so the map's framing can be checked
        // against exactly the worlds it draws.
        mapScreen: Object.fromEntries((map.active ? map.pageWorlds : []).map((id) => {
          const body = world.bodies[id];
          return [id, screenCircle(body.getWorldPosition(new THREE.Vector3()), body.viewRadius ?? body.radius)];
        })),
        teachingSun: (() => {
          const cue = world.teachingSun.group;
          return { visible: cue.visible,
            ...screenCircle(cue.position, cue.scale.x * TEACHING_SUN_RADIUS) };
        })(),
        surfaceRotation: world.bodies[follow].surface.rotation.y,
        mapInvite: uiRoot.classList.contains('is-map-next'),
        mapRing: world.selected,
        shipAim: flight.phase === 'idle' ? (suggested ?? 'moon') : null,
        mapReturnGuarded: ui.mapReturnGuarded,
        bodyScreenRadius: Math.abs(center.clone().addScaledVector(
          new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), world.bodies[follow].radius,
        ).project(camera).x - center.clone().project(camera).x) * innerWidth / 2,
        collected: activeMission?.collected ?? 0,
        ids: activeMission?.definition.discoveries.map(d => d.id) ?? [],
        targets: activeMission?.hitMeshes.map(mesh => {
          const position = mesh.getWorldPosition(new THREE.Vector3());
          const alignment = position.clone().sub(center).normalize().dot(view);
          const sunlight = position.clone().sub(center).normalize().dot(SUN_DIRECTION);
          const ndc = position.project(camera);
          return { x: (ndc.x + 1) * innerWidth / 2, y: (1 - ndc.y) * innerHeight / 2,
            sunlight,
            visible: alignment > world.bodies[follow].radius / camera.position.distanceTo(center) * 0.85 };
        }) ?? [],
        hidden: activeMission?.remainingHint(),
      };
    } });
  }
  const lifecycle = createSessionLifecycle({
    stage, document, window,
    suspend: () => {
      narrator.stop();
      sfx.reset();
      controls.cancelGesture();
      map.suspend();
    },
    reset: resetAdventure,
    dispose,
    fail: (error) => {
      dayTurn.reset();
      map.suspend();
      ui.dismissToys();
      fail('Space Ninja stopped', error, true);
    },
  });
  function restart() { lifecycle.restart(); }
  lifecycle.start();

  function dispose() {
    dayTurn.reset();
    window.removeEventListener('pointerdown', onAnyPress, true);
    coach.dispose();
    canvas.removeEventListener('pointerup', onDayTurnSkipTap);
    map.dispose();
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
}

main().catch((error: unknown) => {
  if (error instanceof WebGLUnavailableError) fail('WebGL unavailable', error);
  else fail('Failed to start Space Ninja', error);
});
