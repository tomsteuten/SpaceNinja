/**
 * Read-aloud support via the browser's SpeechSynthesis API.
 *
 * Temporary: good enough to let a five-year-old hear the fact without reading it, and
 * entirely optional — if the API is missing or silent the game is unaffected and the
 * narration button simply does not appear.
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

/** Prefer a natural-sounding English voice; fall back to whatever the platform offers. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = english.length > 0 ? english : voices;
  const preferred = pool.find((v) => /natural|google|samantha|aria|zira/i.test(v.name));
  return preferred ?? pool[0] ?? null;
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
    voice = pickVoice(synth.getVoices());
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

      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.92; // a touch slow, for young listeners
      utterance.pitch = 1.08;
      utterance.volume = 1;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      setSpeaking(true);
      try {
        synth.speak(utterance);
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
