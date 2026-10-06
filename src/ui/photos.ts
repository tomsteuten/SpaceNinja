/**
 * Optional full photographs for real discovery subjects. Requested on a find or deliberate
 * opening, then cached for offline reuse. Small journal/control derivatives are separate
 * precached assets. HEAD probes resolve a missing full photo to an intentional no-photo
 * state instead of a broken image. Provenance is in public/assets/discoveries/README.txt.
 */

import { worldPicture } from './pictures';
import { imageExists } from '../scene/textures';
import { createIcon } from './icons';
import { createDialogFocus } from './dialog';
import { PANEL_OPEN_GUARD_MS, createPanelGuard, type PanelGuard, type PanelOpening } from './panelGuard';

/**
 * Named after the discovery id rather than listed in config.ts, which is the same bargain
 * the drop-in textures make: put a correctly named file in the folder and it appears, with
 * no code change and nothing to keep in step. `public/assets/discoveries/README.txt` is the
 * list of names.
 */
export function photoUrl(discoveryId: string): string {
  return `assets/discoveries/${discoveryId}.jpg`;
}

/** Resolves to the url if a real image is there, and to null otherwise. */
export async function findPhoto(discoveryId: string): Promise<string | null> {
  const url = photoUrl(discoveryId);
  return (await imageExists(url)) ? url : null;
}

export interface PhotoViewer {
  readonly isOpen: boolean;
  show(url: string, caption: string, worldId?: string): void;
  /** The first find is a reward, not a thumbnail a pre-reader has to notice. */
  showDiscovery(url: string, title: string, detail: string, worldId: string, progress?: { found: number; total: number }): void;
  hide(): void;
  dispose(): void;
}

/** Pure seam for the timing half of the real-device ghost-click guard. */
export function canBeginPhotoDismiss(openedAt: number, pressedAt: number, guardMs: number): boolean {
  return pressedAt - openedAt > guardMs;
}

/** The release must belong to the exact backdrop press that armed dismissal. */
export function canFinishPhotoDismiss(
  armedPointer: number | null,
  releasedPointer: number,
  releasedOnBackdrop: boolean,
): boolean {
  return releasedOnBackdrop && armedPointer === releasedPointer;
}

/**
 * The photo, big.
 *
 * Closing is deliberately over-served: a close button, a tap anywhere on the backdrop, and
 * Escape. A child who opens this by accident must never be stuck in it, and at this age
 * "tap the small x" is not a reliable skill.
 */
export interface PhotoViewerOptions {
  onShow?: () => void;
  onJournal?: () => void;
  /** Called whenever the viewer hides, by any route: button, backdrop, Escape or code. */
  onHide?: () => void;
  /** The interface's shared press counter, so every panel keeps the same double-tap rule. */
  guard?: PanelGuard;
}

export function createPhotoViewer(root: HTMLElement, options: PhotoViewerOptions = {}): PhotoViewer {
  const overlay = document.createElement('div');
  overlay.className = 'photo-view is-hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const figure = document.createElement('figure');
  figure.className = 'photo-view__figure';

  const title = document.createElement('h2');
  title.className = 'photo-view__title';
  title.id = 'photo-view-title';
  overlay.setAttribute('aria-labelledby', title.id);

  const image = document.createElement('img');
  image.className = 'photo-view__image';
  image.alt = '';

  const caption = document.createElement('figcaption');
  caption.className = 'photo-view__caption';

  const detail = document.createElement('p');
  detail.className = 'photo-view__detail';

  const close = document.createElement('button');
  close.className = 'btn btn--round photo-view__close';
  close.type = 'button';
  close.append(createIcon('close'));
  close.setAttribute('aria-label', 'Close the photo');

  const continueButton = document.createElement('button');
  continueButton.className = 'btn photo-view__continue is-hidden';
  continueButton.type = 'button';
  const returnPicture = document.createElement('span');
  returnPicture.className = 'photo-view__return-picture';
  returnPicture.setAttribute('aria-hidden', 'true');
  const returnWorld = document.createElement('span');
  returnWorld.className = 'photo-view__return-world';
  returnPicture.append(createIcon('back'), returnWorld);
  const returnLabel = document.createElement('span');
  continueButton.append(returnPicture, returnLabel);

  const panel = document.createElement('div');
  panel.className = 'photo-view__panel';
  const header = document.createElement('div');
  header.className = 'dialog-head';
  header.append(title, close);
  figure.append(image, caption);
  const saved = document.createElement('div');
  saved.className = 'photo-view__saved is-hidden';
  const actions = document.createElement('div');
  actions.className = 'photo-view__actions';
  const journalButton = document.createElement('button');
  journalButton.type = 'button';
  journalButton.className = 'photo-view__journal is-hidden';
  journalButton.append(createIcon('journal'), document.createTextNode('See discoveries'));
  actions.append(continueButton, journalButton);
  panel.append(header, saved, figure, detail, actions);
  overlay.append(panel);

  const focus = createDialogFocus(overlay, () => continueButton, hide);
  const guard = options.guard ?? createPanelGuard(window);
  const ownsGuard = !options.guard;
  /** When and on which press the viewer last opened; the buttons ask before closing. */
  let opening: PanelOpening | null = null;

  function reveal() {
    overlay.classList.remove('is-hidden');
    opening = guard.opened();
    openedAt = opening.at;
    dismissPointer = null;
    focus.open();
    options.onShow?.();
  }
  function hide() {
    overlay.classList.add('is-hidden');
    // Dropped so a closed viewer is not holding a full-size decoded bitmap on a tablet
    // whose whole quality tier exists because memory is tight.
    image.removeAttribute('src');
    focus.close();
    options.onHide?.();
  }

  /*
   * The backdrop closes on a tap, but only a *fresh* one — never the tail of the tap that
   * opened it. Reported from a Samsung phone: the photo opened and shut again instantly,
   * on Earth, every time. It is the classic touch "ghost click": a tap on the thumbnail
   * shows this full-screen overlay at those same coordinates, and the device then delivers
   * the tap's trailing compatibility click, which now hit-tests onto the overlay sitting
   * under the finger and dismisses it. It did not reproduce in a headless browser because
   * that ghost click is a real-hardware behaviour.
   *
   * The opening tap's pointerdown landed on the thumbnail, never on this overlay, so a
   * dismiss is only honoured when a pointerdown actually begins here — which the ghost
   * click has none of — and, belt and braces, not within a moment of opening, since a
   * ghost lands within a few hundred milliseconds. A deliberate second tap to close is
   * well past both gates.
   */
  const OPEN_GUARD_MS = PANEL_OPEN_GUARD_MS;
  let openedAt = 0;
  let dismissPointer: number | null = null;

  overlay.addEventListener('pointerdown', (event) => {
    // Only the backdrop. Presses on the photograph are exploration, not dismissal, and
    // the explicit close button has its own unconditional handler below.
    dismissPointer =
      event.target === overlay && canBeginPhotoDismiss(openedAt, performance.now(), OPEN_GUARD_MS)
        ? event.pointerId
        : null;
  });
  overlay.addEventListener('pointerup', (event) => {
    // Close from a complete fresh pointer sequence, never from the compatibility `click`
    // Android may deliver after the thumbnail tap has put this overlay under the finger.
    if (canFinishPhotoDismiss(dismissPointer, event.pointerId, event.target === overlay)) hide();
    dismissPointer = null;
  });
  overlay.addEventListener('pointercancel', () => {
    dismissPointer = null;
  });
  // The large X is always an immediate escape. The pictured return waits for a fresh press
  // so the opening double-tap cannot immediately dismiss the postcard. The backdrop retains
  // its stricter pointer-sequence guard; no compatibility-click handler belongs there.
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    hide();
  });
  // A visible, worded exit makes the automatic postcard feel like a reward rather than a
  // surprise modal.
  continueButton.addEventListener('click', (event) => {
    if (!guard.allowsClose(opening, event)) return;
    hide();
  });
  journalButton.addEventListener('click', (event) => {
    if (!guard.allowsClose(opening, event)) return;
    hide();
    options.onJournal?.();
  });
  root.append(overlay);

  return {
    get isOpen() { return !overlay.classList.contains('is-hidden'); },
    show(url: string, text: string, worldId?: string) {
      image.src = url;
      caption.textContent = '';
      image.alt = text;
      // Hidden visually in the journal viewer, but still the dialog name for assistive tech.
      title.textContent = text;
      detail.textContent = '';
      overlay.classList.remove('is-reward');
      saved.classList.add('is-hidden');
      journalButton.classList.add('is-hidden');
      returnWorld.replaceChildren(worldId ? worldPicture(worldId) : createIcon('journal'));
      returnLabel.textContent = worldId ? 'Keep exploring' : 'Back to journal';
      continueButton.classList.remove('is-hidden');
      reveal();
    },
    showDiscovery(url: string, discoveryTitle: string, discoveryDetail: string, worldId: string, progress) {
      image.src = url;
      title.textContent = discoveryTitle;
      image.alt = discoveryTitle;
      detail.textContent = discoveryDetail;
      caption.textContent = '';
      overlay.classList.add('is-reward');
      saved.replaceChildren(createIcon('journal'), document.createTextNode('Saved to your journal'));
      saved.classList.remove('is-hidden');
      if (progress) {
        const count = document.createElement('span');
        count.className = 'photo-view__count';
        count.textContent = `${progress.found} / ${progress.total}`;
        count.setAttribute('aria-label', `${progress.found} of ${progress.total} places found this visit`);
        saved.append(count);
      }
      journalButton.classList.toggle('is-hidden', !options.onJournal || !progress || progress.found !== progress.total);
      continueButton.classList.remove('is-hidden');
      returnWorld.replaceChildren(worldPicture(worldId));
      returnLabel.textContent = 'Keep exploring';
      reveal();
    },
    hide,
    dispose() {
      focus.dispose();
      if (ownsGuard) guard.dispose();
      overlay.remove();
    },
  };
}
