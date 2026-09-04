# Narration recordings

Put authored MP3 narration here. The filename is the stable cue id used by the game, for
example `arrival-earth.mp3`, `discovery-earth-sahara.mp3`, or `spin-earth.mp3`.

Vite fingerprints imported recordings and the existing service-worker build precaches
them with the application shell, so every installed recording works offline. A missing
recording falls back to the device voice when the speaker button is pressed. Only cues
with a recording start automatically; an incomplete voice pack therefore never makes the
poor platform voice begin talking by itself.

`npm run narration:generate` creates the complete pack from `../narration-script.json`
using OpenAI text-to-speech and requires `OPENAI_API_KEY`. The script never stores the key,
preserves existing files unless passed `--force`, and accepts `--voice=<name>`. Generated
files are AI voices and must stay disclosed as such in the grown-ups panel and README.
The generator writes `provenance.json` beside the MP3s to supply that disclosure. A human
recording pack may omit it or provide its own plain-language origin note.
