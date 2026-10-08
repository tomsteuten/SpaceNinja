import * as THREE from 'three';
import type { World, BodyId } from '../scene/Bodies';
import type { OrbitInput } from '../controls/OrbitInput';
import { availability, createMapModel, type MapPlace } from './model';
import { createMapUI } from './ui';

/** One home-only camera owner; yields before any journey, lesson or return starts. */
export function createNeighborhoodMap(options: {
  root: HTMLElement; canvas: HTMLCanvasElement; camera: THREE.PerspectiveCamera;
  world: World; controls: OrbitInput; ship: THREE.Object3D;
  revealed(): BodyId[]; prerequisite(id: string): string | undefined;
  covered(): boolean; launch(id: BodyId): void; tap(x: number,y: number): void; onBrowse(): void;
}) {
  const { root, canvas, camera, world, controls, ship } = options;
  const model = createMapModel();
  let active = false;
  let gesture: { id: number; x: number; y: number; moved: number; multi: boolean } | null = null;
  const center = new THREE.Vector3(), point = new THREE.Vector3(), delta = new THREE.Vector3();
  const ui = createMapUI(root, model, {
    revealed: options.revealed, prerequisite: options.prerequisite,
    choose, browse,
    moreMoons() { if (!active || options.covered()) return; model.moreMoons(); ui.render(); ui.measure(); },
  });

  function choose(place: MapPlace) {
    if (!active || options.covered()) return;
    const state = availability(place, options.revealed());
    if (state === 'unbuilt') { ui.feedback(`${place.label} is coming later. Try Earth, Moon or Sun.`); return; }
    if (state === 'locked') ui.feedback(`Visit ${options.prerequisite(place.id)} first`);
    if (place.body) options.launch(place.body);
  }
  function refresh() {
    ui.render(); ui.measure();
    const shown = model.neighborhood.scene.filter(id => options.revealed().includes(id));
    world.setRevealed(shown);
    world.setFocus(null);
    ship.visible = model.neighborhood.id === 'earth';
    controls.cancelGesture();
    controls.enabled = false;
  }
  function browse(step: number) {
    if (!active || options.covered()) return;
    clearGesture();
    model.move(step); options.onBrowse(); refresh();
    // A cut is intentional: paging never sweeps the camera across the solar system.
    update();
  }
  function bounds() {
    const ids = model.neighborhood.scene.filter(id => options.revealed().includes(id));
    if (!ids.length) { center.set(0,0,0); return 2; }
    const first = world.bodies[ids[0]!];
    first.getWorldPosition(center);
    let radius = first.viewRadius ?? first.radius;
    // Union of enclosing spheres includes Saturn's rings and keeps Earth's Moon nearby.
    for (const id of ids.slice(1)) {
      const body = world.bodies[id], other = body.viewRadius ?? body.radius;
      body.getWorldPosition(point); delta.subVectors(point,center);
      const distance = delta.length();
      if (distance + other <= radius) continue;
      if (distance + radius <= other) { center.copy(point); radius = other; continue; }
      const next = (radius + distance + other)/2;
      if (distance > 0) center.addScaledVector(delta,(next-radius)/distance);
      radius = next;
    }
    return radius * 1.1;
  }
  function restingPose() {
    const radius = bounds();
    controls.setFocusRadius(radius);
    return controls.restingPose(center,radius,ui.inset);
  }
  function update() {
    if (!active) return;
    const pose = restingPose();
    camera.position.copy(pose.position); camera.lookAt(pose.look);
  }
  function clearGesture() {
    const id = gesture?.id; gesture = null;
    if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  function down(event: PointerEvent) {
    if (!active || options.covered()) return;
    event.stopImmediatePropagation();
    if (gesture) { gesture.multi = true; return; }
    controls.cancelGesture();
    gesture = { id:event.pointerId,x:event.clientX,y:event.clientY,moved:0,multi:false };
    canvas.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!active || !gesture) return;
    event.stopImmediatePropagation();
    if (event.pointerId !== gesture.id) return;
    gesture.moved = Math.max(gesture.moved,Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y));
  }
  function up(event: PointerEvent) {
    if (!active || !gesture) return;
    event.stopImmediatePropagation();
    if (event.pointerId !== gesture.id) return;
    const held = gesture; clearGesture();
    if (held.multi || options.covered()) return;
    const dx=event.clientX-held.x,dy=event.clientY-held.y;
    if (Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) browse(dx<0 ? 1 : -1);
    else if (held.moved<12) {
      if (ui.previewContains(event.clientX,event.clientY)) choose(model.neighborhood.places[0]!);
      else options.tap(event.clientX,event.clientY);
    }
  }
  function cancel() { clearGesture(); }
  canvas.addEventListener('pointerdown',down,true);
  canvas.addEventListener('pointermove',move,true);
  canvas.addEventListener('pointerup',up,true);
  canvas.addEventListener('pointercancel',cancel,true);
  canvas.addEventListener('lostpointercapture',cancel,true);
  return {
    get active() { return active; }, get neighborhood() { return model.neighborhood.id; },
    get offset() { return ui.offset; },
    show(newlyReady?: BodyId) {
      active=true; ui.setActive(true); refresh(); update();
      if (newlyReady) ui.feedback(`${world.bodies[newlyReady].label.replace(/^The /,'')} is ready on the map`);
    },
    hide() { active=false; clearGesture(); ui.setActive(false); ship.visible=true; },
    update, restingPose, clearGesture,
    resize() { if (active) { ui.measure(); update(); } },
    dispose() {
      clearGesture(); ui.dispose();
      canvas.removeEventListener('pointerdown',down,true); canvas.removeEventListener('pointermove',move,true);
      canvas.removeEventListener('pointerup',up,true); canvas.removeEventListener('pointercancel',cancel,true);
      canvas.removeEventListener('lostpointercapture',cancel,true);
    },
  };
}
