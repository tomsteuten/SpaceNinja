/**
 * The two pieces of the narration that are decidable without a voice.
 *
 * Which voice gets chosen and how the words come out are the whole of the complaint about
 * this feature, and neither can be *heard* from here — the machine this is written on
 * reports the SpeechSynthesis API present and zero voices installed. So the ranking and
 * the text cleanup are pulled out as pure functions and pinned, and the part that
 * genuinely needs a real device is answered by `?voices` instead of by guessing.
 */

import { describe, expect, it } from 'vitest';
import { pickVoice, speechText } from './narration';

/** Enough of a SpeechSynthesisVoice for the ranking, which reads four fields. */
function voice(
  name: string,
  lang: string,
  extra: { default?: boolean; localService?: boolean } = {},
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    default: extra.default ?? false,
    localService: extra.localService ?? true,
    voiceURI: name,
  } as SpeechSynthesisVoice;
}

describe('pickVoice', () => {
  it('returns null when there is nothing to pick', () => {
    expect(pickVoice([])).toBeNull();
  });

  it('prefers a natural voice over a plain one', () => {
    const voices = [voice('Microsoft David', 'en-US'), voice('Microsoft Ryan Natural', 'en-GB')];
    expect(pickVoice(voices)?.name).toBe('Microsoft Ryan Natural');
  });

  /*
   * The bug this replaces. The old rule took the first voice matching any of a set of
   * patterns, in whatever order the platform listed them — so a device carrying both a
   * good voice and a poor one was a coin toss, decided by enumeration order. Ranking is
   * the whole point: put the poor one first and the good one still has to win.
   */
  it('is not decided by the order the platform happens to list them', () => {
    const good = voice('Google UK English Female', 'en-GB');
    const poor = voice('Google Bangla', 'en-IN');
    expect(pickVoice([poor, good])?.name).toBe(good.name);
    expect(pickVoice([good, poor])?.name).toBe(good.name);
  });

  it('never picks a non-English voice while an English one exists', () => {
    const voices = [voice('Anna Natural', 'de-DE', { default: true }), voice('Daniel', 'en-GB')];
    expect(pickVoice(voices)?.name).toBe('Daniel');
  });

  it('falls back to something rather than nothing when no English exists at all', () => {
    // Silence would be the wrong answer: the button is on screen and has to do something.
    const voices = [voice('Anna', 'de-DE'), voice('Yuki', 'ja-JP')];
    expect(pickVoice(voices)).not.toBeNull();
  });

  it('prefers the device’s own English over another country’s', () => {
    const voices = [voice('Samantha', 'en-US'), voice('Moira', 'en-IE')];
    expect(pickVoice(voices, 'en-IE')?.name).toBe('Moira');
    expect(pickVoice(voices, 'en-US')?.name).toBe('Samantha');
  });

  it('tolerates the underscore form some platforms report', () => {
    expect(pickVoice([voice('Karen', 'en_AU')])?.name).toBe('Karen');
  });
});

describe('speechText', () => {
  it('splits a fact into one utterance per sentence', () => {
    // A weak engine given one long run delivers it as one long run. Letting it stop for
    // breath is the single biggest gain in being understood, and it costs nothing.
    expect(
      speechText('The Moon has no air. Nothing moves here. It is very quiet.'),
    ).toEqual(['The Moon has no air.', 'Nothing moves here.', 'It is very quiet.']);
  });

  it('replaces em and en dashes rather than reading them', () => {
    // Engines either announce the character or run straight through the pause it stands
    // for. The dash stays in the text on screen, where it reads correctly.
    const [only] = speechText('Mars is full of rust — the same rust as an old bike');
    expect(only).toBe('Mars is full of rust, the same rust as an old bike');
  });

  it('keeps exclamations and questions as their own sentences', () => {
    expect(speechText('You found them all! What an explorer.')).toHaveLength(2);
  });

  it('does not split on a decimal point', () => {
    expect(speechText('It is 3.5 times as wide.')).toHaveLength(1);
  });

  it('collapses the line breaks that come from wrapped source strings', () => {
    expect(speechText('one   two\nthree')).toEqual(['one two three']);
  });

  it('returns nothing for nothing, so the caller can skip speaking entirely', () => {
    expect(speechText('   ')).toEqual([]);
    expect(speechText('')).toEqual([]);
  });
});
