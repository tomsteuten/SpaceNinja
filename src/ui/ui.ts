/**
 * The interface layer: selection prompt, the big fly button, the arrival fact card and
 * the discovery journal.
 *
 * Kept deliberately sparse — for this age group, one clear thing to press at a time.
 */

import type { Narrator } from '../audio/narration';
import { JOURNAL_SLOTS, STICKERS, loadProgress } from '../state/progress';

export interface SelectionInfo {
  label: string;
  /** Whether this body is a flyable destination (only the Moon, for now). */
  flyable: boolean;
}

export interface GameUI {
  setHint(text: string | null): void;
  showSelection(selection: SelectionInfo | null): void;
  /** Called when the flight starts: everything clears out of the way. */
  enterFlight(): void;
  showArrival(fact: string, celebrateSticker: string | null): void;
  dispose(): void;
}

export interface UIOptions {
  root: HTMLElement;
  narrator: Narrator;
  onFly(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createUI(options: UIOptions): GameUI {
  const { root, narrator, onFly } = options;
  const timers: number[] = [];

  /* --- hint ---------------------------------------------------------------- */

  const hint = el('p', 'hint');
  root.append(hint);

  /* --- dock: name + fly button + fact card --------------------------------- */

  const dock = el('div', 'dock');
  const namePill = el('div', 'name-pill');
  namePill.classList.add('is-hidden');

  const flyButton = el('button', 'btn fly-btn');
  flyButton.type = 'button';
  flyButton.append(el('span', undefined, '🚀'), el('span', undefined, 'Fly to the Moon'));
  flyButton.classList.add('is-hidden');

  const factCard = el('div', 'panel fact-card');
  const factText = el('p');
  const narrateButton = el('button', 'btn btn--round narrate-btn', '🔊');
  narrateButton.type = 'button';
  narrateButton.setAttribute('aria-label', 'Read this out loud');
  factCard.append(factText, narrateButton);
  factCard.classList.add('is-hidden');

  dock.append(namePill, flyButton, factCard);
  root.append(dock);

  /* --- journal ------------------------------------------------------------- */

  const journalButton = el('button', 'btn btn--round journal-btn', '📔');
  journalButton.type = 'button';
  journalButton.setAttribute('aria-label', 'Open your discovery journal');

  const journalPanel = el('div', 'panel journal-panel');
  journalPanel.classList.add('is-hidden');
  const journalTitle = el('h2', undefined, 'My Discoveries');
  const stickerGrid = el('div', 'sticker-grid');
  const closeJournal = el('button', 'btn btn--quiet', 'Close');
  closeJournal.type = 'button';
  journalPanel.append(journalTitle, stickerGrid, closeJournal);

  root.append(journalButton, journalPanel);

  function renderJournal() {
    stickerGrid.replaceChildren();
    const earned = loadProgress().stickers;
    for (const id of earned) {
      const definition = STICKERS[id];
      if (!definition) continue;
      const sticker = el('div', 'sticker');
      sticker.append(
        el('div', undefined, definition.emoji),
        el('span', undefined, definition.label),
      );
      stickerGrid.append(sticker);
    }
    for (let i = earned.length; i < JOURNAL_SLOTS; i++) {
      stickerGrid.append(el('div', 'sticker sticker--empty', '?'));
    }
  }

  let journalOpen = false;
  function setJournalOpen(open: boolean) {
    journalOpen = open;
    if (open) renderJournal();
    journalPanel.classList.toggle('is-hidden', !open);
    journalButton.classList.toggle('is-hidden', open);
    // The panel and the fact card both want the lower half of a phone screen.
    dock.classList.toggle('is-hidden', open);
    if (open) journalButton.removeAttribute('data-new');
  }

  journalButton.addEventListener('click', () => setJournalOpen(true));
  closeJournal.addEventListener('click', () => setJournalOpen(false));
  renderJournal();

  /* --- behaviour ----------------------------------------------------------- */

  flyButton.addEventListener('click', () => {
    onFly();
  });

  let currentFact = '';
  narrateButton.addEventListener('click', () => {
    if (narrator.speaking) narrator.stop();
    else if (currentFact) narrator.speak(currentFact);
  });
  narrator.onChange((speaking) => {
    narrateButton.classList.toggle('is-speaking', speaking);
    narrateButton.setAttribute(
      'aria-label',
      speaking ? 'Stop reading' : 'Read this out loud',
    );
  });
  if (!narrator.available) narrateButton.classList.add('is-hidden');

  function celebrate(stickerId: string) {
    const definition = STICKERS[stickerId];
    if (!definition) return;

    const award = el('div', 'panel award');
    const awardText = el('div', 'award-text');
    awardText.append(
      el('strong', undefined, 'New sticker!'),
      el('small', undefined, definition.label),
    );
    award.append(el('div', 'award-icon', definition.emoji), awardText);
    root.append(award);
    journalButton.setAttribute('data-new', 'true');

    timers.push(
      window.setTimeout(() => {
        award.style.transition = 'opacity 0.5s ease';
        award.style.opacity = '0';
        timers.push(window.setTimeout(() => award.remove(), 520));
      }, 2400),
    );
    if (journalOpen) renderJournal();
  }

  function setHint(text: string | null) {
    hint.textContent = text ?? '';
    hint.style.opacity = text ? '1' : '0';
  }

  return {
    setHint,

    showSelection(selection: SelectionInfo | null) {
      if (!selection) {
        namePill.classList.add('is-hidden');
        flyButton.classList.add('is-hidden');
        return;
      }
      namePill.textContent = selection.label;
      namePill.classList.remove('is-hidden');
      namePill.classList.add('fade-in');
      flyButton.classList.toggle('is-hidden', !selection.flyable);
      if (selection.flyable) flyButton.classList.add('fade-in');
    },

    enterFlight() {
      namePill.classList.add('is-hidden');
      flyButton.classList.add('is-hidden');
      factCard.classList.add('is-hidden');
      setHint(null);
    },

    showArrival(fact: string, celebrateSticker: string | null) {
      currentFact = fact;
      factText.textContent = fact;
      factCard.classList.remove('is-hidden');
      factCard.classList.add('fade-in');
      namePill.textContent = 'The Moon';
      namePill.classList.remove('is-hidden');

      if (celebrateSticker) celebrate(celebrateSticker);

      // Speech needs a recent user gesture on mobile; the fly button provided one, but if
      // the platform refuses anyway the button is right there.
      narrator.speak(fact);
    },

    dispose() {
      for (const timer of timers) window.clearTimeout(timer);
      timers.length = 0;
      root.replaceChildren();
    },
  };
}
