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
import { pickVoice, rankVoices, recordingCueId, speechText } from './narration';

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

  /*
   * A voice the device fetches rather than one it ships. On Android and desktop Chrome
   * these are the neural ones, and they are not marginally better than the local
   * fallbacks — the local ones are where the complaint about this feature comes from.
   */
  it('prefers a network voice over an equally-named local one', () => {
    const voices = [
      voice('English United Kingdom', 'en-GB'),
      voice('English United Kingdom', 'en-GB', { localService: false }),
    ];
    expect(pickVoice(voices)?.localService).toBe(false);
  });

  it('does not let a network voice outrank a genuinely good local one', () => {
    // The reverse case, which is iOS: every voice there is local, and the Siri ones are
    // the good ones. Weighting the network flag above the name rank would bury them.
    const voices = [
      voice('English United Kingdom', 'en-GB', { localService: false }),
      voice('Samantha', 'en-GB'),
    ];
    expect(pickVoice(voices)?.name).toBe('Samantha');
  });
});

describe('recordingCueId', () => {
  it('derives the stable cue from a Vite glob path', () => {
    expect(recordingCueId('./recordings/arrival-earth.mp3')).toBe('arrival-earth');
    expect(recordingCueId('./recordings/discovery-moon-tycho.MP3')).toBe(
      'discovery-moon-tycho',
    );
  });

  it('ignores files that are not MP3 narration', () => {
    expect(recordingCueId('./recordings/README.md')).toBeNull();
  });
});

describe('a voice someone actually chose', () => {
  /*
   * The whole point of the ?voices page. Ranking voices by their *names* is guessing at a
   * quality that cannot be observed from the machine this is written on; a parent holding
   * the tablet can just listen, and their answer must not be second-guessed.
   */
  it('wins outright over the ranking', () => {
    const good = voice('Google UK English Female', 'en-GB');
    const plain = voice('Albert', 'en-US');
    expect(pickVoice([good, plain], 'en-GB', plain.voiceURI)?.name).toBe('Albert');
  });

  it('falls back to the ranking when that voice is gone', () => {
    // Uninstalling a voice, or opening the game on another device with the same profile.
    // Going silent over a stale preference would be the worst of both.
    const good = voice('Google UK English Female', 'en-GB');
    expect(pickVoice([good], 'en-GB', 'a-voice-that-left')?.name).toBe(good.name);
  });

  it('is ignored when it is empty rather than treated as a choice', () => {
    const good = voice('Google UK English Female', 'en-GB');
    expect(pickVoice([good], 'en-GB', '')?.name).toBe(good.name);
    expect(pickVoice([good], 'en-GB', null)?.name).toBe(good.name);
  });
});

describe('rankVoices', () => {
  it('lists every voice, best first', () => {
    const voices = [
      voice('Albert', 'en-US'),
      voice('Google UK English Female', 'en-GB'),
      voice('Anna', 'de-DE'),
    ];
    const ranked = rankVoices(voices, 'en-GB');
    expect(ranked).toHaveLength(3);
    expect(ranked[0]?.name).toBe('Google UK English Female');
    // Nothing is hidden: a parent choosing by ear may want the one the ranking dislikes.
    expect(ranked.at(-1)?.name).toBe('Anna');
  });

  it('keeps the platform’s order between voices it cannot separate', () => {
    // Otherwise the picker's rows reshuffle between renders, and the row a parent is
    // reaching for moves out from under their finger.
    const first = voice('Voice One', 'en-GB');
    const second = voice('Voice Two', 'en-GB');
    expect(rankVoices([first, second], 'en-GB').map((v) => v.name)).toEqual([
      'Voice One',
      'Voice Two',
    ]);
  });

  it('leaves the caller’s array alone', () => {
    const voices = [voice('Albert', 'en-US'), voice('Samantha', 'en-GB')];
    rankVoices(voices, 'en-GB');
    expect(voices[0]?.name).toBe('Albert');
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
