/**
 * Assisted free flight — the scene glue for the `?freeflight` prototype.
 *
 * This is a self-contained experiment, deliberately entered from the grown-ups panel or
 * `?freeflight`. It reuses the real Stage, sky, worlds and ship and answers the question
 * both put first: does steering the ship yourself feel good, and does it stay legible? The
 * last steering attempt was cut because "the ship barely moved in frame" and there was "no
 * goal", so this is built around fixing exactly those two things:
 *
 *  - **Visible response.** The chase camera follows a *lagged* copy of the heading, so when
 *    the ship yaws its nose leads the turn across the frame before the camera swings to
 *    follow — the opposite of the old rig, where camera and ship shared one offset and the
 *    ship sat still in the middle of its own exhaust. The bank roll is deliberately large.
 *  - **A goal.** The planets. Fly near one and the assist coasts you to a hover beside it and
 *    offers Explore. Steering is *for* reaching a world, not a cosmetic wobble on a fixed path.
 *
 * The physics and every assist (auto-brake, auto-level, slow-to-hover, gentle collision
 * deflection, optional autopilot) live in freeFlightModel.ts, which is pure and tested. This
 * file only turns the scene into that model's `FlightBody[]` each frame and draws the result.
 */

import * as THREE from 'three';
import { DESTINATIONS, fovForAspect } from '../config';
import { detectQuality, prefersReducedMotion } from '../scene/quality';
import { createStage } from '../scene/Stage';
import { createSky } from '../scene/Starfield';
import { createWorld, type BodyId } from '../scene/Bodies';
import { createSpaceship } from '../scene/Spaceship';
import { createEngineTrail } from '../scene/EngineTrail';
import {
  createFreeFlight,
  DEFAULT_TUNING,
  type FlightBody,
} from './freeFlightModel';
import { adventureHref } from './freeFlightRoute';

const ALL_BODIES: BodyId[] = ['earth', 'moon', 'mars', 'saturn'];

/** Where the ship starts: out from Earth, nose toward the middle of the neighbourhood. */
const START_POSITION = new THREE.Vector3(0, 1.2, 5.5);
const START_HEADING = new THREE.Vector3(0, -0.12, -1).normalize();

/** Chase rig. DIST/HEIGHT frame the ship; the two lag rates are what make a turn visible. */
const CHASE_DIST = 1.5;
const CHASE_HEIGHT = 0.5;
const CHASE_LOOKAHEAD = 1.6;
/** How fast the camera's heading catches the ship's. Low on purpose: the lag *is* the effect. */
const CAM_HEADING_LAG = 2.4;
/** A gentler position smooth on top, so the rig glides rather than snaps. */
const CAM_POSITION_LAG = 6;
/** A little extra view width at speed, the same cheap acceleration cue the scripted flight uses. */
const FOV_PUNCH = 7;

export async function startFreeFlight(canvas: HTMLCanvasElement, uiRoot: HTMLElement): Promise<void> {
  const boot = document.getElementById('boot');
  const reducedMotion = prefersReducedMotion();

  const stage = createStage(canvas, detectQuality());
  const { scene, camera } = stage;

  const sky = createSky(stage.quality);
  scene.add(sky.group);
  void sky.applyStarMap();

  const world = await createWorld(stage.quality);
  scene.add(world.group);
  // A sandbox, not the gated opening shot: show every world, so there is always somewhere to fly.
  world.setRevealed(ALL_BODIES);
  world.setOrbitSpeedScale(1);

  const ship = createSpaceship();
  scene.add(ship.group);

  const trail = createEngineTrail(stage.quality.tier === 'low' ? 24 : 46);
  scene.add(trail.group);

  const flight = createFreeFlight(
    { position: START_POSITION, heading: START_HEADING },
    DEFAULT_TUNING,
  );

  /* --- HUD ---------------------------------------------------------------- */

  const hud = buildHud(uiRoot, {
    onAutopilot: (id) => {
      flight.engageAutopilot(id);
      setHint(`🛸 Autopilot to ${label(id)} — touch anywhere to fly it yourself`);
    },
    onExplore: () => {
      const id = flight.state.explorable as BodyId | null;
      if (id) openArrival(id);
    },
    onCloseArrival: () => hud.arrival.classList.remove('is-open'),
    onExit: () => window.location.assign(adventureHref(window.location.href)),
  });
  function setHint(text: string) {
    hud.hint.textContent = text;
  }
  function label(id: BodyId): string {
    return world.bodies[id].label.replace(/^The /, '');
  }
  function openArrival(id: BodyId) {
    const config = DESTINATIONS[id];
    hud.arrivalEmoji.textContent = config?.emoji ?? '✨';
    hud.arrivalTitle.textContent = `You reached ${label(id)}!`;
    hud.arrivalFact.textContent = config?.fact ?? '';
    hud.arrival.classList.add('is-open');
  }

  setHint('👆 Hold anywhere and steer — let go to slow down');

  /* --- one-finger steering ------------------------------------------------ */

  // Pointer offset from the screen centre, in [-1, 1]. Null when nothing is held, which the
  // model reads as "release" and turns into braking. Centre-relative rather than drag-relative
  // so "hold on the right, turn right" needs no explaining — the whole screen is the stick.
  let pointer: { x: number; y: number } | null = null;
  let activePointer: number | null = null;

  function readPointer(event: PointerEvent) {
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    pointer = {
      x: THREE.MathUtils.clamp((event.clientX - halfW) / halfW, -1, 1),
      y: THREE.MathUtils.clamp((halfH - event.clientY) / halfH, -1, 1),
    };
  }
  function onPointerDown(event: PointerEvent) {
    if (activePointer !== null) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    readPointer(event);
  }
  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== activePointer) return;
    readPointer(event);
  }
  function onPointerUp(event: PointerEvent) {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    pointer = null;
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('lostpointercapture', onPointerUp);

  /* --- frame loop --------------------------------------------------------- */

  const bodies: FlightBody[] = ALL_BODIES.map((id) => ({
    id,
    center: new THREE.Vector3(),
    radius: world.bodies[id].radius,
    // Only Saturn sets viewRadius. Its rings are a real part of the silhouette, so collision
    // and approach assistance must engage before the ship passes through them.
    clearanceRadius: world.bodies[id].viewRadius,
  }));

  const camHeading = START_HEADING.clone();
  const desiredCam = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const tail = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);

  let lastExplorable: BodyId | null = null;
  let booted = false;

  stage.onFrame((dt, elapsed) => {
    sky.update(dt);
    world.update(dt, elapsed, camera);
    trail.update(dt);

    // Refresh each body's live world position — they keep orbiting under the flight.
    for (const body of bodies) world.bodies[body.id as BodyId].getWorldPosition(body.center);

    const state = flight.update(dt, { pointer }, bodies);

    // Draw the ship. The nose is +Z (Spaceship.orient), roll is the bank.
    ship.group.position.copy(state.position);
    ship.orient(state.heading, state.roll);
    ship.setThrust(state.speed / DEFAULT_TUNING.cruiseSpeed);
    ship.update(dt, elapsed);

    // Exhaust, laid down in world space behind the engines while thrusting.
    if (!reducedMotion && state.speed > 0.05) {
      tail.copy(state.position).addScaledVector(state.heading, -0.19);
      trail.emit(tail, state.speed / DEFAULT_TUNING.cruiseSpeed, dt);
    }

    // Chase camera. camHeading lags the true heading, so the nose leads a turn in frame.
    camHeading.lerp(state.heading, Math.min(1, CAM_HEADING_LAG * dt)).normalize();
    desiredCam
      .copy(state.position)
      .addScaledVector(camHeading, -CHASE_DIST)
      .addScaledVector(WORLD_UP, CHASE_HEIGHT);
    camera.position.lerp(desiredCam, Math.min(1, CAM_POSITION_LAG * dt));
    // Look ahead along the *true* heading, so the place the ship is turning toward is framed.
    lookTarget.copy(state.position).addScaledVector(state.heading, CHASE_LOOKAHEAD);
    camera.up.copy(WORLD_UP);
    camera.lookAt(lookTarget);

    // Widen the view a touch with speed — reads as acceleration.
    if (!reducedMotion) {
      const punch = FOV_PUNCH * (state.speed / DEFAULT_TUNING.cruiseSpeed);
      const want = fovForAspect(camera.aspect) + punch;
      if (Math.abs(camera.fov - want) > 0.01) {
        camera.fov = want;
        camera.updateProjectionMatrix();
      }
    }

    // The goal light. Banner appears while hovering beside a world, clears when you leave.
    if (state.explorable !== lastExplorable) {
      lastExplorable = state.explorable as BodyId | null;
      if (state.explorable) {
        hud.hint.classList.add('is-contextual-hidden');
        hud.banner.classList.add('is-open');
        hud.bannerLabel.textContent = `${DESTINATIONS[state.explorable]?.emoji ?? ''} ${label(state.explorable as BodyId)}`;
      } else {
        hud.hint.classList.remove('is-contextual-hidden');
        hud.banner.classList.remove('is-open');
        if (!state.autopilot) setHint('👆 Hold anywhere and steer — let go to slow down');
      }
    }

    if (!booted) {
      booted = true;
      boot?.classList.add('is-hidden');
    }
  });

  stage.onCrash((error) => {
    console.error('Free flight stopped', error);
    setHint('The prototype hit an error — reload to try again.');
  });

  stage.start();

  window.addEventListener('pagehide', () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('lostpointercapture', onPointerUp);
    ship.dispose();
    trail.dispose();
    world.dispose();
    sky.dispose();
    stage.dispose();
    hud.root.remove();
  }, { once: true });
}

/* --- HUD construction (prototype-only, kept out of ui.ts on purpose) -------- */

interface Hud {
  root: HTMLElement;
  hint: HTMLElement;
  banner: HTMLElement;
  bannerLabel: HTMLElement;
  arrival: HTMLElement;
  arrivalEmoji: HTMLElement;
  arrivalTitle: HTMLElement;
  arrivalFact: HTMLElement;
}

function buildHud(
  uiRoot: HTMLElement,
  handlers: {
    onAutopilot: (id: BodyId) => void;
    onExplore: () => void;
    onCloseArrival: () => void;
    onExit: () => void;
  },
): Hud {
  injectStyles();
  const root = el('div', 'ff');
  uiRoot.appendChild(root);

  const exit = el('button', 'ff-exit');
  exit.textContent = '← Back to adventure';
  exit.setAttribute('aria-label', 'Back to the Space Ninja adventure');
  exit.addEventListener('click', handlers.onExit);
  root.appendChild(exit);

  const hint = el('div', 'ff-hint');
  root.appendChild(hint);

  // The Explore banner — the goal made visible when you hover beside a world.
  const banner = el('div', 'ff-banner');
  const bannerLabel = el('span', 'ff-banner-label');
  const exploreBtn = el('button', 'ff-explore');
  exploreBtn.textContent = 'Explore ✨';
  exploreBtn.addEventListener('click', handlers.onExplore);
  banner.append(bannerLabel, exploreBtn);
  root.appendChild(banner);

  // Optional autopilot: the shipped destination buttons, kept as a fly-there-for-me path.
  const dock = el('div', 'ff-dock');
  for (const id of ALL_BODIES) {
    const btn = el('button', 'ff-chip');
    btn.innerHTML = `<span class="ff-chip-emoji">${DESTINATIONS[id]?.emoji ?? '✨'}</span>`;
    btn.setAttribute('aria-label', `Autopilot to ${id}`);
    btn.addEventListener('click', () => handlers.onAutopilot(id));
    dock.appendChild(btn);
  }
  root.appendChild(dock);

  // The arrival card, shown when Explore is pressed.
  const arrival = el('div', 'ff-arrival');
  const card = el('div', 'ff-arrival-card');
  const arrivalEmoji = el('div', 'ff-arrival-emoji');
  const arrivalTitle = el('h2', 'ff-arrival-title');
  const arrivalFact = el('p', 'ff-arrival-fact');
  const back = el('button', 'ff-arrival-back');
  back.textContent = '🚀 Keep flying';
  back.addEventListener('click', handlers.onCloseArrival);
  card.append(arrivalEmoji, arrivalTitle, arrivalFact, back);
  arrival.appendChild(card);
  root.appendChild(arrival);

  return { root, hint, banner, bannerLabel, arrival, arrivalEmoji, arrivalTitle, arrivalFact };
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** Prototype styling, injected once. Purple-and-gold to sit beside the real game's look. */
function injectStyles() {
  if (document.getElementById('ff-styles')) return;
  const style = document.createElement('style');
  style.id = 'ff-styles';
  style.textContent = `
    .ff { position: fixed; inset: 0; pointer-events: none; z-index: 40;
      font-family: ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif; color: #efe9ff; }
    .ff-exit { position: absolute; top: max(14px, env(safe-area-inset-top));
      left: max(14px, env(safe-area-inset-left)); min-height: 48px; padding: 10px 15px;
      border: 1px solid rgba(255,255,255,0.2); border-radius: 999px; pointer-events: auto;
      background: rgba(28, 20, 64, 0.78); color: #efe9ff; cursor: pointer;
      font: inherit; font-weight: 800; box-shadow: 0 6px 18px rgba(6,4,20,0.38); }
    .ff-hint { position: absolute; top: max(14px, env(safe-area-inset-top)); left: 50%;
      transform: translateX(-50%); max-width: min(60vw, 44rem); text-align: center; padding: 10px 18px;
      border-radius: 999px; background: rgba(28, 20, 64, 0.72); backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px); font-size: 1rem; font-weight: 700; }
    .ff-hint.is-contextual-hidden { visibility: hidden; }
    .ff-banner { position: absolute; top: 64px; left: 50%; transform: translateX(-50%) scale(0.9);
      display: none; align-items: center; gap: 12px; padding: 10px 12px 10px 18px;
      border-radius: 999px; background: rgba(74, 61, 132, 0.9); pointer-events: auto;
      box-shadow: 0 10px 26px rgba(6, 4, 20, 0.5); opacity: 0; transition: opacity .2s, transform .2s; }
    .ff-banner.is-open { display: flex; opacity: 1; transform: translateX(-50%) scale(1); }
    .ff-banner-label { font-weight: 800; font-size: 1.1rem; }
    .ff-explore { border: none; cursor: pointer; font: inherit; font-weight: 800; font-size: 1.05rem;
      color: #40200a; padding: 12px 22px; border-radius: 999px; min-height: 52px;
      background: linear-gradient(180deg, #ffd479 0%, #f4b21f 55%, #d68e12 100%);
      box-shadow: 0 4px 0 #a5690c; }
    .ff-dock { position: absolute; bottom: max(16px, env(safe-area-inset-bottom)); left: 50%;
      transform: translateX(-50%); display: flex; gap: 12px; pointer-events: auto; }
    .ff-chip { width: 60px; height: 60px; border-radius: 18px; border: 2px solid rgba(255,255,255,0.14);
      background: rgba(28, 20, 64, 0.72); cursor: pointer; display: grid; place-items: center;
      font-size: 1.8rem; box-shadow: 0 6px 16px rgba(6,4,20,0.4); }
    .ff-chip:active { transform: scale(0.94); }
    .ff-arrival { position: absolute; inset: 0; display: none; place-items: center;
      background: rgba(8, 6, 25, 0.66); pointer-events: auto; padding: 20px; }
    .ff-arrival.is-open { display: grid; }
    .ff-arrival-card { max-width: 34ch; text-align: center; padding: 26px 24px 20px;
      border-radius: 24px; background: radial-gradient(120% 100% at 50% 0%, #241a52, #140f30);
      box-shadow: 0 18px 50px rgba(6,4,20,0.6); }
    .ff-arrival-emoji { font-size: 3.4rem; }
    .ff-arrival-title { margin: 8px 0 6px; font-size: 1.5rem; }
    .ff-arrival-fact { margin: 0 0 18px; font-size: 1.02rem; line-height: 1.5; opacity: 0.92; }
    .ff-arrival-back { border: none; cursor: pointer; font: inherit; font-weight: 800; font-size: 1.1rem;
      color: #40200a; padding: 14px 26px; border-radius: 999px; min-height: 56px;
      background: linear-gradient(180deg, #ffb266 0%, #f4762a 52%, #d2551a 100%);
      box-shadow: 0 5px 0 #a03c11; }
    @media (max-width: 560px) {
      .ff-hint { top: max(72px, calc(env(safe-area-inset-top) + 60px)); max-width: 88vw; }
      .ff-banner { top: max(126px, calc(env(safe-area-inset-top) + 114px)); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ff-banner { transition: none; }
    }
  `;
  document.head.appendChild(style);
}
