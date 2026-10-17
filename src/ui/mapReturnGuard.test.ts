import { describe, expect, it } from 'vitest';
import { createMapReturnGuard, MAP_RETURN_REPEAT_MS } from './mapReturnGuard';

function setup() {
  let time = 0;
  const target = new EventTarget();
  const guard = createMapReturnGuard(target, () => time);
  const dispatch = (type: string, values = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX: 60, clientY: 400, pointerId: 1, detail: 1 }, values);
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  guard.arm({ left: 20, right: 100, top: 370, bottom: 440 }, { detail: 1 });
  return { guard, dispatch, at: (value: number) => { time = value; } };
}

describe('map return input', () => {
  it('blocks the duplicate press, release and compatibility click of a quick double tap', () => {
    const s = setup();
    s.at(150);
    expect(s.dispatch('pointerdown')).toBe(true);
    expect(s.dispatch('pointerup')).toBe(true);
    expect(s.dispatch('click')).toBe(true);
    expect(s.guard.active).toBe(true);
  });

  it('catches a roughly one-second repeat, and each rejected press extends the window', () => {
    const s = setup();
    s.at(1000);
    expect(s.dispatch('pointerdown')).toBe(true);
    expect(s.dispatch('click')).toBe(true);
    s.at(1000 + MAP_RETURN_REPEAT_MS - 1);
    expect(s.dispatch('pointerdown')).toBe(true);
  });

  it('lets a deliberate tap through once the child has paused, however long the return took', () => {
    const s = setup();
    s.at(MAP_RETURN_REPEAT_MS);
    expect(s.guard.active).toBe(false);
    expect(s.dispatch('pointerdown')).toBe(false);
    expect(s.dispatch('click')).toBe(false);
    // A slow animated return: the map arrives late, and the first tap on it is a choice.
    const slow = setup();
    slow.at(3000);
    expect(slow.dispatch('pointerdown')).toBe(false);
    expect(slow.dispatch('click')).toBe(false);
  });

  it('allows an immediately chosen different location and keyboard activation', () => {
    const s = setup();
    expect(s.dispatch('pointerdown', { clientX: 200 })).toBe(false);
    expect(s.dispatch('click')).toBe(false);
    // Choosing elsewhere ends the protection: the next tap over the footprint is deliberate.
    expect(s.guard.active).toBe(false);
    expect(s.dispatch('pointerdown')).toBe(false);
    const keyboard = setup();
    expect(keyboard.dispatch('click', { detail: 0 })).toBe(false);
    expect(keyboard.dispatch('click')).toBe(false);
  });

  it('does not arm a keyboard return and releases listeners on dispose', () => {
    const s = setup();
    s.guard.arm({ left: 20, right: 100, top: 370, bottom: 440 }, { detail: 0 });
    expect(s.guard.active).toBe(false);
    expect(s.dispatch('click')).toBe(false);
    const disposed = setup(); disposed.guard.dispose();
    expect(disposed.dispatch('pointerdown')).toBe(false);
  });

  it('blocks the release of an already rejected press even after the window ends', () => {
    const s = setup(); s.at(1000);
    expect(s.dispatch('pointerdown')).toBe(true);
    s.at(5000); expect(s.dispatch('pointerup')).toBe(true);
    expect(s.dispatch('click')).toBe(true);
  });
});
