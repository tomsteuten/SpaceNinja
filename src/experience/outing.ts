import * as THREE from 'three';
import { DISCOVERIES } from '../config';
import { createSessionLifecycle } from '../session/lifecycle';
import { fail } from '../session/failure';
import { registerOffline } from '../session/offline';
import { detectQuality, prefersReducedMotion } from '../scene/quality';
import { createStage } from '../scene/Stage';
import { createSky } from '../scene/Starfield';
import { createWorld } from '../scene/Bodies';
import { createSpaceship } from '../scene/Spaceship';
import { createEngineTrail } from '../scene/EngineTrail';
import { createFreeFlight, DEFAULT_TUNING, type FlightBody } from '../flight/freeFlightModel';
import { createCollectMission } from '../mission/CollectMission';
import { createNarrator } from '../audio/narration';
import { createPhotoViewer, findPhoto } from '../ui/photos';
import { loadProgress, markVisited, recordDiscovery } from '../state/progress';
import { loadSoundOn } from '../state/settings';
import { createCameraDirector } from './cameraDirector';
import {
  INITIAL_OUTING,
  assistedArrival,
  canReloadForUpdate,
  flightRuns,
  transition,
  type OutingEffect,
  type OutingEvent,
  type OutingState,
} from './outingState';
import './outing.css';

const TYCHO = DISCOVERIES['moon-tycho']!;
const TYCHO_VOICE = 'You found Tycho! A crashing space rock splashed those bright streaks of dust across the Moon.';

/** Canonical, bounded outing: the real Earth and Moon, one ship and one discovery. */
export async function startOuting(canvas: HTMLCanvasElement, uiRoot: HTMLElement): Promise<void> {
  if (!TYCHO) throw new Error('Tycho discovery is missing');
  const boot = document.getElementById('boot');
  const reducedMotion = prefersReducedMotion();
  const stage = createStage(canvas, detectQuality());
  const { scene, camera } = stage;
  const sky = createSky(stage.quality);
  scene.add(sky.group);
  void sky.applyStarMap();
  const world = await createWorld(stage.quality);
  scene.add(world.group);
  world.setRevealed(['earth', 'moon']);
  // Keep the small outing's destination in view between trips. This is navigation
  // staging, not a scale or orbital-period demonstration.
  world.setOrbitSpeedScale(0);
  const ship = createSpaceship();
  scene.add(ship.group);
  const trail = createEngineTrail(stage.quality.tier === 'low' ? 24 : 46);
  scene.add(trail.group);
  const narrator = createNarrator();
  const photo = createPhotoViewer(uiRoot, { onHide: () => dispatch({ type: 'photoClosed' }) });
  const cameraDirector = createCameraDirector(camera, reducedMotion);
  const moon = world.bodies.moon;
  const earth = world.bodies.earth;
  world.update(0, 0, camera);

  const earthCenter = earth.getWorldPosition(new THREE.Vector3());
  const moonCenter = moon.getWorldPosition(new THREE.Vector3());
  // A clear lane past Earth: the old trial spawn's straight line to the Moon crossed
  // Earth's safety shell, where the flight model correctly braked and deflected it.
  const start = new THREE.Vector3(1, 0.5, 3);
  // Aim the authored +Z nose at the Moon. The pilot begins clear of Earth's surface.
  const heading = moonCenter.clone().sub(start).normalize();
  let flight = createFreeFlight({ position: start, heading }, DEFAULT_TUNING);
  const bodies: FlightBody[] = [
    { id: 'earth', center: earthCenter, radius: earth.radius, brakeOnApproach: false, canExplore: false },
    { id: 'moon', center: moonCenter, radius: moon.radius },
  ];
  let state: OutingState = INITIAL_OUTING;
  let remembered = loadProgress().discoveries.includes(TYCHO.id);
  let photoUnavailable = false;
  let pointer: { x: number; y: number } | null = null;
  let pointerId: number | null = null;
  let foundThisVisit = false;
  let photoRequest = 0;
  let mission: ReturnType<typeof createCollectMission> | null = null;
  let booted = false;
  const events = new AbortController();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tail = new THREE.Vector3();

  const hud = document.createElement('section');
  hud.className = 'outing';
  hud.innerHTML = `
    <div class="outing-top"><span class="outing-brand">🚀 Space Ninja</span><span class="outing-status" aria-live="polite"></span><button class="outing-memory" type="button" hidden>✨ Memory</button></div>
    <div class="outing-center"><button class="outing-explore" type="button" hidden>🌙 Explore the Moon</button></div>
    <div class="outing-bottom"><span class="outing-hint">👆 Hold to fly · let go to stop</span><div class="outing-actions"><button class="outing-help" type="button">🌙 Help me to the Moon</button><button class="outing-stop" type="button">✋ Stop</button><button class="outing-home" type="button">🏠 Fly Home</button></div></div>
    <div class="outing-discovery" hidden><strong>✨ The Bright Crater</strong><p></p><div><button class="outing-photo" type="button">📷 See the real Moon</button><button class="outing-speak" type="button">🔊 Hear it again</button></div></div>`;
  uiRoot.append(hud);
  const get = <T extends HTMLElement>(selector: string) => hud.querySelector<T>(selector)!;
  const status = get<HTMLElement>('.outing-status');
  const hint = get<HTMLElement>('.outing-hint');
  const explore = get<HTMLButtonElement>('.outing-explore');
  const help = get<HTMLButtonElement>('.outing-help');
  const stop = get<HTMLButtonElement>('.outing-stop');
  const home = get<HTMLButtonElement>('.outing-home');
  const memory = get<HTMLButtonElement>('.outing-memory');
  const card = get<HTMLElement>('.outing-discovery');
  const photoButton = get<HTMLButtonElement>('.outing-photo');
  const speakButton = get<HTMLButtonElement>('.outing-speak');
  get<HTMLElement>('.outing-discovery p').textContent = TYCHO_VOICE;

  function releaseInput() {
    const held = pointerId;
    pointerId = null;
    pointer = null;
    if (held !== null && canvas.hasPointerCapture(held)) canvas.releasePointerCapture(held);
  }

  /** The only way interaction state changes: one transition, then its effects in order. */
  function dispatch(event: OutingEvent, press?: PointerEvent) {
    const result = transition(state, event, { explorable: flight.state.explorable === 'moon', reducedMotion });
    state = result.state;
    for (const effect of result.effects) apply(effect, press);
    syncHud();
  }
  function apply(effect: OutingEffect, press?: PointerEvent) {
    switch (effect.type) {
      case 'beginSteer':
        if (!press) return;
        pointerId = press.pointerId;
        canvas.setPointerCapture(press.pointerId);
        readPointer(press);
        flight.cancelAutopilot();
        return;
      case 'collectAt':
        if (press) collectAt(press.offsetX, press.offsetY);
        return;
      case 'haltFlight':
        releaseInput();
        flight.cancelAutopilot();
        flight.state.speed = 0;
        ship.setThrust(0);
        trail.reset();
        return;
      case 'engageHelp':
        releaseInput();
        flight.engageAutopilot('moon');
        return;
      case 'arriveNow':
        arriveNow();
        return;
      case 'enterMoon':
        enterMoon();
        return;
      case 'leaveMoon':
        leaveMoon();
        return;
      case 'showPhoto':
        void showPhoto(effect.reward);
        return;
      case 'hidePhoto':
        ++photoRequest;
        photo.hide();
        return;
      case 'silence':
        narrator.stop();
        return;
    }
  }

  function syncHud() {
    const { phase } = state;
    memory.hidden = !remembered || phase === 'explore';
    explore.hidden = phase !== 'flight' || flight.state.explorable !== 'moon';
    help.hidden = phase !== 'flight';
    stop.hidden = phase !== 'flight';
    home.hidden = phase !== 'explore';
    hint.textContent = phase === 'explore' ? (foundThisVisit ? '📷 Photo or fly home' : '👆 Tap the gold ring on the Moon')
      : flight.state.autopilot ? '🌙 Flying to the Moon · touch to steer' : '👆 Hold to fly · let go to stop';
    status.textContent = phase === 'explore' ? 'On the Moon' : flight.state.explorable === 'moon' ? 'Moon reached!'
      : flight.state.autopilot ? '🌙 Moon help' : flight.state.speed > 0.05 ? '🚀 Flying' : '✋ Stopped';
    status.hidden = phase === 'explore' && !card.hidden;
    photoButton.disabled = photoUnavailable || state.photoOpen;
  }
  async function showPhoto(reward: boolean) {
    const request = ++photoRequest;
    const url = await findPhoto(TYCHO.id);
    // Superseded by flying home, a later request or disposal; that path owns the state.
    if (request !== photoRequest) return;
    if (url) {
      if (reward) photo.showDiscovery(url, TYCHO.name, TYCHO_VOICE);
      else photo.show(url, `${TYCHO.name} — ${TYCHO_VOICE}`);
    } else {
      photoUnavailable = true;
      photoButton.textContent = '📷 Photo unavailable';
      dispatch({ type: 'photoClosed' });
    }
  }
  /** Reduced-motion help: cut straight to the hover an assisted journey would end in. */
  function arriveNow() {
    moon.getWorldPosition(moonCenter);
    flight = createFreeFlight(assistedArrival(flight.state.position, moonCenter, moon.radius), DEFAULT_TUNING);
    flight.update(0, { pointer: null }, bodies);
    cameraDirector.cut();
  }
  function enterMoon() {
    markVisited('moon');
    world.setFocus('moon');
    ship.group.visible = false;
    cameraDirector.setMode('explore');
    cameraDirector.update(0, flight.state, moon);
    camera.updateMatrixWorld(true);
    foundThisVisit = false;
    card.hidden = true;
    mission = createCollectMission({
      definition: { body: moon, instruction: 'Find Tycho', huntLine: '', successLine: '', stickerId: 'moon-explorer', discoveries: [TYCHO] },
      camera, quality: stage.quality, reducedMotion,
      onCollect(discovery) {
        foundThisVisit = true;
        remembered = true;
        recordDiscovery(discovery.id);
        card.hidden = false;
        if (loadSoundOn()) narrator.speak(TYCHO_VOICE, 'discovery-moon-tycho');
        dispatch({ type: 'openPhoto', reward: true });
      },
      onComplete() {},
    });
    mission.start();
    mission.reveal();
  }
  function leaveMoon() {
    mission?.dispose();
    mission = null;
    world.setFocus(null);
    ship.group.visible = true;
    flight = createFreeFlight({ position: start, heading: moon.getWorldPosition(moonCenter).clone().sub(start).normalize() }, DEFAULT_TUNING);
    cameraDirector.setMode('flight');
    cameraDirector.update(0, flight.state, moon);
    card.hidden = true;
  }
  function collectAt(x: number, y: number) {
    if (!mission || !mission.hitMeshes.length) return;
    ndc.set(x / canvas.clientWidth * 2 - 1, 1 - y / canvas.clientHeight * 2);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(mission.hitMeshes, false)[0];
    if (hit) mission.collectFrom(hit.object);
  }

  function readPointer(event: PointerEvent) {
    pointer = {
      x: THREE.MathUtils.clamp((event.clientX - innerWidth / 2) / (innerWidth / 2), -1, 1),
      y: THREE.MathUtils.clamp((innerHeight / 2 - event.clientY) / (innerHeight / 2), -1, 1),
    };
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || pointerId !== null) return;
    narrator.resume();
    dispatch({ type: 'press' }, event);
  }, { signal: events.signal });
  canvas.addEventListener('pointermove', (event) => { if (event.pointerId === pointerId) readPointer(event); }, { signal: events.signal });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, (event) => { if ((event as PointerEvent).pointerId === pointerId) releaseInput(); }, { signal: events.signal });
  }
  window.addEventListener('blur', () => dispatch({ type: 'background' }), { signal: events.signal });
  help.addEventListener('click', () => { narrator.resume(); dispatch({ type: 'help' }); }, { signal: events.signal });
  stop.addEventListener('click', () => dispatch({ type: 'stop' }), { signal: events.signal });
  explore.addEventListener('click', () => { narrator.resume(); dispatch({ type: 'explore' }); }, { signal: events.signal });
  home.addEventListener('click', () => dispatch({ type: 'home' }), { signal: events.signal });
  memory.addEventListener('click', () => { narrator.resume(); dispatch({ type: 'openPhoto', reward: false }); }, { signal: events.signal });
  photoButton.addEventListener('click', () => dispatch({ type: 'openPhoto', reward: false }), { signal: events.signal });
  speakButton.addEventListener('click', () => { narrator.resume(); narrator.speak(TYCHO_VOICE, 'discovery-moon-tycho', true); }, { signal: events.signal });
  window.addEventListener('keydown', (event) => {
    // The photo dialog handles its own Escape first and marks it; that press is spent.
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    dispatch({ type: 'escape' });
  }, { signal: events.signal });

  stage.onFrame((dt, elapsed) => {
    sky.update(dt);
    world.update(dt, elapsed, camera);
    earth.getWorldPosition(earthCenter);
    moon.getWorldPosition(moonCenter);
    trail.update(dt);
    if (state.phase === 'flight') {
      // A modal photo holds the flight model; the ship stays where it was stopped.
      const pose = flightRuns(state) ? flight.update(dt, { pointer }, bodies) : flight.state;
      ship.group.position.copy(pose.position);
      ship.orient(pose.heading, pose.roll);
      ship.setThrust(pose.speed / DEFAULT_TUNING.cruiseSpeed);
      if (!reducedMotion && pose.speed > 0.05) {
        tail.copy(pose.position).addScaledVector(pose.heading, -0.19);
        trail.emit(tail, pose.speed / DEFAULT_TUNING.cruiseSpeed, dt);
      }
    } else {
      ship.setThrust(0);
      mission?.update(dt, elapsed);
    }
    ship.update(dt, elapsed);
    cameraDirector.update(dt, flight.state, moon);
    syncHud();
    if (!booted) {
      booted = true;
      boot?.classList.add('is-hidden');
      registerOffline(() => canReloadForUpdate(state));
    }
  });
  const lifecycle = createSessionLifecycle({
    stage, document, window,
    suspend: () => dispatch({ type: 'background' }),
    fail: (error) => fail('Space Ninja stopped', error, true),
    dispose: () => {
      ++photoRequest;
      events.abort();
      mission?.dispose();
      narrator.dispose();
      photo.dispose();
      trail.dispose();
      ship.dispose();
      world.dispose();
      sky.dispose();
      stage.dispose();
      hud.remove();
    },
  });
  if (import.meta.env.VITE_PLAYTEST === '1') {
    Object.assign(window, { spaceNinjaSnapshot: () => Object.freeze({ phase: state.phase,
      photoOpen: state.photoOpen, touched: state.touched, updateSafe: canReloadForUpdate(state), cameraOwner: cameraDirector.mode,
      speed: flight.state.speed, autopilot: flight.state.autopilot, explorable: flight.state.explorable,
      shipVisible: ship.group.visible, found: loadProgress().discoveries.includes(TYCHO.id),
      steering: pointer !== null, target: mission?.nextTarget() ?? null,
      position: flight.state.position.toArray(), moon: moonCenter.toArray(),
      frame: stage.renderer.info.render.frame }) });
  }
  syncHud();
  lifecycle.start();
}
