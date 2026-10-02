import { describe, expect, it } from 'vitest';
import {
  PANEL_OPEN_GUARD_MS,
  createPanelGuard,
  isFreshClose,
  isKeyboardClick,
} from './panelGuard';

const opening = { at: 1000, press: 3 };

describe('isFreshClose', () => {
  it('ignores a close inside the guard window, even from a new press', () => {
    expect(isFreshClose(opening, 1000 + PANEL_OPEN_GUARD_MS - 1, 4, false)).toBe(false);
  });

  it('ignores a close from the press that opened the panel, however late', () => {
    expect(isFreshClose(opening, 60_000, 3, false)).toBe(false);
  });

  it('accepts a later close from a new press', () => {
    expect(isFreshClose(opening, 1000 + PANEL_OPEN_GUARD_MS, 4, false)).toBe(true);
  });

  it('lets the keyboard close at once', () => {
    expect(isFreshClose(opening, 1001, 3, true)).toBe(true);
  });

  it('never blocks a panel that has not recorded an opening', () => {
    expect(isFreshClose(null, 0, 0, false)).toBe(true);
  });
});

describe('isKeyboardClick', () => {
  it('reads a zero detail as keyboard activation', () => {
    expect(isKeyboardClick({ detail: 0 })).toBe(true);
    expect(isKeyboardClick({})).toBe(true);
    expect(isKeyboardClick({ detail: 1 })).toBe(false);
    expect(isKeyboardClick({ detail: 2 })).toBe(false);
  });
});

describe('createPanelGuard', () => {
  it('counts presses on the target and applies both rules', () => {
    const target = new EventTarget();
    let clock = 0;
    const guard = createPanelGuard(target, () => clock);
    const press = () => target.dispatchEvent(new Event('pointerdown'));

    press();
    const opened = guard.opened();
    const tap = { detail: 1 };

    // The compatibility click of the opening tap: same press, too soon.
    clock = 120;
    expect(guard.allowsClose(opened, tap)).toBe(false);
    // A double tap: new press, still too soon.
    press();
    clock = 300;
    expect(guard.allowsClose(opened, tap)).toBe(false);
    // A deliberate second press, later.
    press();
    clock = 900;
    expect(guard.allowsClose(opened, tap)).toBe(true);
    // Keyboard, straight after opening.
    const reopened = guard.opened();
    expect(guard.allowsClose(reopened, { detail: 0 })).toBe(true);

    guard.dispose();
    press();
    // Disposed: presses no longer count, so the last opening's press still matches.
    clock = 5000;
    expect(guard.allowsClose(reopened, tap)).toBe(false);
  });
});
