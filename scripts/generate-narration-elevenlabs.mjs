/**
 * Generate the shipped narration pack with one ElevenLabs voice, chosen by the owner by ear.
 *
 * This is the shipped path: `npm run narration:generate` points here. It is a plain `fetch`
 * against the ElevenLabs text-to-speech API, so it needs no dependency — only the key in the
 * environment. On a laptop, run it with Node reading a local .env:
 *
 *   node --env-file=.env scripts/generate-narration-elevenlabs.mjs [--force] [--only=<cue>]
 *
 * The key is read only from process.env.ELEVENLABS_API_KEY and is never printed or written.
 *
 * A text-hash cache at src/audio/recordings/manifest.json records, per cue, the SHA-256 of
 * voiceId + model + JSON(voiceSettings) + text. A cue is regenerated only when its MP3 is
 * missing or its hash has changed, so re-running is cheap and credits are spent only on real
 * changes. --force regenerates everything; --only=<cue> regenerates one cue.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(root, 'src/audio/narration-script.json');
const outputDirectory = join(root, 'src/audio/recordings');
const cachePath = join(outputDirectory, 'manifest.json');

const force = process.argv.includes('--force');
const onlyArgument = process.argv.find((argument) => argument.startsWith('--only='));
const only = onlyArgument?.slice('--only='.length) || null;

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  throw new Error(
    'Set ELEVENLABS_API_KEY before generating narration (e.g. node --env-file=.env). ' +
      'The key is never stored.',
  );
}

const definition = JSON.parse(await readFile(scriptPath, 'utf8'));
const elevenlabs = definition.elevenlabs;
if (!elevenlabs?.voiceId || !elevenlabs?.model || !elevenlabs?.voiceSettings) {
  throw new Error(
    'narration-script.json is missing a complete "elevenlabs" block ' +
      '{ voiceId, voiceName, model, outputFormat, voiceSettings }.',
  );
}
const { voiceId, voiceName, model, voiceSettings } = elevenlabs;
const outputFormat = elevenlabs.outputFormat || 'mp3_44100_64';

if (only && !(only in definition.cues)) {
  throw new Error(`--only=${only} is not a cue in narration-script.json.`);
}

/** The identity of a rendered cue: any change here means the audio must be remade. */
function cueHash(text) {
  return createHash('sha256')
    .update(voiceId + model + JSON.stringify(voiceSettings) + text)
    .digest('hex');
}

async function loadCache() {
  try {
    const parsed = JSON.parse(await readFile(cachePath, 'utf8'));
    return parsed?.cues && typeof parsed.cues === 'object' ? parsed.cues : {};
  } catch {
    return {};
  }
}

/** Write to a temp name and rename, so an interrupted run never leaves a half file. */
async function writeAtomic(path, data) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, data);
  await rename(temporary, path);
}

async function synthesize(cueId, text) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: model, voice_settings: voiceSettings }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Narration generation failed for ${cueId}: ${response.status} ${await response.text()}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

await mkdir(outputDirectory, { recursive: true });
const cache = await loadCache();

const entries = Object.entries(definition.cues).filter(([cueId]) => !only || cueId === only);
let wrote = 0;
let kept = 0;
let charactersSent = 0;

for (const [cueId, text] of entries) {
  const output = join(outputDirectory, `${cueId}.mp3`);
  const hash = cueHash(text);
  const current = existsSync(output) && cache[cueId] === hash;
  if (!force && current) {
    process.stdout.write(`kept  ${cueId}\n`);
    kept++;
    continue;
  }

  const audio = await synthesize(cueId, text);
  await writeAtomic(output, audio);
  cache[cueId] = hash;
  charactersSent += text.length;
  wrote++;
  process.stdout.write(`wrote ${cueId}.mp3\n`);
}

// The cache and disclosure describe the whole pack, so refresh them whenever anything was
// remade (or on a --force run that rewrote everything).
if (wrote > 0) {
  await writeAtomic(
    cachePath,
    JSON.stringify(
      {
        note:
          'Text-hash cache for the ElevenLabs narration pack. Each value is the SHA-256 of ' +
          'voiceId + model + JSON(voiceSettings) + text. The generator remakes a cue only when ' +
          'its MP3 is missing or this hash changes; delete a value (or pass --force) to remake it.',
        voiceId,
        model,
        cues: Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b))),
      },
      null,
      2,
    ) + '\n',
  );

  await writeAtomic(
    join(outputDirectory, 'provenance.json'),
    JSON.stringify(
      {
        kind: 'ai',
        provider: 'ElevenLabs',
        voice: voiceName ?? voiceId,
        voiceId,
        model,
        disclosure: `The included narration uses the ElevenLabs AI voice ${voiceName ?? voiceId}.`,
      },
      null,
      2,
    ) + '\n',
  );
}

process.stdout.write(
  `Done: wrote ${wrote}, kept ${kept}. ${charactersSent} characters sent to ElevenLabs ` +
    `(${voiceName ?? voiceId}, ${model}). Listen on the real target device before release.\n`,
);
