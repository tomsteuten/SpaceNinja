/**
 * Real photographs of the real places, shown when a child finds one.
 *
 * The discoveries are already genuine — real features at their real coordinates on real
 * NASA maps — and until now the payoff for finding one was a paragraph. This is the part a
 * five-year-old can actually read: *this is what the Sahara looks like from space, and you
 * just found it.*
 *
 * **Nothing is downloaded until a place is found.** That is the whole reason this is
 * affordable. The game starts at exactly the speed it does today, and a child who finds
 * three places on one world fetches three files; the other six are never asked for. Compare
 * that to sharpening the globe maps, where every byte is spent before the title screen and
 * most of the detail never survives a pixel ratio capped at 1.5.
 *
 * Every photo is optional, in the same way every texture is: the file is HEAD-probed first,
 * and if it is not there the card looks exactly as it did before. So the images can be
 * dropped in one at a time, and a place whose photo has not been sourced yet is not a
 * broken image — it is simply a place without a photo.
 */

import { imageExists } from '../scene/textures';

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
  show(url: string, caption: string): void;
  hide(): void;
  dispose(): void;
}

/**
 * The photo, big.
 *
 * Closing is deliberately over-served: a close button, a tap anywhere on the backdrop, and
 * Escape. A child who opens this by accident must never be stuck in it, and at this age
 * "tap the small x" is not a reliable skill.
 */
export function createPhotoViewer(root: HTMLElement): PhotoViewer {
  const overlay = document.createElement('div');
  overlay.className = 'photo-view is-hidden';

  const figure = document.createElement('figure');
  figure.className = 'photo-view__figure';

  const image = document.createElement('img');
  image.className = 'photo-view__image';
  image.alt = '';

  const caption = document.createElement('figcaption');
  caption.className = 'photo-view__caption';

  const close = document.createElement('button');
  close.className = 'btn btn--round photo-view__close';
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Close the photo');

  figure.append(image, caption);
  overlay.append(figure, close);

  function hide() {
    overlay.classList.add('is-hidden');
    // Dropped so a closed viewer is not holding a full-size decoded bitmap on a tablet
    // whose whole quality tier exists because memory is tight.
    image.removeAttribute('src');
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
  const OPEN_GUARD_MS = 450;
  let openedAt = 0;
  let pressedInside = false;

  overlay.addEventListener('pointerdown', () => {
    pressedInside = performance.now() - openedAt > OPEN_GUARD_MS;
  });
  overlay.addEventListener('click', () => {
    if (pressedInside) hide();
    pressedInside = false;
  });
  // The close button is an explicit control, so it always closes — no ghost reaches a
  // 62px target the finger deliberately found, and gating it would only make the X feel
  // broken. stopPropagation so it does not also run the backdrop handler.
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    hide();
  });
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') hide();
  };
  window.addEventListener('keydown', onKey);

  root.append(overlay);

  return {
    show(url: string, text: string) {
      image.src = url;
      caption.textContent = text;
      overlay.classList.remove('is-hidden');
      openedAt = performance.now();
      pressedInside = false;
    },
    hide,
    dispose() {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
    },
  };
}
