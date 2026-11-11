import { worldPicture, discoveryPicture } from './pictures';
import { worldCollections } from '../state/replay';
/**
 * The adventure interface: the map heading, contextual actions, deliberate reading, the
 * mission HUD and the discovery journal. The Space map's own controls live in src/map.
 *
 * Kept deliberately sparse — for this age group, one clear thing to press at a time.
 */

import type { Narrator } from '../audio/narration';
import { cueText } from '../audio/script';
import { DESTINATIONS, DISCOVERIES, type Discovery } from '../config';
import { STICKERS, foundEverything, loadProgress } from '../state/progress';
import { createIcon, iconMarkup, type IconName } from './icons';
import { cardPictureMarkup, picture, type CardPicture } from './visitPictures';
import {
  guideOnArrival,
  narrationOnEnd,
  shouldAutoNarrate,
  type PendingGuide,
} from './narrationFlow';
import { createPhotoViewer, findPhoto } from './photos';
import { createDialogFocus } from './dialog';
import { createPanelGuard, type PanelOpening } from './panelGuard';
import { createMapReturnGuard } from './mapReturnGuard';
import { createMoonJump } from '../toys/moonJump';
import { createBedtimeSpin } from '../toys/bedtimeSpin';
import { createSaturnBath } from '../toys/saturnBath';
import { createMarsRover } from '../toys/marsRover';
import { createMoonLight } from '../toys/moonLight';
import { createSunStar } from '../toys/sunStar';
import type { PartOfDay } from '../toys/daySpin';

export interface GameUI {
  /** A reward, journal, celebration or transcript currently has the child's attention. */
  readonly activityCovered: boolean;
  /** The world's toy is the visit's one ringed next step (after the finds, before it is played). */
  readonly toyIsNext: boolean;
  /** Space map is the visit's one ringed next step. */
  readonly mapIsNext: boolean;
  /** Day & night (Turn Earth on Earth) is one of this world's cards on the toy shelf. */
  readonly spinAvailable: boolean;
  /** A repeat tap over the old Space map footprint would still be ignored (mapReturnGuard.ts). */
  readonly mapReturnGuarded: boolean;
  /** A short line at the top, optionally led by one of the interface's own icons. */
  setHint(text: string | null, icon?: IconName): void;
  /** The Space map is up (src/map draws its own controls; this is the heading and journal). */
  setHome(home: boolean): void;
  /** Lowest edge of the heading and journal button at the top, in client pixels. */
  headingBottom(): number;
  /** Called when the flight starts: everything clears out of the way. */
  enterFlight(): void;
  /**
   * The ship has landed: the whole visit screen goes up at once and stays put (visit-B). With a
   * `worldId`, the name chip and the toy shelf are that world's; `places` is how many gold places
   * this visit has, the rings of the found counter (none on a world without places).
   */
  showArrival(cueId: string, label: string, fact: string, emoji: string, worldId?: string, places?: number): void;
  /** Clear idle fact content and follow-ups; an explicitly open reading panel stays open. */
  clearFact(): void;
  /**
   * The guided hunt has begun. The found counter has been on screen since arrival; this only
   * speaks the find instruction, and only when `speak` is set (the hunt starting by itself
   * after a quiet spell) and nothing else is talking. It is never queued behind the arrival
   * welcome: one line at arrival, and nothing waiting to talk over the child's first taps
   * (owner's playtest, 22 Oct 2026).
   */
  beginMission(caption: string, cueId?: string, speak?: boolean): void;
  /**
   * Queue a guide without replacing the current fact, such as a day/night explanation or
   * invitation. Waits behind whatever is being read, as the hunt line does,
    * and only authored audio starts by itself. Immediate state feedback may interrupt.
   */
  speakGuide(text: string, cueId: string, interrupt?: boolean): void;
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
  /** Turns the activity button into an explicit stop control while a day is turning. */
  setSpinBusy(busy: boolean): void;
  /**
   * Let the day/night button ask to be noticed in a quiet gap. See `shouldInviteSpin`.
   */
  setSpinAttention(on: boolean): void;
  /** Open Earth's bedtime spin toy over the visit. It is Earth's toy, so this plays it. */
  openBedtime(): void;
  /** Take any open toy away without its own exit (crash, teardown). */
  dismissToys(): void;
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
  /** Back to the opening state, without rebuilding any of the DOM. */
  reset(): void;
  dispose(): void;
}

export interface UIOptions {
  root: HTMLElement;
  narrator: Narrator;
  onExploreAgain(): void;
  /** The "turn this world through a day" button. Only offered where config has one. */
  onSpin(): void;
  onStopSpin(): void;
  /** Earth's bedtime spin moved the house into a new part of the day. */
  onBedtimePart(part: PartOfDay): void;
  /** The child left the bedtime spin. */
  onBedtimeClose(): void;
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
    onExploreAgain,
    onSpin,
    onStopSpin,
    onBedtimePart,
    onBedtimeClose,
    onGrownups,
    onFinale,
  } = options;
  const timers: number[] = [];
  const mapReturnGuard = createMapReturnGuard(window);

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

  /* --- day and night legend ----------------------------------------------- */

  const dayLegend = el('div', 'day-legend is-hidden');
  const dayKey = el('span', 'day-key', 'Day');
  const nightKey = el('span', 'night-key', 'Night');
  dayLegend.append(dayKey, nightKey);
  root.append(dayLegend);

  /** This visit's places, in the order found: the journal leads with them once the visit is done. */
  let visitFinds: string[] = [];
  let visitFound = 0;

  /* --- the Words card --------------------------------------------------------- */

  const factCard = el('div', 'panel fact-card');
  // Named above the text rather than inside it: a child who cannot read the paragraph can
  // still match three words against the ring they just tapped.
  const factTitle = el('strong', 'fact-title');
  const factText = el('p');
  factText.id = 'fact-transcript';
  const narrateButton = el('button', 'btn btn--round narrate-btn');
  narrateButton.append(picture('speaker'));
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
    onHide: () => {
      factCard.inert = false;
      journalPanel.inert = false;
    },
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
      { found: visitFound, total: foundRings.length });
  }

  /** The discovery the card is currently about, or null for anything else. */
  let photoFor: string | null = null;

  /* --- the visit screen ------------------------------------------------------
   *
   * Owner's pick B, the toy shelf (design/visit-screen/visit-B.png, 11 Nov 2026). Everything a
   * child can do on a world is on screen from the moment the ship lands, in the same place on
   * every world, and never moves: Space map top left (the way back), the world's name beside
   * it, Listen and Journal small, the found counter, and the world's toys as big picture cards
   * on a paper shelf (along the bottom in portrait, down the right side in landscape). Nothing
   * appears later because of something the child did; a control may change state (Day & night
   * becomes Stop, a ring fills in), never place. The staged "quiet arrival" row, the first-Earth
   * welcome and the yellow hunt arrow are gone: even adults were lost when controls popped in.
   *
   * Layout is visit.css. The camera keeps the world in the clear playfield the screen leaves
   * (viewport.ts), so the world never sits under the shelf or the top buttons.
   */
  const visit = el('div', 'visit is-hidden');
  visit.setAttribute('role', 'group');
  visit.setAttribute('aria-label', 'Explore this world');

  /**
   * The one way back, from the moment the ship arrives until it leaves again: always the same
   * big sky button in the same corner, a ringed planet for the map of all the worlds.
   */
  const homeButton = el('button', 'visit-btn visit-map home-btn');
  homeButton.type = 'button';
  homeButton.setAttribute('aria-label', 'Back to the space map');
  homeButton.append(picture('planet'));

  /** The world's name and its little picture: what a grown-up reads out, what a child matches. */
  const worldChip = el('div', 'visit-chip');
  worldChip.setAttribute('aria-hidden', 'true');
  const chipName = el('strong', 'visit-chip__name');

  const listenButton = el('button', 'visit-btn visit-small listen-btn');
  listenButton.type = 'button';
  listenButton.setAttribute('aria-label', 'Listen');
  listenButton.append(picture('speaker'));

  /** Three gold rings, one per place on this visit; a found place fills its ring. */
  const foundCounter = el('div', 'visit-found');
  foundCounter.setAttribute('role', 'img');
  let foundRings: HTMLElement[] = [];
  function buildRings(total: number) {
    visitFound = 0;
    foundRings = Array.from({ length: total }, () => el('i', 'found-ring'));
    foundCounter.replaceChildren(...foundRings);
    foundCounter.setAttribute('aria-label', `0 of ${total} places found`);
    foundCounter.classList.toggle('is-hidden', total === 0);
  }

  const shelf = el('div', 'toy-shelf');
  shelf.setAttribute('role', 'group');
  shelf.setAttribute('aria-label', 'Things to do here');

  /** A big picture card on the shelf: the picture large, the word small beneath it. */
  function toyCard(className: string, word: string, name: string): { card: HTMLButtonElement; label: HTMLSpanElement } {
    const card = el('button', `toy-card ${className}`);
    card.type = 'button';
    card.setAttribute('aria-label', name);
    const label = el('span', 'toy-card__label', word);
    card.append(el('span', 'toy-card__picture'), label);
    return { card, label };
  }
  function paint(card: HTMLElement, kind: CardPicture, worldId: string) {
    const art = card.querySelector('.toy-card__picture');
    if (art) art.innerHTML = cardPictureMarkup(kind, worldId);
  }

  visit.append(homeButton, worldChip, listenButton, foundCounter, shelf);

  let spinBusy = false;
  let visitWorldId = 'earth';
  let arrivalFact = '';
  let arrivalCue = '';
  let factOpen = false;
  let readingOpening: PanelOpening | null = null;

  function setFactOpen(open: boolean) {
    if (open === factOpen) return;
    factOpen = open;
    factShade.classList.toggle('is-hidden', !open);
    listenButton.setAttribute('aria-expanded', String(open));
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

  /* --- the world's toys, one card each ----------------------------------------- */

  // Earth's toy: day and night are Earth turning, seen from above the North Pole.
  const bedtimeSpin = createBedtimeSpin(root, {
    onPart: (part) => onBedtimePart(part),
    onClose: () => {
      spinButton.focus();
      onBedtimeClose();
    },
  });
  // On the Moon, jump side by side with yourself on Earth.
  const moonJump = createMoonJump(root, () => jumpButton.focus());
  /** The world's toy has been opened, so it counts as played for this visit. */
  let toyPlayed = false;
  function markToyPlayed() {
    toyPlayed = true;
    root.classList.remove('is-toy-next');
    // Played after the finds: Space map is the one ringed way on. Played before them: nothing
    // is ringed. The places are still there, never required. A world with no places to find
    // (the Sun) has nothing left to finish: its toy is the visit.
    if (root.classList.contains('is-complete') || !DESTINATIONS[visitWorldId]?.mission) {
      root.classList.add('is-map-next');
    }
  }
  /** Open a world's toy from its card. Every toy card shares this. */
  function openToy(open: () => void) {
    markToyPlayed();
    setFactOpen(false);
    pendingGuide = null;
    narrator.stop();
    open();
  }
  const { card: jumpButton } = toyCard('toy-card--jump jump-btn', 'Jump', 'Jump on the Moon');
  paint(jumpButton, 'jump', 'moon');
  jumpButton.addEventListener('click', () => openToy(() => moonJump.open()));
  // Saturn's toy: a giant bath where Saturn floats and the rocky worlds sink.
  const saturnBath = createSaturnBath(root, { onClose: () => bathButton.focus() });
  const { card: bathButton } = toyCard('toy-card--bath bath-btn', 'Bath', 'Saturn bath time');
  paint(bathButton, 'bath', 'saturn');
  bathButton.addEventListener('click', () => openToy(() => saturnBath.open()));
  // Mars's toy: drive Perseverance, with every command taking minutes to get there.
  const marsRover = createMarsRover(root, { onClose: () => roverButton.focus() });
  const { card: roverButton } = toyCard('toy-card--rover rover-btn', 'Rover', 'Drive the Mars rover');
  paint(roverButton, 'rover', 'mars');
  roverButton.addEventListener('click', () => openToy(() => marsRover.open()));
  // The Sun's toy: fly away from it until it is one star among the others.
  const sunStar = createSunStar(root, {
    onClose: () => sunStarButton.focus(),
    onSay: (cueId, text) => speakToyLine(cueId, text),
  });
  const { card: sunStarButton } = toyCard('toy-card--far sun-star-btn', 'Far away', 'Far away: fly away from the Sun');
  paint(sunStarButton, 'far-away', 'sun');
  sunStarButton.addEventListener('click', () => openToy(() => sunStar.open()));
  // The Moon's second toy, Moonlight (the Moon shines with the Sun's light). Jump stays the
  // Moon's ringed next step, so opening this does not count as the visit's toy being played.
  const moonLight = createMoonLight(root, {
    onClose: () => moonlightButton.focus(),
    onSay: (cueId, text) => speakToyLine(cueId, text),
  });
  const { card: moonlightButton } = toyCard('toy-card--moonlight moonlight-btn', 'Moonlight', 'Moonlight: why the Moon shines');
  paint(moonlightButton, 'moonlight', 'moon');
  moonlightButton.addEventListener('click', () => {
    setFactOpen(false);
    pendingGuide = null;
    narrator.stop();
    moonLight.open();
  });
  /*
   * Day and night. On Earth it is Turn Earth, Earth's bedtime spin toy (teal); on Mars and
   * Saturn it is the timed day turn of the world itself (grass), which becomes Stop while it
   * runs. One card, painted for the world on arrival.
   */
  const { card: spinButton, label: spinLabel } = toyCard('spin-btn', 'Day & night', 'Watch day and night');
  /** What the spin card says when it is not a Stop button. */
  let spinWord = 'Day & night';
  /** Picture, word and name for this world (repainted, so a Stop goes back to the world's own). */
  function paintSpin(worldId: string) {
    const earth = worldId === 'earth';
    const spin = DESTINATIONS[worldId]?.spin;
    spinWord = earth ? 'Turn Earth' : 'Day & night';
    spinLabel.textContent = spinWord;
    spinButton.classList.toggle('toy-card--turn-earth', earth);
    spinButton.classList.toggle('toy-card--day-night', !earth);
    spinButton.setAttribute('aria-label', earth ? 'Turn Earth: day and night'
      : `${spin?.label ?? 'Day and night'}: watch day and night`);
    paint(spinButton, earth ? 'turn-earth' : 'day-night', worldId);
  }
  /** The world's cards, its own toy first. Every card is on the shelf from arrival. */
  function fillShelf(worldId: string) {
    const spin = DESTINATIONS[worldId]?.spin ? [spinButton] : [];
    const cards: HTMLElement[] =
      worldId === 'moon' ? [jumpButton, moonlightButton]
        : worldId === 'mars' ? [roverButton, ...spin]
          : worldId === 'saturn' ? [bathButton, ...spin]
            : worldId === 'sun' ? [sunStarButton]
              : spin;
    if (cards.includes(spinButton)) paintSpin(worldId);
    shelf.replaceChildren(...cards);
    shelf.dataset.cards = String(cards.length);
    const toy = visitToy();
    for (const card of cards) card.classList.toggle('is-main-toy', card === toy);
  }
  /** A toy's own line: its words are already on screen; it plays only if it has a recording. */
  function speakToyLine(cueId: string, text: string) {
    if (soundOn && narrator.hasRecording(cueId)) narrator.speak(text, cueId, false);
  }

  function prepareCurrentWords() {
    const spin = DESTINATIONS[visitWorldId]?.spin;
    if (spinBusy && spin) showFact(spin.fact, 'Day & night', 'spin-' + visitWorldId, false);
    else if (!currentFact) showFact(arrivalFact, chipName.textContent ?? '', arrivalCue, false);
  }
  // Listen opens the words and, with sound on, reads them out: written words exist in every
  // audio mode (AGENTS.md), and the heading's separate Words box is gone.
  listenButton.addEventListener('click', () => {
    prepareCurrentWords();
    pendingGuide = null;
    setFactOpen(true);
    if (soundOn) narrator.speak(currentFact, currentFactCueId);
  });

  /* --- journal ------------------------------------------------------------- */

  const journalButton = el('button', 'btn btn--round journal-btn');
  journalButton.append(picture('book'), el('span', 'control-label journal-label', 'Journal'));
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
  const journalVisitHint = el('p', 'journal-visit-hint');
  const journalDetailTitle = el('h3', 'journal-detail-title');
  const journalBack = el('button', 'journal-back is-hidden');
  journalBack.type = 'button';
  journalBack.append(createIcon('back'), el('span', '', 'All places'));
  journalBack.addEventListener('click', () => {
    const id = detailFor;
    clearJournalDetail();
    journalPanel.querySelector<HTMLButtonElement>(`.sticker[data-discovery="${id}"]`)?.focus();
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
  journalAudio.append(picture('speaker'));
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
  /*
   * Playtest 2 / state audit 11: a finished visit opened a page that was half dashed "Still
   * to find" tiles, which read as failure. Now the trip's own three snapshots lead the page
   * under a "3 found!" sticker, and the places left are a small calm "Next time" strip of
   * gold-place rings, the same ring the child hunts on the world.
   */
  const journalTrip = el('section', 'journal-trip');
  journalTrip.setAttribute('aria-label', 'Found on this trip');
  const journalNext = el('div', 'journal-next');
  journalPanel.append(journalHeader, journalTrip, collectionProgress, journalPageCaption, journalVisitHint, stickerGrid,
    journalNext, journalBack, journalDetailTitle, journalDetail, journalActions, closeJournal);
  const journalFocus = createDialogFocus(journalPanel, () => closeJournal, () => setJournalOpen(false));

  const journalShade = el('div', 'panel-shade journal-shade is-hidden');
  journalShade.append(journalPanel);
  root.append(journalButton, journalShade);
  root.append(visit);

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
      // Every place on the world found: the count becomes a sun star (storybook.css).
      row.classList.toggle('is-full', world.found === world.total);
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
    journalVisitHint.textContent = count < places.length
      ? `Each trip has three places. Visit ${worldLabel} again to find more.` : '';
    // The trip leads only on the page of the visit just finished; any other page lists what
    // is found, then the places still waiting.
    const trip = root.classList.contains('is-complete') && !root.classList.contains('is-home')
      && journalWorldId === visitWorldId
      ? places.filter(d => visitFinds.includes(d.id) && found.includes(d.id))
        .sort((a, b) => visitFinds.indexOf(a.id) - visitFinds.indexOf(b.id))
      : [];
    journalPanel.classList.toggle('is-trip', trip.length > 0);
    journalTrip.replaceChildren();
    if (trip.length) {
      const badge = el('span', 'journal-trip__badge');
      badge.setAttribute('aria-hidden', 'true');
      badge.append(el('b', undefined, String(trip.length)), el('span', undefined, 'found!'));
      const head = el('p', 'journal-trip__head', `${worldLabel} trip`);
      head.prepend(worldPicture(journalWorldId));
      const photos = el('div', 'journal-trip__photos');
      for (const discovery of trip) {
        const tile = stickerTile(discovery);
        // The map card's "been there" tick, on each snapshot of this trip.
        const tick = createIcon('tick');
        tick.classList.add('journal-trip__tick');
        tile.append(tick);
        photos.append(tile);
      }
      journalTrip.append(badge, head, photos);
    }
    for (const discovery of places) {
      if (found.includes(discovery.id) && !trip.includes(discovery)) stickerGrid.append(stickerTile(discovery));
    }
    journalNext.replaceChildren();
    const left = places.length - count;
    if (left > 0) {
      const label = el('span', 'journal-next__label', 'Next time');
      label.prepend(createIcon('rocket'));
      const rings = el('span', 'journal-next__slots');
      rings.setAttribute('role', 'img');
      rings.setAttribute('aria-label', `${left} more ${left === 1 ? 'place' : 'places'} to find`);
      for (let i = 0; i < left; i++) rings.append(createIcon('target'));
      journalNext.append(label, rings);
    }
  }

  /** A found place: a button, because it does something — it tells the whole story of the place. */
  function stickerTile(discovery: Discovery) {
    const tile = el('button', 'sticker') as HTMLButtonElement;
    tile.type = 'button';
    tile.dataset.discovery = discovery.id;
    tile.setAttribute('aria-label', `${discovery.name} — read more`);
    tile.append(
      discoveryPicture(discovery.id),
      el('span', undefined, discovery.name),
    );
    tile.addEventListener('click', () => showJournalDetail(discovery));
    return tile;
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
  /** The visit's toy: the one card ringed after the finds (on Earth, Turn Earth). */
  function visitToy(): HTMLElement | null {
    if (visitWorldId === 'moon') return jumpButton;
    if (visitWorldId === 'saturn') return bathButton;
    if (visitWorldId === 'mars') return roverButton;
    if (visitWorldId === 'sun') return sunStarButton;
    if (visitWorldId === 'earth' && DESTINATIONS.earth?.spin) return spinButton;
    return null;
  }
  function setJournalOpen(open: boolean) {
    journalOpen = open;
    clearJournalDetail();
    if (open) {
      if (root.classList.contains('is-complete')) root.classList.add('has-seen-journal');
      if (DESTINATIONS[visitWorldId]?.mission && !root.classList.contains('is-home')) journalWorldId = visitWorldId;
      renderJournal();
      // The panel pops up in the button's own corner, so on a double tap the second touch
      // lands on Close. Remember when and on which press it opened; Close asks before acting.
      journalOpening = panelGuard.opened();
    }
    journalShade.classList.toggle('is-hidden', !open);
    journalPanel.classList.toggle('is-hidden', !open);
    closeJournal.replaceChildren(createIcon('back'),
      root.classList.contains('is-home') ? picture('planet') : worldPicture(visitWorldId),
      el('span', '', root.classList.contains('is-home') ? 'Back to space' : 'Keep exploring'));
    journalButton.classList.toggle('is-hidden', open);
    // Keep the visit's controls out of this modal.
    visit.inert = open;
    if (open) {
      journalButton.removeAttribute('data-new');
      journalFocus.open();
    } else {
      journalFocus.close();
    }
  }

  homeButton.addEventListener('click', (event) => {
    mapReturnGuard.arm(homeButton.getBoundingClientRect(), event);
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
  let guideGeneration = 0;

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
        const generation = guideGeneration;
        // A breath after the discovery rather than two recordings joined into one sentence.
        later(() => {
          if (soundOn && generation === guideGeneration) narrator.speak(guide.text, guide.cueId, false);
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

  /** The visit screen up (with the journal in its visit place) or down (the journal goes home). */
  function setHomeAvailable(available: boolean) {
    visit.classList.toggle('is-hidden', !available);
    if (available) visit.insertBefore(journalButton, foundCounter);
    else root.append(journalButton);
  }

  function setHint(text: string | null, icon?: IconName) {
    hint.replaceChildren();
    // The visit screen has no caption: the world's name chip and the pictures say it.
    if (!visit.classList.contains('is-hidden')) text = null;
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
    get mapReturnGuarded() {
      return mapReturnGuard.active;
    },

    get spinAvailable() {
      return spinButton.parentElement === shelf;
    },

    get toyIsNext() {
      return root.classList.contains('is-toy-next');
    },

    get mapIsNext() {
      return root.classList.contains('is-map-next');
    },

    get activityCovered() {
      return journalOpen || photoViewer.isOpen || Boolean(awardCard || finale) ||
        factOpen || moonJump.isOpen || moonLight.isOpen || sunStar.isOpen || bedtimeSpin.isOpen || saturnBath.isOpen || marsRover.isOpen;
    },
    setHint,

    setHome(home: boolean) {
      root.classList.toggle('is-home', home);
    },

    headingBottom() {
      const shown = [journalButton, ...(hint.textContent ? [hint] : [])]
        .filter((node) => !node.classList.contains('is-hidden'));
      return Math.max(0, ...shown.map((node) => node.getBoundingClientRect().bottom));
    },

    enterFlight() {
      setFactOpen(false);
      dayLegend.classList.add('is-hidden');
      root.classList.remove('is-home');
      root.classList.remove('is-earth', 'is-day-active', 'is-complete', 'has-seen-journal', 'is-map-next', 'is-toy-next', 'is-hunting');
      toyPlayed = false;
      this.dismissToys();
      factCard.classList.add('is-hidden');
      // Nothing to go home from yet, and the flight owns the camera regardless.
      setHomeAvailable(false);
      setHint(null);
    },

    showArrival(cueId: string, label: string, fact: string, _emoji: string, worldId = 'earth', places = 0) {
      root.classList.remove('is-home');
      root.classList.remove('is-complete', 'has-seen-journal', 'is-toy-next', 'is-map-next');
      root.classList.toggle('is-earth', worldId === 'earth');
      chipName.textContent = label;
      worldChip.replaceChildren(worldPicture(worldId), chipName);
      arrivalFact = fact;
      arrivalCue = cueId;
      visitWorldId = worldId;
      visitFinds = [];
      toyPlayed = false;
      root.classList.toggle('is-hunting', Boolean(DESTINATIONS[worldId]?.mission));
      buildRings(places);
      fillShelf(worldId);
      setHint(null);
      setHomeAvailable(true);
      setHint(null);
      showFact(fact, label, cueId);
    },

    beginMission(caption: string, cueId?: string, speak = false) {
      // The spoken instruction is a nudge for a child who has not tapped yet, never a second
      // line queued behind the welcome: a hunt started by a tap stays quiet, and a queued
      // line would land on top of the discovery the child is busy with. Without an authored
      // cue the gold places and the counter are the instruction, as they have always been.
      const arrival = guideOnArrival({
        hasRecording: narrator.hasRecording(cueId ?? null),
        soundOn,
        speaking: narrator.speaking,
      });
      if (speak && arrival === 'speak') narrator.speak(caption, cueId, false);
    },

    speakGuide(text: string, cueId: string, interrupt = false) {
      if (interrupt) {
        // The house has changed now; stale queued descriptions must not follow it.
        guideGeneration++;
        pendingGuide = null;
        narrator.stop();
      }
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
      if (!visitFinds.includes(discovery.id)) visitFinds.push(discovery.id);
      photoFor = discovery.id;
      void attachPhoto(discovery, !revisited);
      journalButton.setAttribute('data-new', 'true');
      if (journalOpen) renderJournal();
    },

    setMissionProgress(collected: number) {
      visitFound = collected;
      foundCounter.setAttribute('aria-label', `${collected} of ${foundRings.length} places found`);
      for (const [index, ring] of foundRings.entries()) ring.classList.toggle('is-filled', index < collected);
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
      root.classList.remove('is-hunting');
      // One ringed next step. The toy, if it has not been played this visit: its invitation
      // replaces the "fly home" follow-up, which would point away from it (Earth has no toy
      // line; its Day & night invitation speaks for itself). Otherwise Space map.
      if (visitToy() && !toyPlayed) {
        root.classList.add('is-toy-next');
        const toyCue = `toy-${visitWorldId}`;
        followUp = narrator.hasRecording(toyCue) ? { text: cueText(toyCue), cueId: toyCue } : undefined;
      } else {
        root.classList.add('is-map-next');
      }
      // The found counter stays where it is, full. Behind the last discovery rather than over it. The sticker and the chime land now;
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

    setSpinAttention(on: boolean) {
      // Called every frame, so it has to be idempotent and cheap. A class already set costs
      // nothing to set again.
      spinButton.classList.toggle('is-inviting', on);
    },

    openBedtime() {
      markToyPlayed();
      setFactOpen(false);
      bedtimeSpin.open();
    },

    dismissToys() {
      moonJump.close();
      moonLight.dismiss();
      sunStar.dismiss();
      bedtimeSpin.dismiss();
      saturnBath.dismiss();
      marsRover.dismiss();
    },

    setSpinProgress(progress: number | null) {
      // The card's own night half follows the world's turn (visit.css).
      spinButton.classList.toggle('is-turning', progress !== null);
      if (progress !== null) spinButton.style.setProperty('--turn', String(progress));
    },

    setSpinBusy(busy: boolean) {
      spinBusy = busy;
      dayLegend.classList.toggle('is-hidden', !busy);
      spinLabel.textContent = busy ? 'Stop' : spinWord;
      if (busy) spinButton.setAttribute('aria-label', 'Stop day and night');
      else paintSpin(visitWorldId);
      spinButton.disabled = false;
      spinButton.classList.toggle('is-busy', busy);
      root.classList.toggle('is-day-active', busy);
      if (busy) spinButton.classList.remove('is-inviting');
    },

    setSoundOn(on: boolean) {
      soundOn = on;
      // Sound off, the same speaker opens the words to read (with sound, it reads them too).
      listenButton.setAttribute('aria-label', on ? 'Listen' : 'Read the words');
      root.classList.toggle('is-sound-off', !on);
      if (!on) narrator.stop();
      updateNarrateButton();
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
      visitFinds = [];
      dayLegend.classList.add('is-hidden');
      root.classList.remove('is-earth', 'is-day-active', 'is-complete', 'has-seen-journal', 'is-map-next', 'is-toy-next', 'is-hunting');
      toyPlayed = false;
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
      this.dismissToys();
      spinBusy = false;
      spinLabel.textContent = spinWord;
      spinButton.classList.remove('is-busy', 'is-inviting', 'is-turning');
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
      factCard.classList.add('is-hidden');
      buildRings(0);
      visit.inert = false;
    },

    dispose() {
      clearTimers();
      // Its own window listener, so it has to be told rather than just detached.
      photoViewer.dispose();
      panelGuard.dispose();
      mapReturnGuard.dispose();
      journalFocus.dispose();
      factFocus.dispose();
      root.replaceChildren();
    },
  };
}
