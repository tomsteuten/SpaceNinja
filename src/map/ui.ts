import { createIcon } from '../ui/icons';
import { worldPicture } from '../ui/pictures';
import type { ScreenRect } from './framing';
import './map.css';

/** One world's card on the current page. */
export interface MapChoice {
  id: string;
  label: string;
  /** Been there: the card wears a tick, so a pre-reader can see what is finished. */
  done?: boolean;
  /**
   * Places found and carried, for a world with places. A visited card shows them as the
   * journal's dots, so "more to find" is a picture; all found swaps the tick for a sun star.
   */
  found?: number;
  total?: number;
}

/** Everything the page's controls show, rendered in one go. */
export interface MapView {
  page: number;
  pageCount: number;
  choices: readonly MapChoice[];
  /** The first world of the previous and next page, for the arrows' pictures and names. */
  previous: MapChoice | null;
  next: MapChoice | null;
  /** The suggested world's id when its card is on this page. */
  suggested: string | null;
  /** -1 or 1 when the previous or next arrow carries the hint instead. */
  hintArrow: -1 | 1 | null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** A fat crayon chevron, drawn rather than typed so it is the same object on every device. */
function chevron(direction: -1 | 1): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 40 48');
  svg.setAttribute('class', 'map-arrow__chevron');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', direction === 1 ? 'M11 5 L33 24 L11 43 L4 36 L18 24 L4 12 Z' : 'M29 5 L7 24 L29 43 L36 36 L22 24 L36 12 Z');
  svg.append(path);
  return svg;
}

/**
 * The Space map's controls: the current page's cards, the two big page arrows at the screen
 * edges and the page dots. DOM order is the Tab order (previous arrow, cards, next arrow),
 * and the section is placed before the journal button, which follows it.
 */
export function createMapUI(root: HTMLElement, options: {
  choose(id: string): void;
  step(direction: -1 | 1): void;
}) {
  const section = el('section', 'space-map');
  section.setAttribute('aria-label', 'Space map');
  section.hidden = true;

  function arrow(direction: -1 | 1) {
    const button = el('button', `map-arrow map-arrow--${direction === 1 ? 'next' : 'previous'}`);
    button.type = 'button';
    const picture = el('span', 'map-arrow__world');
    button.append(chevron(direction), picture);
    button.addEventListener('click', () => options.step(direction));
    return { button, picture };
  }
  const previous = arrow(-1);
  const next = arrow(1);
  const cards = el('nav', 'map-cards');
  cards.setAttribute('aria-label', 'Choose a world');
  const dots = el('div', 'map-dots');
  dots.setAttribute('aria-hidden', 'true');
  section.append(previous.button, cards, next.button, dots);
  root.prepend(section);

  /*
   * Show, don't tell (playtest 2): one bouncing arrow sits on whatever carries the hint, the
   * suggested world's card or the page arrow that leads to it. It is the same object
   * wherever it goes, so it moves, never multiplies. A suggestion only: every card flies.
   */
  const pointer = el('span', 'map-pointer');
  pointer.setAttribute('aria-hidden', 'true');
  pointer.append(createIcon('pointer'));

  function card(choice: MapChoice, suggested: boolean): HTMLButtonElement {
    const button = el('button', 'map-card');
    button.type = 'button';
    // "Fly to": one press on this button is the whole journey.
    button.setAttribute('aria-label', `Fly to ${choice.label}`);
    button.dataset.destination = choice.id;
    button.classList.toggle('is-suggested', suggested);
    const label = el('span', 'map-card__label', choice.label);
    button.append(worldPicture(choice.id), label);
    if (choice.done) {
      const tick = createIcon('tick');
      tick.classList.add('map-card__done');
      button.append(tick);
      button.classList.add('is-done');
      // A finished visit must not look like a brand-new world (state audit 22): the card
      // carries the journal's dots, sun for found and white for still to find.
      const total = choice.total ?? 0;
      const found = Math.min(choice.found ?? 0, total);
      button.classList.toggle('is-full', total > 0 && found === total);
      if (total > 0 && found < total) {
        const pips = el('span', 'map-card__pips');
        pips.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < total; i++) pips.append(el('span', i < found ? 'is-found' : ''));
        label.after(pips);
      }
    }
    button.addEventListener('click', () => options.choose(choice.id));
    return button;
  }

  function dressArrow(control: ReturnType<typeof arrow>, neighbour: MapChoice | null, hinted: boolean, direction: -1 | 1) {
    control.button.hidden = !neighbour;
    control.button.classList.toggle('is-suggested', hinted);
    control.picture.replaceChildren(...(neighbour ? [worldPicture(neighbour.id)] : []));
    control.button.setAttribute('aria-label', neighbour
      ? `${direction === 1 ? 'Next' : 'Previous'} worlds: ${neighbour.label}` : '');
  }

  function render(view: MapView) {
    // A card or arrow that had focus is about to be replaced or hidden; keep the keyboard
    // (or a TV remote) on the map rather than dropping it on the page body.
    const active = document.activeElement;
    const hadCardFocus = active instanceof HTMLElement && cards.contains(active);
    const focusedArrow = active === previous.button ? previous : active === next.button ? next : null;

    dressArrow(previous, view.previous, view.hintArrow === -1, -1);
    dressArrow(next, view.next, view.hintArrow === 1, 1);
    cards.replaceChildren(...view.choices.map((choice) => card(choice, choice.id === view.suggested)));
    cards.dataset.count = String(view.choices.length);
    dots.replaceChildren(...Array.from({ length: view.pageCount }, (_, i) =>
      el('span', i === view.page ? 'is-current' : '')));
    dots.hidden = view.pageCount < 2;

    const carrier = view.hintArrow === -1 ? previous.button : view.hintArrow === 1 ? next.button
      : view.suggested ? cards.querySelector<HTMLElement>(`[data-destination="${view.suggested}"]`) : null;
    if (carrier) carrier.append(pointer);
    else pointer.remove();

    if (focusedArrow?.button.hidden) cards.querySelector<HTMLElement>('.map-card')?.focus();
    else if (hadCardFocus) cards.querySelector<HTMLElement>('.map-card')?.focus();
  }

  return {
    section,
    render,
    setVisible(visible: boolean) {
      section.hidden = !visible;
    },
    /**
     * The clear part of the screen the worlds may use: below the heading and the journal,
     * above the dots and cards, and inside the arrows' columns (reserved even on an end page,
     * so the worlds stay centred where the arrows would be).
     */
    clearRect(top: number): ScreenRect {
      const gap = 10;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const shown = [previous.button, next.button].find((button) => !button.hidden);
      const arrowBox = shown?.getBoundingClientRect() ?? null;
      const dotsBox = dots.hidden ? null : dots.getBoundingClientRect();
      let floor = cards.getBoundingClientRect().top || height;
      let ceiling = top;
      // How far in from either edge the arrows reach, mirrored so an end page stays centred.
      let inset = 12;
      if (height >= width) {
        // Portrait (as the stylesheet's orientation query has it): arrows and dots sit low.
        if (arrowBox) floor = Math.min(floor, arrowBox.top);
        if (dotsBox) floor = Math.min(floor, dotsBox.top);
      } else {
        if (arrowBox) inset = arrowBox.left < width / 2 ? arrowBox.right : width - arrowBox.left;
        if (dotsBox) ceiling = Math.max(ceiling, dotsBox.bottom);
      }
      return {
        left: inset + gap,
        right: width - inset - gap,
        top: ceiling + gap,
        bottom: Math.max(ceiling + gap + 40, floor - gap),
      };
    },
    dispose() {
      section.remove();
    },
  };
}
