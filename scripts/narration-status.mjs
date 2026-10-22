/**
 * Which voice each narration cue currently has: ElevenLabs (in manifest.json with a matching
 * hash), Kokoro (a provenance.json exception), or none (no MP3). Spends nothing and needs no key.
 *
 *   npm run narration:status
 *
 * Everything not "ElevenLabs" is what a plain `npm run narration:generate` would (re)record.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recordings = join(root, 'src/audio/recordings');
const script = JSON.parse(readFileSync(join(root, 'src/audio/narration-script.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(recordings, 'manifest.json'), 'utf8')).cues ?? {};
const exceptions = JSON.parse(readFileSync(join(recordings, 'provenance.json'), 'utf8')).exceptions ?? {};
const { voiceId, model, voiceSettings } = script.elevenlabs;
const hash = (text) => createHash('sha256').update(voiceId + model + JSON.stringify(voiceSettings) + text).digest('hex');

const groups = { elevenlabs: [], kokoro: [], stale: [], missing: [] };
for (const [cue, text] of Object.entries(script.cues)) {
  if (!existsSync(join(recordings, `${cue}.mp3`))) groups.missing.push(cue);
  else if (exceptions[cue]) groups.kokoro.push(cue);
  else if (manifest[cue] === hash(text)) groups.elevenlabs.push(cue);
  else groups.stale.push(cue);
}

const total = Object.keys(script.cues).length;
const toRecord = [...groups.kokoro, ...groups.stale, ...groups.missing];
process.stdout.write(`${total} cues: ${groups.elevenlabs.length} ElevenLabs, ${groups.kokoro.length} Kokoro, ` +
  `${groups.stale.length} ElevenLabs but text changed since, ${groups.missing.length} with no recording.\n`);
for (const [label, list] of [['Kokoro', groups.kokoro], ['Text changed', groups.stale], ['No recording', groups.missing]]) {
  if (list.length) process.stdout.write(`\n${label}:\n${list.map((cue) => `  ${cue}: ${script.cues[cue]}`).join('\n')}\n`);
}
const characters = toRecord.reduce((sum, cue) => sum + script.cues[cue].length, 0);
process.stdout.write(`\nA plain \`npm run narration:generate\` would record ${toRecord.length} cues (${characters} characters).\n`);
