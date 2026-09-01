/**
 * The interface layer: selection prompt, the big fly button, the arrival fact card, the
 * mission HUD and the discovery journal.
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
  showArrival(fact: string): void;
  /** Reveals the mission button, a beat later so the fact gets read first. */
  offerMission(label: string): void;
  /** Clears the arrival furniture and puts up the progress slots. */
  beginMission(caption: string, total: number): void;
  setMissionCaption(text: string): void;
  /** Fills `collected` of the slots. */
  setMissionProgress(collected: number): void;
  /**
   * The celebration. `stickerId` is null when the sticker was already earned on an
   * earlier visit — the party happens either way, only the "new sticker" badge does not.
   */
  completeMission(successLine: string, stickerId: string | null): void;
  /** Back to the opening state, without rebuilding any of the DOM. */
  reset(): void;
  dispose(): void;
}

export interface UIOptions {
  root: HTMLElement;
  narrator: Narrator;
  onFly(): void;
  onMissionStart(): void;
  onExploreAgain(): void;
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
  const { root, narrator, onFly, onMissionStart, onExploreAgain } = options;
  const timers: number[] = [];

  function later(callback: () => void, delay: number) {
    timers.push(window.setTimeout(callback, delay));
  }

  function clearTimers() {
    for (const timer of timers) window.clearTimeout(timer);
    timers.length = 0;
  }

  /* --- hint ---------------------------------------------------------------- */

  const hint = el('p', 'hint');
  root.append(hint);

  /* --- mission HUD --------------------------------------------------------- */

  // Top of the screen: the destination sits in the middle and the dock owns the bottom,
  // so this is the one band that is clear of both in portrait and in landscape.
  const missionHud = el('div', 'mission-hud');
  missionHud.classList.add('is-hidden');
  const slotRow = el('div', 'slot-row');
  const missionCaption = el('p', 'mission-caption');
  missionHud.append(slotRow, missionCaption);
  root.append(missionHud);

  let slots: HTMLElement[] = [];

  function buildSlots(total: number) {
    slotRow.replaceChildren();
    slots = [];
    for (let i = 0; i < total; i++) {
      const slot = el('div', 'slot');
      // Not colour alone: an empty slot is dashed and holds a faint dot, a filled one is
      // solid, holds the rock itself and gains a tick.
      slot.append(el('span', 'slot-icon', '·'));
      slotRow.append(slot);
      slots.push(slot);
    }
  }

  /* --- dock: name + buttons + fact card ------------------------------------ */

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

  const missionButton = el('button', 'btn mission-btn');
  missionButton.type = 'button';
  const missionButtonIcon = el('span', undefined, '🪨');
  const missionButtonLabel = el('span');
  missionButton.append(missionButtonIcon, missionButtonLabel);
  missionButton.classList.add('is-hidden');

  const againButton = el('button', 'btn again-btn');
  againButton.type = 'button';
  againButton.append(el('span', undefined, '🌍'), el('span', undefined, 'Explore Again'));
  againButton.classList.add('is-hidden');

  dock.append(namePill, factCard, flyButton, missionButton, againButton);
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
  missionButton.addEventListener('click', () => {
    onMissionStart();
  });
  againButton.addEventListener('click', () => {
    onExploreAgain();
  });

  let currentFact = '';
  narrateButton.addEventListener('click', () => {
    if (narrator.speaking) narrator.stop();
    else if (currentFact) narrator.speak(currentFact);
  });
  narrator.onChange((speaking) => {
    narrateButton.classList.toggle('is-speaking', speaking);
    narrateButton.setAttribute('aria-label', speaking ? 'Stop reading' : 'Read this out loud');
  });
  if (!narrator.available) narrateButton.classList.add('is-hidden');

  let awardCard: HTMLElement | null = null;

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
    awardCard = award;
    journalButton.setAttribute('data-new', 'true');

    later(() => {
      award.style.transition = 'opacity 0.5s ease';
      award.style.opacity = '0';
      later(() => {
        award.remove();
        if (awardCard === award) awardCard = null;
      }, 520);
    }, 2400);
    if (journalOpen) renderJournal();
  }

  function setHint(text: string | null) {
    hint.textContent = text ?? '';
    hint.style.opacity = text ? '1' : '0';
  }

  function showFact(text: string) {
    currentFact = text;
    factText.textContent = text;
    factCard.classList.remove('is-hidden');
    factCard.classList.add('fade-in');
    narrator.speak(text);
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

    showArrival(fact: string) {
      namePill.textContent = 'The Moon';
      namePill.classList.remove('is-hidden');
      // Speech needs a recent user gesture on mobile; the fly button provided one, but if
      // the platform refuses anyway the button is right there.
      showFact(fact);
    },

    offerMission(label: string) {
      missionButtonLabel.textContent = label;
      // One clear thing at a time: let the fact be read before a second thing appears.
      later(() => {
        missionButton.classList.remove('is-hidden');
        missionButton.classList.add('fade-in');
      }, 1400);
    },

    beginMission(caption: string, total: number) {
      missionButton.classList.add('is-hidden');
      factCard.classList.add('is-hidden');
      namePill.classList.add('is-hidden');
      setHint(null);

      buildSlots(total);
      missionCaption.textContent = caption;
      missionHud.classList.remove('is-hidden');
      // Its own keyframe, not .fade-in: that one animates transform and would drop the
      // translateX(-50%) that centres this, sliding the slots off to one side.
      missionHud.classList.add('fade-in-centred');
      narrator.speak(caption);
    },

    setMissionCaption(text: string) {
      missionCaption.textContent = text;
      narrator.speak(text);
    },

    setMissionProgress(collected: number) {
      for (const [index, slot] of slots.entries()) {
        const filled = index < collected;
        slot.classList.toggle('is-filled', filled);
        const icon = slot.firstElementChild;
        if (icon) icon.textContent = filled ? '🪨' : '·';
      }
    },

    completeMission(successLine: string, stickerId: string | null) {
      // Clear the slots before the award lands: they share the top of the screen.
      missionHud.classList.add('is-hidden');
      namePill.classList.remove('is-hidden');
      showFact(successLine);
      againButton.classList.remove('is-hidden');
      againButton.classList.add('fade-in');
      if (stickerId) celebrate(stickerId);
    },

    reset() {
      clearTimers();
      narrator.stop();
      awardCard?.remove();
      awardCard = null;

      setJournalOpen(false);
      journalButton.removeAttribute('data-new');
      renderJournal();

      currentFact = '';
      factText.textContent = '';
      missionHud.classList.add('is-hidden');
      slotRow.replaceChildren();
      slots = [];

      for (const node of [namePill, flyButton, factCard, missionButton, againButton]) {
        node.classList.add('is-hidden');
        // Or the animation will not replay the next time the node is shown.
        node.classList.remove('fade-in');
      }
      missionHud.classList.remove('fade-in-centred');
      dock.classList.remove('is-hidden');
    },

    dispose() {
      clearTimers();
      root.replaceChildren();
    },
  };
}
