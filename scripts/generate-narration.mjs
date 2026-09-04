import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(root, 'src/audio/narration-script.json');
const outputDirectory = join(root, 'src/audio/recordings');
const definition = JSON.parse(await readFile(scriptPath, 'utf8'));
const force = process.argv.includes('--force');
const requestedVoice = process.argv.find((argument) => argument.startsWith('--voice='));
const voice = requestedVoice?.slice('--voice='.length) || definition.voice;
const key = process.env.OPENAI_API_KEY;
let wroteAny = false;

if (!key) {
  throw new Error('Set OPENAI_API_KEY before generating narration. The key is never stored.');
}

await mkdir(outputDirectory, { recursive: true });

for (const [cueId, input] of Object.entries(definition.cues)) {
  const output = join(outputDirectory, `${cueId}.mp3`);
  if (!force && existsSync(output)) {
    process.stdout.write(`kept ${cueId}\n`);
    continue;
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: definition.model,
      voice,
      input,
      instructions: definition.instructions,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Narration generation failed for ${cueId}: ${response.status} ${await response.text()}`,
    );
  }

  await writeFile(output, Buffer.from(await response.arrayBuffer()));
  wroteAny = true;
  process.stdout.write(`wrote ${cueId}.mp3\n`);
}

if (wroteAny) {
  await writeFile(
    join(outputDirectory, 'provenance.json'),
    JSON.stringify(
      {
        kind: 'ai',
        provider: 'OpenAI',
        model: definition.model,
        voice,
        disclosure: 'The included narration uses an AI-generated voice.',
      },
      null,
      2,
    ) + '\n',
  );
}

process.stdout.write(
  `Generated ${Object.keys(definition.cues).length} AI-voice cues with ${voice}. ` +
    'Listen on the real target device before committing them.\n',
);
