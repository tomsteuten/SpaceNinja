import { describe, expect, it } from 'vitest';

import {
  COACH_DRAG_DELAY,
  COACH_TAP_DELAY,
  SPIN_INVITE_DELAY,
  coachCue,
  cueChanged,
  shouldInviteSpin,
} from './coach';

const hunting = { huntActive: true, target: null, hiddenSide: null } as const;

describe('coachCue', () => {
  it('says nothing while the child is playing', () => {
    expect(coachCue({ ...hunting, idleFor: 0, target: { x: 0.1, y: 0.2 } })).toBeNull();
  });

  it('waits out the full delay before a tap cue, not a moment less', () => {
    const target = { x: 0.1, y: 0.2 };
    expect(coachCue({ ...hunting, idleFor: COACH_TAP_DELAY - 0.01, target })).toBeNull();
    expect(coachCue({ ...hunting, idleFor: COACH_TAP_DELAY, target })).toEqual({
      kind: 'tap',
      x: 0.1,
      y: 0.2,
    });
  });

  it('never coaches outside a live hunt', () => {
    // The camera belongs to a flight, a day turn or the pull-back. A hand demonstrating a
    // tap over a moving camera is pointing at where a target used to be.
    expect(
      coachCue({ idleFor: 60, huntActive: false, target: { x: 0, y: 0 }, hiddenSide: 1 }),
    ).toBeNull();
  });

  it('demonstrates the drag only once nothing is left to tap, and waits longer for it', () => {
    const hidden = { ...hunting, hiddenSide: 1 as const };
    expect(coachCue({ ...hidden, idleFor: COACH_TAP_DELAY })).toBeNull();
    expect(coachCue({ ...hidden, idleFor: COACH_DRAG_DELAY - 0.01 })).toBeNull();
    expect(coachCue({ ...hidden, idleFor: COACH_DRAG_DELAY })).toEqual({ kind: 'drag', side: 1 });
  });

  it('prefers the tap while anything is still tappable', () => {
    // Both facts can be true at once: the arrow appears when one place is left, and that
    // place can swing into view while the child sits still. A tap is the smaller ask.
    expect(
      coachCue({
        idleFor: 60,
        huntActive: true,
        target: { x: -0.4, y: 0.1 },
        hiddenSide: -1,
      }),
    ).toEqual({ kind: 'tap', x: -0.4, y: 0.1 });
  });

  it('carries the drag side through, so the hand sweeps the way the arrow points', () => {
    expect(coachCue({ ...hunting, idleFor: 60, hiddenSide: -1 })).toEqual({
      kind: 'drag',
      side: -1,
    });
  });

  it('stays silent when there is neither a target nor a hidden one', () => {
    expect(coachCue({ ...hunting, idleFor: 600 })).toBeNull();
  });
});

describe('cueChanged', () => {
  it('ignores the drift of a target on an orbiting body', () => {
    // The body keeps orbiting under a held surface, so a target moves a fraction every
    // frame. Restarting the animation on that would pin the hand at frame zero forever.
    const a = { kind: 'tap', x: 0.2, y: 0.3 } as const;
    expect(cueChanged(a, { kind: 'tap', x: 0.205, y: 0.303 })).toBe(false);
  });

  it('notices a real move', () => {
    const a = { kind: 'tap', x: 0.2, y: 0.3 } as const;
    expect(cueChanged(a, { kind: 'tap', x: 0.6, y: 0.3 })).toBe(true);
  });

  it('notices appearing, vanishing and changing mode', () => {
    const tap = { kind: 'tap', x: 0, y: 0 } as const;
    const drag = { kind: 'drag', side: 1 } as const;
    expect(cueChanged(null, tap)).toBe(true);
    expect(cueChanged(tap, null)).toBe(true);
    expect(cueChanged(tap, drag)).toBe(true);
    expect(cueChanged(null, null)).toBe(false);
  });

  it('notices the drag turning round', () => {
    expect(cueChanged({ kind: 'drag', side: 1 }, { kind: 'drag', side: -1 })).toBe(true);
    expect(cueChanged({ kind: 'drag', side: 1 }, { kind: 'drag', side: 1 })).toBe(false);
  });
});

describe('shouldInviteSpin', () => {
  const done = { huntComplete: true, spinOffered: true, spinBusy: false };

  it('waits out its own delay, which is longer than either coach cue', () => {
    expect(shouldInviteSpin({ ...done, idleFor: SPIN_INVITE_DELAY - 0.01 })).toBe(false);
    expect(shouldInviteSpin({ ...done, idleFor: SPIN_INVITE_DELAY })).toBe(true);
    expect(SPIN_INVITE_DELAY).toBeGreaterThan(COACH_DRAG_DELAY);
  });

  it('never competes with an unfinished hunt', () => {
    // Finding places is the thing; a button asking to be pressed over the top of it would
    // be the game interrupting its own instruction.
    expect(shouldInviteSpin({ ...done, huntComplete: false, idleFor: 600 })).toBe(false);
  });

  it('stays quiet on a world with no day turn to offer', () => {
    expect(shouldInviteSpin({ ...done, spinOffered: false, idleFor: 600 })).toBe(false);
  });

  it('stays quiet while the turn it asks for is already running', () => {
    expect(shouldInviteSpin({ ...done, spinBusy: true, idleFor: 600 })).toBe(false);
  });
});
