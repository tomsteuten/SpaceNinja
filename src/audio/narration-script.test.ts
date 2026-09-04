import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../config';

interface NarrationScript {
  model: string;
  voice: string;
  instructions: string;
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
    expect(Object.values(script.cues).every((line) => line.trim().length > 0)).toBe(true);
  });
});
