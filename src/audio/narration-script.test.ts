import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../config';

interface NarrationScript {
  model: string;
  voice: string;
  instructions: string;
  kokoro: {
    model: string;
    dtype: string;
    voice: string;
    speed: number;
  };
  cues: Record<string, string>;
}

const script = JSON.parse(
  readFileSync(new URL('./narration-script.json', import.meta.url), 'utf8'),
) as NarrationScript;

function cuesByBody(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(DESTINATIONS).map(([bodyId, destination]) => [
      bodyId,
      [
        `arrival-${bodyId}`,
        `find-${bodyId}`,
        ...destination.mission.discoveries.map((discovery) => `discovery-${discovery.id}`),
        `hunt-${bodyId}`,
        `success-${bodyId}`,
        ...(destination.spin ? [`spin-${bodyId}`] : []),
      ],
    ]),
  );
}

function expectedCueIds(): string[] {
  return Object.values(cuesByBody()).flat();
}

describe('narration script', () => {
  it('has one authored cue for every place the UI requests', () => {
    expect(Object.keys(script.cues).sort()).toEqual(expectedCueIds().sort());
  });

  it('has complete generation settings and no empty lines', () => {
    expect(script.model).toBeTruthy();
    expect(script.voice).toBeTruthy();
    expect(script.instructions).toBeTruthy();
    expect(script.kokoro.model).toBeTruthy();
    expect(script.kokoro.voice).toBeTruthy();
    expect(script.kokoro.speed).toBeGreaterThanOrEqual(0.5);
    expect(script.kokoro.speed).toBeLessThanOrEqual(2);
    expect(Object.values(script.cues).every((line) => line.trim().length > 0)).toBe(true);
  });

  it('welcomes before the intro and saves the target instruction for the hunt', () => {
    for (const bodyId of Object.keys(DESTINATIONS)) {
      expect(script.cues[`arrival-${bodyId}`]).not.toMatch(/\b(?:tap|target)\b/i);
      expect(script.cues[`find-${bodyId}`]).toMatch(/\btap\b.*\bgold\b|\bgold\b.*\btap\b/i);
    }
  });

  it('keeps every committed world complete, per world', () => {
    const recorded = new Set(
      readdirSync(new URL('./recordings', import.meta.url))
        .filter((name) => name.endsWith('.mp3'))
        .map((name) => name.slice(0, -'.mp3'.length)),
    );

    /*
     * The rule this used to enforce — all or none per *world* — was the right rule when a
     * world had exactly three places and showed all three. Worlds now carry more than they
     * show and a set is chosen per visit, so the unit that matters is the visit, and it is
     * enforced at runtime instead: `narrateWholeVisit` silences a set that is not fully
     * recorded, so a spoken find can never sit beside a silent one in the same hunt. That is
     * strictly stronger than a file check could be, because the file cannot know which three
     * places a given arrival will pick.
     *
     * What is still worth pinning here is the *framing* pair. The arrival welcome and the
     * find instruction are per-world and always both play, so one recorded without the other
     * is a half-narrated arrival with no runtime fallback to catch it.
     */
    for (const bodyId of Object.keys(DESTINATIONS)) {
      const framing = [`arrival-${bodyId}`, `find-${bodyId}`];
      const have = framing.filter((cue) => recorded.has(cue));
      expect(
        have.length === 0 || have.length === framing.length,
        `${bodyId} has ${have.length}/2 framing cues recorded — record both or neither`,
      ).toBe(true);
    }

    // And nothing recorded that no world asks for: a renamed or removed discovery must not
    // leave a stray MP3 the game will never play.
    const known = new Set(expectedCueIds());
    for (const name of recorded) {
      expect(known.has(name), `${name}.mp3 matches no cue any world requests`).toBe(true);
    }
  });
});
