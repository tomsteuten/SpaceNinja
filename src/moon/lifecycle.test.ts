import { describe, expect, it, vi } from 'vitest';
import { createSessionLifecycle } from './lifecycle';

function setup(hidden = false) {
  const document = Object.assign(new EventTarget(), { hidden });
  const window = new EventTarget();
  let crash!: (error: unknown) => void;
  const stage = { start: vi.fn(), stop: vi.fn(), onCrash: (fn: typeof crash) => { crash = fn; } };
  const hooks = { suspend: vi.fn(), reset: vi.fn(), dispose: vi.fn(), fail: vi.fn() };
  const session = createSessionLifecycle({ stage, document, window, ...hooks });
  const visibility = (hidden: boolean) => {
    document.hidden = hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const hide = (persisted: boolean) => window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted }));
  return { session, stage, hooks, visibility, hide, window, crash: (error: unknown) => crash(error) };
}

describe('session browser lifetime', () => {
  it('does not start in the background, and silences each suspension before resuming', () => {
    const s = setup(true);
    s.session.start();
    expect(s.stage.start).not.toHaveBeenCalled();
    s.visibility(false);
    s.session.start();
    expect(s.stage.start).toHaveBeenCalledTimes(1);
    s.visibility(true);
    s.visibility(true);
    expect(s.hooks.suspend).toHaveBeenCalledTimes(1);
    s.visibility(false);
    expect(s.stage.start).toHaveBeenCalledTimes(2);
  });

  it('preserves a cached history page and resumes only after pageshow', () => {
    const s = setup();
    s.session.start();
    s.hide(true);
    s.visibility(false);
    expect(s.stage.start).toHaveBeenCalledTimes(1);
    expect(s.hooks.dispose).not.toHaveBeenCalled();
    s.window.dispatchEvent(new Event('pageshow'));
    expect(s.stage.start).toHaveBeenCalledTimes(2);
    expect(s.hooks.reset).not.toHaveBeenCalled();
  });

  it('keeps crashes terminal across visibility, history and adventure reset', () => {
    const s = setup();
    s.session.start();
    const error = new Error('frame failed');
    s.crash(error);
    s.crash(error);
    s.visibility(true);
    s.visibility(false);
    s.hide(true);
    s.window.dispatchEvent(new Event('pageshow'));
    s.session.restart();
    expect(s.stage.start).toHaveBeenCalledTimes(1);
    expect(s.hooks.suspend).toHaveBeenCalledTimes(1);
    expect(s.hooks.fail).toHaveBeenCalledExactlyOnceWith(error);
    expect(s.hooks.reset).not.toHaveBeenCalled();
  });

  it('resets adventure without replacing the renderer and disposes once on real exit', () => {
    const s = setup();
    s.session.start();
    s.session.restart();
    expect(s.hooks.reset).toHaveBeenCalledTimes(1);
    expect(s.stage.start).toHaveBeenCalledTimes(1);
    s.hide(false);
    s.session.dispose();
    s.session.restart();
    s.visibility(false);
    s.window.dispatchEvent(new Event('pageshow'));
    expect(s.hooks.dispose).toHaveBeenCalledTimes(1);
    expect(s.hooks.reset).toHaveBeenCalledTimes(1);
    expect(s.stage.start).toHaveBeenCalledTimes(1);
  });
});
