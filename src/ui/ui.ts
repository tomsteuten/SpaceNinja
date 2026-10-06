import { worldPicture, discoveryPicture } from './pictures';
import { worldCollections } from '../state/replay';
/**
 * The adventure interface: destination tray, contextual actions, deliberate reading, the
 * mission HUD and the discovery journal.
 *
 * Kept deliberately sparse — for this age group, one clear thing to press at a time.
 */

import type { Narrator } from '../audio/narration';
import { cueText } from '../audio/script';
import { DESTINATIONS, DISCOVERIES, type Discovery } from '../config';
import { STICKERS, foundEverything, loadProgress } from '../state/progress';
import { createIcon, iconMarkup, type IconName } from './icons';
import {
  guideOnArrival,
  narrationOnEnd,
  shouldAutoNarrate,
  type PendingGuide,
} from './narrationFlow';
import { createPhotoViewer, findPhoto } from './photos';
import { createDialogFocus } from './dialog';
import { createPanelGuard, type PanelOpening } from './panelGuard';

export interface DestinationChoice {
  id: string;
  label: string;
  emoji: string;
  /**
   * Earned, but not yet. A locked world is shown in the bar and still *not drawn* in the
   * scene — see `revealedDestinations`. Reveal-gating the bodies fixes two composition
   * failures reported from a real deploy (Saturn looming across the bottom of a portrait
   * phone during "Tap the Moon"; Mars crossing Saturn's rings and reading as a moon caught
   * in them), so the bodies stay gated. What it also did, though, was hide the fact that
   * there is anywhere else to go at all: the first-run map is Earth and the Moon and gives
   * a child no reason to believe in a Mars. A padlocked button says "there is more" without
   * putting an un-earned planet in the shot.
   */
  locked?: boolean;
  /** What to say when a locked one is pressed: the world that unlocks it. */
  unlockedBy?: string;
}

export interface GameUI {
  /** A reward, journal, celebration or transcript currently has the child's attention. */
  readonly activityCovered: boolean;
  /** A short line at the top, optionally led by one of the interface's own icons. */
  setHint(text: string | null, icon?: IconName): void;
  /** Large, stable alternatives to tapping small moving worlds in the canvas. */
  showDestinations(
    choices: readonly DestinationChoice[],
    suggestedId?: string | null,
    newlyRevealedId?: string | null,
  ): void;
  /** Called when the flight starts: everything clears out of the way. */
  enterFlight(): void;
  /** With a `worldId`, the card's title is led by a small picture of that world. */
  showArrival(cueId: string, label: string, fact: string, emoji: string, worldId?: string): void;
  /** Clear idle fact content and follow-ups; an explicitly open reading panel stays open. */
  clearFact(): void;
  /**
   * Puts up the progress counter a beat after the gold places appear. The targets get the
   * first look, then the counter names the ambient hunt without becoming a mode the child
   * has to finish before leaving.
   *
   * `cueId` is the spoken instruction, and it queues behind the arrival welcome rather than
   * talking over it — the hunt now begins while that welcome is still being read, so the two
   * cues genuinely overlap in time for the first time.
   */
  beginMission(caption: string, total: number, cueId?: string): void;
  setMissionCaption(text: string, cueId?: string): void;
  /**
   * Queue a guide without replacing the current fact, such as a day/night explanation or
   * invitation. Waits behind whatever is being read, as the hunt line does,
   * and only authored audio starts by itself.
   */
  speakGuide(text: string, cueId: string): void;
  /**
   * A place has been found: name it, and put it in the journal.
   *
   * Available recordings play independently; missing recordings remain manual.
   * The reading panel remains available even when a recording is absent.
   */
  showDiscovery(discovery: Discovery, narrate?: boolean, revisited?: boolean): void;
  /**
   * Something worth saying that is not a find — it uses the same card and the same
   * speaker button, but nothing goes into the journal, because nothing was collected.
   */
  showNote(cueId: string, title: string, text: string): void;

  /** Fills `collected` of the slots. */
  setMissionProgress(collected: number): void;
  /**
   * The celebration. `stickerId` is null when the sticker was already earned on an
   * earlier visit — the party happens either way, only the "new sticker" badge does not.
   */
  completeMission(
    cueId: string,
    successLine: string,
    stickerId: string | null,
    title: string,
    /**
     * A guide line to speak behind the success line once it is actually shown and read —
     * the "you can fly home and pick another world" follow-up. Only passed when the hint
     * names a next world, and it rides the success narration whichever path shows it.
     */
    followUp?: PendingGuide,
  ): void;
  /**
   * The bigger celebration, for finding every place on every world. Follows the world's
   * own completion rather than replacing it.
   *
   * Unlike `completeMission`, this happens exactly once per save: it rides on the finale
   * sticker actually being awarded, so there is no already-earned case to carry. It used to
   * fire on any completion that left the book full, which meant every replay re-ran the
   * victory party for nothing.
   */
  completeGame(stickerId: string): void;
  /**
   * Answer a tap that hit nothing. Not a failure signal - to a small child an
   * unresponsive tap reads as a broken app rather than as a miss.
   */
  showTapEcho(clientX: number, clientY: number): void;
  /**
   * Name a place at the point on screen where it was found, so the answer arrives at the
   * thing that was touched rather than only in a card at the bottom of the screen.
   */
  showFindLabel(clientX: number, clientY: number, discoveryId: string, name: string): void;
  /**
   * Offer to turn the destination through a day, or take the offer away. Null hides it.
   *
   * `tint` colours the small globe on the button so it is recognisably *this* world's day
   * rather than a generic one.
   */
  showSpin(label: string | null, tint?: string): void;
  /** Turns the activity button into an explicit stop control while a day is turning. */
  setSpinBusy(busy: boolean): void;
  /**
   * Let the day/night button ask to be noticed in a quiet gap. See `shouldInviteSpin`.
   */
  setSpinAttention(on: boolean): void;
  setEarthWelcome(on: boolean): void;
  setDayHandsOn(on: boolean): void;
  dismissTurnCoach(): void;
  /**
   * Drive the button's own globe from the real turn, 0 → 1, or `null` for a resting half-lit globe.
   *
   * The small globe and the big planet then turn together, at the same rate, finishing
   * together — so the child watches the thing they pressed doing exactly what the world is
   * doing. That mapping between a control and its effect is the whole difficulty with this
   * feature, and this is the one moment it can be shown outright rather than implied.
   *
   * Fed from `DayTurn`'s own progress rather than a timer of its own, for the reason
   * everything else in this game follows the picture: a struggling tablet stretches the turn
   * well past its nominal duration, and anything scheduled against the clock would finish
   * early and leave the button still while the planet was still moving.
   */
  setSpinProgress(progress: number | null): void;
  /** Sound off also stops and hides the read-aloud button, which is the only sound the UI owns. */
  setSoundOn(on: boolean): void;
  /**
   * Point at the last place still to be found, or `null` to take the arrow away.
   *
   * `-1` for the left edge, `1` for the right. Only ever shown while the one remaining
   * discovery is round the back: it is the drag lesson, made visible — and a button that
   * turns the world there for a child who would rather tap than drag.
   */
  setHuntArrow(side: -1 | 1 | null): void;
  /**
   * The centre of the hunt arrow button in client pixels while it is shown, else null. Read
   * from layout rather than the animated box, so the idle coach's hand does not chase the
   * arrow's own nudge.
   */
  huntArrowCentre(): { x: number; y: number } | null;
  /**
   * Shake a destination button. The wordless half of answering a press on a locked world —
   * the hint line says which world unlocks it, and a child who cannot read gets the shake
   * and the padlock.
   */
  nudgeDestination(id: string): void;
  /** Back to the opening state, without rebuilding any of the DOM. */
  reset(): void;
  dispose(): void;
}

export interface UIOptions {
  root: HTMLElement;
  narrator: Narrator;
  /** One tap, one journey: this launches the flight, it does not select anything. */
  onChooseDestination(id: string): void;
  onExploreAgain(): void;
  /** The "turn this world through a day" button. Only offered where config has one. */
  onSpin(): void;
  onStopSpin(): void;
  onFindPlaces(): void;
  onNudgeDayTurn(): void;
  /** The hunt arrow was pressed: turn the world towards the hidden last place. */
  onTurnToHidden(): void;
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
    onChooseDestination,
    onExploreAgain,
    onSpin,
    onStopSpin,
    onFindPlaces,
    onNudgeDayTurn,
    onTurnToHidden,
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
    suggestedId: string | null = null,
    newlyRevealedId: string | null = null,
  ) {
    root.classList.toggle('is-home', choices.length > 0);
    destinationBar.replaceChildren();
    destinationBar.style.setProperty('--destination-count', String(choices.length));
    for (const choice of choices) {
      const button = el('button', 'destination-choice') as HTMLButtonElement;
      button.type = 'button';
      // "Fly to", not "Choose": one press on this button is the whole journey now, and the
      // label a screen reader speaks should say what the press actually does.
      button.setAttribute(
        'aria-label',
        choice.locked
          ? `${choice.label} — visit ${choice.unlockedBy ?? 'another world'} first`
          : `Fly to ${choice.label}`,
      );
      /*
       * Deliberately neither `disabled` nor `aria-disabled`. A disabled button answers a
       * five-year-old's press with nothing at all, which reads as a broken app — the same
       * reason `showTapEcho` exists for a tap that hits empty space — and `aria-disabled`
       * tells assistive technology the same lie, that there is nothing here to press. There
       * is: it shakes, and it says which world unlocks it, and its label says so up front.
       */
      button.classList.toggle('is-locked', Boolean(choice.locked));
      // A suggestion, not a selection — nothing is ever in a chosen-but-not-acted-on state
      // any more. It marks the world the map is pointing at, alongside the
      // parked ship's nose.
      button.classList.toggle('is-suggested', choice.id === suggestedId);
      button.classList.toggle('is-new', choice.id === newlyRevealedId);
      // The world keeps its own picture even while locked — that picture is the whole
      // reason to want to go there, and a child who cannot read "Saturn" can want the one
      // with the rings. The padlock is a corner badge over it rather than a replacement.
      const orb = worldPicture(choice.id);
      button.append(orb, el('span', 'destination-choice__label', choice.label));
      if (choice.locked) {
        const lock = createIcon('lock');
        lock.classList.add('destination-choice__lock');
        button.append(lock);
      }
      button.dataset.destination = choice.id;
      button.addEventListener('click', () => onChooseDestination(choice.id));
      destinationBar.append(button);
    }
    destinationBar.classList.toggle('is-hidden', choices.length === 0);
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
  const dayLegend = el('div', 'day-legend is-hidden');
  dayLegend.append(el('span', 'day-key', 'Day'), el('span', 'night-key', 'Night'));
  root.append(dayLegend);

  let slots: HTMLElement[] = [];
  let visitFound = 0;

  function buildSlots(total: number) {
    visitFound = 0;
    missionHud.setAttribute('role', 'img');
    missionHud.setAttribute('aria-label', `0 of ${total} places found`);
    slotRow.replaceChildren();
    slots = [];
    for (let i = 0; i < total; i++) {
      const slot = el('div', 'slot');
      // Not colour alone: an empty slot is dashed and previews the gold target to find, a
      // filled one is solid, holds the rock and gains a tick.
      const slotIcon = el('span', 'slot-icon');
      slotIcon.innerHTML = iconMarkup('target');
      slot.append(slotIcon);
      slotRow.append(slot);
      slots.push(slot);
    }
  }

  /* --- dock: buttons + fact card ------------------------------------------- */

  const dock = el('div', 'dock');

  const factCard = el('div', 'panel fact-card');
  // Named above the text rather than inside it: a child who cannot read the paragraph can
  // still match three words against the ring they just tapped.
  const factTitle = el('strong', 'fact-title');
  const factText = el('p');
  factText.id = 'fact-transcript';
  const narrateButton = el('button', 'btn btn--round narrate-btn');
  narrateButton.append(createIcon('speaker'));
  narrateButton.type = 'button';
  narrateButton.setAttribute('aria-label', 'Read this out loud');
  /*
   * Optional discovery photo action below the full-width words in the deliberate reading
   * panel. Its thumbnail opens the larger photograph through the shared viewer.
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

  // Reading opens through Listen/Words; replay, photo and pictured return follow the text.
  const factActions = el('div', 'fact-actions');
  const factClose = el('button', 'btn panel-close');
  factClose.type = 'button';
  factClose.setAttribute('aria-label', 'Close the words');
  factClose.append(createIcon('close'));
  const factReturn = el('button', 'btn panel-return');
  factReturn.type = 'button';
  const factHeader = el('div', 'dialog-head');
  factTitle.id = 'fact-title';
  factHeader.append(factTitle, factClose);
  factActions.append(factPhoto, narrateButton, factReturn);
  factCard.append(factHeader, factText, factActions);
  factCard.setAttribute('role', 'dialog');
  factCard.setAttribute('aria-modal', 'true');
  factCard.setAttribute('aria-labelledby', factTitle.id);
  const factShade = el('div', 'panel-shade is-hidden');
  factShade.append(factCard);
  root.append(factShade);
  const factFocus = createDialogFocus(factCard, () => factReturn, () => setFactOpen(false));

  /*
   * The drag lesson, made visible — and made a button.
   *
   * One discovery on every world sits past the horizon, and reaching it is how a child
   * learns the camera can be turned — the single most important thing the game teaches
   * about its own controls. Until now the only cue was a line of text ("One more! Drag to
   * spin around Earth"), which is a poor instrument for an audience that mostly cannot
   * read. This points at where the place actually is, and only while it is out of sight.
   *
   * On the tablet the drag itself was the frustrating part: the arrow said where, the
   * child understood where, and turning the world there still took more than they had.
   * So the arrow now also *does* it: a press turns the world a quarter turn towards the
   * place. The drag still works and still turns further per swipe than it did; the button
   * is the smaller ask, offered first. Outside the dock, because it belongs to the edge of
   * the screen rather than to the cluster of controls at the bottom.
   */
  const huntArrow = el('button', 'hunt-arrow is-hidden') as HTMLButtonElement;
  huntArrow.type = 'button';
  huntArrow.setAttribute('aria-label', 'Turn to the last place');
  huntArrow.append(el('span', 'hunt-arrow__chevron', '❯'));
  huntArrow.addEventListener('click', () => onTurnToHidden());
  root.append(huntArrow);

  /*
   * One press counter for every panel the interface opens: the journal, the About words and
   * the photo. A fast second tap must not close what the first one opened — see panelGuard.
   */
  const panelGuard = createPanelGuard(window);
  const photoViewer = createPhotoViewer(root, {
    onJournal: () => {
      // The postcard button disappears on close; return focus to the persistent journal
      // control when the book later closes, rather than to that hidden postcard.
      journalButton.focus();
      setJournalOpen(true);
    },
    guard: panelGuard,
    onShow: () => { factCard.inert = true; journalPanel.inert = true; },
    onHide: () => { factCard.inert = false; journalPanel.inert = false; },
  });
  /** What the thumbnail currently shows, so a tap opens the right one. */
  let photoShowing: { url: string; caption: string } | null = null;

  factPhoto.addEventListener('click', () => {
    if (photoShowing) photoViewer.show(photoShowing.url, photoShowing.caption, visitWorldId);
  });

  function clearPhoto() {
    photoShowing = null;
    factPhoto.classList.add('is-hidden');
    factPhoto.classList.remove('is-fresh');
    factPhotoImage.removeAttribute('src');
  }
  // A successful HEAD probe cannot promise the browser can decode every image. Keep the
  // existing no-photo state when a cached file is truncated or a connection changes mid-load.
  factPhotoImage.addEventListener('error', clearPhoto);

  /**
   * Looks for this place's photo and shows it if it exists.
   *
   * Guarded on the discovery still being the one on screen, because facts overlap: finding
   * a place replaces the arrival fact, and the completion line queues behind the last
   * discovery. A probe that resolves a moment late would otherwise staple the Sahara's
   * photograph to whatever the card had moved on to.
   */
  async function attachPhoto(discovery: Discovery, showAsFirstFindReward: boolean) {
    clearPhoto();
    const url = await findPhoto(discovery.id);
    if (!url || photoFor !== discovery.id) return;
    factPhotoImage.src = url;
    photoShowing = { url, caption: discovery.name };
    factPhoto.classList.remove('is-hidden');
    // Pulse once to say "this is new, and it opens". Retriggered by removing the class and
    // forcing a reflow, because the element persists between finds and a CSS animation
    // otherwise fires only the first time.
    factPhoto.classList.remove('is-fresh');
    void factPhoto.offsetWidth;
    factPhoto.classList.add('is-fresh');
    later(() => factPhoto.classList.remove('is-fresh'), 2200);

    if (!showAsFirstFindReward) return;
    // A large postcard is the payoff for a first find, but it must not replace the instant
    // badge, words and narration with a wait for a lazy image. Waiting for decode also keeps
    // a slow connection from opening a dark overlay with an empty rectangle inside it.
    try {
      await factPhotoImage.decode();
    } catch {
      return;
    }
    if (photoFor !== discovery.id) return;
    photoViewer.showDiscovery(url, discovery.name, discovery.short, visitWorldId,
      { found: visitFound, total: slots.length });
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
   *
   * "Fly Home" and a rocket said the wrong thing twice: a rocket means *go*, not *come back*,
   * and "home" is the very world some children are standing on. It is now the solar-system map
   * icon and "Space map" — it names the place it returns to (the map of all the worlds), which
   * adults missed was always available and a pre-reader reads from the little orbit.
   */
  const homeButton = el('button', 'btn btn--secondary home-btn');
  homeButton.type = 'button';
  homeButton.setAttribute('aria-label', 'Back to the space map');
  homeButton.append(createIcon('spaceMap'), el('span', undefined, 'Space map'));
  homeButton.classList.add('is-hidden');

  // Picture + action + words: the globe explains the light, the arrow shows a turn,
  // and the short label reinforces its meaning. It stays in one place when it becomes Stop.
  const spinButton = el('button', 'btn btn--secondary spin-btn');
  spinButton.type = 'button';
  const spinPicture = el('span', 'spin-picture');
  spinPicture.setAttribute('aria-hidden', 'true');
  const spinGlobe = el('span', 'spin-globe');
  const spinSun = el('span', 'spin-sun');
  spinGlobe.append(el('span', 'spin-globe__night'));
  const spinArrow = el('span', 'spin-arrow');
  spinArrow.append(createIcon('turnArrow'));
  spinPicture.append(spinSun, spinGlobe, spinArrow);
  const spinLabel = el('span', 'control-label', 'Day & night');
  spinButton.append(spinPicture, spinLabel);
  spinButton.classList.add('is-hidden');
  let spinBusy = false;
  let preDayCaption = '';
  let visitWorldId = 'earth';
  let spinAccessibleLabel = 'Watch day and night';

  const listenButton = el('button', 'btn btn--secondary listen-btn is-hidden');
  const listenLabel = el('span', 'control-label', 'Listen');
  listenButton.append(createIcon('speaker'), listenLabel);
  listenButton.type = 'button';
  listenButton.setAttribute('aria-expanded', 'false');
  listenButton.setAttribute('aria-controls', 'fact-title');
  const worldHeading = el('div', 'world-heading is-hidden');
  const headingName = el('strong');
  const headingCaption = el('span', 'world-heading__caption');
  const headingCopy = el('div');
  headingCopy.append(headingName, headingCaption);
  worldHeading.append(headingCopy);
  const wordsButton = el('button', 'world-words', 'Words');
  wordsButton.type = 'button';
  wordsButton.setAttribute('aria-label', 'Read the words');
  wordsButton.setAttribute('aria-expanded', 'false');
  wordsButton.setAttribute('aria-controls', 'fact-title');
  headingCopy.append(wordsButton);
  root.append(worldHeading);
  let arrivalFact = '';
  let arrivalCue = '';
  let factOpen = false;
  let readingOpening: PanelOpening | null = null;

  function setFactOpen(open: boolean) {
    if (open === factOpen) return;
    factOpen = open;
    factShade.classList.toggle('is-hidden', !open);
    wordsButton.setAttribute('aria-expanded', String(open));
    if (open) {
      readingOpening = panelGuard.opened();
      factCard.classList.remove('is-hidden');
      factReturn.replaceChildren(createIcon('back'), worldPicture(visitWorldId), el('span', '', 'Keep exploring'));
      factFocus.open();
    } else {
      factFocus.close();
      pendingGuide = null;
      narrator.stop();
      scheduleFactAdvance(FACT_MINIMUM_MS);
    }
  }
  factClose.addEventListener('click', () => setFactOpen(false));
  factReturn.addEventListener('click', event => {
    if (panelGuard.allowsClose(readingOpening, event)) setFactOpen(false);
  });

  const visitActions = el('div', 'visit-actions is-hidden');
  const findPlacesButton = el('button', 'btn find-places-btn is-hidden');
  findPlacesButton.type = 'button';
  findPlacesButton.append(createIcon('target'), el('span', 'control-label', 'Find places'));
  findPlacesButton.addEventListener('click', onFindPlaces);
  const turnButton = el('button', 'btn turn-earth-btn is-hidden');
  turnButton.type = 'button';
  turnButton.append(worldPicture('earth'), el('span', 'control-label', 'Turn Earth'));
  turnButton.setAttribute('aria-label', 'Turn Earth a little');
  turnButton.addEventListener('click', onNudgeDayTurn);
  const turnCoach = el('div', 'day-gesture is-hidden');
  turnCoach.setAttribute('aria-hidden', 'true');
  turnCoach.append(createIcon('dragHand'));
  root.append(turnCoach);
  visitActions.setAttribute('role', 'group');
  visitActions.setAttribute('aria-label', 'Explore this world');
  visitActions.append(homeButton, listenButton, spinButton, findPlacesButton, turnButton);
  dock.append(visitActions);
  root.append(dock);

  function prepareCurrentWords() {
    const spin = DESTINATIONS[visitWorldId]?.spin;
    if (spinBusy && spin) showFact(spin.fact, 'Day & night', 'spin-' + visitWorldId, false);
    else if (!currentFact) showFact(arrivalFact, headingName.textContent ?? '', arrivalCue, false);
  }
  wordsButton.addEventListener('click', () => {
    prepareCurrentWords();
    setFactOpen(true);
    pendingGuide = null;
  });
  listenButton.removeAttribute('aria-expanded');
  listenButton.removeAttribute('aria-controls');
  listenButton.addEventListener('click', () => {
    prepareCurrentWords();
    pendingGuide = null;
    if (soundOn) narrator.speak(currentFact, currentFactCueId);
    else setFactOpen(true);
  });

  /* --- journal ------------------------------------------------------------- */

  const journalButton = el('button', 'btn btn--round journal-btn');
  journalButton.append(createIcon('journal'), el('span', 'control-label journal-label', 'Journal'));
  journalButton.type = 'button';
  journalButton.setAttribute('aria-label', 'Open your discovery journal');

  const journalPanel = el('div', 'panel journal-panel');
  journalPanel.classList.add('is-hidden');
  journalPanel.setAttribute('role', 'dialog');
  journalPanel.setAttribute('aria-modal', 'true');
  const journalTitle = el('h2', undefined, 'My Discoveries');
  journalTitle.id = 'journal-title';
  journalPanel.setAttribute('aria-labelledby', journalTitle.id);
  const collectionProgress = el('div', 'collection-progress');
  collectionProgress.setAttribute('role', 'group');
  collectionProgress.setAttribute('aria-label', 'Places found on each world');
  const journalPageCaption = el('p', 'journal-page-caption');
  const journalDetailTitle = el('h3', 'journal-detail-title');
  const journalBack = el('button', 'journal-back is-hidden');
  journalBack.type = 'button';
  journalBack.append(createIcon('back'), el('span', '', 'All places'));
  journalBack.addEventListener('click', () => {
    const id = detailFor;
    clearJournalDetail();
    stickerGrid.querySelector<HTMLButtonElement>(`[data-discovery="${id}"]`)?.focus();
  });
  const stickerGrid = el('div', 'sticker-grid');
  // Scrollable containers otherwise become an extra Tab stop in Chromium even when empty.
  stickerGrid.tabIndex = -1;
  /*
   * Where the long fact lives now that the card in play carries the short one.
   *
   * One detail at a time: the discovery photographs are fetched
   * only when a place is found and kept after, which is what makes twelve of them cost the
   * game nothing at startup. A journal that showed twelve thumbnails would have downloaded
   * all twelve. This is also the first thing in the game that makes the journal worth
   * opening for its own sake rather than as a scoreboard.
   */
  const journalDetail = el('p', 'journal-detail');
  journalDetail.hidden = true;
  const journalActions = el('div', 'fact-actions is-hidden');
  const journalPhoto = el('button', 'fact-photo is-hidden');
  journalPhoto.type = 'button';
  journalPhoto.setAttribute('aria-label', 'See a photo of this discovery');
  const journalImage = document.createElement('img');
  journalImage.alt = '';
  journalPhoto.append(journalImage, el('span', 'fact-photo__zoom', '⛶'));
  const journalAudio = el('button', 'btn btn--round narrate-btn');
  journalAudio.type = 'button';
  journalAudio.setAttribute('aria-label', 'Read this discovery out loud');
  journalAudio.append(createIcon('speaker'));
  journalActions.append(journalPhoto, journalAudio);
  let journalPhotoUrl: string | null = null;
  journalImage.addEventListener('error', () => {
    journalPhotoUrl = null;
    journalPhoto.classList.add('is-hidden');
    journalImage.removeAttribute('src');
  });
  journalPhoto.addEventListener('click', () => {
    const discovery = detailFor ? DISCOVERIES[detailFor] : undefined;
    if (journalPhotoUrl && discovery) photoViewer.show(journalPhotoUrl, discovery.name);
  });
  journalAudio.addEventListener('click', () => {
    const discovery = detailFor ? DISCOVERIES[detailFor] : undefined;
    if (!discovery) return;
    pendingGuide = null;
    if (narrator.speaking) narrator.stop();
    else narrator.speak(discovery.short, `discovery-${discovery.id}`);
  });
  const closeJournal = el('button', 'btn panel-return');
  closeJournal.setAttribute('aria-label', 'Close');
  const journalClose = el('button', 'btn panel-close');
  journalClose.type = 'button';
  journalClose.setAttribute('aria-label', 'Close journal');
  journalClose.append(createIcon('close'));
  journalClose.addEventListener('click', () => setJournalOpen(false));
  const journalHeader = el('div', 'dialog-head');
  journalHeader.append(journalTitle, journalClose);
  closeJournal.type = 'button';
  journalPanel.append(journalHeader, collectionProgress, journalPageCaption, stickerGrid,
    journalBack, journalDetailTitle, journalDetail, journalActions, closeJournal);
  const journalFocus = createDialogFocus(journalPanel, () => closeJournal, () => setJournalOpen(false));

  const journalShade = el('div', 'panel-shade journal-shade is-hidden');
  journalShade.append(journalPanel);
  root.append(journalButton, journalShade);

  let journalWorldId = 'earth';
  function renderJournal() {
    stickerGrid.replaceChildren();
    const found = loadProgress().discoveries;
    collectionProgress.replaceChildren();
    for (const world of worldCollections(found)) {
      const row = el('button', 'collection-progress__world') as HTMLButtonElement;
      row.type = 'button';
      row.setAttribute('aria-label', `${world.label}: ${world.found} of ${world.total} places found`);
      row.setAttribute('aria-pressed', String(world.id === journalWorldId));
      row.addEventListener('click', () => {
        clearJournalDetail();
        journalWorldId = world.id;
        renderJournal();
        collectionProgress.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
      });
      const label = el('span', 'collection-progress__label', world.label);
      label.prepend(worldPicture(world.id));
      row.append(label,
        el('span', '', `${world.found}/${world.total}`));
      const track = el('span', 'collection-progress__track');
      track.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < world.total; i++) track.append(el('span', i < world.found ? 'is-found' : ''));
      row.append(track);
      collectionProgress.append(row);
    }
    // A full book says so; each world's page also replaces its missing-place symbols.
    journalTitle.textContent = foundEverything(found, Object.keys(DISCOVERIES))
      ? 'Every place found!'
      : 'My Discoveries';
    const definition = DESTINATIONS[journalWorldId]?.mission;
    const places = definition?.discoveries ?? [];
    const count = places.filter(d => found.includes(d.id)).length;
    const worldLabel = journalWorldId.charAt(0).toUpperCase() + journalWorldId.slice(1);
    journalPageCaption.textContent = `${worldLabel} · ${count} of ${places.length} places found`;
    for (const discovery of places) {
      if (!found.includes(discovery.id)) {
        const empty = el('div', 'sticker sticker--empty');
        empty.append(createIcon('target'), el('span', '', 'Still to find'));
        stickerGrid.append(empty);
        continue;
      }
      // A button, because it does something: it tells you the whole story of the place.
      const tile = el('button', 'sticker') as HTMLButtonElement;
      tile.type = 'button';
      tile.dataset.discovery = discovery.id;
      tile.setAttribute('aria-label', `${discovery.name} — read more`);
      tile.append(
        discoveryPicture(discovery.id),
        el('span', undefined, discovery.name),
      );
      tile.addEventListener('click', () => showJournalDetail(discovery));
      stickerGrid.append(tile);
    }
  }

  /** The story owns one place and its lazy photograph until the reader returns to the page. */
  let detailFor: string | null = null;

  function showJournalDetail(discovery: Discovery) {
    clearJournalDetail();
    detailFor = discovery.id;
    journalPanel.classList.add('is-reading');
    journalBack.classList.remove('is-hidden');
    journalDetailTitle.textContent = discovery.name;
    journalDetail.textContent = discovery.fact;
    journalDetail.hidden = false;
    journalBack.focus();
    journalActions.classList.remove('is-hidden');
    journalAudio.classList.toggle('is-hidden', !soundOn || !narrator.available);
    void findPhoto(discovery.id).then((url) => {
      if (detailFor !== discovery.id || !url) return;
      journalPhotoUrl = url;
      journalImage.src = url;
      journalPhoto.classList.remove('is-hidden');
    });
  }

  function clearJournalDetail() {
    if (detailFor) {
      pendingGuide = null;
      narrator.stop();
    }
    detailFor = null;
    journalPanel.classList.remove('is-reading');
    journalBack.classList.add('is-hidden');
    journalDetailTitle.textContent = '';
    journalDetail.hidden = true;
    journalDetail.textContent = '';
    journalActions.classList.add('is-hidden');
    journalPhoto.classList.add('is-hidden');
    journalImage.removeAttribute('src');
    journalPhotoUrl = null;
  }

  let journalOpen = false;
  let journalOpening: PanelOpening | null = null;
  function setJournalOpen(open: boolean) {
    journalOpen = open;
    clearJournalDetail();
    if (open) {
      if (DESTINATIONS[visitWorldId]?.mission && !root.classList.contains('is-home')) journalWorldId = visitWorldId;
      renderJournal();
      // The panel pops up in the button's own corner, so on a double tap the second touch
      // lands on Close. Remember when and on which press it opened; Close asks before acting.
      journalOpening = panelGuard.opened();
    }
    journalShade.classList.toggle('is-hidden', !open);
    journalPanel.classList.toggle('is-hidden', !open);
    closeJournal.replaceChildren(createIcon('back'),
      root.classList.contains('is-home') ? createIcon('spaceMap') : worldPicture(visitWorldId),
      el('span', '', root.classList.contains('is-home') ? 'Back to space' : 'Keep exploring'));
    journalButton.classList.toggle('is-hidden', open);
    // Keep the underlying row out of this modal.
    dock.classList.toggle('is-hidden', open);
    if (open) {
      journalButton.removeAttribute('data-new');
      journalFocus.open();
    } else {
      journalFocus.close();
    }
  }

  homeButton.addEventListener('click', () => {
    onExploreAgain();
  });

  spinButton.addEventListener('click', () => {
    if (spinBusy) onStopSpin();
    else onSpin();
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
  closeJournal.addEventListener('click', (event) => {
    if (!panelGuard.allowsClose(journalOpening, event)) return;
    setJournalOpen(false);
  });
  renderJournal();

  /* --- behaviour ----------------------------------------------------------- */

  let currentFact = '';
  let currentFactCueId: string | null = null;
  let pendingGuide: PendingGuide | null = null;

  /**
   * Say a guide line with no card: wait behind whatever is being read, and only ever start a
   * cue that has an authored recording. The one place the arrival/queue/ignore decision is
   * made for a spoken guide, shared by the `speakGuide` method and the finale below.
   */
  function playGuide(text: string, cueId: string) {
    const arrival = guideOnArrival({
      hasRecording: narrator.hasRecording(cueId),
      soundOn,
      speaking: narrator.speaking,
    });
    if (arrival === 'queue') pendingGuide = { text, cueId };
    else if (arrival === 'speak') narrator.speak(text, cueId, false);
  }

  narrateButton.addEventListener('click', () => {
    if (narrator.speaking) {
      // Stop means stop. Do not let the queued hunt cue begin a moment later.
      pendingGuide = null;
      narrator.stop();
    } else if (currentFact) {
      // Replay is an explicit action inside the reading panel.
      factShownAt = Date.now();
      narrator.speak(currentFact, currentFactCueId);
      scheduleFactAdvance(11000);
    }
  });
  narrator.onChange((speaking) => {
    journalAudio.classList.toggle('is-speaking', speaking);
    journalAudio.setAttribute('aria-label', speaking ? 'Stop reading discovery' : 'Read this discovery out loud');
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
        scheduleFactAdvance(1600);
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
    const awardIcon = el('div', 'award-icon');
    const worldId = Object.keys(DESTINATIONS).find(id => DESTINATIONS[id]?.mission?.stickerId === stickerId);
    awardIcon.append(worldId ? worldPicture(worldId) : createIcon('rocket'));
    award.append(awardIcon, awardText);
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

  function showFinale(stickerId: string) {
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
      const badge = el('span', 'finale__badge');
      badge.append(discoveryPicture(discovery.id));
      badge.style.setProperty('--i', String(index));
      badge.setAttribute('title', discovery.name);
      badges.append(badge);
    });

    const title = el('strong', 'finale__title', 'You found every place!');
    const line = el('p', 'finale__line');
    const hero = STICKERS[stickerId] ?? STICKERS['space-ninja'];
    line.append(
      createIcon('rocket'),
      el('span', undefined, `New sticker: ${hero?.label ?? 'Space Ninja'}`),
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
    // "You found every place. You are a Space Ninja!" — over the overlay, behind any success
    // line still reading, and only when its own recording is present.
    playGuide(cueText('finale'), 'finale');
    later(closeFinale, FINALE_MS);
  }

  function setHomeAvailable(available: boolean) {
    homeButton.classList.toggle('is-hidden', !available);
    visitActions.classList.toggle('is-hidden', !available);
    // One journal button owns both tap and grown-up hold behavior in either context.
    if (available) visitActions.append(journalButton);
    else root.append(journalButton);
  }

  function setHint(text: string | null, icon?: IconName) {
    if (!worldHeading.classList.contains('is-hidden')) {
      if (text) headingCaption.textContent = text;
      hint.style.opacity = '0';
      return;
    }
    hint.replaceChildren();
    if (text && icon) hint.append(createIcon(icon));
    if (text) hint.append(el('span', undefined, text));
    hint.style.opacity = text ? '1' : '0';
  }

  /**
   * Hold the completion fact behind the last discovery's reading window. Automatic
   * narration does not open the panel, and queued advancement waits while it is open.
   */
  let pendingFact:
    | { text: string; title?: string; cueId?: string; guide?: PendingGuide | null }
    | null = null;

  /** Advance queued narration only after the fact has had its time and the reader is done. */
  function factTimeUp() {
    if (factOpen) return;
    const next = pendingFact;
    if (next) {
      pendingFact = null;
      showFact(next.text, next.title, next.cueId);
      // showFact clears any queued guide; re-arm the success follow-up now that the success
      // line is the one on screen, so it plays when this narration ends.
      if (next.guide) pendingGuide = next.guide;
      return;
    }

  }

  // Replacing a fact cancels its old advance timer so a stale arrival timer cannot advance
  // past a new discovery. The timer advances queued content; it does not fold an open panel.
  let factAdvanceTimer = 0;
  let factShownAt = 0;
  /** Minimum reading window before queued advancement, even if speech ends immediately. */
  const FACT_MINIMUM_MS = 6500;

  function scheduleFactAdvance(delay: number) {
    window.clearTimeout(factAdvanceTimer);
    const held = Math.max(delay, FACT_MINIMUM_MS - (Date.now() - factShownAt));
    factAdvanceTimer = window.setTimeout(factTimeUp, Math.max(0, held));
    timers.push(factAdvanceTimer);
  }

  function showFact(text: string, title?: string, cueId?: string, allowNarrate = true) {
    setFactOpen(false);
    currentFact = text;
    currentFactCueId = cueId ?? null;
    pendingGuide = null;
    // A new explicit fact supersedes queued completion copy. Starting Day & night must not
    // later have its explanation replaced by the previous discovery's success follow-up.
    pendingFact = null;
    factShownAt = Date.now();
    // Every fact clears the photo; showDiscovery is the only one that puts one back, and
    // it does so after calling this. Otherwise the arrival fact or the success line would
    // inherit the picture belonging to the last place found.
    photoFor = null;
    clearPhoto();
    factTitle.textContent = title ?? '';
    factTitle.classList.toggle('is-hidden', !title);
    factTitle.classList.remove('has-world');
    factText.textContent = text;
    factCard.classList.remove('is-hidden');
    // Only authored audio starts itself. A partial voice pack never makes the platform's
    // fallback begin talking. Listen/Words keeps written text available for every cue.
    // `allowNarrate` lets the caller keep a visual moment silent; arrival welcomes can speak
    // while the child explores the already-visible targets.
    const autoNarrate =
      allowNarrate && shouldAutoNarrate(narrator.hasRecording(currentFactCueId), soundOn);
    // Words are always available by choice, even when this particular recording is absent.
    if (autoNarrate) {
      narrator.speak(text, currentFactCueId, false);
    }
    scheduleFactAdvance(11000);
  }

  return {
    get activityCovered() {
      return journalOpen || photoViewer.isOpen || Boolean(awardCard || finale) ||
        factOpen;
    },
    setHint,
    showDestinations,

    enterFlight() {
      setFactOpen(false);
      dayLegend.classList.add('is-hidden');
      missionHud.style.visibility = '';
      root.classList.remove('is-home');
      root.classList.remove('is-earth', 'is-day-active', 'is-complete', 'is-earth-welcome', 'is-hands-on');
      findPlacesButton.classList.add('is-hidden');
      turnButton.classList.add('is-hidden');
      turnCoach.classList.add('is-hidden');
      worldHeading.classList.add('is-hidden');
      listenButton.classList.add('is-hidden');
      destinationBar.classList.add('is-hidden');
      // This can be an outbound flight or Fly Home. In the latter case the old mission
      // rings and instruction otherwise hover over the receding solar-system map.
      missionHud.classList.add('is-hidden');
      spinButton.classList.add('is-hidden');
      factCard.classList.add('is-hidden');
      // Nothing to go home from yet, and the flight owns the camera regardless.
      setHomeAvailable(false);
      setHint(null);
    },

    showArrival(cueId: string, label: string, fact: string, _emoji: string, worldId = 'earth') {
      root.classList.remove('is-home');
      root.classList.remove('is-complete');
      root.classList.toggle('is-earth', worldId === 'earth');
      worldHeading.classList.remove('is-hidden');
      listenButton.classList.remove('is-hidden');
      headingName.textContent = label;
      headingCaption.textContent = worldId === 'sun' ? 'Our nearest star' : worldId === 'earth' ? 'Turn Earth. See day and night.' : 'Tap a gold place';
      worldHeading.replaceChildren(worldPicture(worldId), headingCopy);
      arrivalFact = fact;
      arrivalCue = cueId;
      visitWorldId = worldId;
      setHint(null);
      destinationBar.classList.add('is-hidden');
      setHomeAvailable(true);
      showFact(fact, label, cueId);
      const spin = DESTINATIONS[worldId]?.spin;
      this.showSpin(spin ? (worldId === 'earth' ? 'Day and night on Earth' : spin.label) : null, spin?.tint);
    },

    beginMission(caption: string, total: number, cueId?: string) {
      setHint(null);
      buildSlots(total);
      missionCaption.textContent = caption;

      // A beat behind the target reveal, so the places themselves arrive before a counter
      // asks the child to count them. The counter lives at the top and the dock owns the
      // bottom, so nothing has to move aside.
      later(() => {
        missionHud.classList.remove('is-hidden');
        // Its own keyframe, not .fade-in: that one animates transform and would drop the
        // translateX(-50%) that centres this, sliding the slots off to one side.
        missionHud.classList.add('fade-in-centred');
      }, 1400);
      // The spoken instruction waits behind the arrival welcome — two voices at once is
      // worse than one, and it is the welcome that is mid-sentence. Same queue the hunt
      // line uses to wait behind a discovery. Without an authored cue the target
      // silhouettes and the counter are the instruction, as they have always been.
      const arrival = guideOnArrival({
        hasRecording: narrator.hasRecording(cueId ?? null),
        soundOn,
        speaking: narrator.speaking,
      });
      if (arrival === 'queue') pendingGuide = { text: caption, cueId: cueId as string };
      else if (arrival === 'speak') narrator.speak(caption, cueId, false);
    },

    setMissionCaption(text: string, cueId?: string) {
      missionCaption.textContent = text;
      headingCaption.textContent = text;
      // Wait behind the discovery narration rather than interrupting the reward the child
      // just earned. Without an authored cue the visual hand/arrow remains the instruction.
      if (cueId) this.speakGuide(text, cueId);
    },

    speakGuide(text: string, cueId: string) {
      playGuide(text, cueId);
    },

    showNote(cueId: string, title: string, text: string) {
      showFact(text, title, cueId);
    },

    clearFact() {
      // An explicitly opened reading panel stays until its reader chooses an exit.
      if (factOpen) return;
      setFactOpen(false);
      window.clearTimeout(factAdvanceTimer);
      currentFact = '';
      currentFactCueId = null;
      pendingFact = null;
      pendingGuide = null;
      photoFor = null;
      clearPhoto();
      factTitle.textContent = '';
      factTitle.classList.add('is-hidden');
      factText.textContent = '';
      factCard.classList.add('is-hidden');

    },

    showDiscovery(discovery: Discovery, narrate = true, revisited = false) {
      // Keep the fact ready for Listen. Authored audio reads it aloud; the platform fallback
      // remains opt-in. This is the whole payoff for
      // going and looking: the old collectible answered a tap with a counter going up.
      //
      // The short line, not the long one. The long one is the journal's, where an adult can
      // read it out; see Discovery.short for why one card cannot serve both audiences.
      showFact(
        discovery.short,
        discovery.name,
        `discovery-${discovery.id}`,
        narrate,
      );
      // And the real photograph, if one has been dropped in for this place. Started after
      // the words rather than waited on: the card must not hang on a network probe. A first
      // find becomes a big postcard once that photograph is actually ready; repeats keep the
      // compact card so a familiar place does not keep stopping play.
      photoFor = discovery.id;
      void attachPhoto(discovery, !revisited);
      journalButton.setAttribute('data-new', 'true');
      if (journalOpen) renderJournal();
    },

    setMissionProgress(collected: number) {
      visitFound = collected;
      missionHud.setAttribute('aria-label', `${collected} of ${slots.length} places found`);
      for (const [index, slot] of slots.entries()) {
        const filled = index < collected;
        slot.classList.toggle('is-filled', filled);
        const icon = slot.firstElementChild;
        if (icon) icon.innerHTML = iconMarkup(filled ? 'rock' : 'target');
      }
    },

    completeMission(
      cueId: string,
      successLine: string,
      stickerId: string | null,
      title: string,
      followUp?: PendingGuide,
    ) {
      // The visit's finds are ready to revisit together. Keep exits in place and give the
      // journal the gold emphasis, cleared on the next arrival/flight.
      root.classList.add('is-complete');
      headingCaption.textContent = 'All three found! See your journal.';
      // Clear the slots before the award lands: they share the top of the screen.
      missionHud.classList.add('is-hidden');
      missionHud.classList.remove('fade-in-centred');
      // The card keeps carrying the identity — the name pill stays hidden for the whole
      // visit, as it has been since arrival.
      // Behind the last discovery rather than over it. The sticker and the chime land now;
      // the words wait their turn.
      if (currentFact) {
        pendingFact = { text: successLine, title, cueId, guide: followUp ?? null };
        // And only their turn. The card's own timer is the eleven-second backstop for a
        // fact nobody is reading aloud, which is the right wait for *finishing* with one
        // and much too long for handing over to the next: the celebration would arrive
        // after the sticker that announced it had already faded. Cut it to the time the
        // discovery is guaranteed and no more.
        scheduleFactAdvance(FACT_MINIMUM_MS);
      } else {
        showFact(successLine, title, cueId);
        // Nothing was on the card, so the success line shows now; arm its follow-up so it
        // plays when the success narration ends. showFact clears any queued guide first.
        if (followUp) pendingGuide = followUp;
      }
      // The way home has been on screen throughout and stays exactly where it was. It
      // does not need promoting here — finishing is not the moment a child is looking
      // for the exit, and moving it now would teach that it moves.
      setHomeAvailable(true);
      if (stickerId) celebrate(stickerId);
    },

    completeGame(stickerId: string) {
      // After the world's own sticker has had its 2.4 seconds and faded, not on top of it:
      // two celebrations at once is one celebration nobody can see.
      later(() => showFinale(stickerId), FINALE_DELAY_MS);
    },

    showSpin(label: string | null, tint?: string) {
      visitActions.classList.toggle('has-activity', Boolean(label));
      spinAccessibleLabel = label ? `${label}: watch day and night` : 'Watch day and night';
      spinButton.setAttribute('aria-label', spinAccessibleLabel);
      spinLabel.textContent = 'Day & night';
      spinGlobe.style.backgroundImage = worldPicture(visitWorldId).style.backgroundImage;
      if (tint) spinGlobe.style.setProperty('--world', tint);
      spinButton.classList.toggle('is-hidden', !label);
      if (label) spinButton.classList.add('fade-in');
    },

    setSpinAttention(on: boolean) {
      // Called every frame, so it has to be idempotent and cheap. A class already set costs
      // nothing to set again — the same bargain setHuntArrow makes.
      spinButton.classList.toggle('is-inviting', on);
    },

    setEarthWelcome(on: boolean) {
      root.classList.toggle('is-earth-welcome', on);
      findPlacesButton.classList.toggle('is-hidden', !on);
      headingCaption.textContent = on ? 'Make night. Bring back morning.'
        : root.classList.contains('is-complete') ? 'All three found! See your journal.' : 'Tap a gold place';
      spinLabel.textContent = on ? 'Turn Earth' : 'Day & night';
    },

    setDayHandsOn(on: boolean) {
      root.classList.toggle('is-hands-on', on);
      turnButton.classList.toggle('is-hidden', !on);
      turnCoach.classList.toggle('is-hidden', !on);
      if (on) {
        headingCaption.textContent = 'Drag Earth, or tap to turn.';
        spinLabel.textContent = 'Done';
      }
    },

    dismissTurnCoach() {
      turnCoach.classList.add('is-hidden');
    },

    setSpinProgress(progress: number | null) {
      spinGlobe.classList.toggle('is-turning', progress !== null);
      if (progress !== null) spinGlobe.style.setProperty('--turn', String(progress));
    },

    setSpinBusy(busy: boolean) {
      if (busy && !spinBusy) preDayCaption = headingCaption.textContent ?? '';
      spinBusy = busy;
      spinGlobe.style.backgroundImage = busy ? '' : worldPicture(visitWorldId).style.backgroundImage;
      headingCaption.textContent = busy ? 'Sunlight makes day.' : preDayCaption;
      dayLegend.classList.toggle('is-hidden', !busy);
      // Preserve the hunt's display state even if its delayed reveal happens mid-turn.
      missionHud.style.visibility = busy ? 'hidden' : '';
      spinLabel.textContent = busy ? 'Stop' : 'Day & night';
      spinButton.setAttribute('aria-label', busy ? 'Stop day and night' : spinAccessibleLabel);
      spinButton.disabled = false;
      spinButton.classList.toggle('is-busy', busy);
      root.classList.toggle('is-day-active', busy);
      if (busy) spinButton.classList.remove('is-inviting');
    },

    setSoundOn(on: boolean) {
      soundOn = on;
      listenLabel.textContent = on ? 'Listen' : 'Words';
      if (!on) narrator.stop();
      updateNarrateButton();
    },

    nudgeDestination(id: string) {
      const button = destinationBar.querySelector(`[data-destination="${id}"]`);
      if (!button) return;
      // Restart the animation on a repeat press rather than ignoring it: a child who presses
      // a locked world twice is asking twice and should be answered twice.
      button.classList.remove('is-refused');
      void (button as HTMLElement).offsetWidth;
      button.classList.add('is-refused');
    },

    setHuntArrow(side: -1 | 1 | null) {
      // Called every frame while a mission is running, so it has to be cheap and it has to
      // be idempotent. Both are: a class that is already set costs nothing to set again.
      huntArrow.classList.toggle('is-hidden', side === null);
      huntArrow.classList.toggle('is-left', side === -1);
      huntArrow.classList.toggle('is-right', side === 1);
    },

    huntArrowCentre() {
      if (huntArrow.classList.contains('is-hidden')) return null;
      // offsetLeft/Top ignore the transform the arrow's own animation applies, so this is
      // the resting centre. The root is the fixed full-screen layer, so its offsets are
      // already client pixels; the root's rect is added for a page that ever insets it.
      const rootRect = root.getBoundingClientRect();
      return {
        x: rootRect.left + huntArrow.offsetLeft + huntArrow.offsetWidth / 2,
        y: rootRect.top + huntArrow.offsetTop + huntArrow.offsetHeight / 2,
      };
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

    showFindLabel(clientX: number, clientY: number, discoveryId: string, name: string) {
      /*
       * The name, right where the finger was.
       *
       * The fact card says the same name, in small orange text, at the bottom of the
       * screen — and a five-year-old who cannot read it has nothing at all connecting the
       * dot they just touched to the words that changed hundreds of pixels away. Reported
       * from the tablet by an adult who also had not made the connection.
       *
       * Kept to the real thumbnail and the short name. This is the label on the thing, not the
       * story about it; the story is still the card's job.
       */
      const label = el('div', 'find-label');
      label.append(discoveryPicture(discoveryId), el('span', '', name));
      label.style.left = clientX + 'px';
      label.style.top = clientY + 'px';
      // Removed by its own animation, like the tap echo, so a Fly Home part-way through
      // cannot cancel the cleanup and leave it stuck over the scene.
      label.addEventListener('animationend', () => label.remove(), { once: true });
      root.append(label);
    },

    reset() {
      dayLegend.classList.add('is-hidden');
      missionHud.style.visibility = '';
      root.classList.remove('is-earth', 'is-day-active', 'is-complete', 'is-earth-welcome', 'is-hands-on');
      findPlacesButton.classList.add('is-hidden');
      turnButton.classList.add('is-hidden');
      turnCoach.classList.add('is-hidden');
      worldHeading.classList.add('is-hidden');
      listenButton.classList.add('is-hidden');
      setFactOpen(false);
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
      spinBusy = false;
      spinLabel.textContent = 'Day & night';
      spinButton.disabled = false;
      spinButton.classList.remove('is-busy', 'is-inviting', 'fade-in');
      spinGlobe.classList.remove('is-turning');
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
      window.clearTimeout(factAdvanceTimer);

      factTitle.textContent = '';
      factTitle.classList.add('is-hidden');
      factText.textContent = '';
      missionHud.classList.add('is-hidden');
      slotRow.replaceChildren();
      slots = [];

      for (const node of [factCard, homeButton]) {
        node.classList.add('is-hidden');
        // Or the animation will not replay the next time the node is shown.
        node.classList.remove('fade-in');
      }
      destinationBar.classList.add('is-hidden');
      destinationBar.replaceChildren();
      missionHud.classList.remove('fade-in-centred');
      dock.classList.remove('is-hidden');
    },

    dispose() {
      clearTimers();
      // Its own window listener, so it has to be told rather than just detached.
      photoViewer.dispose();
      panelGuard.dispose();
      journalFocus.dispose();
      factFocus.dispose();
      root.replaceChildren();
    },
  };
}
