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
        // The Places card says each place's line as it shows its photo.
        ...(destination.places ?? []).map(place => `discovery-${place.id}`),
        ...(destination.spin ? [`spin-${bodyId}`] : []),
        ...(destination.spin?.intro ? [`spin-intro-${bodyId}`] : []),
        ...(destination.spin?.invite ? [`spin-invite-${bodyId}`] : []),
        // The home map: this world as the map's suggestion, and the two shortening nudges
        // that repeat it ("Tap the Moon", then "The Moon").
        `home-${bodyId}`,
        `home-nudge-${bodyId}`,
        `home-nudge-short-${bodyId}`,
        // A world's own toy says its line when it opens (src/ui/ui.ts openToy).
        ...(bodyId === 'moon' || bodyId === 'saturn' || bodyId === 'mars' ? [`toy-${bodyId}`] : []),
      ],
    ]),
  );
}

/** Shared map and invitation cues requested by the adventure UI. */
const SCREEN_CUES = [
  'home-first',
  'home-any',
  'fly-home',
  // The map's page arrow, when the suggested world is on another page.
  'map-arrow-nudge',
  'map-arrow-nudge-short',
  'spin-nudge',
  // Earth's hands-on day/night spot: into night, then back to morning (main.ts).
  'day-night-start',
  'day-night-night',
  'day-night-moon',
  'day-night-done',
  // The lesson toys' opening lines and captions (src/toys/moonLight.ts, sunStar.ts). Script
  // only for now (DECISIONS.md #9): they show as words and play once they have a recording.
  'toy-moonlight',
  'toy-sun',
  'moonlight-on',
  'moonlight-off',
  'sunstar-start',
  'sunstar-earth',
  'sunstar-neptune',
  'sunstar-far',
];

function expectedCueIds(): string[] {
  return [...Object.values(cuesByBody()).flat(), ...SCREEN_CUES];
}

describe('narration script', () => {
  it('ships the essential Earth activity feedback for offline, non-reading play', () => {
    const recorded = readdirSync(new URL('./recordings', import.meta.url));
    for (const cue of ['start', 'night', 'moon', 'done']) {
      expect(recorded).toContain(`day-night-${cue}.mp3`);
    }
  });
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

  it('says nothing about a hunt: nothing to find, count or collect (DECISIONS.md)', () => {
    for (const [id, line] of Object.entries(script.cues)) {
      expect(line, id).not.toMatch(/\b(?:gold|target|found|find|three places|sticker|journal)\b/i);
    }
  });

  it('invites in the child\'s register: short, and "you can" rather than "you must"', () => {
    // The design principle agreed with the owner: tell a child what they *can* do. Every
    // invitation leads with it, except the very first one on a brand-new save, and every
    // invitation and nudge stays under about eight words so it is over before it is a lecture.
    const words = (line: string) => line.trim().split(/\s+/).length;
    const invitations = Object.keys(script.cues).filter(
      (id) => /^(home-(?!first|nudge)|spin-invite-|toy-(?:moonlight|sun)$|map-arrow-nudge$)/.test(id),
    );
    expect(invitations.length).toBeGreaterThan(0);
    for (const id of invitations) {
      expect(script.cues[id], id).toMatch(/\byou can\b/i);
      expect(words(script.cues[id]!), id).toBeLessThanOrEqual(8);
    }
    expect(script.cues['home-first']).not.toMatch(/\bmust\b/i);
    for (const id of Object.keys(script.cues).filter((id) => /nudge/.test(id))) {
      expect(words(script.cues[id]!), id).toBeLessThanOrEqual(6);
    }
    // Each nudge pair shortens.
    for (const id of Object.keys(script.cues).filter((id) => /-nudge-short-|nudge-short$/.test(id))) {
      const full = id.replace('-short', '');
      expect(words(script.cues[id]!), `${id} shorter than ${full}`).toBeLessThan(words(script.cues[full]!));
    }
  });

  it('rejects orphan recordings', () => {
    const recorded = new Set(
      readdirSync(new URL('./recordings', import.meta.url))
        .filter((name) => name.endsWith('.mp3'))
        .map((name) => name.slice(0, -'.mp3'.length)),
    );

    // Runtime playback is per available cue: a missing recording does not silence a visit or
    // start device speech by itself, so nothing here requires every cue to be recorded.
    // And nothing recorded that no world asks for: a renamed or removed discovery must not
    // leave a stray MP3 the game will never play.
    const known = new Set(expectedCueIds());
    for (const name of recorded) {
      expect(known.has(name), `${name}.mp3 matches no cue any world requests`).toBe(true);
    }
  });
});
