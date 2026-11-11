import { createSessionLifecycle } from './session/lifecycle';
import { fail } from './session/failure';
import { registerOffline } from './session/offline';
/**
 * Entry point. Builds the scene, wires input to the flight sequence, the Places card and
 * the UI. Session lifecycle owns browser transitions; this route supplies reset and disposal.
 *
 * Common destination behavior is data-driven; unusual bodies may expose explicit scene
 * capabilities instead of being forced through a false one-size-fits-all abstraction.
 */

import './ui/ui.css';
import './ui/theme.css';
import './ui/adventure.css';
import './ui/storybook.css';
import './ui/visit.css';
import { FULL_VIEW, playfieldView } from './ui/viewport';
import * as THREE from 'three';
import { DESTINATIONS } from './config';
import { detectQuality, prefersReducedMotion } from './scene/quality';
import { WebGLUnavailableError, createStage } from './scene/Stage';
import { createSky } from './scene/Starfield';
import { createWorld, type BodyId } from './scene/Bodies';
import { createSpaceship } from './scene/Spaceship';
import { createEngineTrail } from './scene/EngineTrail';
import { createDayTurn } from './scene/DayTurn';
import { TEACHING_SUN_RADIUS } from './scene/dayTurnFraming';
import { createOrbitInput } from './controls/OrbitInput';
import { createSpaceMap } from './map';
import { createFlightSequence } from './flight/FlightSequence';
import { createHomeReturn } from './flight/HomeReturn';
import { createPlacesScene } from './places/places';
import { createNarrator } from './audio/narration';
import { cueText } from './audio/script';
import { createSfx } from './audio/sfx';
import { createUI } from './ui/ui';
import { dueNudge, shorteningPair, shouldInviteSpin, singleNudge } from './ui/nudge';
import { createGrownups, shouldGreet } from './ui/grownups';
import { loadProgress, markVisited, nextWorld } from './state/progress';
import { loadSoundOn } from './state/settings';

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
   * Earth's bedtime spin: into night, back into morning, each change said once. Once Space
   * map is the ringed next step the round trip suggests the Moon if it is still unvisited;
   * otherwise it suggests turning more. Nothing is counted or saved.
   */
  /** This opening of Earth's bedtime spin has reached night, then morning again. */
  let bedtimeNight = false;
  let bedtimeRoundTrip = false;

  const ship = createSpaceship();
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
   * a visit's Listen button down — or asks for it by address, which is the way back in if
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
    onPlaces: () => showNextPlace(),
    onPlaceHidden: () => places.hide(),
    onSpin: () => {
      if (dayTurn.active) {
        if (follow === 'earth') dayTurn.skip();
        return;
      }
      startDayTurn();
    },
    onStopSpin: () => dayTurn.skip(),
    // The house's night and morning get the same spoken feedback the old 3D activity gave.
    // "You can fly to the Moon next" only while it is true and agrees with the screen: the
    // Moon is still unvisited and Space map is the ringed next step (Turn Earth was played).
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
    onBedtimeClose: () => {},
  });

  /**
   * Earth's Day & night is the bedtime spin toy (src/toys/bedtimeSpin.ts): Earth seen from
   * above the North Pole, turned by the child, with a house riding into night and back into
   * morning. It replaced the 3D side-on turn, where a sideways drag hid the house round the
   * back of the planet. The 3D scene is left alone while it is open.
   */
  function startBedtime() {
    controls.cancelGesture();
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
   * The visit holds the surface still (onArrive); this drives the held value instead of
   * fighting it, so the terminator sweeps and the city lights come on with no new physics at
   * all. Exactly one turn, so every place ends where it started.
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
    // The arrival is composed in the visit screen's clear playfield, clear of the toy shelf.
    playfield: () => playfieldView(innerWidth, innerHeight),
    onArrive: (destination) => {
      follow = destination.id;
      suggested = null;
      world.setSelected(null);
      spinInvited = false;
      // Each visit gets its nudges afresh; the clock for the spin follow-up starts here too.
      arrivalNudgesGiven.clear();
      spinIdle = 0;
      // Recorded for the map's tick and its suggestion; it opens nothing, since nothing is
      // locked.
      markVisited(destination.id);
      placeIndex = -1;

      // The destination is the subject now. Other worlds and the parked ship remain visible
      // enough to preserve context, but cannot become opaque foreground objects when a child
      // drags the world round.
      world.setFocus(destination.id);
      ship.setContextDimmed(true);
      // Hold the surface still for the visit: a place turned to stays put, and the day turn
      // drives the held value. Released in resetAdventure.
      destination.holdSurface();

      const config = DESTINATIONS[destination.id];
      if (!config) return;
      // The welcome never takes the camera automatically. Every control of the visit is on
      // screen from here (visit-B).
      ui.showArrival(`arrival-${destination.id}`, destination.label, config.fact, config.emoji, destination.id);
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

  /* --- places --------------------------------------------------------------- */

  /*
   * The Places card (owner's pick B, design/places/places-B.png). A tap turns the world to its
   * next place and the UI shows the real photo and says its line; another tap, on the card or
   * the photo's arrow, goes on to the next, round and round. A press on the world (a spin or a
   * tap) puts it away. Nothing about it is counted or saved.
   */
  const places = createPlacesScene({
    camera,
    orbitAround: (axis, angle) => controls.orbitAround(axis, angle),
    reducedMotion,
  });
  /** The place on show, or the last one shown this visit; -1 before the first. */
  let placeIndex = -1;

  function showNextPlace() {
    const list = DESTINATIONS[follow]?.places ?? [];
    if (!list.length || flight.phase !== 'arrived' || !cameraIsOurs()) return;
    placeIndex = (placeIndex + 1) % list.length;
    const place = list[placeIndex]!;
    controls.cancelGesture();
    places.show(world.bodies[follow], place);
    ui.showPlace(place);
  }

  /** A press on the world itself puts the photo away and stops a turn where it is. */
  function onWorldPress() {
    if (!ui.placeOpen) return;
    ui.hidePlace();
    places.hide();
  }
  canvas.addEventListener('pointerdown', onWorldPress);

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

  /* --- day turn ------------------------------------------------------------ */

  /**
   * A day turn has finished (or been tapped through). Hand the camera back where the child
   * was looking from, rather than leaving them side-on to the Sun. Reduced motion cuts back; other devices ease.
   */
  function onDayTurnFinish() {
    ui.setSpinBusy(false);
    ui.setSpinProgress(null);
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

  /*
   * Tap-to-skip during a day turn. The turn disables orbit control, so OrbitInput's tap path
   * is dead for its whole duration — this covers exactly that window. On pointerup, not down,
   * so OrbitInput's own (disabled, no-op) handler runs first.
   */
  function onDayTurnSkipTap() {
    if (dayTurn.active) dayTurn.skip();
  }
  canvas.addEventListener('pointerup', onDayTurnSkipTap);

  function handleTap(clientX: number, clientY: number) {
    if (flight.phase === 'flying') return;
    // A tap during a day turn is "I have seen enough": end the turn as a completion, so the
    // places land back on their real coordinates, rather than raycasting at a swinging
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
    if (flight.phase !== 'idle' || homeReturn.active) return;
    const destination = world.bodies[id];
    if (!destination) return;
    if (!flight.start(destination)) return;
    // The map lets go of the camera and draws every world again for the journey.
    map.hide();
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
   * handed back in. Captured relative to the body's *current* position, since it keeps
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

  /** The spoken invitation to turn the world has been given this visit. */
  let spinInvited = false;

  function cameraIsOurs(): boolean {
    return flight.phase !== 'flying' && !dayTurn.active && !homeReturn.active && !cameraReturn;
  }

  /* --- hints --------------------------------------------------------------- */

  let idleFor = 0;
  let spinTried = false;
  /*
   * The spoken layer's idle nudges (docs/current-implementation.md, "The spoken layer").
   *
   * Two clocks that reset on any press, and two "given" sets that do not, so a press quiets
   * the nagging but the same words are never spoken twice in one visit or one map view. The
   * arrival nudges (the spin invitation) run off `idleFor`, which accumulates from arrival;
   * `spinIdle` is the separate wait after the spin invitation; `mapIdle` is the map's own idle.
   */
  const arrivalNudgesGiven = new Set<string>();
  const mapNudgesGiven = new Set<string>();
  let spinIdle = 0;
  let mapIdle = 0;

  /*
   * Any press at all, anywhere, is the child doing something — a tap on a target, a drag, a
   * pinch, a dock button. Listened for on the window in the capture phase rather than wired
   * through OrbitInput, because a drag that the controls are ignoring (during a day turn,
   * say) is still a child trying.
   */
  function onAnyPress() {
    idleFor = 0;
    spinIdle = 0;
    mapIdle = 0;
    // The first real gesture of the session unlocks the audio context, so a map cue attempted
    // before any touch (it fails silently) is picked up by the nudge once the child taps.
    narrator.resume();
  }
  window.addEventListener('pointerdown', onAnyPress, true);

  /**
   * The one world the map is pointing at: the first unvisited world in the map's hint order
   * (Earth, the Moon, Mars, the Sun, Saturn). Once everywhere has been visited, the map stops
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
    if (map.hint !== 0) ui.setHint(`Tap the arrow for ${label}`, 'rocket');
    else ui.setHint('Tap ' + label, 'rocket');
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
    describe: (id) => ({
      id,
      label: shortLabel(id),
      // Been there: a tick, so a pre-reader can see where they have been. It opens nothing.
      done: loadProgress().visited.includes(id),
    }),
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
    spinInvited = false;
    idleFor = 0;
    spinTried = false;
    spinIdle = 0;
    arrivalNudgesGiven.clear();
    places.hide();
    placeIndex = -1;
    // The visit held its world's surface (onArrive); give it back, or the world stays frozen.
    world.bodies[follow].releaseSurface();
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
  let lastPlaceOpen = false;

  const viewOffset = { x: 0, y: 0 };
  const easeOffset = (from: number, to: number, dt: number) => {
    const next = THREE.MathUtils.damp(from, to, 8, dt);
    return Math.abs(next - to) < 0.05 ? to : next;
  };
  stage.onFrame((dt, elapsed) => {
    // Off-centre projection puts the world in the visit screen's clear playfield, clear of
    // the toy shelf and the top buttons, without changing camera ownership or translating
    // the canvas. Projection, marker picking and screenshots stay in sync.
    const visiting = flight.phase !== 'idle' && !homeReturn.active;
    const placeOpen = ui.placeOpen;
    const desired = visiting ? playfieldView(innerWidth, innerHeight, placeOpen) : FULL_VIEW;
    viewOffset.x = easeOffset(viewOffset.x, desired.offsetX, dt);
    viewOffset.y = easeOffset(viewOffset.y, desired.offsetY, dt);
    stage.setViewOffset(viewOffset.x, viewOffset.y);
    sky.update(dt);
    world.update(dt, elapsed, camera);
    trail.update(dt);
    places.update(dt);
    dayTurn.update(dt);

    const cameraOurs = cameraIsOurs();
    const arrived = flight.phase === 'arrived' && !homeReturn.active;

    /*
     * Idle time accumulates only while the camera is the child's to move and nothing covers
     * the world, so a seven-second flight does not arrive with the nudges convinced nobody is
     * playing.
     */
    if (cameraOurs && arrived && !ui.activityCovered) {
      idleFor += dt;
      const spin = DESTINATIONS[follow]?.spin;
      const inviting = !placeOpen && shouldInviteSpin({
        idleFor,
        spinOffered: Boolean(spin) && ui.spinAvailable,
        spinBusy: dayTurn.active || narrator.speaking,
        spinTried,
        // Earth's toy *is* Day & night; elsewhere the card waits to be found.
        spinIsPrimary: follow === 'earth',
      });
      /*
       * Turn Earth asking to be noticed: the card rocks and the world's spoken invitation is
       * given once per visit, the first time this comes true.
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
      ui.setSpinAttention(false);
      /*
       * At the home map (no visit in progress and the camera settled): its own gentle nudges,
       * naming the suggested world at 8s and shortening at 16s, then silence — the map is not a
       * nag.
       */
      const atMap = cameraOurs && flight.phase === 'idle' && map.active;
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
      // So does the place photo coming up or going away: the world moves into the playfield
      // the photo leaves it, and back.
      if (camera.aspect !== lastAspect || placeOpen !== lastPlaceOpen) {
        lastAspect = camera.aspect;
        lastPlaceOpen = placeOpen;
        const body = world.bodies[follow];
        // viewRadius so a rotation while at Saturn reframes the whole ring system, not the
        // sphere alone; it falls back to the plain radius for every other body. Match the
        // arrival composition after rotation: 1.4 is the breathing room arrivalDistance
        // authors, fitted into the visit screen's clear playfield (ui/viewport.ts).
        const field = playfieldView(innerWidth, innerHeight, placeOpen);
        // Under the photo the band is short, so the world takes a little less breathing room.
        const room = placeOpen ? 1.15 : 1.4;
        controls.frame((body.viewRadius ?? body.radius) * room, false, 1 - field.height, 1 - field.width);
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
        cameraReturning: Boolean(cameraReturn),
        dayTurning: dayTurn.active,
        bodyScreen: screenCircle(center, world.bodies[follow].viewRadius ?? world.bodies[follow].radius),
        // The page's worlds' silhouettes on screen, so the map's framing can be checked
        // against exactly the worlds it draws.
        mapScreen: Object.fromEntries((map.active ? map.pageWorlds : []).map((id) => {
          const body = world.bodies[id];
          const at = body.getWorldPosition(new THREE.Vector3());
          // `radius` is the sphere; `rim` is the ring edge as drawn. Tilted rings are an
          // ellipse, so a circle of the ring radius would overstate what is on screen.
          const rim = world.mapFootprint(id, false).outline.map((point) => {
            const p = point.clone().project(camera);
            return [(p.x + 1) * innerWidth / 2, (1 - p.y) * innerHeight / 2];
          });
          return [id, { ...screenCircle(at, body.radius), rim }];
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
        placeOpen: ui.placeOpen,
        placeTurning: places.turning,
        place: ui.placeOpen ? (DESTINATIONS[follow]?.places?.[placeIndex]?.id ?? null) : null,
        // Where the place's mark is on screen, and whether it faces the camera.
        placeMark: (() => {
          const at = places.markPosition(new THREE.Vector3());
          if (!at) return null;
          const facing = at.clone().sub(center).normalize().dot(view);
          const ndc = at.project(camera);
          return { x: (ndc.x + 1) * innerWidth / 2, y: (1 - ndc.y) * innerHeight / 2, facing };
        })(),
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
    canvas.removeEventListener('pointerup', onDayTurnSkipTap);
    canvas.removeEventListener('pointerdown', onWorldPress);
    map.dispose();
    controls.dispose();
    ui.dispose();
    grownups.dispose();
    narrator.dispose();
    sfx.dispose();
    places.dispose();
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
