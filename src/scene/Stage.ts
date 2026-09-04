/**
 * Renderer, camera, post-processing and the frame loop.
 *
 * Rendering always goes through EffectComposer, even when bloom is off, so tone mapping
 * and colour conversion happen in exactly one place (OutputPass) for every material —
 * including the custom atmosphere and sky shaders.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CAMERA_FAR, CAMERA_FOV_LANDSCAPE, CAMERA_NEAR, fovForAspect } from '../config';
import { demote, type QualitySettings } from './quality';

export type FrameCallback = (dt: number, elapsed: number) => void;

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  quality: QualitySettings;
  onFrame(callback: FrameCallback): void;
  /**
   * Something inside a frame threw. The loop has already stopped by the time this is
   * called: a callback that throws once throws every frame, and the picture underneath is
   * the last good one, which looks fine and is not.
   */
  onCrash(handler: (error: unknown) => void): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

export class WebGLUnavailableError extends Error {}

export function createStage(canvas: HTMLCanvasElement, initial: QualitySettings): Stage {
  let quality = initial;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
  } catch (cause) {
    throw new WebGLUnavailableError('WebGL context could not be created', { cause });
  }

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x05040f, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV_LANDSCAPE,
    1,
    CAMERA_NEAR,
    CAMERA_FAR,
  );

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  let bloomPass: UnrealBloomPass | null = null;
  const outputPass = new OutputPass();

  function buildBloom() {
    if (bloomPass) return;
    bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.6, 0.76);
    composer.insertPass(bloomPass, 1);
  }

  function removeBloom() {
    if (!bloomPass) return;
    composer.removePass(bloomPass);
    bloomPass.dispose();
    bloomPass = null;
  }

  if (quality.bloom) buildBloom();
  composer.addPass(outputPass);

  /* --- sizing ------------------------------------------------------------- */

  let resizePending = false;

  function applySize() {
    resizePending = false;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const aspect = width / height;

    camera.aspect = aspect;
    // Portrait phones are narrow; widening the vertical FOV keeps the scene in frame.
    camera.fov = fovForAspect(aspect);
    camera.updateProjectionMatrix();

    const pixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    // composer.setSize already sized the bloom targets to full resolution; re-size them
    // down afterwards. Bloom is a blur, so running it at half res is nearly free quality.
    bloomPass?.setSize(
      Math.max(1, Math.round(width * quality.bloomScale)),
      Math.max(1, Math.round(height * quality.bloomScale)),
    );
  }

  function requestResize() {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(applySize);
  }

  applySize();
  window.addEventListener('resize', requestResize);
  window.addEventListener('orientationchange', requestResize);
  window.visualViewport?.addEventListener('resize', requestResize);

  /* --- adaptive quality ---------------------------------------------------- */

  // Hardware hints are unreliable. Measure real frame times for a few seconds after
  // startup and step the tier down once if we are missing the budget. Only pixel ratio
  // and bloom change here — geometry and texture sizes are fixed at construction.
  let sampleStart = -1;
  let sampleFrames = 0;
  let sampleTime = 0;
  let adaptDone = quality.tier === 'low';

  function sampleFrame(dt: number, elapsed: number) {
    if (adaptDone) return;
    if (elapsed < 1.5) return; // let JIT, texture upload and first paint settle
    if (sampleStart < 0) sampleStart = elapsed;
    sampleFrames++;
    sampleTime += dt;
    if (elapsed - sampleStart < 2.5) return;

    adaptDone = true;
    const fps = sampleFrames / Math.max(sampleTime, 0.0001);
    if (fps >= 45) return;

    const next = demote(quality);
    if (!next) return;
    console.info(
      `[quality] measured ${fps.toFixed(0)}fps on tier "${quality.tier}" - dropping to "${next.tier}"`,
    );
    quality = next;
    if (quality.bloom) buildBloom();
    else removeBloom();
    applySize();

    // Allow one further measurement so a very slow device can fall all the way to "low".
    adaptDone = quality.tier === 'low';
    sampleStart = -1;
    sampleFrames = 0;
    sampleTime = 0;
  }

  /* --- loop ---------------------------------------------------------------- */

  const callbacks: FrameCallback[] = [];
  let crashHandler: ((error: unknown) => void) | null = null;
  // Timer rather than the deprecated Clock; connect() makes it use the Page Visibility API
  // so returning to a backgrounded tab does not produce one enormous delta.
  const timer = new THREE.Timer();
  timer.connect(document);
  let frameHandle = 0;
  let running = false;
  let contextLost = false;

  function onContextLost(event: Event) {
    event.preventDefault();
    contextLost = true;
  }

  function onContextRestored() {
    contextLost = false;
    applySize();
  }

  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  function tick() {
    frameHandle = requestAnimationFrame(tick);
    if (contextLost) return;

    /*
     * Caught here and nowhere else, because this is the one place a crash is *visible* as
     * a crash. An exception out of a frame used to propagate to the console and leave the
     * last rendered frame on screen — a bug report from a tablet reads "it just stopped",
     * with a picture that looks perfectly fine. Stopping the loop is deliberate: the same
     * throw would otherwise repeat sixty times a second.
     */
    try {
      timer.update();
      // Clamp so a dropped frame cannot teleport the ship mid-flight.
      const dt = Math.min(timer.getDelta(), 0.05);
      const elapsed = timer.getElapsed();
      for (const callback of callbacks) callback(dt, elapsed);
      composer.render(dt);
      sampleFrame(dt, elapsed);
    } catch (error) {
      running = false;
      cancelAnimationFrame(frameHandle);
      crashHandler?.(error);
    }
  }

  return {
    renderer,
    scene,
    camera,
    get quality() {
      return quality;
    },

    onFrame(callback: FrameCallback) {
      callbacks.push(callback);
    },

    onCrash(handler: (error: unknown) => void) {
      crashHandler = handler;
    },

    start() {
      if (running) return;
      running = true;
      frameHandle = requestAnimationFrame(tick);
    },

    stop() {
      running = false;
      cancelAnimationFrame(frameHandle);
    },

    dispose() {
      this.stop();
      window.removeEventListener('resize', requestResize);
      window.removeEventListener('orientationchange', requestResize);
      window.visualViewport?.removeEventListener('resize', requestResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      callbacks.length = 0;
      timer.disconnect();
      removeBloom();
      outputPass.dispose();
      renderPass.dispose?.();
      composer.dispose();
      renderer.dispose();
    },
  };
}
