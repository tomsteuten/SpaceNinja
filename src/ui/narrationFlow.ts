/**
 * When authored narration starts, waits, or is dropped.
 *
 * These rules lived inline in `ui.ts`, tangled in DOM wiring, which is where the one real
 * bug hid: on a Fly Home the queued hunt line leaked into the fresh home view because the
 * "narration ended" listener could not tell a genuine end from a `stop()` during reset.
 * Pulling the decisions out as pure functions is the same move already made for `dragAngle`
 * and the photo-viewer guard — the parts whose failure is invisible by eye get a test.
 *
 * Three facts drive everything: whether the cue has a bundled recording (only those start
 * by themselves — the platform fallback never does), whether the parent has left sound on,
 * and whether a reading is already in progress (a hunt line must wait behind the discovery
 * the child just earned rather than talk over it).
 */

/** A guide line — the hunt cue — held until the discovery narration finishes. */
export interface PendingGuide {
  readonly text: string;
  readonly cueId: string;
}

/**
 * Whether a fact should read itself the moment it appears.
 *
 * Authored audio is the primary telling and starts on its own; the device voice is the top
 * playtest complaint and never does, which is enforced by only ever passing a cue that
 * `hasRecording`. Sound off silences both.
 */
export function shouldAutoNarrate(hasRecording: boolean, soundOn: boolean): boolean {
  return hasRecording && soundOn;
}

/** Visible state for the labelled transcript control on an audio-first fact card. */
export function transcriptControlState(wordsVisible: boolean): {
  readonly label: string;
  readonly expanded: 'true' | 'false';
} {
  return wordsVisible
    ? { label: 'Hide words', expanded: 'true' }
    : { label: 'Show words', expanded: 'false' };
}

/**
 * Whether this visit's discoveries narrate themselves.
 *
 * All or none, across the whole set — never some. Worlds now carry more places than they
 * show and a set is chosen per visit, so a partly recorded world could otherwise put a
 * spoken find and a silent one side by side in the same hunt: the child learns the game
 * reads to them, and then it stops, which is worse than it never having started. A visit is
 * either narrated or read.
 *
 * That is also what keeps a partial pack shippable, which the design has always required — a
 * newly added place with no recording yet costs its *visit* the audio, not the world and not
 * the game. The speaker button still works either way, and a visit that does not auto-narrate
 * shows its words instead of hiding them behind "Show words".
 */
export function narrateWholeVisit(hasRecordings: readonly boolean[]): boolean {
  return hasRecordings.length > 0 && hasRecordings.every(Boolean);
}

/** What a guide cue does the instant it arrives. */
export type GuideArrival = 'speak' | 'queue' | 'ignore';

/**
 * `ignore` without an authored recording or with sound off — the visual hand and arrow are
 * the instruction then. `queue` while a discovery is still being read, so the reward is not
 * interrupted; `speak` when nothing is talking.
 */
export function guideOnArrival(opts: {
  hasRecording: boolean;
  soundOn: boolean;
  speaking: boolean;
}): GuideArrival {
  if (!opts.hasRecording || !opts.soundOn) return 'ignore';
  return opts.speaking ? 'queue' : 'speak';
}

/** What happens the moment a reading stops. */
export type NarrationEnd =
  | { readonly kind: 'speak-guide'; readonly guide: PendingGuide }
  | { readonly kind: 'collapse' };

/**
 * A queued guide plays only if sound is still on; otherwise — no guide, or the parent
 * turned sound off while the discovery was reading — the card just folds away. A `stop()`
 * from Fly Home reaches here too, which is why the caller clears the guide before calling
 * `stop()`: by the time this runs during a reset there is nothing left to play.
 */
export function narrationOnEnd(pendingGuide: PendingGuide | null, soundOn: boolean): NarrationEnd {
  if (pendingGuide && soundOn) return { kind: 'speak-guide', guide: pendingGuide };
  return { kind: 'collapse' };
}
