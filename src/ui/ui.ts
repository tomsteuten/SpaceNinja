/**
 * The interface layer: selection prompt, the big fly button, the arrival fact card, the
 * mission HUD and the discovery journal.
 *
 * Kept deliberately sparse — for this age group, one clear thing to press at a time.
 */

import type { Narrator } from '../audio/narration';
import { DISCOVERIES, JOURNAL_SLOTS, type Discovery } from '../config';
import { STICKERS, loadProgress } from '../state/progress';
import { createIcon, iconMarkup } from './icons';

export interface SelectionInfo {
  label: string;
  /** Text for the launch button, or null when this body is not a destination. */
  flyLabel: string | null;
}

export interface GameUI {
  setHint(text: string | null): void;
  showSelection(selection: SelectionInfo | null): void;
  /** Called when the flight starts: everything clears out of the way. */
  enterFlight(): void;
  showArrival(label: string, fact: string): void;
  /**
   * Puts up the progress counter. A beat after arrival, so the fact is read first, and
   * *alongside* the fact card rather than instead of it: the rocks are simply there to
   * be found, not a mode the child has entered and has to finish to leave.
   */
  beginMission(caption: string, total: number): void;
  setMissionCaption(text: string): void;
  /** A place has been found: name it, and put it in the journal. */
  showDiscovery(discovery: Discovery): void;
  /**
   * Something worth saying that is not a find — it uses the same card and the same
   * speaker button, but nothing goes into the journal, because nothing was collected.
   */
  showNote(title: string, text: string): void;
  /**
   * Fold the card away to its speaker button now, because something has started that is
   * worth more than the words are. Idempotent, and yields to a reading in progress.
   */
  foldFact(): void;
  /** Fills `collected` of the slots. */
  setMissionProgress(collected: number): void;
  /**
   * The celebration. `stickerId` is null when the sticker was already earned on an
   * earlier visit — the party happens either way, only the "new sticker" badge does not.
   */
  completeMission(successLine: string, stickerId: string | null): void;
  /**
   * Answer a tap that hit nothing. Not a failure signal - to a small child an
   * unresponsive tap reads as a broken app rather than as a miss.
   */
  showTapEcho(clientX: number, clientY: number): void;
  /**
   * Name a place at the point on screen where it was found, so the answer arrives at the
   * thing that was touched rather than only in a card at the bottom of the screen.
   */
  showFindLabel(clientX: number, clientY: number, emoji: string, name: string): void;
  /**
   * Offer to turn the destination through a day, or take the offer away. Null hides it.
   */
  showSpin(label: string | null): void;
  /** Greys the spin button out while a turn is running, so a press cannot stack. */
  setSpinBusy(busy: boolean): void;
  /** Back to the opening state, without rebuilding any of the DOM. */
  reset(): void;
  dispose(): void;
}

export interface UIOptions {
  root: HTMLElement;
  narrator: Narrator;
  onFly(): void;
  onExploreAgain(): void;
  /** The "turn this world through a day" button. Only offered where config has one. */
  onSpin(): void;
  /**
   * Someone held the journal button down. That is the way back into the grown-ups panel,
   * and it is deliberately a gesture rather than a button: a settings control on screen is
   * a settings control a five-year-old will press.
   */
  onGrownups(): void;
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
  const { root, narrator, onFly, onExploreAgain, onSpin, onGrownups } = options;
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
      const slotIcon = el('span', 'slot-icon');
      slotIcon.innerHTML = iconMarkup('dot');
      slot.append(slotIcon);
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
  const flyButtonLabel = el('span');
  flyButton.append(createIcon('rocket'), flyButtonLabel);
  flyButton.classList.add('is-hidden');

  const factCard = el('div', 'panel fact-card');
  // Named above the text rather than inside it: a child who cannot read the paragraph can
  // still match three words against the ring they just tapped.
  const factTitle = el('strong', 'fact-title');
  const factText = el('p');
  const narrateButton = el('button', 'btn btn--round narrate-btn');
  narrateButton.append(createIcon('speaker'));
  narrateButton.type = 'button';
  narrateButton.setAttribute('aria-label', 'Read this out loud');
  factCard.append(factTitle, factText, narrateButton);
  factCard.classList.add('is-hidden');

  /**
   * The one way back, from the moment the ship arrives until it leaves again.
   *
   * This replaces a pair that used to split the job: a 62px unlabelled round "🌍" while
   * a mission was running, and a big labelled "Explore Again" once it was finished. Two
   * problems with that. The quiet one was the *only* thing in the dock during a mission,
   * competing with nothing, yet styled to lose — a translucent circle next to the
   * journal's translucent circle, with no word on it to say which was which. And the
   * loud one appeared only on completion, so the game shouted the exit at exactly the
   * child who no longer needed it and whispered it at the one who did.
   *
   * So: one button, always the same words, never hidden mid-mission. It stays visually
   * secondary to whatever the primary action is, but it is unmistakably a button with a
   * label, because "how do I get out of here" should never need a guess.
   */
  const homeButton = el('button', 'btn btn--secondary home-btn');
  homeButton.type = 'button';
  homeButton.append(createIcon('rocket'), el('span', undefined, 'Fly Home'));
  homeButton.classList.add('is-hidden');

  /*
   * Above Fly Home rather than beside it. The dock is a column, and the exit has to stay
   * exactly where it has always been — it is the answer to "how do I get out of here" and
   * a button that moves teaches that buttons move. So the new one goes on top of the
   * stack, and the one that matters most keeps the bottom.
   */
  const spinButton = el('button', 'btn btn--secondary spin-btn');
  spinButton.type = 'button';
  const spinLabel = el('span');
  spinButton.append(createIcon('sun'), spinLabel);
  spinButton.classList.add('is-hidden');

  dock.append(namePill, factCard, flyButton, spinButton, homeButton);
  root.append(dock);

  /* --- journal ------------------------------------------------------------- */

  const journalButton = el('button', 'btn btn--round journal-btn');
  journalButton.append(createIcon('journal'));
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
    const found = loadProgress().discoveries;
    let filled = 0;
    for (const id of found) {
      const discovery = DISCOVERIES[id];
      // A discovery that no longer exists — an id retired between releases — is skipped
      // rather than shown blank, and its slot goes back to being a question mark.
      if (!discovery) continue;
      const tile = el('div', 'sticker');
      tile.append(
        el('div', undefined, discovery.emoji),
        el('span', undefined, discovery.name),
      );
      stickerGrid.append(tile);
      filled++;
    }
    for (let i = filled; i < JOURNAL_SLOTS; i++) {
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

  homeButton.addEventListener('click', () => {
    onExploreAgain();
  });

  spinButton.addEventListener('click', () => {
    onSpin();
  });

  /*
   * Tap opens the journal; hold opens the grown-ups panel.
   *
   * A hold rather than a visible button, because anything on screen that opens settings is
   * something a five-year-old will open. Two seconds is long enough that no child holds it
   * by accident and short enough that an adult who has been told about it does not give up
   * — and the panel says the gesture in writing, which works precisely because the person
   * it needs to hide from cannot read it yet.
   */
  const HOLD_MS = 2000;
  let holdTimer = 0;
  let held = false;

  function endHold() {
    window.clearTimeout(holdTimer);
  }

  journalButton.addEventListener('pointerdown', () => {
    held = false;
    endHold();
    holdTimer = window.setTimeout(() => {
      held = true;
      onGrownups();
    }, HOLD_MS);
    timers.push(holdTimer);
  });
  // pointerup alone is not enough: a finger that slides off the button, or a pointer the
  // browser takes back mid-gesture, would otherwise leave the timer to fire later over
  // whatever the child had moved on to.
  for (const event of ['pointerup', 'pointerleave', 'pointercancel'] as const) {
    journalButton.addEventListener(event, endHold);
  }
  journalButton.addEventListener('click', () => {
    // The hold already did something. Chrome still fires the click that ended it.
    if (held) {
      held = false;
      return;
    }
    setJournalOpen(true);
  });
  closeJournal.addEventListener('click', () => setJournalOpen(false));
  renderJournal();

  /* --- behaviour ----------------------------------------------------------- */

  flyButton.addEventListener('click', () => {
    onFly();
  });

  let currentFact = '';
  // Tapping the words puts them away. The card is wide and the destination is now close
  // enough to fill the frame behind it, so a place worth finding can end up underneath it
  // — and a tap that lands on the card instead of on the ring it is covering has to do
  // something. Folding is the something: the next tap reaches the ring.
  factCard.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('.narrate-btn')) return;
    // Advances rather than simply closing, so a tap during a discovery still gets to the
    // completion line that was queued behind it.
    factTimeUp();
  });

  narrateButton.addEventListener('click', () => {
    if (narrator.speaking) {
      narrator.stop();
    } else if (currentFact) {
      // Unfolds the card as well as reading it, so the speaker is how you get the words
      // back on screen — one button, doing the one thing a child would expect of it.
      factCard.classList.remove('is-collapsed');
      factShownAt = Date.now();
      narrator.speak(currentFact);
      scheduleCollapse(11000);
    }
  });
  narrator.onChange((speaking) => {
    narrateButton.classList.toggle('is-speaking', speaking);
    narrateButton.setAttribute('aria-label', speaking ? 'Stop reading' : 'Read this out loud');
    // Fold away shortly after the reading finishes rather than on a fixed timer, so the
    // card is never taken away mid-sentence.
    if (!speaking) scheduleCollapse(1600);
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

  function setHomeAvailable(available: boolean) {
    homeButton.classList.toggle('is-hidden', !available);
  }

  function setHint(text: string | null) {
    hint.textContent = text ?? '';
    hint.style.opacity = text ? '1' : '0';
  }

  /**
   * The card folds itself away once it has been read, leaving only its speaker button.
   *
   * It used to stay up for the rest of the visit, and it is wide: at the old arrival
   * distance the destination was a small ball above it and that cost nothing, but the
   * flight now arrives close enough for the body to fill the frame, and a card across the
   * bottom third was sitting on top of the very places the child is being asked to find.
   * Two of the Moon's three were underneath it.
   */
  /**
   * A fact waiting for the card, shown when the one on screen has had its time.
   *
   * Exists for exactly one case: the last place on a body is found, and the completion
   * line wants the card a second later. Shown immediately it replaced the discovery that
   * had just been earned — so the one find that actually required the drag was the one
   * whose story got cut off after a second, which is precisely backwards.
   */
  let pendingFact: { text: string; title?: string } | null = null;

  /** The fact on screen has had its time: hand over to the next one, or fold away. */
  function factTimeUp() {
    const next = pendingFact;
    if (next) {
      pendingFact = null;
      showFact(next.text, next.title);
      return;
    }
    if (!currentFact) return;
    factCard.classList.add('is-collapsed');
  }

  /**
   * One pending fold at a time.
   *
   * Deliberately not `later()`: these overlap. Finding a place while the arrival fact is
   * still up replaces the words in the card, and the arrival's fold was already in flight
   * — it fired a second later and shut the discovery away before it had been read.
   */
  let collapseTimer = 0;
  let factShownAt = 0;
  /**
   * How long a fact is guaranteed to stay up, however the reading went.
   *
   * Speech that fails reports itself as finished immediately — no voices installed, an
   * error, a platform that refuses outside a gesture — and the fold is hung off the end of
   * the reading, so without a floor the card appeared and vanished inside two seconds.
   * Long enough here for an adult to read the longest fact aloud themselves.
   */
  const FACT_MINIMUM_MS = 6500;

  function scheduleCollapse(delay: number) {
    window.clearTimeout(collapseTimer);
    const held = Math.max(delay, FACT_MINIMUM_MS - (Date.now() - factShownAt));
    collapseTimer = window.setTimeout(factTimeUp, Math.max(0, held));
    timers.push(collapseTimer);
  }

  function showFact(text: string, title?: string) {
    currentFact = text;
    factShownAt = Date.now();
    factTitle.textContent = title ?? '';
    factTitle.classList.toggle('is-hidden', !title);
    factText.textContent = text;
    factCard.classList.remove('is-hidden', 'is-collapsed');
    factCard.classList.add('fade-in');
    // Deliberately not spoken. Playtesting was blunt about it: the platform voice is bad
    // enough that no narration beats this narration, and it used to start on its own for
    // every fact, so there was no way to not have it. The speaker button is right there
    // and now it is the only thing that starts a reading. One line to put back.
    scheduleCollapse(11000);
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
      flyButton.classList.toggle('is-hidden', !selection.flyLabel);
      if (selection.flyLabel) {
        flyButtonLabel.textContent = selection.flyLabel;
        flyButton.classList.add('fade-in');
      }
    },

    enterFlight() {
      namePill.classList.add('is-hidden');
      flyButton.classList.add('is-hidden');
      spinButton.classList.add('is-hidden');
      factCard.classList.add('is-hidden');
      // Nothing to go home from yet, and the flight owns the camera regardless.
      setHomeAvailable(false);
      setHint(null);
    },

    showArrival(label: string, fact: string) {
      setHomeAvailable(true);
      namePill.textContent = label;
      namePill.classList.remove('is-hidden');
      // Speech needs a recent user gesture on mobile; the fly button provided one, but if
      // the platform refuses anyway the button is right there.
      showFact(fact);
    },

    beginMission(caption: string, total: number) {
      setHint(null);
      buildSlots(total);
      missionCaption.textContent = caption;

      // A beat behind the arrival, so the fact gets read before a second thing appears.
      // The fact card and the name pill stay exactly where they are: the counter lives at
      // the top of the screen and the dock owns the bottom, so nothing has to move aside.
      later(() => {
        missionHud.classList.remove('is-hidden');
        // Its own keyframe, not .fade-in: that one animates transform and would drop the
        // translateX(-50%) that centres this, sliding the slots off to one side.
        missionHud.classList.add('fade-in-centred');
      }, 1400);
      // Deliberately not narrated. The fact is already being read aloud, and two voices
      // at once is worse than one — the caption is a picture prompt, not a line of script.
    },

    setMissionCaption(text: string) {
      // Not spoken either, for the same reason, and it was the worse of the two: the hunt
      // line arrives while a child is mid-search and had a voice interrupt them for it.
      missionCaption.textContent = text;
    },

    showNote(title: string, text: string) {
      showFact(text, title);
    },

    foldFact() {
      // Already out of the way, or there is nothing to fold.
      if (factCard.classList.contains('is-hidden')) return;
      if (factCard.classList.contains('is-collapsed')) return;
      // Somebody asked for this to be read. Taking it away mid-sentence is worse than
      // covering the planet, and the fold that follows a reading is scheduled already.
      if (narrator.speaking) return;

      /*
       * Deliberately bypasses FACT_MINIMUM_MS, which every other fold respects.
       *
       * That floor exists because a *timed* fold hung off the end of a reading fires
       * instantly on a device where speech fails, flashing the card away in under two
       * seconds. This fold is not a timer running out — it is an event, and the event is
       * the thing the card was introducing actually starting. Holding the words over it
       * for another four seconds would cover exactly what they were pointing at.
       */
      window.clearTimeout(collapseTimer);
      factCard.classList.add('is-collapsed');
    },

    showDiscovery(discovery: Discovery) {
      // Straight into the fact card, which reads it aloud. This is the whole payoff for
      // going and looking: the old collectible answered a tap with a counter going up.
      //
      // The emoji is in the title so the card, the badge now left on the planet and the
      // journal entry are visibly the same thing. For a child who cannot read the name,
      // that picture is the only part of the title that carries.
      showFact(discovery.fact, `${discovery.emoji} ${discovery.name}`);
      journalButton.setAttribute('data-new', 'true');
      if (journalOpen) renderJournal();
    },

    setMissionProgress(collected: number) {
      for (const [index, slot] of slots.entries()) {
        const filled = index < collected;
        slot.classList.toggle('is-filled', filled);
        const icon = slot.firstElementChild;
        if (icon) icon.innerHTML = iconMarkup(filled ? 'rock' : 'dot');
      }
    },

    completeMission(successLine: string, stickerId: string | null) {
      // Clear the slots before the award lands: they share the top of the screen.
      missionHud.classList.add('is-hidden');
      missionHud.classList.remove('fade-in-centred');
      namePill.classList.remove('is-hidden');
      // Behind the last discovery rather than over it. The sticker and the chime land now;
      // the words wait their turn.
      if (currentFact) {
        pendingFact = { text: successLine };
        // And only their turn. The card's own timer is the eleven-second backstop for a
        // fact nobody is reading aloud, which is the right wait for *finishing* with one
        // and much too long for handing over to the next: the celebration would arrive
        // after the sticker that announced it had already faded. Cut it to the time the
        // discovery is guaranteed and no more.
        scheduleCollapse(FACT_MINIMUM_MS);
      } else {
        showFact(successLine);
      }
      // The way home has been on screen throughout and stays exactly where it was. It
      // does not need promoting here — finishing is not the moment a child is looking
      // for the exit, and moving it now would teach that it moves.
      setHomeAvailable(true);
      if (stickerId) celebrate(stickerId);
    },

    showSpin(label: string | null) {
      spinLabel.textContent = label ?? '';
      spinButton.classList.toggle('is-hidden', !label);
      if (label) spinButton.classList.add('fade-in');
    },

    setSpinBusy(busy: boolean) {
      spinButton.disabled = busy;
      spinButton.classList.toggle('is-busy', busy);
    },

    showTapEcho(clientX: number, clientY: number) {
      const echo = el('div', 'tap-echo');
      echo.style.left = clientX + 'px';
      echo.style.top = clientY + 'px';
      // Removed by its own animation rather than a timer, so a reset mid-flight cannot
      // cancel the cleanup and strand it on screen.
      echo.addEventListener('animationend', () => echo.remove(), { once: true });
      root.append(echo);
    },

    showFindLabel(clientX: number, clientY: number, emoji: string, name: string) {
      /*
       * The name, right where the finger was.
       *
       * The fact card says the same name, in small orange text, at the bottom of the
       * screen — and a five-year-old who cannot read it has nothing at all connecting the
       * dot they just touched to the words that changed hundreds of pixels away. Reported
       * from the tablet by an adult who also had not made the connection.
       *
       * Kept to the emoji and the short name. This is the label on the thing, not the
       * story about it; the story is still the card's job.
       */
      const label = el('div', 'find-label');
      label.append(el('span', 'find-label__emoji', emoji), el('span', '', name));
      label.style.left = clientX + 'px';
      label.style.top = clientY + 'px';
      // Removed by its own animation, like the tap echo, so a Fly Home part-way through
      // cannot cancel the cleanup and leave it stuck over the scene.
      label.addEventListener('animationend', () => label.remove(), { once: true });
      root.append(label);
    },

    reset() {
      clearTimers();
      narrator.stop();
      awardCard?.remove();
      awardCard = null;
      setHomeAvailable(false);
      spinButton.classList.add('is-hidden');
      spinButton.disabled = false;
      spinButton.classList.remove('is-busy');
      for (const echo of root.querySelectorAll('.tap-echo')) echo.remove();

      setJournalOpen(false);
      journalButton.removeAttribute('data-new');
      renderJournal();

      currentFact = '';
      pendingFact = null;
      window.clearTimeout(collapseTimer);
      factCard.classList.remove('is-collapsed');
      factTitle.textContent = '';
      factTitle.classList.add('is-hidden');
      factText.textContent = '';
      missionHud.classList.add('is-hidden');
      slotRow.replaceChildren();
      slots = [];

      for (const node of [namePill, flyButton, factCard, homeButton]) {
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
