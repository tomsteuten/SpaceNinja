// Design mock for "make done visible" (fix 5): rearranges the real DOM of the running build
// for the after-shots. Injected by e2e/done-visible-capture.pw.ts; not shipped.
(() => {
  const TOTAL = 6;
  const svg = (body, cls = '') =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const TARGET = '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4"/>';
  const ROCKET = '<path d="M12 2.6c2.7 2.4 4.1 5.5 4.1 8.9v3.2l1.8 1.9v3.2l-2.9-1.3-3 1.3-3-1.3-2.9 1.3v-3.2l1.8-1.9v-3.2c0-3.4 1.4-6.5 4.1-8.9Z"/><circle cx="12" cy="10" r="1.7" fill="#fff"/>';
  const found = () => JSON.parse(localStorage.getItem('spaceninja.progress.v1') || '{}').discoveries || [];
  const countFor = id => found().filter(d => d.startsWith(id + '-')).length;

  function markFullChips(panel) {
    for (const chip of panel.querySelectorAll('.collection-progress__world')) {
      const count = chip.children[1]?.textContent ?? '';
      chip.classList.toggle('is-full', count === `${TOTAL}/${TOTAL}`);
    }
  }

  /** A: this trip's three snapshots first, places left as a calm "next time" strip. */
  function journal(worldId, tripIds) {
    const panel = document.querySelector('.journal-panel');
    const grid = panel.querySelector('.sticker-grid');
    const chips = panel.querySelector('.collection-progress');
    const label = worldId.charAt(0).toUpperCase() + worldId.slice(1);
    const trip = document.createElement('section');
    trip.className = 'trip';
    trip.innerHTML = `<div class="trip__badge"><b>${tripIds.length}</b><span>found!</span></div><p class="trip__head"></p><div class="trip__photos"></div>`;
    const orb = chips.querySelector('[aria-pressed="true"] .world-orb')?.cloneNode(true);
    const head = trip.querySelector('.trip__head');
    if (orb) head.append(orb);
    head.append(`${label} trip`);
    for (const id of tripIds) {
      const tile = grid.querySelector(`[data-discovery="${id}"]`);
      if (tile) trip.querySelector('.trip__photos').append(tile);
    }
    const left = grid.querySelectorAll('.sticker--empty').length;
    const next = document.createElement('div');
    next.className = 'next-time';
    next.innerHTML = `<span class="next-time__label">${svg(ROCKET)}Next time</span><span class="next-time__slots"></span>`;
    for (let i = 0; i < left; i++) {
      const slot = document.createElement('span');
      slot.className = 'next-time__slot';
      slot.innerHTML = svg(TARGET);
      next.querySelector('.next-time__slots').append(slot);
    }
    panel.querySelector('.dialog-head').after(trip);
    trip.after(...(left ? [next] : []), chips);
    markFullChips(panel);
    panel.classList.add('is-trip');
    panel.scrollTop = 0;
  }

  /** B: visited cards wear their pips; a whole world wears a star; the hint shows a gold place. */
  function map() {
    for (const card of document.querySelectorAll('.destination-choice.is-done')) {
      const n = countFor(card.dataset.destination);
      if (n >= TOTAL) { card.classList.add('is-full'); continue; }
      const pips = document.createElement('span');
      pips.className = 'pips';
      for (let i = 0; i < TOTAL; i++) {
        const pip = document.createElement('i');
        if (i < n) pip.className = 'is-found';
        pips.append(pip);
      }
      card.querySelector('.destination-choice__label').after(pips);
    }
    const slot = document.querySelector('.hint .icon-slot');
    if (slot) slot.innerHTML = svg(TARGET, 'mock-target');
  }

  window.doneMock = { journal, map };
})();
