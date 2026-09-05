/**
 * The interface layer: selection prompt, the big fly button, the arrival fact card, the
 * mission HUD and the discovery journal.
 *
 * Kept deliberately sparse — for this age group, one clear thing to press at a time.
 */

import type { Narrator } from '../audio/narration';
import { DISCOVERIES, JOURNAL_SLOTS, type Discovery } from '../config';
import { STICKERS, foundEverything, loadProgress } from '../state/progress';
import { createIcon, iconMarkup } from './icons';
import {
  guideOnArrival,
  narrationOnEnd,
  shouldAutoNarrate,
  type PendingGuide,
} from './narrationFlow';
import { createPhotoViewer, findPhoto } from './photos';

export interface SelectionInfo {
  label: string;
  /** Text for the launch button, or null when this body is not a destination. */
  flyLabel: string | null;
}

export interface DestinationChoice {
  id: string;
  label: string;
  emoji: string;
}

export interface GameUI {
  setHint(text: string | null): void;
  /** Large, stable alternatives to tapping small moving worlds in the canvas. */
  showDestinations(
    choices: readonly DestinationChoice[],
    selectedId?: string | null,
    newlyRevealedId?: string | null,
  ): void;
  showSelection(selection: SelectionInfo | null): void;
  /** Called when the flight starts: everything clears out of the way. */
  enterFlight(steerable?: boolean): void;
  showArrival(cueId: string, label: string, fact: string): void;
  /**
   * Puts up the progress counter. A beat after arrival, so the fact is read first, and
   * *alongside* the fact card rather than instead of it: the rocks are simply there to
   * be found, not a mode the child has entered and has to finish to leave.
   */
  beginMission(caption: string, total: number): void;
  setMissionCaption(text: string, cueId?: string): void;
  /** A place has been found: name it, and put it in the journal. */
  showDiscovery(discovery: Discovery): void;
  /**
   * Something worth saying that is not a find — it uses the same card and the same
   * speaker button, but nothing goes into the journal, because nothing was collected.
   */
  showNote(cueId: string, title: string, text: string): void;
  /**
   * Fold the card away to its speaker button now, because something has started that is
   * worth more than the words are. Idempotent, and normally yields to a reading in
   * progress. The explicit override is reserved for a visual lesson whose card would
   * cover the thing the narration asks the child to watch.
   */
  foldFact(forceWhileSpeaking?: boolean): void;
  /** Fills `collected` of the slots. */
  setMissionProgress(collected: number): void;
  /**
   * The celebration. `stickerId` is null when the sticker was already earned on an
   * earlier visit — the party happens either way, only the "new sticker" badge does not.
   */
  completeMission(cueId: string, successLine: string, stickerId: string | null): void;
  /**
   * The bigger celebration, for finding every place on every world. Follows the world's
   * own completion rather than replacing it; `stickerId` works as in `completeMission`.
   */
  completeGame(stickerId: string | null): void;
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
  /** Sound off also stops and hides the read-aloud button, which is the only sound the UI owns. */
  setSoundOn(on: boolean): void;
  /**
   * Point at the last place still to be found, or `null` to take the arrow away.
   *
   * `-1` for the left edge, `1` for the right. Only ever shown while the one remaining
   * discovery is round the back: it is the drag lesson, made visible.
   */
  setHuntArrow(side: -1 | 1 | null): void;
  /** Back to the opening state, without rebuilding any of the DOM. */
  reset(): void;
  dispose(): void;
}

export interface UIOptions {
  root: HTMLElement;
  narrator: Narrator;
  onFly(): void;
  onChooseDestination(id: string): void;
  onExploreAgain(): void;
  /** The "turn this world through a day" button. Only offered where config has one. */
  onSpin(): void;
  /**
   * Someone held the journal button down. That is the way back into the grown-ups panel,
   * and it is deliberately a gesture rather than a button: a settings control on screen is
   * a settings control a five-year-old will press.
   */
  onGrownups(): void;
  /**
   * The finale has just come on screen. The sound for it belongs to whoever owns sound;
   * this is the moment to play it, because the overlay waits for the sticker to fade.
   */
  onFinale(): void;
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
  const {
    root,
    narrator,
    onFly,
    onChooseDestination,
    onExploreAgain,
    onSpin,
    onGrownups,
    onFinale,
  } = options;
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

  /*
   * The moving 3D bodies remain tappable, but are no longer the only way to choose. In the
   * widest map the inner worlds are necessarily tiny, and a generous invisible sphere does
   * not help a child understand which speck it belongs to. These stable, word-and-picture
   * controls are large enough for a finger and preserve the scene as scenery rather than
   * asking it to carry the whole navigation system.
   */
  const destinationBar = el('nav', 'destination-bar is-hidden');
  destinationBar.setAttribute('aria-label', 'Choose a world');
  root.append(destinationBar);

  function showDestinations(
    choices: readonly DestinationChoice[],
    selectedId: string | null = null,
    newlyRevealedId: string | null = null,
  ) {
    destinationBar.replaceChildren();
    destinationBar.style.setProperty('--destination-count', String(choices.length));
    for (const choice of choices) {
      const button = el('button', 'destination-choice') as HTMLButtonElement;
      button.type = 'button';
      button.setAttribute('aria-label', `Choose ${choice.label}`);
      button.classList.toggle('is-selected', choice.id === selectedId);
      button.classList.toggle('is-new', choice.id === newlyRevealedId);
      button.append(
        el('span', 'destination-choice__emoji', choice.emoji),
        el('span', 'destination-choice__label', choice.label),
      );
      button.addEventListener('click', () => onChooseDestination(choice.id));
      destinationBar.append(button);
    }
    destinationBar.classList.toggle('is-hidden', choices.length === 0);
    dock.classList.toggle('is-map-selection', Boolean(selectedId));
  }

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
  /*
   * A photograph of the place, when there is one for it.
   *
   * A thumbnail beside the words rather than a band above them: the card sits across the
   * bottom of the screen over the planet a child is looking at, and it has already had to
   * be taught to fold away for the day turn. A picture the width of the card would put a
   * third of the screen back. Small here, big on a tap — and it is a button, so it reaches
   * the same size as every other tap target in the game.
   */
  const factPhoto = el('button', 'fact-photo');
  factPhoto.type = 'button';
  factPhoto.setAttribute('aria-label', 'See a photo of this place');
  const factPhotoImage = document.createElement('img');
  factPhotoImage.alt = '';
  // The magnifier corner is the whole point of this change: a bare thumbnail read as
  // decoration, and a child (and an adult, reported on a phone) never learned it opens. The
  // icon is the wordless "this gets bigger" for an audience that cannot read a caption.
  const factPhotoZoom = el('span', 'fact-photo__zoom');
  factPhotoZoom.innerHTML = iconMarkup('expand');
  factPhoto.append(factPhotoImage, factPhotoZoom);
  factPhoto.classList.add('is-hidden');

  // The words get their own full width, and the picture and the speaker share the row
  // beneath. Flanking the text with both used to squeeze a long fact into a column so
  // narrow it ran ten lines deep and buried the planet — the very thing a child has just
  // flown to and is being asked to look at.
  const factActions = el('div', 'fact-actions');
  factActions.append(factPhoto, narrateButton);

  factCard.append(factTitle, factText, factActions);
  factCard.classList.add('is-hidden');

  /*
   * The drag lesson, made visible.
   *
   * One discovery on every world sits past the horizon, and reaching it is how a child
   * learns the camera can be turned — the single most important thing the game teaches
   * about its own controls. Until now the only cue was a line of text ("One more! Drag to
   * spin around Earth"), which is a poor instrument for an audience that mostly cannot
   * read. This points at where the place actually is, and only while it is out of sight.
   *
   * Outside the dock, because it belongs to the edge of the screen rather than to the
   * cluster of controls at the bottom.
   */
  const huntArrow = el('div', 'hunt-arrow is-hidden');
  huntArrow.setAttribute('aria-hidden', 'true');
  huntArrow.append(el('span', 'hunt-arrow__chevron', '❯'));
  root.append(huntArrow);

  const photoViewer = createPhotoViewer(root);
  /** What the thumbnail currently shows, so a tap opens the right one. */
  let photoShowing: { url: string; caption: string } | null = null;

  factPhoto.addEventListener('click', () => {
    if (photoShowing) photoViewer.show(photoShowing.url, photoShowing.caption);
  });

  function clearPhoto() {
    photoShowing = null;
    factPhoto.classList.add('is-hidden');
    factPhoto.classList.remove('is-fresh');
    factPhotoImage.removeAttribute('src');
  }

  /**
   * Looks for this place's photo and shows it if it exists.
   *
   * Guarded on the discovery still being the one on screen, because facts overlap: finding
   * a place replaces the arrival fact, and the completion line queues behind the last
   * discovery. A probe that resolves a moment late would otherwise staple the Sahara's
   * photograph to whatever the card had moved on to.
   */
  async function attachPhoto(discovery: Discovery) {
    clearPhoto();
    const url = await findPhoto(discovery.id);
    if (!url || photoFor !== discovery.id) return;
    factPhotoImage.src = url;
    photoShowing = { url, caption: `${discovery.emoji} ${discovery.name}` };
    factPhoto.classList.remove('is-hidden');
    // Pulse once to say "this is new, and it opens". Retriggered by removing the class and
    // forcing a reflow, because the element persists between finds and a CSS animation
    // otherwise fires only the first time.
    factPhoto.classList.remove('is-fresh');
    void factPhoto.offsetWidth;
    factPhoto.classList.add('is-fresh');
    later(() => factPhoto.classList.remove('is-fresh'), 2200);
  }

  /** The discovery the card is currently about, or null for anything else. */
  let photoFor: string | null = null;

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
    // A full book says so. A child who cannot read the title can still see there are no
    // question marks left, which is the same fact in the picture.
    journalTitle.textContent = foundEverything(found, Object.keys(DISCOVERIES))
      ? 'Every place found! 🥷'
      : 'My Discoveries';
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
  let currentFactCueId: string | null = null;
  let pendingGuide: PendingGuide | null = null;
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
      // Stop means stop. Do not let the queued hunt cue begin a moment later.
      pendingGuide = null;
      narrator.stop();
    } else if (currentFact) {
      // Unfolds the card as well as reading it, so the speaker is how you get the words
      // back on screen — one button, doing the one thing a child would expect of it.
      factCard.classList.remove('is-collapsed', 'is-audio-first');
      factShownAt = Date.now();
      narrator.speak(currentFact, currentFactCueId);
      scheduleCollapse(11000);
    }
  });
  narrator.onChange((speaking) => {
    narrateButton.classList.toggle('is-speaking', speaking);
    narrateButton.setAttribute('aria-label', speaking ? 'Stop reading' : 'Read this out loud');
    if (!speaking) {
      const action = narrationOnEnd(pendingGuide, soundOn);
      if (action.kind === 'speak-guide') {
        pendingGuide = null;
        const { guide } = action;
        // A breath after the discovery rather than two recordings joined into one sentence.
        later(() => {
          if (soundOn) narrator.speak(guide.text, guide.cueId, false);
        }, 350);
      } else {
        // Fold away shortly after the reading finishes rather than on a fixed timer, so the
        // card is never taken away mid-sentence.
        scheduleCollapse(1600);
      }
    }
  });
  /*
   * The read-aloud button exists when there is a voice to read with *and* sound is on.
   *
   * Sound off covers the reading too, and hides the button rather than leaving one that
   * does nothing. Authored narration starts automatically, but never after a parent has
   * turned sound off; the browser fallback still starts only from this explicit button.
   */
  let soundOn = true;

  function updateNarrateButton() {
    narrateButton.classList.toggle('is-hidden', !narrator.available || !soundOn);
  }
  updateNarrateButton();

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

  /* --- the finale ---------------------------------------------------------- */

  /*
   * Finding the ninth place completes the whole game, and it used to get exactly the same
   * celebration as finding the third. This is the moment the structure was dropping.
   *
   * It is the journal, shown full and big: every badge the child has left on every world,
   * popping in one after another in the order they were found, with the title of the game
   * as the thing they have become. Nothing on it needs reading. It follows the world's
   * own sticker rather than fighting it for the top of the screen, and it closes on any
   * tap or by itself, because a child must never be stuck behind a party.
   */
  const FINALE_DELAY_MS = 3200;
  const FINALE_MS = 14000;
  let finale: HTMLElement | null = null;

  function closeFinale() {
    const overlay = finale;
    if (!overlay) return;
    finale = null;
    overlay.classList.add('is-leaving');
    // By its own animation where there is one; by a timer where reduced motion took it
    // away and animationend would never come.
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
    later(() => overlay.remove(), 600);
  }

  function showFinale(stickerId: string | null) {
    closeFinale();
    const overlay = el('div', 'finale');
    const inner = el('div', 'panel finale__inner');

    const badges = el('div', 'finale__badges');
    const found = loadProgress().discoveries;
    // Every place in the game, in the order this child found them — the same order the
    // journal shows — so the badges are the ones they remember leaving.
    const ordered = [
      ...found.map((id) => DISCOVERIES[id]).filter((d): d is Discovery => d !== undefined),
      ...Object.values(DISCOVERIES).filter((d) => !found.includes(d.id)),
    ];
    ordered.forEach((discovery, index) => {
      const badge = el('span', 'finale__badge', discovery.emoji);
      badge.style.setProperty('--i', String(index));
      badge.setAttribute('title', discovery.name);
      badges.append(badge);
    });

    const title = el('strong', 'finale__title', 'You found every place!');
    const line = el('p', 'finale__line');
    const hero = STICKERS[stickerId ?? ''] ?? STICKERS['space-ninja'];
    line.append(
      el('span', 'finale__hero', hero?.emoji ?? '🥷'),
      el('span', undefined, stickerId ? `New sticker: ${hero?.label ?? 'Space Ninja'}` : 'You are a real Space Ninja'),
    );
    const done = el('button', 'btn finale__close', 'Hooray!');
    done.type = 'button';

    inner.append(badges, title, line, done);
    overlay.append(inner);
    overlay.addEventListener('click', closeFinale);
    root.append(overlay);
    finale = overlay;

    if (stickerId) journalButton.setAttribute('data-new', 'true');
    if (journalOpen) renderJournal();
    onFinale();
    later(closeFinale, FINALE_MS);
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
  let pendingFact: { text: string; title?: string; cueId?: string } | null = null;

  /** The fact on screen has had its time: hand over to the next one, or fold away. */
  function factTimeUp() {
    const next = pendingFact;
    if (next) {
      pendingFact = null;
      showFact(next.text, next.title, next.cueId);
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

  function showFact(text: string, title?: string, cueId?: string) {
    currentFact = text;
    currentFactCueId = cueId ?? null;
    pendingGuide = null;
    factShownAt = Date.now();
    // Every fact clears the photo; showDiscovery is the only one that puts one back, and
    // it does so after calling this. Otherwise the arrival fact or the success line would
    // inherit the picture belonging to the last place found.
    photoFor = null;
    clearPhoto();
    factTitle.textContent = title ?? '';
    factTitle.classList.toggle('is-hidden', !title);
    factText.textContent = text;
    factCard.classList.remove('is-hidden', 'is-collapsed', 'is-audio-first');
    factCard.classList.add('fade-in');
    // Only authored audio starts itself. A partial voice pack never makes the platform's
    // poor fallback begin talking, and the paragraph remains fully visible for that cue.
    if (shouldAutoNarrate(narrator.hasRecording(currentFactCueId), soundOn)) {
      factCard.classList.add('is-audio-first');
      narrator.speak(text, currentFactCueId, false);
    }
    scheduleCollapse(11000);
  }

  return {
    setHint,
    showDestinations,

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

    enterFlight(steerable = false) {
      destinationBar.classList.add('is-hidden');
      dock.classList.remove('is-map-selection');
      // This can be an outbound flight or Fly Home. In the latter case the old mission
      // rings and instruction otherwise hover over the receding solar-system map.
      missionHud.classList.add('is-hidden');
      namePill.classList.add('is-hidden');
      flyButton.classList.add('is-hidden');
      spinButton.classList.add('is-hidden');
      factCard.classList.add('is-hidden');
      // Nothing to go home from yet, and the flight owns the camera regardless.
      setHomeAvailable(false);
      setHint(steerable ? '☝️ ↔️  Steer the ship' : null);
    },

    showArrival(cueId: string, label: string, fact: string) {
      destinationBar.classList.add('is-hidden');
      setHomeAvailable(true);
      namePill.textContent = label;
      namePill.classList.remove('is-hidden');
      // Speech needs a recent user gesture on mobile; the fly button provided one, but if
      // the platform refuses anyway the button is right there.
      showFact(fact, undefined, cueId);
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

    setMissionCaption(text: string, cueId?: string) {
      missionCaption.textContent = text;
      // Wait behind the discovery narration rather than interrupting the reward the child
      // just earned. Without an authored cue the visual hand/arrow remains the instruction.
      const arrival = guideOnArrival({
        hasRecording: narrator.hasRecording(cueId ?? null),
        soundOn,
        speaking: narrator.speaking,
      });
      if (arrival === 'queue') pendingGuide = { text, cueId: cueId as string };
      else if (arrival === 'speak') narrator.speak(text, cueId, false);
    },

    showNote(cueId: string, title: string, text: string) {
      showFact(text, title, cueId);
    },

    foldFact(forceWhileSpeaking = false) {
      // Already out of the way, or there is nothing to fold.
      if (factCard.classList.contains('is-hidden')) return;
      if (factCard.classList.contains('is-collapsed')) return;
      // Somebody asked for this to be read. Taking it away mid-sentence is worse than
      // covering the planet, and the fold that follows a reading is scheduled already.
      if (narrator.speaking && !forceWhileSpeaking) return;

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
      // Straight into the fact card. Authored audio reads it aloud; the platform fallback
      // remains opt-in. This is the whole payoff for
      // going and looking: the old collectible answered a tap with a counter going up.
      //
      // The emoji is in the title so the card, the badge now left on the planet and the
      // journal entry are visibly the same thing. For a child who cannot read the name,
      // that picture is the only part of the title that carries.
      showFact(
        discovery.fact,
        `${discovery.emoji} ${discovery.name}`,
        `discovery-${discovery.id}`,
      );
      // And the real photograph, if one has been dropped in for this place. Started after
      // the words rather than waited on: the card must not hang on a network probe.
      photoFor = discovery.id;
      void attachPhoto(discovery);
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

    completeMission(cueId: string, successLine: string, stickerId: string | null) {
      // Clear the slots before the award lands: they share the top of the screen.
      missionHud.classList.add('is-hidden');
      missionHud.classList.remove('fade-in-centred');
      namePill.classList.remove('is-hidden');
      // Behind the last discovery rather than over it. The sticker and the chime land now;
      // the words wait their turn.
      if (currentFact) {
        pendingFact = { text: successLine, cueId };
        // And only their turn. The card's own timer is the eleven-second backstop for a
        // fact nobody is reading aloud, which is the right wait for *finishing* with one
        // and much too long for handing over to the next: the celebration would arrive
        // after the sticker that announced it had already faded. Cut it to the time the
        // discovery is guaranteed and no more.
        scheduleCollapse(FACT_MINIMUM_MS);
      } else {
        showFact(successLine, undefined, cueId);
      }
      // The way home has been on screen throughout and stays exactly where it was. It
      // does not need promoting here — finishing is not the moment a child is looking
      // for the exit, and moving it now would teach that it moves.
      setHomeAvailable(true);
      if (stickerId) celebrate(stickerId);
    },

    completeGame(stickerId: string | null) {
      // After the world's own sticker has had its 2.4 seconds and faded, not on top of it:
      // two celebrations at once is one celebration nobody can see.
      later(() => showFinale(stickerId), FINALE_DELAY_MS);
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

    setSoundOn(on: boolean) {
      soundOn = on;
      if (!on) narrator.stop();
      updateNarrateButton();
    },

    setHuntArrow(side: -1 | 1 | null) {
      // Called every frame while a mission is running, so it has to be cheap and it has to
      // be idempotent. Both are: a class that is already set costs nothing to set again.
      huntArrow.classList.toggle('is-hidden', side === null);
      huntArrow.classList.toggle('is-left', side === -1);
      huntArrow.classList.toggle('is-right', side === 1);
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
      // Clear this before stop(): the narrator's onChange listener otherwise interprets
      // reset as the end of a discovery and queues the hunt line into the fresh home view.
      pendingGuide = null;
      narrator.stop();
      awardCard?.remove();
      awardCard = null;
      // Straight out, not faded: clearTimers() above has already cancelled the timer that
      // would finish a fade, and a Fly Home during the party should not leave it hanging.
      finale?.remove();
      finale = null;
      setHomeAvailable(false);
      spinButton.classList.add('is-hidden');
      spinButton.disabled = false;
      spinButton.classList.remove('is-busy');
      for (const echo of root.querySelectorAll('.tap-echo')) echo.remove();

      setJournalOpen(false);
      journalButton.removeAttribute('data-new');
      renderJournal();

      currentFact = '';
      currentFactCueId = null;
      pendingFact = null;
      photoFor = null;
      clearPhoto();
      photoViewer.hide();
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
      destinationBar.classList.add('is-hidden');
      destinationBar.replaceChildren();
      dock.classList.remove('is-map-selection');
      missionHud.classList.remove('fade-in-centred');
      dock.classList.remove('is-hidden');
    },

    dispose() {
      clearTimers();
      // Its own window listener, so it has to be told rather than just detached.
      photoViewer.dispose();
      root.replaceChildren();
    },
  };
}
