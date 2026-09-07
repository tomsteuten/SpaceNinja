/**
 * The idle coach: a hand that shows the gesture, on the thing the gesture applies to.
 *
 * Every instruction in this game had become a caption. "Tap the 3 gold targets!", "Swipe
 * sideways to look around Earth" — written for the audience that cannot read them, and
 * answered with narration, which helps exactly once: a cue plays, and a child who was
 * looking out of the window at that moment gets nothing, ever again.
 *
 * The gap it leaves is worst for the drag. An arrow at the edge of the screen means "look
 * over there". It does not mean "put your finger down and slide it", and the hidden third
 * discovery — the one the whole design exists to teach the camera with — has only ever been
 * signposted by an arrow and a sentence. Nobody has ever *shown* the gesture.
 *
 * So: after a while with nothing touched, a hand appears and does the thing. It escalates
 * (tap first, then drag, because a tap is the smaller ask), it never speaks, and any
 * interaction at all takes it away. It captures no input of its own — it sits above the
 * canvas with `pointer-events: none`, so the finger it is demonstrating to always reaches
 * the target underneath.
 */

/** What the coach can be showing. `null` is the normal state: the child is playing. */
export type CoachCue = { kind: 'tap'; x: number; y: number } | { kind: 'drag'; side: -1 | 1 };

/** Everything the decision needs, and nothing about the DOM. */
export interface CoachInput {
  /** Seconds since the child last did anything at all. */
  idleFor: number;
  /** A hunt is live and the camera belongs to the child. False during flights and turns. */
  huntActive: boolean;
  /** Where an unfound place is on screen, in NDC, or null when none is on the visible face. */
  target: { x: number; y: number } | null;
  /** The hunt arrow's side, set only while the one remaining place is round the back. */
  hiddenSide: -1 | 1 | null;
}

/**
 * How long a child gets to explore before the hand appears.
 *
 * Six seconds, not two. Two fires while the arrival camera is still settling and while a
 * child is doing the most valuable thing in the game — looking at a planet — which would
 * teach them that the game interrupts. Long enough to be a genuine "stuck?", short enough
 * that a stuck child is not stuck for long.
 */
export const COACH_TAP_DELAY = 6;
/**
 * And longer again before demonstrating the drag, which only ever comes up once the visible
 * places are gone. It is the harder gesture and the child has just succeeded twice, so they
 * have earned a moment to try it themselves first.
 */
export const COACH_DRAG_DELAY = 8;

/**
 * What the coach should be showing, if anything.
 *
 * Pure, and total: called every frame with the current facts and returns the whole answer,
 * so there is no coach state to get stuck on. A tap cue whenever something tappable is on
 * screen; the drag only when the arrow says the last place is round the back, which is the
 * one moment the gesture is genuinely required rather than merely available.
 */
export function coachCue(input: CoachInput): CoachCue | null {
  if (!input.huntActive) return null;
  if (input.target) {
    return input.idleFor >= COACH_TAP_DELAY
      ? { kind: 'tap', x: input.target.x, y: input.target.y }
      : null;
  }
  if (input.hiddenSide !== null) {
    return input.idleFor >= COACH_DRAG_DELAY ? { kind: 'drag', side: input.hiddenSide } : null;
  }
  return null;
}

/** True when the two cues would put the hand in a different place or mode. */
export function cueChanged(a: CoachCue | null, b: CoachCue | null): boolean {
  if (a === null || b === null) return a !== b;
  if (a.kind !== b.kind) return true;
  if (a.kind === 'tap' && b.kind === 'tap') {
    // Only a real move matters. The body is still orbiting under a held surface, so a
    // target drifts by a fraction of a pixel every frame and restarting the animation on
    // that would leave the hand permanently at frame zero, twitching in place.
    return Math.abs(a.x - b.x) > 0.02 || Math.abs(a.y - b.y) > 0.02;
  }
  return a.kind === 'drag' && b.kind === 'drag' && a.side !== b.side;
}

export interface Coach {
  /**
   * Called every frame with the current facts. Shows, moves or hides the hand as needed;
   * cheap and idempotent when nothing has changed.
   */
  update(input: CoachInput): void;
  /** Something was touched, or the world changed under us: take the hand away. */
  clear(): void;
  dispose(): void;
}

export interface CoachOptions {
  root: HTMLElement;
  /** Pixel size of the canvas the NDC coordinates belong to. */
  measure(): { left: number; top: number; width: number; height: number };
  /**
   * Reduced motion gets a *still* hand, not a faster one. The hand is the instruction, and
   * removing it entirely would take the only wordless instruction in the game away from the
   * children most likely to need it — while animating it is exactly the sort of repeating
   * motion the preference is asking to be spared. Same rule the flight and the day turn
   * follow: remove the motion, keep the thing.
   */
  reducedMotion: boolean;
}

export function createCoach(options: CoachOptions): Coach {
  const { root, measure, reducedMotion } = options;

  const hand = document.createElement('div');
  hand.className = 'coach';
  hand.setAttribute('aria-hidden', 'true');
  hand.textContent = '👆';
  hand.hidden = true;
  root.append(hand);

  let showing: CoachCue | null = null;

  function place(cue: CoachCue) {
    const rect = measure();
    if (cue.kind === 'tap') {
      hand.style.left = `${rect.left + ((cue.x + 1) / 2) * rect.width}px`;
      hand.style.top = `${rect.top + ((1 - cue.y) / 2) * rect.height}px`;
      return;
    }
    /*
     * The drag starts on the side the place is round towards and sweeps to the middle,
     * because that is the direction the finger actually goes: dragging right brings what is
     * round to the left into view, so a hand that starts at the right edge and pulls left
     * would be demonstrating the wrong way round. Matches the hunt arrow, which points at
     * the edge the child should be pulling from.
     */
    hand.style.left = `${rect.left + rect.width / 2}px`;
    hand.style.top = `${rect.top + rect.height / 2}px`;
    hand.style.setProperty('--coach-sweep', `${cue.side * Math.min(rect.width * 0.24, 130)}px`);
  }

  return {
    update(input: CoachInput) {
      const cue = coachCue(input);
      if (!cueChanged(showing, cue)) return;
      showing = cue;
      if (!cue) {
        hand.hidden = true;
        hand.classList.remove('is-tap', 'is-drag');
        return;
      }
      place(cue);
      hand.classList.toggle('is-tap', cue.kind === 'tap');
      hand.classList.toggle('is-drag', cue.kind === 'drag');
      hand.classList.toggle('is-still', reducedMotion);
      hand.hidden = false;
    },

    clear() {
      showing = null;
      hand.hidden = true;
      hand.classList.remove('is-tap', 'is-drag');
    },

    dispose() {
      hand.remove();
    },
  };
}
