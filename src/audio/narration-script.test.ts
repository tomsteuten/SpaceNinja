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

function expectedCueIds(): string[] {
  return Object.entries(DESTINATIONS).flatMap(([bodyId, destination]) => [
    `arrival-${bodyId}`,
    ...destination.mission.discoveries.map((discovery) => `discovery-${discovery.id}`),
    `hunt-${bodyId}`,
    `success-${bodyId}`,
    ...(destination.spin ? [`spin-${bodyId}`] : []),
  ]);
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

  it('keeps any committed voice pack complete', () => {
    const recordingNames = readdirSync(new URL('./recordings', import.meta.url))
      .filter((name) => name.endsWith('.mp3'))
      .map((name) => name.slice(0, -'.mp3'.length))
      .sort();
    // An empty pack is a valid development state because the device voice remains an
    // explicit fallback. Once even one generated cue is committed, however, shipping a
    // half-updated script would give a child inconsistent guidance between discoveries.
    if (recordingNames.length > 0) {
      expect(recordingNames).toEqual(expectedCueIds().sort());
    }
  });
});
