/** Keyboard ownership for overlays. Pointer dismissal stays owned by each overlay. */
export interface DialogFocus {
  open(): void;
  close(): void;
  dispose(): void;
}

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function targets(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => !node.hidden);
}

interface OpenDialog {
  dialog: HTMLElement;
  onEscape: () => void;
}

/*
 * The dialogs that are open right now, innermost last. Escape is handled once, at the
 * document, and closes only the innermost one: a photo opened from the journal closes
 * before the journal does.
 *
 * It used to be handled by a keydown listener on each dialog element, which only hears the
 * key while focus is *inside* that element. Focus moves in on the animation frame after
 * opening, so an Escape pressed before that frame (a keyboard user who knows the way, or
 * a test on a slow software-rendered runner) reached nothing and the dialog stayed up.
 */
const openDialogs: OpenDialog[] = [];

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const top = openDialogs[openDialogs.length - 1];
  if (!top) return;
  event.preventDefault();
  top.onEscape();
}

function track(entry: OpenDialog) {
  untrack(entry.dialog);
  openDialogs.push(entry);
  // Idempotent for the same listener, so re-opening never stacks a second one.
  document.addEventListener('keydown', onDocumentKeydown);
}

function untrack(dialog: HTMLElement) {
  const index = openDialogs.findIndex((entry) => entry.dialog === dialog);
  if (index !== -1) openDialogs.splice(index, 1);
  if (!openDialogs.length) document.removeEventListener('keydown', onDocumentKeydown);
}

/**
 * Keeps Tab inside an open dialog, closes it on Escape, and gives focus back to the
 * control that opened it.
 *
 * We do not use `inert` on the whole game: a photo can be opened from the journal while
 * that panel remains visible underneath. The trap limits keyboard navigation without
 * changing pointer ownership or the Android backdrop-dismissal guard.
 */
export function createDialogFocus(
  dialog: HTMLElement,
  initial: () => HTMLElement | null,
  onEscape: () => void,
): DialogFocus {
  let opener: HTMLElement | null = null;
  const entry: OpenDialog = { dialog, onEscape };

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = targets(dialog);
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  dialog.addEventListener('keydown', onKeydown);
  return {
    open() {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      track(entry);
      requestAnimationFrame(() => initial()?.focus());
    },
    close() {
      untrack(dialog);
      const returnTo = opener;
      opener = null;
      if (returnTo?.isConnected) requestAnimationFrame(() => returnTo.focus());
    },
    dispose() {
      untrack(dialog);
      dialog.removeEventListener('keydown', onKeydown);
    },
  };
}
