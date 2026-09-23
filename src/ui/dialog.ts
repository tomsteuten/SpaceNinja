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

/**
 * Keeps Tab inside an open dialog and gives focus back to the control that opened it.
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

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape();
      return;
    }
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
      requestAnimationFrame(() => initial()?.focus());
    },
    close() {
      const returnTo = opener;
      opener = null;
      if (returnTo?.isConnected) requestAnimationFrame(() => returnTo.focus());
    },
    dispose() {
      dialog.removeEventListener('keydown', onKeydown);
    },
  };
}
