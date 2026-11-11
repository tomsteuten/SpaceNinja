import { worldPicture } from './pictures';
/**
 * The adventure interface: the map heading, the visit screen (toy shelf and the Places
 * photo) and deliberate reading. The Space map's own controls live in src/map.
 *
 * Kept deliberately sparse — for this age group, one clear thing to press at a time.
 */

import type { Narrator } from '../audio/narration';
import { DESTINATIONS, type Discovery } from '../config';
import { createIcon, type IconName } from './icons';
import { cardPictureMarkup, picture, type CardPicture } from './visitPictures';
import {
  guideOnArrival,
  narrationOnEnd,
  shouldAutoNarrate,
  type PendingGuide,
} from './narrationFlow';
import { photoUrl } from './photos';
import { placePhotoRect } from './viewport';
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
  /** A toy or the reading panel currently has the child's attention. */
  readonly activityCovered: boolean;
  /** Space map is the visit's one ringed next step (after the world's toy has been played). */
  readonly mapIsNext: boolean;
  /** Day & night (Turn Earth on Earth) is one of this world's cards on the toy shelf. */
  readonly spinAvailable: boolean;
  /** A repeat tap over the old Space map footprint would still be ignored (mapReturnGuard.ts). */
  readonly mapReturnGuarded: boolean;
  /** A place's photo is up (the Places card, owner's pick B). */
  readonly placeOpen: boolean;
  /** A short line at the top, optionally led by one of the interface's own icons. */
  setHint(text: string | null, icon?: IconName): void;
  /** The Space map is up (src/map draws its own controls; this is the heading). */
  setHome(home: boolean): void;
  /** Lowest edge of the heading at the top, in client pixels. */
  headingBottom(): number;
  /** Called when the flight starts: everything clears out of the way. */
  enterFlight(): void;
  /**
   * The ship has landed: the whole visit screen goes up at once and stays put (visit-B). With a
   * `worldId`, the name chip and the toy shelf are that world's.
   */
  showArrival(cueId: string, label: string, fact: string, emoji: string, worldId?: string): void;
  /**
   * Queue a guide without replacing the current fact, such as a day/night explanation or
   * invitation. Waits behind whatever is being read, and only authored audio starts by itself.
   * Immediate state feedback may interrupt.
   */
  speakGuide(text: string, cueId: string, interrupt?: boolean): void;
  /** Something worth saying: it becomes what Listen reads, and reads itself if recorded. */
  showNote(cueId: string, title: string, text: string): void;
  /**
   * Show a place's real photo with its name and say its line (the world has been turned to
   * it). The photo's arrow and the Places card both ask for the next one.
   */
  showPlace(place: Discovery): void;
  /** Put the photo away (the child spun the world, tapped elsewhere, or opened a toy). */
  hidePlace(): void;
  /**
   * Answer a tap that hit nothing. Not a failure signal - to a small child an
   * unresponsive tap reads as a broken app rather than as a miss.
   */
  showTapEcho(clientX: number, clientY: number): void;
  /** Turns the activity button into an explicit stop control while a day is turning. */
  setSpinBusy(busy: boolean): void;
  /** Let the day/night button ask to be noticed in a quiet gap. See `shouldInviteSpin`. */
  setSpinAttention(on: boolean): void;
  /** Open Earth's bedtime spin toy over the visit. It is Earth's toy, so this plays it. */
  openBedtime(): void;
  /** Take any open toy away without its own exit (crash, teardown). */
  dismissToys(): void;
  /**
   * Drive the button's own globe from the real turn, 0 → 1, or `null` for a resting half-lit
   * globe, fed from `DayTurn`'s own progress so the card and the world finish together.
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
  /** The Places card or the photo's arrow: show the next place. */
  onPlaces(): void;
  /** The photo went away by the interface's own doing (a toy opened, Escape). */
  onPlaceHidden(): void;
  /**
   * Someone held the Listen button down for two seconds. That is the way into the grown-ups
   * panel, and it is deliberately a gesture rather than a button: a settings control on
   * screen is a settings control a five-year-old will press.
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
  const {
    root,
    narrator,
    onExploreAgain,
    onSpin,
    onStopSpin,
    onBedtimePart,
    onBedtimeClose,
    onPlaces,
    onPlaceHidden,
    onGrownups,
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
  factActions.append(narrateButton, factReturn);
  factCard.append(factHeader, factText, factActions);
  factCard.setAttribute('role', 'dialog');
  factCard.setAttribute('aria-modal', 'true');
  factCard.setAttribute('aria-labelledby', factTitle.id);
  const factShade = el('div', 'panel-shade is-hidden');
  factShade.append(factCard);
  root.append(factShade);
  const factFocus = createDialogFocus(factCard, () => factReturn, () => setFactOpen(false));

  /** One press counter for every panel, so a fast second tap cannot close what the first opened. */
  const panelGuard = createPanelGuard(window);

  /* --- the visit screen ------------------------------------------------------
   *
   * Owner's pick B, the toy shelf (design/visit-screen/visit-B.png, 11 Nov 2026). Everything a
   * child can do on a world is on screen from the moment the ship lands, in the same place on
   * every world, and never moves: Space map top left (the way back), the world's name beside
   * it, Listen small, and the world's toys and its Places card as big picture cards on a paper
   * shelf (along the bottom in portrait, down the right side in landscape). Nothing appears
   * later because of something the child did, except the place photo the child asked for with
   * the Places card (owner's pick B, design/places/places-B.png). There is no hunt: no gold
   * targets, no counter, no journal (DECISIONS.md, 11 Nov 2026).
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

  /*
   * The place photo (owner's pick B): the real photograph with its name, at the top of the
   * play area in portrait and beside the world in landscape, and a big green arrow on its
   * corner for the next place. Tapping the photo says its line again. Not a dialog: the world
   * stays live around it, and a drag or tap on the world puts it away.
   */
  const placePhoto = el('figure', 'place-photo is-hidden');
  placePhoto.setAttribute('aria-label', 'Photo of this place');
  const placeImageButton = el('button', 'place-photo__picture');
  placeImageButton.type = 'button';
  const placeImage = document.createElement('img');
  placeImage.alt = '';
  placeImage.draggable = false;
  placeImageButton.append(placeImage);
  const placeName = el('figcaption', 'place-photo__name');
  const placeNameText = el('span');
  placeName.append(placeNameText, picture('speaker'));
  const placeNext = el('button', 'place-photo__next');
  placeNext.type = 'button';
  placeNext.setAttribute('aria-label', 'Next place');
  placeNext.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
    '<path d="M7 20 H30 M20 9 L31 20 L20 31" fill="none" stroke="#2b2118" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M7 20 H30 M20 9 L31 20 L20 31" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  placePhoto.append(placeImageButton, placeName, placeNext);
  /** The place on show, or null. */
  let placeShowing: Discovery | null = null;
  /** Put the panel where viewport.ts says, so the camera's playfield and the photo agree. */
  function placePanel() {
    const rect = placePhotoRect(innerWidth, innerHeight);
    placePhoto.style.left = `${rect.left}px`;
    placePhoto.style.top = `${rect.top}px`;
    placePhoto.style.width = `${rect.right - rect.left}px`;
    placePhoto.style.setProperty('--photo-h', `${rect.image}px`);
  }
  function onResize() {
    if (placeShowing) placePanel();
  }
  window.addEventListener('resize', onResize);
  // A photo that will not load: the name and the line still stand (AGENTS.md, Assets).
  placeImage.addEventListener('error', () => placePhoto.classList.add('is-no-photo'));
  placeNext.addEventListener('click', () => onPlaces());
  placeImageButton.addEventListener('click', () => {
    if (!placeShowing) return;
    pendingGuide = null;
    if (soundOn && narrator.hasRecording(currentFactCueId)) narrator.speak(currentFact, currentFactCueId, false);
  });

  function hidePlace(fromUi: boolean) {
    if (!placeShowing) return;
    placeShowing = null;
    placePhoto.classList.add('is-hidden');
    root.classList.remove('is-place-open');
    placesButton.classList.remove('is-on');
    placesButton.setAttribute('aria-pressed', 'false');
    // Its line goes with it; Listen reads the world's own words again.
    if (currentFactCueId?.startsWith('discovery-')) {
      pendingGuide = null;
      narrator.stop();
      currentFact = '';
      currentFactCueId = null;
    }
    if (fromUi) onPlaceHidden();
  }

  visit.append(homeButton, worldChip, listenButton, placePhoto, shelf);
  root.append(visit);

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
    }
  }
  factClose.addEventListener('click', () => setFactOpen(false));
  factReturn.addEventListener('click', event => {
    if (panelGuard.allowsClose(readingOpening, event)) setFactOpen(false);
  });

  /* --- the world's toys, one card each ----------------------------------------- */

  /*
   * An open toy covers the visit, so the visit's own controls leave the Tab order until it
   * closes (keyboard and TV remote: Tab must not wander behind the toy), and focus comes
   * back to the card that opened it.
   */
  function toyClosed(card: HTMLElement) {
    visit.inert = false;
    card.focus();
  }

  // Earth's toy: day and night are Earth turning, seen from above the North Pole.
  const bedtimeSpin = createBedtimeSpin(root, {
    onPart: (part) => onBedtimePart(part),
    onClose: () => {
      toyClosed(spinButton);
      onBedtimeClose();
    },
  });
  // On the Moon, jump side by side with yourself on Earth.
  const moonJump = createMoonJump(root, () => toyClosed(jumpButton));
  /** The world's toy has been opened: it counts as played for this visit. */
  function markToyPlayed() {
    // The world's toy played: Space map is the one ringed way on.
    root.classList.add('is-map-next');
  }
  /** Open a world's toy from its card. Every toy card shares this. */
  function openToy(open: () => void) {
    markToyPlayed();
    hidePlace(true);
    setFactOpen(false);
    pendingGuide = null;
    narrator.stop();
    open();
    visit.inert = true;
  }
  const { card: jumpButton } = toyCard('toy-card--jump jump-btn', 'Jump', 'Jump on the Moon');
  paint(jumpButton, 'jump', 'moon');
  jumpButton.addEventListener('click', () => openToy(() => moonJump.open()));
  // Saturn's toy: a giant bath where Saturn floats and the rocky worlds sink.
  const saturnBath = createSaturnBath(root, { onClose: () => toyClosed(bathButton) });
  const { card: bathButton } = toyCard('toy-card--bath bath-btn', 'Bath', 'Saturn bath time');
  paint(bathButton, 'bath', 'saturn');
  bathButton.addEventListener('click', () => openToy(() => saturnBath.open()));
  // Mars's toy: drive Perseverance, with every command taking minutes to get there.
  const marsRover = createMarsRover(root, { onClose: () => toyClosed(roverButton) });
  const { card: roverButton } = toyCard('toy-card--rover rover-btn', 'Rover', 'Drive the Mars rover');
  paint(roverButton, 'rover', 'mars');
  roverButton.addEventListener('click', () => openToy(() => marsRover.open()));
  // The Sun's toy: fly away from it until it is one star among the others.
  const sunStar = createSunStar(root, {
    onClose: () => toyClosed(sunStarButton),
    onSay: (cueId, text) => speakToyLine(cueId, text),
  });
  const { card: sunStarButton } = toyCard('toy-card--far sun-star-btn', 'Far away', 'Far away: fly away from the Sun');
  paint(sunStarButton, 'far-away', 'sun');
  sunStarButton.addEventListener('click', () => openToy(() => sunStar.open()));
  // The Moon's second toy, Moonlight (the Moon shines with the Sun's light). Jump stays the
  // Moon's ringed next step, so opening this does not count as the visit's toy being played.
  const moonLight = createMoonLight(root, {
    onClose: () => toyClosed(moonlightButton),
    onSay: (cueId, text) => speakToyLine(cueId, text),
  });
  const { card: moonlightButton } = toyCard('toy-card--moonlight moonlight-btn', 'Moonlight', 'Moonlight: why the Moon shines');
  paint(moonlightButton, 'moonlight', 'moon');
  moonlightButton.addEventListener('click', () => {
    hidePlace(true);
    setFactOpen(false);
    pendingGuide = null;
    narrator.stop();
    moonLight.open();
    visit.inert = true;
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
  /*
   * Places (owner's pick B): the world turns to one of its real places and the photo comes
   * up. Another tap, here or on the photo's arrow, goes to the next place, round and round.
   * Tomato, a camera in front of two of the world's own photos.
   */
  const { card: placesButton } = toyCard('toy-card--places places-btn', 'Places', 'Places: see real photos');
  placesButton.setAttribute('aria-pressed', 'false');
  placesButton.addEventListener('click', () => {
    setFactOpen(false);
    onPlaces();
  });
  /** The world's cards, its own toy first and Places last. Every card is on the shelf from arrival. */
  function fillShelf(worldId: string) {
    const spin = DESTINATIONS[worldId]?.spin ? [spinButton] : [];
    const places = DESTINATIONS[worldId]?.places?.length ? [placesButton] : [];
    const cards: HTMLElement[] = [
      ...(worldId === 'moon' ? [jumpButton, moonlightButton]
        : worldId === 'mars' ? [roverButton, ...spin]
          : worldId === 'saturn' ? [bathButton, ...spin]
            : worldId === 'sun' ? [sunStarButton]
              : spin),
      ...places,
    ];
    if (cards.includes(spinButton)) paintSpin(worldId);
    if (places.length) paint(placesButton, 'places', worldId);
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
    // The hold already did something (the grown-ups panel). Chrome still fires the click.
    if (held) {
      held = false;
      return;
    }
    prepareCurrentWords();
    pendingGuide = null;
    setFactOpen(true);
    if (soundOn) narrator.speak(currentFact, currentFactCueId);
  });

  /** The visit's toy: the world's own card (on Earth, Turn Earth). */
  function visitToy(): HTMLElement | null {
    if (visitWorldId === 'moon') return jumpButton;
    if (visitWorldId === 'saturn') return bathButton;
    if (visitWorldId === 'mars') return roverButton;
    if (visitWorldId === 'sun') return sunStarButton;
    if (visitWorldId === 'earth' && DESTINATIONS.earth?.spin) return spinButton;
    return null;
  }

  homeButton.addEventListener('click', (event) => {
    mapReturnGuard.arm(homeButton.getBoundingClientRect(), event);
    hidePlace(false);
    onExploreAgain();
  });

  spinButton.addEventListener('click', () => {
    hidePlace(true);
    if (spinBusy) onStopSpin();
    else onSpin();
  });

  // Escape puts the photo away, as a tap elsewhere does (keyboard and TV remote).
  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && placeShowing && !factOpen) hidePlace(true);
  }
  window.addEventListener('keydown', onKey);

  /*
   * Hold Listen for two seconds: the grown-ups panel (it used to be the journal button's hold,
   * and the journal is gone). Long enough that no child holds it by accident, short enough that
   * an adult who has been told about it does not give up; the panel says so in writing, which
   * works because the person it hides from cannot read it yet. `?grownups` also opens it.
   */
  const HOLD_MS = 2000;
  let holdTimer = 0;
  let held = false;

  function endHold() {
    window.clearTimeout(holdTimer);
  }

  listenButton.addEventListener('pointerdown', () => {
    held = false;
    endHold();
    holdTimer = window.setTimeout(() => {
      held = true;
      onGrownups();
    }, HOLD_MS);
    timers.push(holdTimer);
  });
  // A finger that slides off, or a pointer the browser takes back, must not fire it later.
  for (const event of ['pointerup', 'pointerleave', 'pointercancel'] as const) {
    listenButton.addEventListener(event, endHold);
  }

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
      // Stop means stop. Do not let a queued guide begin a moment later.
      pendingGuide = null;
      narrator.stop();
    } else if (currentFact) {
      // Replay is an explicit action inside the reading panel.
      narrator.speak(currentFact, currentFactCueId);
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
        const generation = guideGeneration;
        // A breath after the line rather than two recordings joined into one sentence.
        later(() => {
          if (soundOn && generation === guideGeneration) narrator.speak(guide.text, guide.cueId, false);
        }, 350);
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

  /** The visit screen up or down. */
  function setHomeAvailable(available: boolean) {
    visit.classList.toggle('is-hidden', !available);
  }

  function setHint(text: string | null, icon?: IconName) {
    hint.replaceChildren();
    // The visit screen has no caption: the world's name chip and the pictures say it.
    if (!visit.classList.contains('is-hidden')) text = null;
    if (text && icon) hint.append(createIcon(icon));
    if (text) hint.append(el('span', undefined, text));
    hint.style.opacity = text ? '1' : '0';
  }

  /** The words Listen reads (and shows) from now on; reads itself if it has a recording. */
  function showFact(text: string, title?: string, cueId?: string, allowNarrate = true) {
    setFactOpen(false);
    currentFact = text;
    currentFactCueId = cueId ?? null;
    pendingGuide = null;
    factTitle.textContent = title ?? '';
    factTitle.classList.toggle('is-hidden', !title);
    factTitle.classList.remove('has-world');
    factText.textContent = text;
    // Only authored audio starts itself. A partial voice pack never makes the platform's
    // fallback begin talking. Listen keeps written text available for every cue.
    if (allowNarrate && shouldAutoNarrate(narrator.hasRecording(currentFactCueId), soundOn)) {
      narrator.speak(text, currentFactCueId, false);
    }
  }

  function clearWords() {
    currentFact = '';
    currentFactCueId = null;
    pendingGuide = null;
    factTitle.textContent = '';
    factTitle.classList.add('is-hidden');
    factText.textContent = '';
  }

  return {
    get mapReturnGuarded() {
      return mapReturnGuard.active;
    },

    get spinAvailable() {
      return spinButton.parentElement === shelf;
    },

    get mapIsNext() {
      return root.classList.contains('is-map-next');
    },

    get placeOpen() {
      return placeShowing !== null;
    },

    get activityCovered() {
      return factOpen || moonJump.isOpen || moonLight.isOpen || sunStar.isOpen || bedtimeSpin.isOpen ||
        saturnBath.isOpen || marsRover.isOpen;
    },
    setHint,

    setHome(home: boolean) {
      root.classList.toggle('is-home', home);
    },

    headingBottom() {
      return hint.textContent ? hint.getBoundingClientRect().bottom : 0;
    },

    enterFlight() {
      setFactOpen(false);
      hidePlace(false);
      dayLegend.classList.add('is-hidden');
      root.classList.remove('is-home', 'is-earth', 'is-day-active', 'is-map-next');
      this.dismissToys();
      // Nothing to go home from yet, and the flight owns the camera regardless.
      setHomeAvailable(false);
      setHint(null);
    },

    showArrival(cueId: string, label: string, fact: string, _emoji: string, worldId = 'earth') {
      root.classList.remove('is-home', 'is-map-next');
      root.classList.toggle('is-earth', worldId === 'earth');
      chipName.textContent = label;
      worldChip.replaceChildren(worldPicture(worldId), chipName);
      arrivalFact = fact;
      arrivalCue = cueId;
      visitWorldId = worldId;
      hidePlace(false);
      fillShelf(worldId);
      setHomeAvailable(true);
      setHint(null);
      showFact(fact, label, cueId);
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

    showPlace(place: Discovery) {
      placeShowing = place;
      placePanel();
      placePhoto.classList.remove('is-hidden', 'is-no-photo');
      placeImage.src = photoUrl(place.id);
      placeNameText.textContent = place.name;
      placeImageButton.setAttribute('aria-label', `${place.name}: say it again`);
      root.classList.add('is-place-open');
      placesButton.classList.add('is-on');
      placesButton.setAttribute('aria-pressed', 'true');
      // Its line, read by its recording (what Listen reads while the photo is up).
      narrator.stop();
      showFact(place.short, place.name, `discovery-${place.id}`);
    },

    hidePlace() {
      hidePlace(false);
    },

    setSpinAttention(on: boolean) {
      // Called every frame, so it has to be idempotent and cheap.
      spinButton.classList.toggle('is-inviting', on);
    },

    openBedtime() {
      markToyPlayed();
      setFactOpen(false);
      bedtimeSpin.open();
      visit.inert = true;
    },

    dismissToys() {
      visit.inert = false;
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

    reset() {
      dayLegend.classList.add('is-hidden');
      root.classList.remove('is-earth', 'is-day-active', 'is-map-next');
      setFactOpen(false);
      hidePlace(false);
      clearTimers();
      // Clear this before stop(): the narrator's onChange listener would otherwise play a
      // queued guide into the fresh home view.
      pendingGuide = null;
      narrator.stop();
      setHomeAvailable(false);
      this.dismissToys();
      spinBusy = false;
      spinLabel.textContent = spinWord;
      spinButton.classList.remove('is-busy', 'is-inviting', 'is-turning');
      for (const echo of root.querySelectorAll('.tap-echo')) echo.remove();
      clearWords();
      visit.inert = false;
    },

    dispose() {
      clearTimers();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      panelGuard.dispose();
      mapReturnGuard.dispose();
      factFocus.dispose();
      root.replaceChildren();
    },
  };
}
