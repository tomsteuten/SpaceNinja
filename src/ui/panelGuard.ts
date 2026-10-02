/**
 * A fast second tap must not close what the first tap opened.
 *
 * Seen on the tablet, one child, one session: the journal, the About words and the photo
 * are each a toggle of one kind or another, and a five-year-old's tap is very often a
 * double tap. The first opened the panel and the second — landing on the Close button that
 * had just appeared under the finger, or on the About button itself — put it straight away
 * again. To the child, the button did nothing.
 *
 * Two rules, and a close has to pass both unless it came from the keyboard:
 *
 *  - Nothing closes within `PANEL_OPEN_GUARD_MS` of opening. A deliberate second press to
 *    close is always slower than that; a double tap never is.
 *  - Nothing closes from the pointer sequence that opened it. Every pointerdown anywhere
 *    advances a counter, a panel remembers the count it opened on, and a close is honoured
 *    only once a *new* press has begun. That is what keeps the trailing compatibility click
 *    Android delivers after a tap (see photos.ts) from closing the thing the tap opened.
 *
 * Keyboard activation (a click whose `detail` is 0) skips both: Enter and Escape are never
 * a double tap, and someone who opens and closes quickly from a keyboard meant it.
 *
 * The decision is pure and tested; the DOM wrapper only counts presses.
 */

export const PANEL_OPEN_GUARD_MS = 500;

export interface PanelOpening {
  /** When the panel opened, on the same clock `now` is read from. */
  at: number;
  /** How many presses had begun anywhere when it opened. */
  press: number;
}

/** True when a close is a fresh, deliberate gesture rather than the tail of the opening tap. */
export function isFreshClose(
  opening: PanelOpening | null,
  now: number,
  press: number,
  keyboard: boolean,
  guardMs = PANEL_OPEN_GUARD_MS,
): boolean {
  if (!opening || keyboard) return true;
  if (now - opening.at < guardMs) return false;
  return press !== opening.press;
}

/** A click with no press behind it: Enter or Space on a focused button, or a synthetic one. */
export function isKeyboardClick(event: { detail?: number }): boolean {
  return !event.detail;
}

export interface PanelGuard {
  /** Call as a panel opens; keep the result to ask about closes. */
  opened(): PanelOpening;
  /** Whether this click may close the panel that `opening` describes. */
  allowsClose(opening: PanelOpening | null, event: { detail?: number }): boolean;
  dispose(): void;
}

export function createPanelGuard(
  target: EventTarget,
  now: () => number = () => performance.now(),
): PanelGuard {
  let presses = 0;
  const count = () => {
    presses += 1;
  };
  // Capture phase, on the window: the press that opens a panel can land on the canvas (a
  // gold place whose postcard opens itself) as easily as on a button inside the interface.
  target.addEventListener('pointerdown', count, { capture: true });
  return {
    opened: () => ({ at: now(), press: presses }),
    allowsClose: (opening, event) => isFreshClose(opening, now(), presses, isKeyboardClick(event)),
    dispose: () => target.removeEventListener('pointerdown', count, { capture: true }),
  };
}
