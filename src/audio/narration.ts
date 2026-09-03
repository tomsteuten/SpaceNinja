/**
 * Read-aloud support via the browser's SpeechSynthesis API.
 *
 * Still temporary, and still the weakest thing in the project. The voice is whatever the
 * operating system ships, so the same code sounds different and mostly poor on every
 * platform. Two consequences are baked in here:
 *
 *  - **Nothing is read aloud unless a child or an adult asks for it.** Playtesting said
 *    the voice was bad enough that no narration beat this narration, so the speaker
 *    button is the only thing that starts it. That is a default, not a deletion: the call
 *    to speak on arrival is one line in ui.ts.
 *  - What it *is* asked to read is cleaned up first. See speechText.
 *
 * The real fix is pre-recorded audio behind this same interface; see AGENTS.md.
 */

export interface Narrator {
  /** False when SpeechSynthesis is absent. Callers should hide their button. */
  readonly available: boolean;
  readonly speaking: boolean;
  speak(text: string): void;
  stop(): void;
  onChange(listener: (speaking: boolean) => void): void;
  dispose(): void;
}

/**
 * Voice names worth having, best first.
 *
 * Ranked rather than matched. The old rule took the *first* voice whose name matched any
 * of a handful of patterns, in whatever order the platform happened to list them, so a
 * device with both a good voice and a poor one had even odds. These are the families that
 * are actually pleasant to listen to, in the order we would choose between them.
 *
 * Unverifiable from here, and worth saying plainly: this environment exposes the
 * SpeechSynthesis API with zero voices installed, so none of this can be heard or tested
 * where it is written. Load the game with `?voices` on the real device to see what it
 * actually offers and what got picked.
 */
const VOICE_RANK = [
  /natural/i, // Microsoft's "Natural" line, and Android's newer neural voices.
  /neural/i,
  /google (uk|us)/i, // Chrome's own, and much better than the generic Google entries.
  /google/i,
  /samantha|daniel|karen|moira/i, // Apple's better English voices.
  /aria|libby|ryan|sonia/i, // Microsoft.
] as const;

/** How well a voice matches what we are looking for. Higher is better; 0 is unranked. */
function voiceScore(voice: SpeechSynthesisVoice, preferredLang: string): number {
  const lang = voice.lang.toLowerCase().replace('_', '-');
  if (!lang.startsWith('en')) return -1;

  let score = 0;
  const rank = VOICE_RANK.findIndex((pattern) => pattern.test(voice.name));
  if (rank >= 0) score += (VOICE_RANK.length - rank) * 10;

  // The child's own accent, then the two big English locales. A voice from the wrong
  // English-speaking country is not wrong, just further from home.
  if (lang === preferredLang) score += 6;
  else if (lang.startsWith('en-gb') || lang.startsWith('en-us')) score += 4;

  // Default voices are usually the platform's own pick and are rarely the worst one.
  if (voice.default) score += 1;
  return score;
}

/** Prefer a natural-sounding English voice; fall back to whatever the platform offers. */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredLang = 'en-gb',
): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;
  for (const voice of voices) {
    const score = voiceScore(voice, preferredLang.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }
  // Every voice scored -1 means there is no English at all; take the platform default.
  return bestScore >= 0 ? best : (voices[0] ?? null);
}

/**
 * The words as a speech engine should receive them, which is not the words on screen.
 *
 * An em dash reads well in a sentence a parent is reading off the card and is a hazard to
 * a weak synthesiser, which either announces it or runs straight through the pause it was
 * standing in for. Splitting into sentences matters more: a poor engine given one long
 * compound sentence delivers it as an unbroken run, and the single biggest gain in being
 * understood is simply letting it stop for breath. Neither costs anything on a good voice.
 */
export function speechText(text: string): string[] {
  return text
    // Absorbing the spaces around the dash matters: replacing the character alone leaves
    // " , ", and engines that pause on punctuation pause on the stray space first.
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 0);
}

export function createNarrator(): Narrator {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const available = Boolean(synth && typeof SpeechSynthesisUtterance === 'function');

  let speaking = false;
  let voice: SpeechSynthesisVoice | null = null;
  const listeners: Array<(speaking: boolean) => void> = [];

  function setSpeaking(value: boolean) {
    if (speaking === value) return;
    speaking = value;
    for (const listener of listeners) listener(speaking);
  }

  // Chrome populates the voice list asynchronously, often after the first getVoices() call.
  function refreshVoices() {
    if (!synth) return;
    voice = pickVoice(synth.getVoices(), navigator.language || 'en-GB');
  }

  if (available && synth) {
    refreshVoices();
    synth.addEventListener('voiceschanged', refreshVoices);
  }

  return {
    available,

    get speaking() {
      return speaking;
    },

    speak(text: string) {
      if (!available || !synth) return;
      synth.cancel();
      if (!voice) refreshVoices();

      // One utterance per sentence, queued. The engine puts a real pause between them,
      // which a single long string does not get, and only the last one ends the reading.
      const sentences = speechText(text);
      if (sentences.length === 0) return;

      let remaining = sentences.length;
      const finished = () => {
        remaining--;
        if (remaining <= 0) setSpeaking(false);
      };

      setSpeaking(true);
      try {
        for (const sentence of sentences) {
          const utterance = new SpeechSynthesisUtterance(sentence);
          if (voice) utterance.voice = voice;
          utterance.rate = 0.92; // a touch slow, for young listeners
          utterance.pitch = 1.08;
          utterance.volume = 1;
          utterance.onend = finished;
          // An error cancels the rest of the queue, so stop counting and go quiet.
          utterance.onerror = () => {
            remaining = 0;
            setSpeaking(false);
          };
          synth.speak(utterance);
        }
      } catch {
        setSpeaking(false);
      }
    },

    stop() {
      if (!available || !synth) return;
      synth.cancel();
      setSpeaking(false);
    },

    onChange(listener: (speaking: boolean) => void) {
      listeners.push(listener);
    },

    dispose() {
      if (available && synth) {
        synth.cancel();
        synth.removeEventListener('voiceschanged', refreshVoices);
      }
      listeners.length = 0;
    },
  };
}

/**
 * Every voice this device offers, best first, with the one that would be chosen marked.
 *
 * Exists because the choice cannot be made from here. This machine reports the
 * SpeechSynthesis API present and zero voices installed, and voice quality is entirely a
 * property of the device — so the only way to pick well for the tablet this game is played
 * on is to look at what that tablet has. Reached with `?voices` in the URL, which a child
 * will never type and a parent can read off the screen.
 */
export function describeVoices(): string[] {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!synth) return ['SpeechSynthesis is not available on this device.'];

  const voices = synth.getVoices();
  if (voices.length === 0) {
    return [
      'SpeechSynthesis is available but reports no voices.',
      'Some platforms fill the list a moment after load — try reloading.',
    ];
  }
  const chosen = pickVoice(voices, navigator.language || 'en-GB');
  const lang = navigator.language || '(unknown)';
  return [
    `${voices.length} voices, device language ${lang}.`,
    `Chosen: ${chosen ? `${chosen.name} (${chosen.lang})` : 'none'}`,
    '',
    ...voices.map(
      (voice) =>
        `${voice === chosen ? '>' : ' '} ${voice.name} (${voice.lang})` +
        `${voice.default ? ' [default]' : ''}${voice.localService ? '' : ' [network]'}`,
    ),
  ];
}
