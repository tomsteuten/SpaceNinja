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
  FRAMING_RADIUS_WIDER,
  WIDE_FRAMING_VISIT,
  WIDER_FRAMING_VISIT,
  revealedDestinations,
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
import { createHomeReturn } from './flight/HomeReturn';
import {
  createCollectMission,
  facingLatitude,
  type CollectMission,
} from './mission/CollectMission';
import { createNarrator } from './audio/narration';
import { createSfx } from './audio/sfx';
import { createUI } from './ui/ui';
import { createCoach, shouldInviteSpin } from './ui/coach';
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

/**
 * The boot screen doubles as the failure screen. `crash` is the mid-session case: the
 * frame loop threw, the picture underneath is the last good frame, and without this the
 * only signal a tablet gives is a child saying it stopped. The words differ, there is a
 * button that reloads, and the error itself is printed small for whoever reports it.
 */
function fail(message: string, error: unknown, crash = false) {
  console.error(message, error);
  if (!boot) return;
  boot.classList.add('has-error');
  boot.classList.toggle('has-crash', crash);
  boot.classList.remove('is-hidden');
  if (!crash) return;
  const detail = boot.querySelector('.boot-detail');
  if (detail) detail.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  boot.querySelector('.boot-restart')?.addEventListener('click', () => window.location.reload(), {
    once: true,
  });
}

/**
 * Offline, from the second launch on. Only in a build: there is no bundle to cache in
 * development, and a worker there would serve stale modules over the live ones. A browser
 * without the API, or a registration that fails, simply leaves the game as it was.
 *
 * `canReloadNow` gates the one-launch auto-update below: it is asked at the moment a new
 * worker takes over, and answers false once a child is playing so the update waits.
 */
function registerOffline(canReloadNow: () => boolean) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  /*
   * Land a new build on the launch that fetched it, not the one after.
   *
   * A new build's worker calls skipWaiting()/clients.claim() (see sw/sw.js), so it takes
   * control of this already-open page the instant it activates — that hand-over is
   * `controllerchange`. But the page in front of the child is still the *old* shell it was
   * served at load, so without this it only refreshes to the new build on the next launch:
   * the "open the installed app twice" tax a cache-first PWA otherwise charges, and the
   * thing that makes on-device testing feel like it is caching forever.
   */
  let reloading = false;
  // A brand-new install claims a page that never had a controller; there is no older
  // version to escape, so a reload there would be a pointless flash of the boot screen.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    // Never pull the world out from under a child mid-flight. At the title the swap is
    // invisible; once they have gone somewhere the new build simply waits for next launch,
    // which is exactly the behaviour that was there before this.
    if (!canReloadNow()) return;
    reloading = true;
    window.location.reload();
  });

  // The shell itself stays cache-first and atomic, but the update check for the tiny
  // worker script must reach Pages rather than an HTTP cache holding yesterday's build.
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((error: unknown) => {
    console.warn('[offline] not available', error);
  });
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
   * The opening shot only takes in Earth and the Moon until the Moon has been visited, then
   * widens for Mars, then wider again for Saturn. Fitting an outer world from the first
   * frame would shrink the first destination to a speck for no reason a five-year-old could
   * understand yet; going there is what makes the world visibly get bigger. Going, not
   * finishing — flying out and looking is enough. Newest tier wins, so it does not matter
   * which order the two gates were passed in.
   */
  function framingRadius(): number {
    const { visited } = loadProgress();
    if (visited.includes(WIDER_FRAMING_VISIT)) return FRAMING_RADIUS_WIDER;
    if (visited.includes(WIDE_FRAMING_VISIT)) return FRAMING_RADIUS_WIDE;
    return FRAMING_RADIUS;
  }

  /**
   * How much of the vertical frame the interface reserves, so the map is fitted into the band
   * between the top mission prompt and the bottom dock rather than the whole canvas — see
   * `framingHalfAngle` and OrbitInput.frame. Without it a tall phone crops the widest tier,
   * Saturn's rings most of all, behind the controls, which reads as the destination sitting
   * too close and too low. Portrait reserves the most because the dock there is a full-width
   * stack; landscape lays it into a thin bottom band, so less is taken. Reasoned defaults, to
   * be watched on the real tablet like the framing tiers themselves.
   */
  function framingInset(): number {
    return camera.aspect < 1 ? 0.3 : 0.16;
  }

  /**
   * Draw only the worlds a child has earned. Same gate the framing tiers widen on, applied to
   * the bodies themselves so an outer world is not looming into the opening shot before it has
   * been revealed (Saturn across a portrait phone during "Tap the Moon"), and Mars is not
   * crossing Saturn's rings until Mars has actually been reached. Re-applied on every return to
   * the map, since visiting a world is what unlocks the next. See revealedDestinations.
   */
  function visibleDestinationIds(): BodyId[] {
    return revealedDestinations(loadProgress().visited) as BodyId[];
  }

  function applyReveal(animate = false): BodyId[] {
    return world.setRevealed(visibleDestinationIds(), animate && !reducedMotion);
  }

  /**
   * Every world gets a button, earned or not — the un-earned ones padlocked.
   *
   * The bar used to list only revealed worlds, which meant a first run showed two buttons
   * and gave a child no reason to believe there was anywhere else at all. The *bodies* stay
   * reveal-gated (that fixes two real composition failures — see DestinationChoice.locked),
   * so this puts the future in the one place it costs nothing: a padlocked chip that names
   * the world and does not draw it.
   */
  function mapChoices() {
    const visible = new Set(visibleDestinationIds());
    return (Object.keys(DESTINATIONS) as BodyId[]).map((id) => ({
      id,
      // The full scene name is "The Moon"; a four-choice phone bar has room for the
      // identity, not the article. Keeping this derivation here avoids duplicate copy.
      label: world.bodies[id].label.replace(/^The /, ''),
      emoji: DESTINATIONS[id]?.emoji ?? '✨',
      locked: !visible.has(id),
      unlockedBy: gateLabel(id),
    }));
  }

  /** The world a locked one is waiting on, named the way a child hears it spoken. */
  function gateLabel(id: BodyId): string | undefined {
    const gate = DESTINATIONS[id]?.revealAfterVisiting;
    return gate ? world.bodies[gate as BodyId]?.label : undefined;
  }

  const controls = createOrbitInput({
    camera,
    element: canvas,
    reducedMotion,
    onTap: handleTap,
  });
  controls.setFocusRadius(world.bodies.earth.radius);
  controls.setTarget(new THREE.Vector3(), true);
  controls.frame(framingRadius(), true, framingInset());
  applyReveal();

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
    onResetProgress: () => restart(),
  });
  if (shouldGreet(asked)) grownups.show();

  const ui = createUI({
    root: uiRoot,
    narrator,
    onChooseDestination: (id) => launch(id as BodyId),
    onExploreAgain: () => {
      // A Fly Home during a day turn: stop the turn first so it is not still writing the
      // camera as the pull-back takes it. dayTurn.reset() is a no-op otherwise.
      cameraReturn = null;
      dayTurn.reset();
      // Ease the camera out to the map first; restart() runs when the pull-back lands. Under
      // reduced motion start() declines and this cuts straight home, exactly as it always did.
      if (homeReturn.start()) {
        // Bring the wider solar-system context back as the camera leaves the destination.
        // Keeping the visit focus until restart() made every other world pop in only after
        // the pull-back had already landed.
        world.setFocus(null);
        ship.setContextDimmed(false);
        ui.enterFlight();
      } else restart();
    },
    onGrownups: () => grownups.show(),
    // The whole game finished. Played when the overlay lands, not when the last world
    // completes, or it would run under the world's own chime.
    onFinale: () => sfx.fanfare(),
    onSpin: () => {
      const body = world.bodies[follow];
      const spin = DESTINATIONS[follow]?.spin;
      if (!spin || dayTurn.active) return;
      // Where the child was looking from before the turn swung the camera side-on, so it can
      // be handed back to them there. Relative to the body, which keeps orbiting throughout.
      body.getWorldPosition(focusPosition);
      preTurnCameraOffset.copy(camera.position).sub(focusPosition);
      // Put the explanation one speaker-tap away before the camera starts moving. This is
      // the one lesson whose content is entirely visual, and a full-width card during the
      // 2.2s swing pulled the child's eyes away before the sunlight even began to move.
      ui.showNote(`spin-${follow}`, spin.name, spin.fact);
      ui.foldFact(true);
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
    // The engine, from the same two numbers the exhaust and the widening view are drawn
    // from. The context was created by the press that started this flight.
    onThrottle: (throttle, cruise) => sfx.thruster(throttle, cruise),
    onArrive: (destination) => {
      follow = destination.id;
      suggested = null;
      world.setSelected(null);
      // Arriving is the achievement that opens the rest of the system up. The sticker is
      // still the collection's, and is still awarded by finishing it.
      markVisited(destination.id);

      // The destination and its real-coordinate targets are the subject now. Other earned
      // worlds and the parked ship remain visible enough to preserve context, but cannot
      // become opaque foreground objects when a child drags around to the hidden place.
      world.setFocus(destination.id);
      ship.setContextDimmed(true);

      const config = DESTINATIONS[destination.id];
      if (!config) return;
      // The welcome: the world's name and what it is, read over a screen that already has
      // the gold targets on it. It no longer gates anything.
      ui.showArrival(`arrival-${destination.id}`, destination.label, config.fact, config.emoji);

      const mission = missions[destination.id];
      if (!mission) return;
      activeMission = mission;
      // Builds the targets and holds the surface still, then puts the gold on screen at
      // once. There is nothing between arriving and having something to touch.
      mission.start();
      revealHunt();
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
    restingPose: () =>
      controls.restingPose(
        world.bodies.earth.getWorldPosition(homeFocus),
        framingRadius(),
        framingInset(),
      ),
    currentFocus: () => world.bodies[follow].getWorldPosition(homeFocus),
    onArrive: () => restart(),
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
        if (found === total - 1) {
          ui.setMissionCaption(config.mission.huntLine, `hunt-${body.id}`);
        }
      },
      onComplete: () => {
        sfx.success();
        // The celebration keys off finishing, not off the award: a child who earned this
        // sticker on an earlier visit still gets the party, just not a second sticker.
        const isNew = awardSticker(config.mission.stickerId);
        ui.completeMission(
          `success-${body.id}`,
          config.mission.successLine,
          isNew ? config.mission.stickerId : null,
          `${config.emoji}  ${body.label}`,
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
          ui.completeGame(FINALE_STICKER);
        }
      },
    });
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

  /*
   * Arriving used to be a sequence: a spoken welcome, then the world turning through one
   * whole day, then the gold targets. Every world has a `spin`, so it ran on every arrival,
   * every time — 2.6s of welcome, a 2.2s camera swing and a 9s turn on top of the 7s
   * flight. Better than 21 seconds could pass between pressing a world and being allowed to
   * touch anything, and it repeated on the twelfth visit exactly as on the first.
   *
   * A tap skipped it. That it needed a skip was the tell: the default was the thing you
   * skipped, and a five-year-old does not discover an unsignposted one.
   *
   * So the day turn is a toy again rather than a toll — offered by its own button from the
   * moment the hunt is live (see `showSpin`), which is where it was before it was promoted
   * to an introduction. The lesson is unchanged and the child now chooses it, which is
   * worth more than being shown it. The welcome fact still speaks; it simply speaks over a
   * screen that already has something on it to touch.
   */
  /**
   * A day turn has finished (or been tapped through). Hand the camera back where the child
   * was looking from, rather than leaving them side-on to the Sun with the targets they were
   * reaching for round the side of the world. An ease, not a cut: cutting read as a jerk on
   * the tablet.
   */
  function onDayTurnFinish() {
    ui.setSpinBusy(false);
    ui.setSpinProgress(null);
    const body = world.bodies[follow];
    body.getWorldPosition(focusPosition);
    cameraReturn = { from: camera.position.clone().sub(focusPosition), t: 0 };
    controls.enabled = false;
  }

  function revealHunt() {
    const config = DESTINATIONS[follow];
    const mission = missions[follow];
    if (!config || !mission) return;
    mission.reveal();
    // The instruction cue queues behind the arrival welcome rather than talking over it.
    // Never auto-start the platform voice when a partial pack is installed.
    ui.beginMission(config.mission.instruction, config.mission.discoveries.length, `find-${follow}`);
    // The day turn, offered rather than imposed — and the button wears this world's own
    // globe, so what it will do is legible without a word on it.
    ui.showSpin(config.spin?.label ?? null, config.spin?.tint);
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
    if (!visibleDestinationIds().includes(id)) {
      // A locked world is pressable and answers. Never silence: an unanswered press reads
      // as a broken app at this age.
      const gate = gateLabel(id);
      ui.nudgeDestination(id);
      ui.setHint(gate ? `🔒 Visit ${gate} first` : '🔒 Not yet');
      window.clearTimeout(nudge);
      nudge = window.setTimeout(() => {
        if (flight.phase === 'idle') showOpeningHints();
      }, 2600);
      return;
    }
    const destination = world.bodies[id];
    if (!destination) return;
    // The flight is told which latitude to arrive over; it does not know why. Matching
    // destinations to their copy is this file's job, exactly as it is for the fact and
    // the mission.
    const discoveries = DESTINATIONS[id]?.mission.discoveries;
    const aim = discoveries ? facingLatitude(discoveries) : undefined;
    if (!flight.start(destination, aim)) return;
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
  let cameraReturn: { from: THREE.Vector3; t: number } | null = null;

  /* --- hints --------------------------------------------------------------- */

  let nudge = 0;

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
  /*
   * Any press at all, anywhere, is the child doing something — a tap on a target, a drag, a
   * pinch, a dock button. Listened for on the window in the capture phase rather than wired
   * through OrbitInput, because a drag that the controls are ignoring (during a day turn,
   * say) is still a child trying, and a coach that kept demonstrating over it would be
   * telling them they had not moved.
   */
  function onAnyPress() {
    idleFor = 0;
    coach.clear();
  }
  window.addEventListener('pointerdown', onAnyPress, true);

  /**
   * The one world the map is pointing at: genuinely unvisited, furthest earned one first.
   *
   * Once the outer journey is done this naturally brings Earth back into the story rather
   * than claiming Saturn is "new" forever, and when everywhere has been visited it returns
   * null — there is no next, and the map should stop insisting there is.
   */
  function suggestedDestination(): BodyId | null {
    const visited = new Set(loadProgress().visited);
    const visible = visibleDestinationIds();
    return (
      [...visible].reverse().find((id) => id !== 'earth' && !visited.has(id)) ??
      (visible.includes('earth') && !visited.has('earth') ? 'earth' : null)
    );
  }

  /**
   * Put the suggestion on screen in all three places at once — the ring in the scene, the
   * highlighted button in the bar and the parked ship's nose — so they cannot disagree.
   */
  function applySuggestion(newlyRevealed: BodyId | null = null) {
    suggested = suggestedDestination();
    world.setSelected(suggested);
    ui.showDestinations(mapChoices(), suggested, newlyRevealed);
  }

  function showOpeningHints(newlyRevealed?: BodyId) {
    window.clearTimeout(nudge);
    if (newlyRevealed) {
      const config = DESTINATIONS[newlyRevealed];
      const label = world.bodies[newlyRevealed].label;
      ui.setHint(`✨ ${config?.emoji ?? ''}  ${label} is ready`);
      nudge = window.setTimeout(() => {
        if (flight.phase !== 'idle') return;
        ui.setHint(`👆 ${config?.emoji ?? ''}  Tap ${label}`);
      }, 3600);
      return;
    }
    // Audio cannot do this first job because no user gesture has unlocked playback yet, so
    // the gesture pictures still carry the action.
    const next = suggested;
    if (!next) {
      ui.setHint('👆 Tap a world to go there');
      return;
    }
    const nextBody = world.bodies[next];
    const nextEmoji = DESTINATIONS[next]?.emoji ?? '✨';
    if (next === 'moon') {
      ui.setHint('☝️ ↔️  Swipe to look around');
    } else {
      ui.setHint(`👀 ${nextEmoji}  A new world is out there`);
    }
    // "Tap", not "Choose": choosing was the old two-step, and the word outlived it. One
    // press on that world is now the whole journey.
    nudge = window.setTimeout(() => {
      if (flight.phase !== 'idle') return;
      ui.setHint(`👆 ${nextEmoji}  Tap ${nextBody.label.replace(/^The /, '')}`);
    }, 6500);
  }

  // Whatever was chosen last time, applied before anything can make a noise.
  const soundOn = loadSoundOn();
  sfx.setMuted(!soundOn);
  ui.setSoundOn(soundOn);
  applySuggestion();
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
    cameraReturn = null;
    coach.clear();
    idleFor = 0;
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
    // Or the last flight's exhaust hangs in space, still out at the destination.
    trail.reset();
    world.reset();
    // A world visited this run may have unlocked the next one. It appears only after the
    // pull-back lands, when the map is stable enough for the reveal to be understood.
    const newlyRevealed = applyReveal(true);

    controls.reset();
    controls.setFocusRadius(world.bodies.earth.radius);
    controls.setTarget(world.bodies.earth.getWorldPosition(focusPosition), true);
    controls.frame(framingRadius(), true, framingInset());

    follow = 'earth';

    ui.reset();
    applySuggestion(newlyRevealed[0] ?? null);
    showOpeningHints(newlyRevealed[0]);
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
    const cameraIsOurs =
      flight.phase !== 'flying' && !dayTurn.active && !homeReturn.active && !cameraReturn;
    const hint = cameraIsOurs ? (activeMission?.remainingHint() ?? null) : null;
    const hiddenSide = hint && !hint.visible ? hint.side : null;
    ui.setHuntArrow(hiddenSide);

    /*
     * And the hand, on the same terms as the arrow: only while the camera is the child's to
     * move. Idle time accumulates only then too, so a seven-second flight does not arrive
     * with the coach already convinced nobody is playing.
     */
    if (cameraIsOurs && activeMission?.active) {
      idleFor += dt;
      coach.update({
        idleFor,
        huntActive: true,
        target: activeMission.nextTarget(),
        hiddenSide,
      });
      /*
       * And once every place is found, the one remaining offer with anything in it. The
       * child has just been celebrated and the alternatives are the journal and going home;
       * the day turn is the only thing here they have no way of guessing at.
       */
      ui.setSpinAttention(
        shouldInviteSpin({
          idleFor,
          huntComplete: activeMission.collected >= activeMission.definition.discoveries.length,
          spinOffered: Boolean(DESTINATIONS[follow]?.spin),
          spinBusy: dayTurn.active,
        }),
      );
    } else {
      idleFor = 0;
      coach.update({ idleFor: 0, huntActive: false, target: null, hiddenSide: null });
      ui.setSpinAttention(false);
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
      camera.lookAt(focusPosition);
      if (cameraReturn.t >= 1) {
        cameraReturn = null;
        controls.syncFromCamera();
        controls.enabled = true;
      }
    }

    if (flight.phase === 'idle') {
      // The idle ship keeps its nose pointed at the world the map is suggesting, so it
      // never sits blankly side-on — and so the ship, the ring and the hint all point the
      // same way. The Moon whenever the suggestion is Earth or absent: a ship aimed at the
      // planet it is parked beside reads as pointing at nothing.
      const aim = suggested && suggested !== 'earth' ? suggested : 'moon';
      world.bodies[aim].getWorldPosition(aimPosition);
      shipHeading.subVectors(aimPosition, ship.group.position);
      ship.orient(shipHeading);
    }

    ship.update(dt, elapsed);
    flight.update(dt);
    // The pull-back owns the camera while it runs, like the flight does; suspend orbit
    // control for it so the two are not both writing the camera on the same frame.
    homeReturn.update(dt);

    if (flight.phase !== 'flying' && !homeReturn.active && !cameraReturn) {
      // Rotating the device changes how much fits on screen, so recompose the shot.
      // Deliberately overrides any manual zoom: a rotated view that cuts off the
      // destination is worse than losing the zoom level.
      if (camera.aspect !== lastAspect) {
        lastAspect = camera.aspect;
        const body = world.bodies[follow];
        // viewRadius so a rotation while at Saturn reframes the whole ring system, not the
        // sphere alone; it falls back to the plain radius for every other body. The same
        // interface inset keeps the subject out from under the dock as it does on the map.
        controls.frame(
          // Match the arrival composition after rotation. The old 2.6 multiplier treated
          // frame()'s subject radius like a camera distance and shrank Saturn to a thumbnail
          // in phone landscape; 1.4 is the same breathing room arrivalDistance authors.
          follow === 'earth' ? framingRadius() : (body.viewRadius ?? body.radius) * 1.4,
          false,
          framingInset(),
        );
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

  stage.onCrash((error) => {
    // The loop has stopped; the sounds it was driving have not, and the engine would
    // otherwise drone under the crash screen at whatever gain it had reached.
    sfx.reset();
    narrator.stop();
    fail('Space Ninja stopped', error, true);
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
    window.removeEventListener('pointerdown', onAnyPress, true);
    coach.dispose();
    canvas.removeEventListener('pointerup', onDayTurnSkipTap);
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
