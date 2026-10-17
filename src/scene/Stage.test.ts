import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStage } from './Stage';
import { createSessionLifecycle } from '../session/lifecycle';
import type { QualitySettings } from './quality';

// Keep the real scene, camera and timer; only GPU resources are replaced here.
vi.mock('three', async importOriginal => {
  const three = await importOriginal<typeof import('three')>();
  return { ...three, WebGLRenderer: class {
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {}
  } };
});
vi.mock('three/addons/postprocessing/EffectComposer.js', () => ({ EffectComposer: class {
  addPass() {} setPixelRatio() {} setSize() {} render() {} dispose() {}
} }));
vi.mock('three/addons/postprocessing/RenderPass.js', () => ({ RenderPass: class { dispose() {} } }));
vi.mock('three/addons/postprocessing/OutputPass.js', () => ({ OutputPass: class { dispose() {} } }));

const quality: QualitySettings = {
  tier: 'low', maxPixelRatio: 1, antialias: false, bloom: false,
  bloomScale: 0.5, sphereSegments: [32, 16], textureSize: 512, starCount: 1400,
};

function setup() {
  const document = Object.assign(new EventTarget(), { hidden: false });
  const window = Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 844 });
  const canvas = new EventTarget() as HTMLCanvasElement;
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++next, fn); return next; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const stage = createStage(canvas, quality);
  const draw = vi.fn();
  stage.onFrame(draw);
  const loss = () => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  const tick = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const fn of pending) fn(0);
  };
  return { stage, canvas, document, window, frames, draw, loss, tick };
}

afterEach(() => vi.unstubAllGlobals());

describe('renderer failure and lifecycle handoff', () => {
  it('stops rendering, pending resize, audio and input through one crash callback', () => {
    const s = setup();
    const suspend = vi.fn(), fail = vi.fn();
    const session = createSessionLifecycle({
      stage: s.stage, document: s.document, window: s.window,
      suspend, fail, dispose: () => s.stage.dispose(),
    });
    session.start();
    s.tick();
    s.window.dispatchEvent(new Event('resize'));
    expect(s.frames.size).toBe(2);
    expect(s.loss()).toBe(false); // preventDefault allows the driver's own restoration.
    s.loss();
    expect(s.frames.size).toBe(0);
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(fail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: expect.stringContaining('3D graphics were interrupted.') }));
    s.canvas.dispatchEvent(new Event('webglcontextrestored'));
    s.window.dispatchEvent(new Event('resize'));
    s.window.dispatchEvent(new Event('pageshow'));
    s.document.dispatchEvent(new Event('visibilitychange'));
    s.stage.start();
    s.tick();
    expect(s.frames.size).toBe(0);
    expect(s.draw).toHaveBeenCalledTimes(1);
    session.dispose();
  });

  it('reports loss during loading when the lifecycle handler is installed later', () => {
    const s = setup();
    s.loss();
    const fail = vi.fn();
    s.stage.onCrash(fail);
    expect(fail).toHaveBeenCalledTimes(1);
    s.stage.start();
    expect(s.frames.size).toBe(0);
    s.stage.dispose();
  });

  it('keeps a thrown frame terminal even after a direct restart', () => {
    const s = setup();
    const error = new Error('broken frame');
    const fail = vi.fn();
    s.stage.onCrash(fail);
    s.stage.onFrame(() => { throw error; });
    s.stage.start();
    s.tick();
    expect(fail).toHaveBeenCalledExactlyOnceWith(error);
    s.stage.start();
    s.tick();
    expect(s.frames.size).toBe(0);
    expect(s.draw).toHaveBeenCalledTimes(1);
    s.stage.dispose();
  });

  it('cancels resize and ignores context events after disposal', () => {
    const s = setup();
    const fail = vi.fn();
    s.stage.onCrash(fail);
    s.stage.start();
    s.window.dispatchEvent(new Event('resize'));
    s.stage.dispose();
    s.stage.dispose();
    s.loss();
    s.window.dispatchEvent(new Event('resize'));
    s.stage.start();
    s.tick();
    expect(s.frames.size).toBe(0);
    expect(s.draw).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
  });
});
