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
import './outing.css';

const TYCHO = DISCOVERIES['moon-tycho']!;
const TYCHO_VOICE = 'You found Tycho! A crashing space rock splashed those bright streaks of dust across the Moon.';
type Phase = 'flight' | 'explore';

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
  const photo = createPhotoViewer(uiRoot);
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
  let phase: Phase = 'flight';
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
  function suspend() {
    releaseInput();
    flight.cancelAutopilot();
    flight.state.speed = 0;
    ship.setThrust(0);
    trail.reset();
    narrator.stop();
  }
  function syncHud() {
    const saved = loadProgress().discoveries.includes(TYCHO.id);
    memory.hidden = !saved || phase === 'explore';
    explore.hidden = phase !== 'flight' || flight.state.explorable !== 'moon';
    help.hidden = phase !== 'flight';
    stop.hidden = phase !== 'flight';
    home.hidden = phase !== 'explore';
    hint.textContent = phase === 'explore' ? (foundThisVisit ? '📷 Photo or fly home' : '👆 Tap the gold ring on the Moon')
      : flight.state.autopilot ? '🌙 Flying to the Moon · touch to steer' : '👆 Hold to fly · let go to stop';
    status.textContent = phase === 'explore' ? 'On the Moon' : flight.state.explorable === 'moon' ? 'Moon reached!'
      : flight.state.autopilot ? '🌙 Moon help' : flight.state.speed > 0.05 ? '🚀 Flying' : '✋ Stopped';
    status.hidden = phase === 'explore' && !card.hidden;
  }
  async function showPhoto(reward: boolean) {
    releaseInput();
    const request = ++photoRequest;
    photoButton.disabled = true;
    const url = await findPhoto(TYCHO.id);
    if (request !== photoRequest) return;
    photoButton.disabled = false;
    if (url) {
      if (reward) photo.showDiscovery(url, TYCHO.name, TYCHO_VOICE);
      else photo.show(url, `${TYCHO.name} — ${TYCHO_VOICE}`);
    } else {
      photoButton.textContent = '📷 Photo unavailable';
      photoButton.disabled = true;
    }
  }
  function enterMoon() {
    if (phase !== 'flight' || flight.state.explorable !== 'moon') return;
    suspend();
    phase = 'explore';
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
        recordDiscovery(discovery.id);
        card.hidden = false;
        syncHud();
        if (loadSoundOn()) narrator.speak(TYCHO_VOICE, 'discovery-moon-tycho');
        void showPhoto(true);
      },
      onComplete() {},
    });
    mission.start();
    mission.reveal();
    syncHud();
  }
  function flyHome() {
    if (phase !== 'explore') return;
    ++photoRequest;
    photo.hide();
    narrator.stop();
    mission?.dispose();
    mission = null;
    world.setFocus(null);
    ship.group.visible = true;
    flight = createFreeFlight({ position: start, heading: moon.getWorldPosition(moonCenter).clone().sub(start).normalize() }, DEFAULT_TUNING);
    phase = 'flight';
    cameraDirector.setMode('flight');
    cameraDirector.update(0, flight.state, moon);
    card.hidden = true;
    syncHud();
  }
  function collectAt(x: number, y: number) {
    if (phase !== 'explore' || !mission || !mission.hitMeshes.length || !photoIsClosed()) return;
    ndc.set(x / canvas.clientWidth * 2 - 1, 1 - y / canvas.clientHeight * 2);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(mission.hitMeshes, false)[0];
    if (hit) mission.collectFrom(hit.object);
  }
  function photoIsClosed() { return Boolean(uiRoot.querySelector('.photo-view.is-hidden')); }

  function readPointer(event: PointerEvent) {
    pointer = {
      x: THREE.MathUtils.clamp((event.clientX - innerWidth / 2) / (innerWidth / 2), -1, 1),
      y: THREE.MathUtils.clamp((innerHeight / 2 - event.clientY) / (innerHeight / 2), -1, 1),
    };
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || pointerId !== null || !photoIsClosed()) return;
    narrator.resume();
    if (phase === 'explore') {
      collectAt(event.offsetX, event.offsetY);
      return;
    }
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    readPointer(event);
    flight.cancelAutopilot();
    syncHud();
  }, { signal: events.signal });
  canvas.addEventListener('pointermove', (event) => { if (event.pointerId === pointerId) readPointer(event); }, { signal: events.signal });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, (event) => { if ((event as PointerEvent).pointerId === pointerId) releaseInput(); }, { signal: events.signal });
  }
  window.addEventListener('blur', suspend, { signal: events.signal });
  help.addEventListener('click', () => { narrator.resume(); releaseInput(); flight.engageAutopilot('moon'); syncHud(); }, { signal: events.signal });
  stop.addEventListener('click', () => { suspend(); syncHud(); }, { signal: events.signal });
  explore.addEventListener('click', () => { narrator.resume(); enterMoon(); }, { signal: events.signal });
  home.addEventListener('click', flyHome, { signal: events.signal });
  memory.addEventListener('click', () => { narrator.resume(); void showPhoto(false); }, { signal: events.signal });
  photoButton.addEventListener('click', () => { void showPhoto(false); }, { signal: events.signal });
  speakButton.addEventListener('click', () => { narrator.resume(); narrator.speak(TYCHO_VOICE, 'discovery-moon-tycho', true); }, { signal: events.signal });
  window.addEventListener('keydown', (event) => {
    if (phase === 'flight' && event.key === 'Escape') { suspend(); syncHud(); }
    if (phase === 'explore' && event.key === 'Escape' && photoIsClosed()) flyHome();
  }, { signal: events.signal });

  stage.onFrame((dt, elapsed) => {
    sky.update(dt);
    world.update(dt, elapsed, camera);
    earth.getWorldPosition(earthCenter);
    moon.getWorldPosition(moonCenter);
    trail.update(dt);
    if (phase === 'flight') {
      const state = flight.update(dt, { pointer }, bodies);
      ship.group.position.copy(state.position);
      ship.orient(state.heading, state.roll);
      ship.setThrust(state.speed / DEFAULT_TUNING.cruiseSpeed);
      if (!reducedMotion && state.speed > 0.05) {
        tail.copy(state.position).addScaledVector(state.heading, -0.19);
        trail.emit(tail, state.speed / DEFAULT_TUNING.cruiseSpeed, dt);
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
      registerOffline(() => phase === 'flight' && flight.state.speed === 0);
    }
  });
  const lifecycle = createSessionLifecycle({
    stage, document, window, suspend,
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
    Object.assign(window, { spaceNinjaSnapshot: () => Object.freeze({ phase, cameraOwner: cameraDirector.mode,
      speed: flight.state.speed, autopilot: flight.state.autopilot, explorable: flight.state.explorable,
      shipVisible: ship.group.visible, found: loadProgress().discoveries.includes(TYCHO.id),
      steering: pointer !== null, target: mission?.nextTarget() ?? null,
      position: flight.state.position.toArray(), moon: moonCenter.toArray(),
      frame: stage.renderer.info.render.frame }) });
  }
  syncHud();
  lifecycle.start();
}
