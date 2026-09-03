/**
 * The one screen written for the adult rather than the child.
 *
 * It exists because two things in this game cannot be decided from the code and had no
 * door at all: which voice reads aloud (quality is a property of the device, and the
 * ranking in narration.ts is a heuristic over voice *names* — guessing at something it
 * cannot hear), and whether the tablet's reduce-motion setting is on, which changes what
 * the game does and is invisible from inside it.
 *
 * Deliberately short. A parent standing there about to hand over a tablet reads about one
 * screen, and what they need at that moment is operational: how to pick a voice, what will
 * and will not talk, and a way in. The reasoning behind the game belongs in the README,
 * where it can be as long as it likes.
 *
 * Shown once, on the first load on this device, then only when asked for. Start is the
 * biggest thing on it and always reachable, because the failure mode of a panel like this
 * is a child opening the game alone and meeting a wall of text they cannot read.
 */

import { DESTINATIONS } from '../config';
import {
  describeVoices,
  saveVoiceChoice,
  speechText,
  type Narrator,
} from '../audio/narration';
import { prefersReducedMotion } from '../scene/quality';

/** Remembered per device, so it greets a new tablet and never nags a familiar one. */
const SEEN_KEY = 'spaceninja.grownups.v1';

function seen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === 'yes';
  } catch {
    // Private browsing, or storage switched off. Showing it every time is the safe
    // failure: an adult can dismiss it, whereas never showing it hides the voice picker.
    return false;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, 'yes');
  } catch {
    // Nothing to do. It will greet them again next time, which is the harmless direction.
  }
}

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

export interface Grownups {
  /** True while it is on screen. */
  readonly open: boolean;
  show(): void;
  hide(): void;
  dispose(): void;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export interface GrownupsOptions {
  root: HTMLElement;
  narrator: Narrator;
}

export function createGrownups(options: GrownupsOptions): Grownups {
  const { root, narrator } = options;
  const panel = el('div', 'grownups');
  const sample = sampleLine();
  let showing = false;

  function close() {
    showing = false;
    narrator.stop();
    panel.remove();
    markSeen();
  }

  function voiceSection(): HTMLElement {
    const section = el('section', 'grownups__section');
    section.append(el('h3', 'grownups__heading', 'The reading voice'));

    const report = describeVoices();
    if (report.message) {
      section.append(el('p', 'grownups__note', report.message));
      return section;
    }

    section.append(
      el(
        'p',
        'grownups__note',
        'Tap a voice to hear it read a line from the game. The last one you tap is the ' +
          'one Space Ninja will use. Voices differ hugely between devices, and this is ' +
          'the only way to tell which of yours is any good.',
      ),
    );

    const auto = el('button', 'grownups__auto') as HTMLButtonElement;
    auto.type = 'button';
    auto.textContent = report.saved
      ? 'Forget my choice and pick automatically'
      : 'Picking automatically';
    auto.disabled = !report.saved;
    auto.addEventListener('click', () => {
      saveVoiceChoice(null);
      render();
    });
    section.append(auto);

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
    section.append(list);
    return section;
  }

  function render() {
    panel.replaceChildren();
    // One centred column rather than everything pinned to the left edge: on a tablet in
    // landscape the panel is far wider than anything on it is meant to be read at.
    const inner = el('div', 'grownups__inner');
    panel.append(inner);

    inner.append(el('h2', 'grownups__title', 'Space Ninja'));
    inner.append(
      el(
        'p',
        'grownups__lead',
        'A quiet solar system for a child of about five to eight. There is nothing to ' +
          'lose, nothing to get wrong, and no way to get stuck — Fly Home is on screen ' +
          'the whole time.',
      ),
    );

    const start = el('button', 'grownups__start', 'Start playing') as HTMLButtonElement;
    start.type = 'button';
    start.addEventListener('click', close);
    inner.append(start);

    const what = el('section', 'grownups__section');
    what.append(el('h3', 'grownups__heading', 'What it teaches'));
    what.append(
      el(
        'p',
        'grownups__note',
        'The places a child finds are real, at their real latitude and longitude on real ' +
          'NASA maps — the Sahara, the Amazon, the Apollo 11 landing site, Olympus Mons. ' +
          'One on each world is deliberately over the horizon, so reaching it means ' +
          'learning to turn the planet. Spin the Earth turns it through exactly one day, ' +
          'with the city lights coming on as places cross into night.',
      ),
    );
    inner.append(what);

    const sound = el('section', 'grownups__section');
    sound.append(el('h3', 'grownups__heading', 'Sound'));
    sound.append(
      el(
        'p',
        'grownups__note',
        'Quiet by design, and nothing is ever read aloud on its own — the speaker button ' +
          'on a card is the only thing that starts a reading.',
      ),
    );
    inner.append(sound);

    inner.append(voiceSection());

    // Whether the device is asking for reduced motion changes what the game does, and
    // there is no way to see that from inside it. Worth a line, since a tablet can have
    // the setting on without anyone remembering they turned it on.
    const motion = el('section', 'grownups__section');
    motion.append(el('h3', 'grownups__heading', 'This device'));
    motion.append(
      el(
        'p',
        'grownups__note',
        prefersReducedMotion()
          ? 'Reduced motion is switched on for this device, so the game leaves out the ' +
            'exhaust trail, the widening view and the drifting camera. Flights still take ' +
            'the same time — playing the same movement faster is not less movement.'
          : 'Reduced motion is off for this device, so the game plays with its full ' +
            'camera movement. Turning it on in the device settings calms it down.',
      ),
    );
    inner.append(motion);

    inner.append(
      el(
        'p',
        'grownups__reopen',
        'To open this again: press and hold the round book button in the corner for two ' +
          'seconds. It is a hold rather than a button so that a child does not find it.',
      ),
    );
  }

  return {
    get open() {
      return showing;
    },

    show() {
      if (showing) return;
      showing = true;
      // Rebuilt on every open rather than kept: the voice list can fill in late, and a
      // choice made last time should be showing as chosen when it opens again.
      render();
      root.append(panel);
    },

    hide() {
      if (showing) close();
    },

    dispose() {
      narrator.stop();
      panel.remove();
    },
  };
}

/**
 * Whether to greet on this load. `asked` is the `?grownups` address, which skips the
 * once-only rule so an adult can always get back in even if storage was cleared.
 */
export function shouldGreet(asked: boolean): boolean {
  return asked || !seen();
}
