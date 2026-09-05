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

  it('keeps every committed world complete, per world', () => {
    const recorded = new Set(
      readdirSync(new URL('./recordings', import.meta.url))
        .filter((name) => name.endsWith('.mp3'))
        .map((name) => name.slice(0, -'.mp3'.length)),
    );

    // Per world, not per game. narration.ts is built for a partial pack — a world with no
    // audio simply keeps the visual guidance and never auto-plays the poor device voice — so
    // a newly added world pending its recordings is a valid state. What must not happen is a
    // *half*-recorded world, where one discovery in a visit speaks and the next does not.
    for (const [bodyId, cues] of Object.entries(cuesByBody())) {
      const have = cues.filter((cue) => recorded.has(cue));
      expect(
        have.length === 0 || have.length === cues.length,
        `${bodyId} has ${have.length}/${cues.length} cues recorded — record all or none`,
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
