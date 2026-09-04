/**
 * Generate the complete offline narration pack with the Apache-2.0 Kokoro model.
 *
 * No account or API key is involved. The model downloads once into a task-specific
 * temporary cache, then inference is local. ffmpeg is used only to turn Kokoro's large
 * WAV output into consistently loud, phone-friendly MP3s.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { env } from '@huggingface/transformers';
import { KokoroTTS } from 'kokoro-js';

const run = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(root, 'src/audio/narration-script.json');
const outputDirectory = join(root, 'src/audio/recordings');
const definition = JSON.parse(await readFile(scriptPath, 'utf8'));
const force = process.argv.includes('--force');
const requestedVoice = process.argv.find((argument) => argument.startsWith('--voice='));
const requestedSpeed = process.argv.find((argument) => argument.startsWith('--speed='));
const voice = requestedVoice?.slice('--voice='.length) || definition.kokoro.voice;
const speed = Number(requestedSpeed?.slice('--speed='.length) || definition.kokoro.speed);

if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) {
  throw new Error('Narration speed must be between 0.5 and 2.');
}

await mkdir(outputDirectory, { recursive: true });
const pending = Object.entries(definition.cues).filter(
  ([cueId]) => force || !existsSync(join(outputDirectory, `${cueId}.mp3`)),
);

if (pending.length === 0) {
  process.stdout.write('All narration cues already exist. Pass --force to replace them.\n');
  process.exit(0);
}

// Keep downloaded weights out of the repository and out of the user's generic cache.
env.cacheDir =
  process.env.SPACENINJA_KOKORO_CACHE || join(tmpdir(), 'spaceninja-kokoro-model-cache');
process.stdout.write(`Loading ${definition.kokoro.model} (${definition.kokoro.dtype})…\n`);
const tts = await KokoroTTS.from_pretrained(definition.kokoro.model, {
  dtype: definition.kokoro.dtype,
  device: 'cpu',
});

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'spaceninja-narration-'));
try {
  for (const [cueId, input] of pending) {
    const wav = join(temporaryDirectory, `${cueId}.wav`);
    const output = join(outputDirectory, `${cueId}.mp3`);
    const audio = await tts.generate(input, { voice, speed });
    audio.save(wav);
    await run('ffmpeg', [
      '-nostdin',
      '-y',
      '-loglevel',
      'error',
      '-i',
      wav,
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=7',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-b:a',
      '64k',
      '-metadata',
      `title=${cueId}`,
      output,
    ]);
    process.stdout.write(`wrote ${cueId}.mp3\n`);
  }
} catch (error) {
  if (error?.code === 'ENOENT') {
    throw new Error('ffmpeg is required to create compact narration MP3s.', { cause: error });
  }
  throw error;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

await writeFile(
  join(outputDirectory, 'provenance.json'),
  JSON.stringify(
    {
      kind: 'ai',
      provider: 'Kokoro',
      model: definition.kokoro.model,
      voice,
      speed,
      modelLicense: 'Apache-2.0',
      modelSource: 'https://huggingface.co/hexgrad/Kokoro-82M',
      disclosure: 'The included narration uses the open-weight Kokoro AI voice model.',
    },
    null,
    2,
  ) + '\n',
);

process.stdout.write(
  `Generated ${pending.length} Kokoro narration cues with ${voice}. ` +
    'Listen on the real target device before release.\n',
);
