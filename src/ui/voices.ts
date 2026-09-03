/**
 * The `?voices` page: pick a reading voice by listening to it.
 *
 * The narration's whole problem is that the voice is whatever the operating system ships,
 * so the same code sounds different and mostly poor on every device — and none of that can
 * be heard from where the code is written. `VOICE_RANK` in narration.ts is a heuristic over
 * voice *names*, which is guessing at a quality it cannot observe.
 *
 * A parent holding the tablet can simply listen. This turns the unanswerable question into
 * a half-minute job for someone with ears in the room: tap a voice, hear it read a real
 * line from the game, tap another if it is worse. The last one tapped is remembered and
 * used from then on, and the ranking becomes the default rather than the verdict.
 *
 * Deliberately not on the normal path and deliberately not pretty. A child never types a
 * query string; this is a page a parent is told about once.
 */

import { DESTINATIONS } from '../config';
import {
  describeVoices,
  saveVoiceChoice,
  speechText,
  type Narrator,
} from '../audio/narration';

/**
 * What every voice is auditioned on: a real line from the game, not "the quick brown fox".
 *
 * The point is to judge the voice on the job it will actually do — this copy is written to
 * be read to a five-year-old, and a voice that handles a pangram cleanly can still be
 * wrong for it. One sentence, so trying six voices takes half a minute rather than five.
 */
function sampleLine(): string {
  const fact = DESTINATIONS.moon?.fact ?? 'This is your planet, seen from space.';
  return speechText(fact)[0] ?? fact;
}

export interface VoicePanel {
  dispose(): void;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createVoicePanel(root: HTMLElement, narrator: Narrator): VoicePanel {
  const panel = el('div', 'voice-panel');
  const sample = sampleLine();

  function render() {
    const report = describeVoices();
    panel.replaceChildren();
    panel.append(el('h2', 'voice-title', 'Choose a reading voice'));

    if (report.message) {
      panel.append(el('p', 'voice-note', report.message));
      return;
    }

    panel.append(
      el(
        'p',
        'voice-note',
        `Tap a voice to hear it read a line from the game. The last one you tap is the ` +
          `one Space Ninja will use. ${report.voices.length} voices, device language ` +
          `${report.language}.`,
      ),
    );

    const auto = el('button', 'voice-auto') as HTMLButtonElement;
    auto.type = 'button';
    auto.textContent = report.saved ? 'Forget my choice and pick automatically' : 'Picking automatically';
    auto.disabled = !report.saved;
    auto.addEventListener('click', () => {
      saveVoiceChoice(null);
      render();
    });
    panel.append(auto);

    const list = el('ul', 'voice-list');
    for (const voice of report.voices) {
      const item = document.createElement('li');
      const button = el('button', 'voice-option') as HTMLButtonElement;
      button.type = 'button';
      if (voice === report.chosen) button.classList.add('is-chosen');

      button.append(el('span', 'voice-name', voice.name));
      const tags = [voice.lang];
      if (voice.default) tags.push('device default');
      if (!voice.localService) tags.push('network');
      button.append(el('span', 'voice-tags', tags.join(' · ')));

      button.addEventListener('click', () => {
        // Choosing and auditioning are the same tap. Two controls per row is a lot of
        // buttons for a job whose whole appeal is that it takes half a minute, and the
        // choice is free to change — the next tap replaces it.
        saveVoiceChoice(voice.voiceURI);
        render();
        narrator.speak(sample);
      });
      item.append(button);
      list.append(item);
    }
    panel.append(list);
  }

  render();
  // Chrome fills the list asynchronously and often after first paint, so the panel would
  // otherwise settle on "no voices yet" on the platform that most needs this page.
  const onVoicesChanged = () => render();
  window.speechSynthesis?.addEventListener('voiceschanged', onVoicesChanged);
  root.append(panel);

  return {
    dispose() {
      window.speechSynthesis?.removeEventListener('voiceschanged', onVoicesChanged);
      narrator.stop();
      panel.remove();
    },
  };
}
