import { describe, expect, it } from 'vitest';
import {
  guideOnArrival,
  narrateWholeVisit,
  narrationOnEnd,
  shouldAutoNarrate,
  transcriptControlState,
  type PendingGuide,
} from './narrationFlow';

describe('shouldAutoNarrate', () => {
  it('starts a fact only when it has authored audio and sound is on', () => {
    expect(shouldAutoNarrate(true, true)).toBe(true);
  });

  it('never starts the platform fallback by itself', () => {
    // A cue with no recording is exactly the case where hasRecording is false.
    expect(shouldAutoNarrate(false, true)).toBe(false);
  });

  it('stays silent when the parent has turned sound off', () => {
    expect(shouldAutoNarrate(true, false)).toBe(false);
  });
});

describe('transcriptControlState', () => {
  it('names the action and exposes the paragraph state to assistive technology', () => {
    expect(transcriptControlState(false)).toEqual({
      label: 'Show words',
      expanded: 'false',
    });
    expect(transcriptControlState(true)).toEqual({
      label: 'Hide words',
      expanded: 'true',
    });
  });
});

describe('guideOnArrival', () => {
  it('queues behind a discovery still being read rather than interrupting the reward', () => {
    expect(guideOnArrival({ hasRecording: true, soundOn: true, speaking: true })).toBe('queue');
  });

  it('speaks straight away when nothing is talking', () => {
    expect(guideOnArrival({ hasRecording: true, soundOn: true, speaking: false })).toBe('speak');
  });

  it('leaves the hand and arrow to instruct when there is no recording', () => {
    expect(guideOnArrival({ hasRecording: false, soundOn: true, speaking: true })).toBe('ignore');
    expect(guideOnArrival({ hasRecording: false, soundOn: true, speaking: false })).toBe('ignore');
  });

  it('says nothing with sound off, queued or not', () => {
    expect(guideOnArrival({ hasRecording: true, soundOn: false, speaking: true })).toBe('ignore');
    expect(guideOnArrival({ hasRecording: true, soundOn: false, speaking: false })).toBe('ignore');
  });
});

describe('narrationOnEnd', () => {
  const guide: PendingGuide = { text: 'One more is hiding.', cueId: 'hunt-earth' };

  it('plays a queued guide once the discovery has finished', () => {
    expect(narrationOnEnd(guide, true)).toEqual({ kind: 'speak-guide', guide });
  });

  it('just folds away when nothing was queued', () => {
    expect(narrationOnEnd(null, true)).toEqual({ kind: 'collapse' });
  });

  it('drops a queued guide if sound went off while the discovery was reading', () => {
    // Turning sound off mid-discovery must not leave the hunt line to fire afterwards.
    expect(narrationOnEnd(guide, false)).toEqual({ kind: 'collapse' });
  });
});

describe('narrateWholeVisit', () => {
  it('narrates a set that is fully recorded', () => {
    expect(narrateWholeVisit([true, true, true])).toBe(true);
  });

  it('silences a set where even one place has no recording', () => {
    // The case this exists for. A world carries more places than it shows, so a partly
    // recorded world can hand a visit two spoken finds and one silent one — which teaches a
    // child the game reads to them and then stops. Worse than never having started.
    expect(narrateWholeVisit([true, true, false])).toBe(false);
    expect(narrateWholeVisit([false, true, true])).toBe(false);
  });

  it('silences a set with nothing recorded, rather than treating empty as unanimous', () => {
    expect(narrateWholeVisit([])).toBe(false);
    expect(narrateWholeVisit([false, false, false])).toBe(false);
  });
});
