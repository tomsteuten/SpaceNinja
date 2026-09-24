/**
 * The explorer's interface layer. It draws and reports; every decision about what happens next
 * belongs to main.ts. One quiet control cluster per phase, the playfield left clear:
 *
 * - In the solar system: a row of four worlds along the bottom edge, the journal and grown-up
 *   settings in the top corner.
 * - While exploring: a way back to the solar system top-left, a small dock for Places and
 *   height, and a card naming the place beneath the ship with its postcard one tap away.
 */
import type { Narrator } from '../audio/narration';
import { journalPages, journalTotals } from './journal';
import type { Phase } from './phases';
import { thumbnail, WORLDS, type ExplorerWorld, type WorldId, type WorldPlace } from './worlds';

const icons = {
  arrow: '<path d="m13 5-7 7 7 7M6 12h14"/>',
  forward: '<path d="m11 5 7 7-7 7M18 12H4"/>',
  places: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M7 5l1-2h8l1 2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  hand: '<path d="M9 12V5a2 2 0 0 1 4 0v5l4-1c2 0 3 1 3 3v3c0 5-3 7-7 7-3 0-5-2-6-4l-3-4c-1-2 1-3 2-2l3 2"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  book: '<path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5Zm0 0v14"/>',
  speaker: '<path d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
};
type IconName = keyof typeof icons;
const svg = (name: IconName) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const worldName = (world: ExplorerWorld) => (world.id === 'moon' ? 'the Moon' : world.label);
const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface ExplorerActions {
  fly(id: WorldId): void;
  home(): void;
  go(place: WorldPlace): void;
  zoom(closer: boolean): void;
  settings(): void;
  /** A panel opened or closed over the scene; steering must stop while one is up. */
  pause(): void;
  resume(): void;
}

export interface ExplorerUI {
  readonly modal: boolean;
  phase(phase: Phase): void;
  setWorld(world: ExplorerWorld): void;
  /** Refresh the world row: found dots, and which world the map is suggesting. */
  showWorlds(found: ReadonlySet<string>, suggested: WorldId | null): void;
  landmark(place: WorldPlace | null, justFound: boolean): void;
  coach(show: boolean, orbital: boolean): void;
  steering(x: number, y: number, show: boolean): void;
  status(message: string): void;
  zoomLimits(closer: boolean, wider: boolean): void;
  hint(message: string): void;
  /** Fraction of the viewport height the world row and its hint take up from the bottom. */
  systemReserve(): number;
  openPhoto(place: WorldPlace): void;
  dispose(): void;
}

export function createExplorerUI(
  root: HTMLElement,
  narrator: Narrator,
  loadFound: () => ReadonlySet<string>,
  actions: ExplorerActions,
): ExplorerUI {
  const base = import.meta.env.BASE_URL;
  let world: ExplorerWorld = WORLDS[0]!;
  let journalWorld: WorldId = 'earth';
  root.className = 'explorer-ui';
  root.removeAttribute('aria-live');
  // Everything lives in one layer so its styles cannot reach the grown-ups panel beside it.
  root.innerHTML = `<div class="ex-layer">
    <header class="ex-brand"><span class="brand-orbit" aria-hidden="true"></span><span>SPACE NINJA</span><small class="ex-credit">NASA imagery · Maps: Solar System Scope, CC BY 4.0</small></header>
    <div class="ex-corner">
      <button class="ex-journal icon-button" aria-label="Open your journal">${svg('book')}<span class="ex-count" aria-hidden="true"></span></button>
      <button class="ex-settings icon-button" aria-label="Grown-up settings">${svg('settings')}</button>
    </div>
    <nav class="ex-top" aria-label="Exploration navigation" hidden>
      <button class="ex-home quiet">${svg('arrow')} Solar system</button><span class="ex-location"></span>
    </nav>
    <div class="ex-system">
      <p class="ex-hint" role="status" aria-live="polite"></p>
      <nav class="ex-worlds" aria-label="Choose a world">${WORLDS.map((item) => `
        <button class="ex-world" data-world="${item.id}" aria-label="Fly to ${item.label}">
          <span class="ex-world-orb" style="background-image:url('${base}assets/explorer/${item.id}.jpg')" aria-hidden="true"></span>
          <span class="ex-world-name">${item.label}</span>
          <span class="ex-dots" aria-hidden="true">${item.places.map(() => '<i></i>').join('')}</span>
        </button>`).join('')}
      </nav>
      <a class="ex-original" href="./">Guided adventure</a>

    </div>
    <div class="ex-coach" hidden>${svg('hand')}<span></span><small></small></div>
    <div class="ex-steering" aria-hidden="true" hidden><span></span></div>
    <div class="ex-landmark" hidden>
      <img class="ex-landmark-thumb" alt="" />
      <div class="ex-landmark-words"><span class="eyebrow"></span><strong></strong></div>
      <button class="quiet ex-look">${svg('photo')} Take a look</button>
    </div>
    <nav class="ex-dock" aria-label="World controls" hidden>
      <button class="ex-places">${svg('places')}<span>Places</span></button><span class="dock-divider"></span>
      <button class="ex-closer" aria-label="Fly closer">${svg('plus')}<span>Closer</span></button>
      <button class="ex-wider" aria-label="Fly higher">${svg('minus')}<span>Higher</span></button>
    </nav>
    <p class="ex-status" role="status" aria-live="polite"></p>
    <dialog class="ex-dialog places-dialog" aria-labelledby="places-heading">
      <div class="dialog-heading"><div><p class="eyebrow">FOLLOW YOUR CURIOSITY</p><h2 id="places-heading">Places to find</h2></div><button class="icon-button" data-close aria-label="Close places">${svg('close')}</button></div>
      <div class="place-list"></div>
      <p class="dialog-note">Or close this and fly to a picture on the world.</p>
    </dialog>
    <dialog class="ex-dialog journal-dialog" aria-labelledby="journal-heading">
      <div class="dialog-heading"><div><p class="eyebrow">MY JOURNAL</p><h2 id="journal-heading">Places I’ve found</h2></div><button class="icon-button" data-close aria-label="Close journal">${svg('close')}</button></div>
      <div class="journal-tabs" role="tablist" aria-label="Worlds"></div>
      <div class="journal-grid" role="tabpanel"></div>
      <p class="dialog-note journal-note"></p>
    </dialog>
    <dialog class="ex-dialog photo-dialog" aria-labelledby="photo-heading">
      <div class="dialog-heading"><div><p class="eyebrow">FROM THE MISSION ARCHIVES</p><h2 id="photo-heading"></h2></div><button class="icon-button" data-close aria-label="Keep exploring">${svg('close')}</button></div>
      <div class="photo-viewport" tabindex="0" aria-label="Mission image; scroll to explore when enlarged"><img alt=""/><p class="photo-loading">Opening the photograph…</p></div>
      <div class="photo-description"><p class="photo-words"></p>
        <div class="photo-actions">
          <button class="quiet photo-speak" aria-pressed="false">${svg('speaker')}<span>Read to me</span></button>
          <button class="quiet photo-zoom" aria-pressed="false">${svg('plus')} Look closer</button>
        </div>
      </div>
      <a class="photo-source" target="_blank" rel="noreferrer"></a>
    </dialog></div>`;

  const find = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const top = find('.ex-top'), dock = find('.ex-dock'), coach = find('.ex-coach'), system = find('.ex-system');
  const landmark = find('.ex-landmark'), steering = find('.ex-steering');
  const placesDialog = find<HTMLDialogElement>('.places-dialog');
  const journal = find<HTMLDialogElement>('.journal-dialog');
  const photo = find<HTMLDialogElement>('.photo-dialog');
  const img = find<HTMLImageElement>('.photo-viewport img'), loading = find('.photo-loading');
  const speak = find<HTMLButtonElement>('.photo-speak');
  let activePlace: WorldPlace | null = null, shownPlace: WorldPlace | null = null;
  let photoToken = 0;
  let lastReserve = 0.2;
  let landmarkKey = '';
  // Dialogs can stack (a postcard opened from the journal), so focus is restored per dialog.
  const open: Array<{ dialog: HTMLDialogElement; focus: HTMLElement | null }> = [];

  function show(dialog: HTMLDialogElement) {
    if (open.length === 0) actions.pause();
    open.push({ dialog, focus: document.activeElement as HTMLElement | null });
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-close]')?.focus();
  }
  function closed(dialog: HTMLDialogElement) {
    const index = open.findIndex((entry) => entry.dialog === dialog);
    if (index < 0) return;
    const [entry] = open.splice(index, 1);
    if (dialog === photo) narrator.stop();
    entry!.focus?.focus({ preventScroll: true });
    if (open.length === 0) actions.resume();
  }
  for (const dialog of [placesDialog, journal, photo]) {
    dialog.addEventListener('close', () => closed(dialog));
    dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]')]
        .filter((el) => el.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0]!, last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    // Deliberately no backdrop click dismiss: Android compatibility clicks must not close an opening photo.
  }

  find('.ex-home').onclick = actions.home;
  find('.ex-settings').onclick = actions.settings;
  find('.ex-places').onclick = () => { renderPlaces(); show(placesDialog); };
  find('.ex-closer').onclick = () => actions.zoom(true);
  find('.ex-wider').onclick = () => actions.zoom(false);
  find('.ex-journal').onclick = () => { journalWorld = world.id; renderJournal(); show(journal); };
  find('.ex-look').onclick = () => { if (activePlace) openPhoto(activePlace); };
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-world]')) {
    button.onclick = () => actions.fly(button.dataset.world as WorldId);
  }

  function renderPlaces() {
    const found = loadFound();
    const list = find('.place-list');
    list.innerHTML = world.places.map((place) => `
      <button class="place-option${found.has(place.id) ? ' is-found' : ''}" data-place="${place.id}">
        <img class="place-thumb" src="${base}${thumbnail(place)}" alt="" />
        <span><strong>${escape(place.name)}</strong><small>${escape(place.description)}</small></span>
        ${found.has(place.id) ? '<span class="place-tick" aria-label="Found">✓</span>' : svg('forward')}
      </button>`).join('');
    for (const button of list.querySelectorAll<HTMLButtonElement>('[data-place]')) {
      button.onclick = () => {
        const place = world.places.find((item) => item.id === button.dataset.place)!;
        placesDialog.close();
        actions.go(place);
      };
    }
  }

  function renderJournal() {
    const found = loadFound();
    const pages = journalPages(found);
    const totals = journalTotals(found);
    const tabs = find('.journal-tabs');
    tabs.innerHTML = pages.map((page) => `
      <button role="tab" data-journal-world="${page.world.id}" aria-selected="${page.world.id === journalWorld}">
        <span class="ex-world-orb" style="background-image:url('${base}assets/explorer/${page.world.id}.jpg')" aria-hidden="true"></span>
        <span>${page.world.label}</span><small>${page.found}/${page.total}</small>
      </button>`).join('');
    for (const tab of tabs.querySelectorAll<HTMLButtonElement>('[data-journal-world]')) {
      tab.onclick = () => { journalWorld = tab.dataset.journalWorld as WorldId; renderJournal(); tabs.querySelector<HTMLElement>(`[data-journal-world="${journalWorld}"]`)?.focus(); };
    }
    const page = pages.find((item) => item.world.id === journalWorld)!;
    const grid = find('.journal-grid');
    grid.setAttribute('aria-label', `${page.world.label}: ${page.found} of ${page.total} found`);
    grid.innerHTML = page.places.map(({ place, found: isFound }) => isFound
      ? `<button class="postcard" data-postcard="${place.id}"><img src="${base}${thumbnail(place)}" alt="" /><span>${escape(place.name)}</span></button>`
      : `<div class="postcard is-empty" role="img" aria-label="A place still to find"><span class="postcard-hole" aria-hidden="true">?</span><span>Still to find</span></div>`).join('');
    for (const button of grid.querySelectorAll<HTMLButtonElement>('[data-postcard]')) {
      button.onclick = () => openPhoto(page.world.places.find((item) => item.id === button.dataset.postcard)!);
    }
    find('.journal-note').textContent = totals.found === 0
      ? 'Fly to a picture on any world to find your first place.'
      : `${totals.found} of ${totals.total} places found across the solar system.`;
  }

  function setSpeaking(speaking: boolean) {
    speak.setAttribute('aria-pressed', String(speaking));
    speak.innerHTML = speaking ? `${svg('stop')}<span>Stop</span>` : `${svg('speaker')}<span>Read to me</span>`;
  }
  narrator.onChange(setSpeaking);
  speak.hidden = !narrator.available;
  speak.onclick = () => {
    if (!shownPlace) return;
    if (narrator.speaking) { narrator.stop(); return; }
    narrator.resume();
    // The authored recording when there is one; the written words through the device voice
    // otherwise. A press is a request, so the platform fallback is allowed here.
    narrator.speak(shownPlace.words, `discovery-${shownPlace.id}`, true);
  };

  function openPhoto(place: WorldPlace) {
    const token = ++photoToken;
    shownPlace = place;
    find('#photo-heading').textContent = place.name;
    find('.photo-words').textContent = place.words;
    const link = find<HTMLAnchorElement>('.photo-source');
    link.href = place.source;
    link.textContent = place.credit + ' · Image source ↗';
    img.hidden = true; img.alt = place.imageLabel; loading.hidden = false; loading.textContent = 'Opening the photograph…';
    find('.photo-viewport').classList.remove('is-zoomed');
    find('.photo-zoom').setAttribute('aria-pressed', 'false');
    find('.photo-zoom').hidden = true;
    setSpeaking(false);
    if (!photo.open) show(photo);
    img.onload = () => { if (token !== photoToken) return; img.hidden = false; loading.hidden = true; find('.photo-zoom').hidden = false; };
    img.onerror = () => { if (token !== photoToken) return; img.hidden = true; loading.textContent = 'This photograph is unavailable. The words are still here.'; };
    img.src = base + place.photo;
  }
  find('.photo-zoom').onclick = () => {
    const zoomed = find('.photo-viewport').classList.toggle('is-zoomed');
    find('.photo-zoom').setAttribute('aria-pressed', String(zoomed));
  };

  function refreshCount() {
    const { found } = journalTotals(loadFound());
    const count = find('.ex-count');
    count.textContent = found ? String(found) : '';
    count.hidden = found === 0;
  }
  refreshCount();

  return {
    get modal() { return open.length > 0; },
    phase(phase) {
      root.dataset.phase = phase;
      const exploring = phase === 'exploring' || phase === 'descending';
      system.hidden = phase !== 'system';
      top.hidden = !exploring;
      dock.hidden = phase !== 'exploring';
      find('.ex-brand').hidden = phase !== 'system';
      if (phase !== 'exploring') { coach.hidden = true; landmark.hidden = true; activePlace = null; landmarkKey = ''; steering.hidden = true; }
      refreshCount();
    },
    setWorld(next) {
      world = next;
      find('.ex-location').textContent = worldName(next).toUpperCase();
    },
    showWorlds(found, suggested) {
      for (const button of root.querySelectorAll<HTMLButtonElement>('[data-world]')) {
        const item = WORLDS.find((entry) => entry.id === button.dataset.world)!;
        button.classList.toggle('is-suggested', item.id === suggested);
        const dots = button.querySelectorAll('.ex-dots i');
        item.places.forEach((place, index) => dots[index]?.classList.toggle('is-found', found.has(place.id)));
        const count = item.places.filter((place) => found.has(place.id)).length;
        button.setAttribute('aria-label', `Fly to ${item.label}, ${count} of ${item.places.length} places found`);
      }
      refreshCount();
    },
    landmark(place, justFound) {
      // Called every frame while exploring; only a change of place or state touches the DOM.
      const key = place ? `${place.id}:${justFound}` : '';
      if (key === landmarkKey) return;
      landmarkKey = key;
      activePlace = place;
      landmark.hidden = !place;
      landmark.classList.toggle('is-new', justFound);
      if (!place) return;
      find('.ex-landmark .eyebrow').textContent = justFound ? 'YOU FOUND' : 'YOU ARE OVER';
      find('.ex-landmark strong').textContent = place.name;
      const thumb = find<HTMLImageElement>('.ex-landmark-thumb');
      const src = base + thumbnail(place);
      if (thumb.getAttribute('src') !== src) thumb.src = src;
      refreshCount();
    },
    coach(show, orbital) {
      coach.hidden = !show;
      coach.querySelector('span')!.textContent = orbital ? 'Hold to orbit. Slide to steer.' : 'Hold to fly. Slide to steer.';
      coach.querySelector('small')!.textContent = 'Tap a picture to go there.';
    },
    steering(x, y, visible) {
      steering.hidden = !visible;
      steering.style.left = x + 'px';
      steering.style.top = y + 'px';
    },
    status(message) { find('.ex-status').textContent = message; },
    zoomLimits(closer, wider) {
      find<HTMLButtonElement>('.ex-closer').disabled = closer;
      find<HTMLButtonElement>('.ex-wider').disabled = wider;
    },
    hint(message) { find('.ex-hint').textContent = message; },
    systemReserve() {
      const row = find('.ex-system');
      if (row.hidden) return lastReserve;
      const top = Math.min(find('.ex-worlds').getBoundingClientRect().top, find('.ex-hint').getBoundingClientRect().top || Infinity);
      lastReserve = Math.min(0.45, Math.max(0, (window.innerHeight - top) / Math.max(1, window.innerHeight)));
      return lastReserve;
    },
    openPhoto,
    dispose() {
      photoToken++;
      img.onload = null; img.onerror = null;
      for (const { dialog } of [...open]) dialog.close();
      root.replaceChildren();
    },
  };
}
