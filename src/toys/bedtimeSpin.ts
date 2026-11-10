/**
 * Bedtime spin: day and night are Earth turning. Earth is seen from above the North Pole with
 * the Sun off to the left, so exactly half of it is lit and the line between day and night
 * stands still while the planet turns under it. The child drags Earth round (or presses Turn
 * Earth); a house on the equator rides into the dark half, its windows light up and it is
 * bedtime, then it comes round into the morning. A clock shows the hours passing and a
 * counter the days: one turn, one day, 24 hours.
 *
 * A round "From the house" window shows the same moment as the house sees it, looking south:
 * the Sun rises at the left (east) edge at six, climbs overhead at noon, sets at the right
 * (west) edge at six in the evening, and the sky is dark with stars at night, all driven by
 * the one house hour so it stays in step with the spinning Earth and the clock.
 *
 * The Earth is real: the game's own Blue Marble and city-lights maps, reprojected once into
 * the view from above the pole. A self-contained overlay like the Moon jump; it owns nothing
 * in the 3D scene.
 */
import './bedtimeSpin.css';
import { worldPicture } from '../ui/pictures';
import { createIcon } from '../ui/icons';
import {
  bedtimeLayout, dragTurn, daylight, daysPassed, hourAt, houseAngle, isNight, partOfDay, skyColours,
  starAlpha, sunInSky, turnForHour, type BedtimeLayout, type PartOfDay,
} from './daySpin';

export interface BedtimeSpin {
  readonly isOpen: boolean;
  open(): void;
  /** The child's own way out: calls onClose. */
  close(): void;
  /** Taken away by a reset (flight, return, crash): no callback. */
  dismiss(): void;
}

export interface BedtimeSpinOptions {
  /** Called when the house moves into a new part of the day, for narration. */
  onPart?(part: PartOfDay): void;
  onClose?(): void;
}

const TAU = Math.PI * 2;
const MAX_STEP = 0.1;
/** Where the house starts: late afternoon, a short drag away from sunset. */
const START_HOUR = 15;
/** One press of Turn Earth moves the clock on three hours, over about half a second. */
const BUTTON_TURN = TAU / 8;
const BUTTON_SPEED = BUTTON_TURN / 0.5;
const PROJECTED_SIZE = 512;

/** What the window shows, for anyone who cannot see it. */
const WINDOW_LABELS: Record<PartOfDay, string> = {
  day: 'From the house: the Sun is up in the sky',
  evening: 'From the house: the Sun is setting',
  night: 'From the house: a dark sky with stars',
  morning: 'From the house: the Sun is rising',
};

const CAPTIONS: Record<PartOfDay, string> = {
  day: 'Daytime at your house',
  evening: 'The Sun is setting',
  night: 'Night-time. Bedtime!',
  morning: 'The Sun is rising. Good morning!',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function seededStars(count: number, seed = 11): [number, number, number][] {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: count }, () => [rand(), rand(), 0.4 + rand() * 1.2]);
}
const STARS = seededStars(90);
const WINDOW_STARS = seededStars(40, 77);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

/**
 * The northern hemisphere as seen from far above the pole (orthographic), from an
 * equirectangular map. Longitude runs counter-clockwise on screen, as it does looking down.
 */
function projectFromPole(image: HTMLImageElement, size: number): HTMLCanvasElement {
  const source = document.createElement('canvas');
  source.width = Math.min(image.naturalWidth, 2048);
  source.height = Math.round(source.width / 2);
  const sctx = source.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(image, 0, 0, source.width, source.height);
  const src = sctx.getImageData(0, 0, source.width, source.height).data;

  const out = document.createElement('canvas');
  out.width = out.height = size;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(size, size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const r = Math.hypot(dx, dy);
      if (r > 1) continue;
      const lat = Math.acos(r); // orthographic: the rim is the equator
      const lon = -Math.atan2(dy, dx);
      const u = ((lon / TAU + 0.5) % 1 + 1) % 1;
      const v = (Math.PI / 2 - lat) / Math.PI;
      const sx = Math.min(source.width - 1, Math.floor(u * source.width));
      const sy = Math.min(source.height - 1, Math.floor(v * source.height));
      const s = (sy * source.width + sx) * 4;
      const o = (y * size + x) * 4;
      img.data[o] = src[s]!;
      img.data[o + 1] = src[s + 1]!;
      img.data[o + 2] = src[s + 2]!;
      img.data[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

let projected: Promise<{ day: HTMLCanvasElement; night: HTMLCanvasElement | null }> | null = null;
function projectedEarth() {
  projected ??= (async () => {
    const day = projectFromPole(await loadImage('assets/earth.jpg'), PROJECTED_SIZE);
    const night = await loadImage('assets/earth-night.jpg')
      .then(image => projectFromPole(image, PROJECTED_SIZE))
      .catch(() => null);
    return { day, night };
  })();
  projected.catch(() => { projected = null; });
  return projected;
}

export function createBedtimeSpin(host: HTMLElement, options: BedtimeSpinOptions = {}): BedtimeSpin {
  const root = el('div', 'bedtime-spin is-hidden');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Spin Earth through a day');
  const canvas = el('canvas', 'bedtime-spin__canvas');
  canvas.setAttribute('aria-hidden', 'true');

  const caption = el('p', 'bedtime-spin__caption');
  caption.setAttribute('aria-live', 'polite');
  const days = el('p', 'bedtime-spin__days');

  const back = el('button', 'bedtime-spin__back');
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to Earth');
  back.append(createIcon('back'), worldPicture('earth'));

  const turnButton = el('button', 'bedtime-spin__turn');
  turnButton.type = 'button';
  turnButton.append(worldPicture('earth'), el('span', '', 'Turn Earth'));

  // "From the house": the sky outside, a round window with its own small canvas.
  const windowFrame = el('div', 'bedtime-spin__window');
  windowFrame.setAttribute('role', 'img');
  const windowCanvas = el('canvas', '');
  windowFrame.append(windowCanvas);
  const windowTag = el('div', 'bedtime-spin__window-tag');
  windowTag.setAttribute('aria-hidden', 'true');
  windowTag.append(createIcon('house'), el('span', '', 'From the house'));

  root.append(canvas, caption, days, windowFrame, windowTag, back, turnButton);

  const ctx = canvas.getContext('2d')!;
  const wctx = windowCanvas.getContext('2d')!;
  let L: BedtimeLayout = bedtimeLayout(360, 740);
  let open = false;
  let frame = 0;
  let last = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let earth: { day: HTMLCanvasElement; night: HTMLCanvasElement | null } | null = null;

  /** Radians turned since noon; starts in the afternoon. */
  let turn = turnForHour(START_HOUR);
  let turned = 0;
  let pending = 0;
  let spin = 0; // rad/s left over from a flick
  let part: PartOfDay = partOfDay(START_HOUR);
  let dragAngle: number | null = null;
  let dragId: number | null = null;
  let lastMove = 0;

  function layout() {
    return L.earth;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = root.clientWidth;
    height = root.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    L = bedtimeLayout(width, height);
    const { window: win, tag } = L;
    windowFrame.style.left = `${win.cx - win.d / 2}px`;
    windowFrame.style.top = `${win.cy - win.d / 2}px`;
    windowFrame.style.width = windowFrame.style.height = `${win.d}px`;
    windowTag.style.left = `${tag.left}px`;
    windowTag.style.top = `${tag.top}px`;
    const inner = Math.max(1, Math.round(windowFrame.clientWidth));
    windowCanvas.width = windowCanvas.height = Math.round(inner * dpr);
  }

  function advance(by: number) {
    if (by <= 0) return;
    turn += by;
    turned += by;
    const hour = hourAt(turn);
    const next = partOfDay(hour);
    if (next !== part) {
      part = next;
      options.onPart?.(part);
    }
    caption.textContent = CAPTIONS[part];
    const n = daysPassed(turned);
    days.textContent = n === 0 ? '' : n === 1 ? '1 turn = 1 day' : `${n} turns = ${n} days`;
    days.classList.toggle('is-hidden', n === 0);
    root.dataset.part = part;
    root.dataset.hour = hour.toFixed(2);
    const sun = sunInSky(hour);
    windowFrame.dataset.sun = sun.above ? 'up' : 'down';
    windowFrame.dataset.sunX = sun.x.toFixed(2);
    windowFrame.dataset.sunHeight = sun.y.toFixed(2);
    windowFrame.setAttribute('aria-label', WINDOW_LABELS[part]);
    root.dataset.days = String(n);
  }

  function update(dt: number) {
    if (pending > 0) {
      const step = Math.min(pending, BUTTON_SPEED * dt);
      pending -= step;
      advance(step);
    }
    if (spin > 0 && dragId === null) {
      advance(spin * dt);
      spin *= Math.exp(-3 * dt);
      if (spin < 0.05) spin = 0;
    }
  }

  function drawSun(cx: number, cy: number, r: number) {
    const sx = Math.min(cx - r * 2.1, width * 0.06);
    const glow = ctx.createRadialGradient(sx, cy, r * 0.2, sx, cy, r * 1.6);
    glow.addColorStop(0, '#fff3c0');
    glow.addColorStop(0.35, '#ffd25a88');
    glow.addColorStop(1, '#ffb34200');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, cy, r * 1.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2b632';
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, cy, r * 0.55, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // Sunlight reaching Earth: a few soft rays, so "the Sun is over there" needs no words.
    ctx.strokeStyle = '#ffd25a55';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      const y = cy + i * r * 0.32;
      ctx.beginPath();
      ctx.moveTo(sx + r * 0.7, y);
      ctx.lineTo(cx - r * 1.1, y);
      ctx.stroke();
    }
  }

  function drawHouse(cx: number, cy: number, r: number, night: boolean) {
    const a = houseAngle(turn);
    const size = Math.max(34, r * 0.28);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * (r + size * 0.42), cy + Math.sin(a) * (r + size * 0.42));
    ctx.rotate(a + Math.PI / 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#2b2118';
    // Walls and roof, standing on the ground with the roof pointing out into space.
    ctx.fillStyle = night ? '#c9bfa8' : '#f8f0dd';
    ctx.fillRect(-size * 0.4, -size * 0.35, size * 0.8, size * 0.7);
    ctx.strokeRect(-size * 0.4, -size * 0.35, size * 0.8, size * 0.7);
    ctx.fillStyle = '#f07a62';
    ctx.beginPath();
    ctx.moveTo(-size * 0.52, -size * 0.33);
    ctx.lineTo(0, -size * 0.8);
    ctx.lineTo(size * 0.52, -size * 0.33);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (night) {
      ctx.shadowColor = '#ffd25a';
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = night ? '#ffd25a' : '#5d6b80';
    for (const x of [-0.24, 0.08]) {
      ctx.fillRect(x * size, -size * 0.18, size * 0.16, size * 0.16);
    }
    ctx.shadowBlur = 0;
    ctx.strokeRect(-0.24 * size, -size * 0.18, size * 0.16, size * 0.16);
    ctx.strokeRect(0.08 * size, -size * 0.18, size * 0.16, size * 0.16);
    if (night) {
      ctx.fillStyle = '#fff3c0';
      ctx.font = `${Math.round(size * 0.42)}px 'Patrick Hand', cursive`;
      ctx.fillText('z', size * 0.45, -size * 0.85);
      ctx.fillText('z', size * 0.65, -size * 1.15);
    }
    ctx.restore();
  }

  const rgb = (c: readonly number[]) => `rgb(${Math.round(c[0]!)},${Math.round(c[1]!)},${Math.round(c[2]!)})`;

  /** The sky outside the house, looking south: east on the left, west on the right. */
  function drawWindow(hour: number) {
    const size = windowCanvas.width / dpr;
    if (size < 2) return;
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const horizon = size * 0.76;
    const sky = skyColours(hour);
    const gradient = wctx.createLinearGradient(0, 0, 0, horizon);
    gradient.addColorStop(0, rgb(sky.top));
    gradient.addColorStop(1, rgb(sky.low));
    wctx.fillStyle = gradient;
    wctx.fillRect(0, 0, size, size);
    const stars = starAlpha(hour);
    if (stars > 0) {
      wctx.fillStyle = '#ffffff';
      for (const [sx, sy, sr] of WINDOW_STARS) {
        wctx.globalAlpha = stars * (0.5 + sr * 0.25);
        wctx.fillRect(sx * size, sy * horizon * 0.95, sr + 0.4, sr + 0.4);
      }
      wctx.globalAlpha = 1;
    }
    // The Sun climbs the sky from the east (left) edge to the west (right) edge, and goes
    // down behind the ground; the hill is drawn over its lower part.
    const sun = sunInSky(hour);
    if (sun.y > -0.3) {
      const sx = size * 0.5 + sun.x * size * 0.37;
      const sy = horizon - sun.y * horizon * 0.78;
      const r = size * 0.1;
      const glow = wctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, r * 3.2);
      glow.addColorStop(0, '#fff3c0cc');
      glow.addColorStop(0.35, '#ffd25a66');
      glow.addColorStop(1, '#ffb34200');
      wctx.fillStyle = glow;
      wctx.beginPath();
      wctx.arc(sx, sy, r * 3.2, 0, TAU);
      wctx.fill();
      wctx.fillStyle = '#f2b632';
      wctx.strokeStyle = '#2b2118';
      wctx.lineWidth = Math.max(2, size * 0.014);
      wctx.beginPath();
      wctx.arc(sx, sy, r, 0, TAU);
      wctx.fill();
      wctx.stroke();
    }
    // The ground, lit by day and dark at night, with a couple of trees for scale.
    const lit = daylight(hour);
    const ground = (a: number, b: number) => `rgb(${Math.round(a * lit + 14 * (1 - lit))},${Math.round(b * lit + 24 * (1 - lit))},${Math.round(35 * lit + 30 * (1 - lit))})`;
    wctx.fillStyle = ground(106, 174);
    wctx.beginPath();
    wctx.moveTo(0, horizon + size * 0.06);
    wctx.quadraticCurveTo(size * 0.3, horizon - size * 0.06, size * 0.5, horizon + size * 0.03);
    wctx.quadraticCurveTo(size * 0.78, horizon + size * 0.09, size, horizon + size * 0.05);
    wctx.lineTo(size, size);
    wctx.lineTo(0, size);
    wctx.closePath();
    wctx.fill();
    wctx.strokeStyle = '#2b2118';
    wctx.lineWidth = Math.max(2, size * 0.014);
    wctx.stroke();
    for (const [tx, ty, ts] of [[0.2, 0.8, 1], [0.78, 0.84, 0.8]] as const) {
      const x = size * tx;
      const y = size * ty;
      const t = size * 0.07 * ts;
      wctx.fillStyle = ground(70, 130);
      wctx.beginPath();
      wctx.moveTo(x - t * 0.8, y);
      wctx.lineTo(x, y - t * 2.2);
      wctx.lineTo(x + t * 0.8, y);
      wctx.closePath();
      wctx.fill();
      wctx.stroke();
    }
  }

  function drawClock(x: number, y: number, radius: number, hour: number) {
    const night = isNight(hour);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = night ? '#3d4a7a' : '#f8f0dd';
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = night ? '#f8f0dd' : '#2b2118';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.arc(Math.sin(a) * radius * 0.8, -Math.cos(a) * radius * 0.8, i % 3 ? 1.6 : 3, 0, TAU);
      ctx.fill();
    }
    // Sun or Moon in the face, so the clock says day or night without reading it.
    ctx.fillStyle = night ? '#fff3c0' : '#f2b632';
    ctx.beginPath();
    ctx.arc(0, radius * 0.38, radius * 0.2, 0, TAU);
    ctx.fill();
    if (night) {
      ctx.fillStyle = '#3d4a7a';
      ctx.beginPath();
      ctx.arc(radius * 0.08, radius * 0.33, radius * 0.17, 0, TAU);
      ctx.fill();
    }
    const minute = (hour % 1) * TAU;
    const hourHand = ((hour % 12) / 12) * TAU;
    ctx.strokeStyle = night ? '#f8f0dd' : '#2b2118';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(hourHand) * radius * 0.48, -Math.cos(hourHand) * radius * 0.48);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(minute) * radius * 0.7, -Math.cos(minute) * radius * 0.7);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070a18';
    ctx.fillRect(0, 0, width, height);
    for (const [sx, sy, sr] of STARS) {
      ctx.fillStyle = '#ffffff99';
      ctx.fillRect(sx * width, sy * height, sr, sr);
    }
    const { cx, cy, r } = layout();
    drawSun(cx, cy, r);

    // Earth, turned. The Sun lights the left half, so the line between day and night
    // stays upright while the continents turn under it.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    if (earth) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-turn);
      ctx.drawImage(earth.day, -r, -r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#2f6aa8';
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    // The night half is the real night picture of the same ground: dark land, city lights.
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy - r, r, r * 2);
    ctx.clip();
    if (earth?.night) {
      ctx.translate(cx, cy);
      ctx.rotate(-turn);
      ctx.drawImage(earth.night, -r, -r, r * 2, r * 2);
    } else {
      ctx.fillStyle = '#05081ee0';
      ctx.fillRect(cx, cy - r, r, r * 2);
    }
    ctx.restore();
    // Dusk: a soft band either side of the line between day and night.
    const shade = ctx.createLinearGradient(cx - r * 0.08, 0, cx + r * 0.04, 0);
    shade.addColorStop(0, '#05081e00');
    shade.addColorStop(1, '#05081e99');
    ctx.fillStyle = shade;
    ctx.fillRect(cx - r * 0.08, cy - r, r * 0.12, r * 2);
    ctx.restore();
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();

    const hour = hourAt(turn);
    drawHouse(cx, cy, r, isNight(hour));
    drawClock(L.clock.x, L.clock.y, L.clock.r, hour);
    drawWindow(hour);
  }

  function loop(now: number) {
    if (!open) return;
    const dt = last ? Math.min((now - last) / 1000, MAX_STEP) : 0;
    last = now;
    update(dt);
    draw();
    frame = requestAnimationFrame(loop);
  }

  function pointerAngle(event: PointerEvent): number | null {
    const rect = canvas.getBoundingClientRect();
    const { cx, cy, r } = layout();
    const x = event.clientX - rect.left - cx;
    const y = event.clientY - rect.top - cy;
    // Too near the pole the angle swings wildly under a small movement.
    if (Math.hypot(x, y) < r * 0.15) return null;
    return Math.atan2(y, x);
  }

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    dragId = event.pointerId;
    dragAngle = pointerAngle(event);
    spin = 0;
    lastMove = performance.now();
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== dragId) return;
    const angle = pointerAngle(event);
    if (angle === null) { dragAngle = null; return; }
    if (dragAngle !== null) {
      const by = dragTurn(dragAngle, angle);
      const now = performance.now();
      const dt = Math.max(0.008, (now - lastMove) / 1000);
      lastMove = now;
      advance(by);
      spin = Math.min(TAU, by / dt);
    }
    dragAngle = angle;
  });
  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== dragId) return;
    dragId = null;
    dragAngle = null;
    // A flick keeps turning only if the finger was still moving when it lifted.
    if (performance.now() - lastMove > 80) spin = 0;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  turnButton.addEventListener('click', () => { pending += BUTTON_TURN; });
  back.addEventListener('click', () => api.close());
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      pending += BUTTON_TURN;
    }
  });
  const onResize = () => { if (open) resize(); };
  window.addEventListener('resize', onResize);

  const api: BedtimeSpin = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      turn = turnForHour(START_HOUR);
      turned = 0;
      pending = 0;
      spin = 0;
      part = partOfDay(START_HOUR);
      advance(1e-6);
      host.append(root);
      root.classList.remove('is-hidden');
      resize();
      last = 0;
      frame = requestAnimationFrame(loop);
      turnButton.focus();
      void projectedEarth().then(maps => { earth = maps; }).catch(() => {});
    },
    close() {
      if (!open) return;
      api.dismiss();
      options.onClose?.();
    },
    dismiss() {
      if (!open) return;
      open = false;
      cancelAnimationFrame(frame);
      dragId = null;
      root.classList.add('is-hidden');
      root.remove();
    },
  };
  return api;
}
