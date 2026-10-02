/**
 * When a spoken nudge is due, as a pure decision.
 *
 * The map and the arrival both nag gently after a while with nothing pressed: a first, fuller
 * line, then a shorter one, then silence. The clock resets on any press; the "given" flags do
 * not, so a child is never nagged twice with the same words in one visit. Which cue at which
 * second is the whole of the decision, and — like `coachCue` and `guideOnArrival` — it is the
 * part whose failure is invisible by eye, so it lives here as a pure function with tests.
 */

/** The first nudge waits this many idle seconds; the shorter follow-up waits twice as long. */
export const NUDGE_DELAY_SECONDS = 8;
export const NUDGE_SHORT_DELAY_SECONDS = 16;

/** A cue and the idle second at which it becomes due. */
export interface NudgeStep {
  readonly at: number;
  readonly cue: string;
}

/**
 * The next nudge to speak: the earliest step that is both due (its second has passed) and not
 * yet given, or null when nothing is due. Returning the earliest ungiven due step means the
 * pair always plays in order — the full line, then, a beat later, the short one — even if the
 * idle count jumps past both thresholds in a single frame.
 */
export function dueNudge(
  idleSeconds: number,
  steps: readonly NudgeStep[],
  given: ReadonlySet<string>,
): string | null {
  for (const step of steps) {
    if (idleSeconds >= step.at && !given.has(step.cue)) return step.cue;
  }
  return null;
}

/**
 * The 8s/16s shortening pair for one place, e.g. `home-nudge-moon` then `home-nudge-short-moon`,
 * or `find-nudge` then `find-nudge-short`. The two cue ids are passed explicitly because the
 * "short" variant is spelled differently for the home cues (before the world) than for the
 * screen cues (at the end), and the caller knows the exact ids the manifest holds.
 */
export function shorteningPair(full: string, short: string): NudgeStep[] {
  return [
    { at: NUDGE_DELAY_SECONDS, cue: full },
    { at: NUDGE_SHORT_DELAY_SECONDS, cue: short },
  ];
}

/** A single nudge that follows something else (the spin invitation) after the first delay. */
export function singleNudge(cue: string): NudgeStep[] {
  return [{ at: NUDGE_DELAY_SECONDS, cue }];
}
