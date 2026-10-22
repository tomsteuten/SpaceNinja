/**
 * Mars rover: Mars is so far away that messages take minutes. Earth hangs in space on one
 * side; Perseverance waits on the floor of Jezero crater on the other. The child taps a
 * glowing rock; a message leaves Earth as a glowing dot while a little clock's hand sweeps
 * through the real wait (about 12 minutes on a typical day, 3 to 22), and only when the dot
 * arrives does the rover drive itself to the rock and drill a sample tube. Taps while it is
 * busy get a little shimmer from the rover and are not queued. Three tubes bring new rocks.
 *
 * A self-contained overlay like the Saturn bath; it owns nothing in the 3D scene. The
 * timing is in roverDelay.ts.
 */
import './marsRover.css';
import { worldPicture } from '../ui/pictures';
import { createIcon } from '../ui/icons';
import {
  PLAY_DELAY, allDrilled, createDrive, delayMinutes, messageProgress, stepDrive, tap, type Drive,
} from './roverDelay';

export interface MarsRover {
  readonly isOpen: boolean;
  open(): void;
  /** The child's own way out: calls onClose. */
  close(): void;
  /** Taken away by a reset (flight, return, crash): no callback. */
  dismiss(): void;
}

export interface MarsRoverOptions {
  onClose?(): void;
}

const TAU = Math.PI * 2;
const MAX_STEP = 0.1;
const COLS = 6;
const ROWS = 4;
const INK = '#2b2118';
/** Minutes of a clock hour a message really takes; the hand sweeps that much of the face. */
const REAL_MINUTES = delayMinutes();
/** The rover's "not now" shimmer, seconds. */
const NUDGE_TIME = 0.6;
/** Rocks set per round never exceed this, so the tap targets are made once. */
const MAX_ROCKS = 3;

interface Layout {
  wide: boolean;
  earth: { x: number; y: number; r: number };
  clock: { x: number; y: number; r: number };
  tubes: { x: number; y: number; size: number };
  /** The edge of Mars: a huge circle whose near side is the horizon. */
  limb: { x: number; y: number; r: number };
  board: { x: number; y: number; tile: number };
}

interface Flyer { x: number; y: number; tx: number; ty: number; t: number }
interface Dust { x: number; y: number; vx: number; vy: number; life: number }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const STARS = (() => { const r = seeded(31); return Array.from({ length: 90 }, () => [r(), r(), 0.4 + r() * 1.2]); })();
const PEBBLES = (() => { const r = seeded(7); return Array.from({ length: 70 }, () => [r(), r(), 0.5 + r()]); })();

let earthBall: Promise<HTMLCanvasElement | null> | null = null;
function earthPicture() {
  earthBall ??= new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const size = 256;
      const out = document.createElement('canvas');
      out.width = out.height = size;
      const ctx = out.getContext('2d')!;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, TAU);
      ctx.clip();
      const w = image.naturalWidth;
      const h = image.naturalHeight;
      ctx.drawImage(image, w * 0.25, 0, w * 0.5, h, 0, 0, size, size);
      const shade = ctx.createRadialGradient(size * 0.62, size * 0.38, size * 0.1, size / 2, size / 2, size / 2);
      shade.addColorStop(0, '#ffffff22');
      shade.addColorStop(0.7, '#00000000');
      shade.addColorStop(1, '#00000088');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, size, size);
      resolve(out);
    };
    image.onerror = () => resolve(null);
    image.src = 'assets/earth.jpg';
  });
  return earthBall;
}

export function createMarsRover(host: HTMLElement, options: MarsRoverOptions = {}): MarsRover {
  const root = el('div', 'mars-rover is-hidden');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Drive the Mars rover');
  const canvas = el('canvas', 'mars-rover__canvas');
  canvas.setAttribute('aria-hidden', 'true');

  const caption = el('p', 'mars-rover__caption');
  caption.setAttribute('aria-live', 'polite');

  const back = el('button', 'mars-rover__back');
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to Mars');
  back.append(createIcon('back'), worldPicture('mars'));

  // Each rock's tap target: an invisible button much bigger than the drawn rock.
  const rockButtons = Array.from({ length: MAX_ROCKS }, (_, i) => {
    const button = el('button', 'mars-rover__rock');
    button.type = 'button';
    button.setAttribute('aria-label', `Send the rover to rock ${i + 1}`);
    button.addEventListener('click', () => tapRock(i));
    return button;
  });

  root.append(canvas, caption, back, ...rockButtons);

  const ctx = canvas.getContext('2d')!;
  let open = false;
  let frame = 0;
  let last = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let reduced = false;
  let L: Layout | null = null;
  let earth: HTMLCanvasElement | null = null;
  let drive: Drive = createDrive(COLS, ROWS);
  let wheel = 0;
  let nudge = 0;
  let nudges = 0;
  let flyers: Flyer[] = [];
  let dust: Dust[] = [];

  function say(text: string) {
    if (caption.textContent !== text) caption.textContent = text;
  }

  function tapRock(i: number) {
    const rock = drive.rocks[i];
    if (!open || !rock) return;
    const result = tap(drive, rock);
    if (result === 'sent') say('Mars is far away!');
    else if (result === 'busy') {
      // Not now: a little shimmer on the rover, and nothing remembered.
      nudge = NUDGE_TIME;
      nudges++;
    }
    syncState();
  }

  /* --- layout ------------------------------------------------------------- */

  function rectOf(node: Element) {
    const box = node.getBoundingClientRect();
    const origin = root.getBoundingClientRect();
    return { left: box.left - origin.left, top: box.top - origin.top, right: box.right - origin.left, bottom: box.bottom - origin.top };
  }

  function layout(): Layout {
    const wide = width > height * 1.15;
    root.classList.toggle('is-wide', wide);
    const gap = 14;
    const backBox = rectOf(back);
    const captionBottom = caption.textContent ? rectOf(caption).bottom : gap;
    let region: { x0: number; y0: number; x1: number; y1: number };
    let earthAt: Layout['earth'];
    let limb: Layout['limb'];
    if (wide) {
      const spaceW = Math.min(320, Math.max(180, width * 0.26));
      root.style.setProperty('--space-w', `${Math.round(spaceW)}px`);
      const r = Math.max(26, Math.min(height * 0.11, spaceW * 0.2, 70));
      earthAt = { x: gap + r + 6, y: captionBottom + r + 18, r };
      limb = { x: spaceW + height * 2.2, y: height / 2, r: height * 2.2 };
      region = { x0: spaceW + gap * 1.5, y0: gap, x1: width - gap, y1: height - gap };
    } else {
      root.style.removeProperty('--space-w');
      const r = Math.max(30, Math.min(width * 0.12, height * 0.075, 80));
      earthAt = { x: gap + r + 8, y: captionBottom + r + 16, r };
      const horizon = earthAt.y + r + Math.max(46, r * 0.75);
      limb = { x: width / 2, y: horizon + width * 2.4, r: width * 2.4 };
      region = { x0: gap, y0: horizon + gap * 1.6, x1: width - gap, y1: backBox.top - gap };
    }
    // The clock sits out of the dot's way: under Earth when Mars is beside it, beside Earth
    // when Mars is below.
    const clockR = earthAt.r * 0.8;
    const clock = wide
      ? { x: earthAt.x, y: earthAt.y + earthAt.r + 18 + clockR, r: clockR }
      : { x: earthAt.x + earthAt.r + 22 + clockR, y: earthAt.y, r: clockR };
    // The rover's mast pokes above its square, so the top row needs a little headroom.
    const tile = Math.max(28, Math.min((region.x1 - region.x0) / COLS, (region.y1 - region.y0) / (ROWS + 0.45), 130));
    const boardW = tile * COLS;
    const boardH = tile * ROWS;
    const board = {
      x: region.x0 + (region.x1 - region.x0 - boardW) / 2,
      y: region.y0 + tile * 0.45 + Math.max(0, (region.y1 - region.y0 - tile * 0.45 - boardH) / 2),
      tile,
    };
    const tubeSize = Math.max(18, Math.min(30, tile * 0.3));
    const tubes = wide
      ? { x: board.x + boardW, y: Math.max(gap + 4, board.y - tile * 0.45 - tubeSize * 1.6), size: tubeSize }
      : { x: board.x + boardW, y: board.y - tile * 0.45 - tubeSize * 1.6, size: tubeSize };
    return { wide, earth: earthAt, clock, tubes, limb, board };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = root.clientWidth;
    height = root.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    L = layout();
    placeRocks();
  }

  function squareCentre(col: number, row: number) {
    const b = L!.board;
    return { x: b.x + (col + 0.5) * b.tile, y: b.y + (row + 0.5) * b.tile };
  }

  /** Where a rock sits on screen: low on its square, so the rover's arm reaches it. */
  function rockCentre(col: number, row: number) {
    const c = squareCentre(col, row);
    return { x: c.x, y: c.y + L!.board.tile * 0.1 };
  }

  /** Lay the tap targets over the rocks that are left; drilled ones have none. */
  function placeRocks() {
    if (!L) return;
    const size = Math.max(64, L.board.tile * 1.15);
    rockButtons.forEach((button, i) => {
      const rock = drive.rocks[i];
      button.classList.toggle('is-done', !rock || rock.drilled);
      if (!rock) return;
      const c = rockCentre(rock.col, rock.row);
      button.style.left = `${c.x - size / 2}px`;
      button.style.top = `${c.y - size / 2}px`;
      button.style.width = button.style.height = `${size}px`;
    });
  }

  /** The rover's middle on screen and its size. */
  function roverAt() {
    const c = squareCentre(drive.x, drive.y);
    return { x: c.x, y: c.y, s: L!.board.tile * 0.95, dir: drive.facing === 'right' ? 1 : -1 };
  }

  /** Where the dot arrives: the rover's antenna, wherever it is now. */
  function antenna() {
    const r = roverAt();
    return { x: r.x - r.s * 0.08 * r.dir, y: r.y - r.s * 0.42 };
  }

  function flightPoint(t: number) {
    const e = L!.earth;
    const to = antenna();
    const from = L!.wide ? { x: e.x + e.r * 0.7, y: e.y } : { x: e.x, y: e.y + e.r * 0.7 };
    const mid = L!.wide ? { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - height * 0.08 } : { x: from.x, y: (from.y + to.y) / 2 };
    const u = 1 - t;
    return { x: u * u * from.x + 2 * u * t * mid.x + t * t * to.x, y: u * u * from.y + 2 * u * t * mid.y + t * t * to.y };
  }

  function syncState() {
    root.dataset.phase = drive.phase;
    root.dataset.samples = String(drive.samples);
    root.dataset.flying = drive.phase === 'message' ? '1' : '0';
    root.dataset.rocks = String(drive.rocks.filter(r => !r.drilled).length);
    root.dataset.nudges = String(nudges);
  }

  /* --- update ------------------------------------------------------------- */

  function update(dt: number) {
    const target = drive.target;
    const events = stepDrive(drive, dt);
    if (drive.phase === 'drive') wheel += dt * 6 * (drive.facing === 'right' ? 1 : -1);
    if (drive.phase === 'drill' && L) {
      const { x, y, s, dir } = roverAt();
      const tip = { x: x + s * 0.52 * dir, y: y + s * 0.22 };
      if (Math.random() < dt * 30) {
        dust.push({ x: tip.x, y: tip.y, vx: (Math.random() - 0.5) * s * 1.2, vy: -s * (0.4 + Math.random() * 0.6), life: 0.7 });
      }
    }
    if (events.sampled && L && target) {
      const c = rockCentre(target.col, target.row);
      flyers.push({ x: c.x, y: c.y, tx: L.tubes.x, ty: L.tubes.y, t: 0 });
      say(allDrilled(drive) ? 'Three samples!' : 'A rock sample!');
      placeRocks();
    }
    if (events.restocked) {
      say('Tap a rock!');
      placeRocks();
    }
    nudge = Math.max(0, nudge - dt);
    for (const f of flyers) f.t += dt / 0.9;
    flyers = flyers.filter(f => f.t < 1);
    for (const d of dust) {
      d.vy += (L?.board.tile ?? 60) * 2.2 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
    }
    dust = dust.filter(d => d.life > 0);
    syncState();
  }

  /* --- drawing ------------------------------------------------------------ */

  function drawSpace() {
    ctx.fillStyle = '#070a18';
    ctx.fillRect(0, 0, width, height);
    for (const [sx, sy, sr] of STARS) {
      ctx.fillStyle = '#ffffff99';
      ctx.fillRect(sx! * width, sy! * height, sr!, sr!);
    }
  }

  function drawMars() {
    const { limb, board } = L!;
    ctx.save();
    ctx.beginPath();
    ctx.arc(limb.x, limb.y, limb.r, 0, TAU);
    ctx.fillStyle = '#c4673d';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.clip();
    // A thin butterscotch haze at the edge: Mars's dusty air.
    ctx.strokeStyle = '#e9a86a66';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(limb.x, limb.y, limb.r - 8, 0, TAU);
    ctx.stroke();
    // Jezero crater: a wide dark rim around the floor the rover drives on.
    const bw = board.tile * COLS;
    const bh = board.tile * ROWS;
    const cx = board.x + bw / 2;
    const cy = board.y + bh / 2;
    const rx = bw / 2 + board.tile * 0.75;
    const ry = bh / 2 + board.tile * 0.75;
    ctx.fillStyle = '#9c4a2c';
    ctx.beginPath();
    ctx.ellipse(cx, cy + board.tile * 0.06, rx + board.tile * 0.3, ry + board.tile * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#d98a5a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.clip();
    // The old river fan at the crater's edge, where Perseverance looks for signs of ancient water.
    ctx.fillStyle = '#e8b383';
    ctx.beginPath();
    ctx.moveTo(cx + rx * 1.05, cy - ry * 0.9);
    ctx.quadraticCurveTo(cx + rx * 0.2, cy - ry * 0.55, cx + rx * 0.3, cy + ry * 0.15);
    ctx.quadraticCurveTo(cx + rx * 0.75, cy + ry * 0.05, cx + rx * 1.05, cy + ry * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c98a5e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + rx * 1.02, cy - ry * (0.85 - i * 0.05));
      ctx.quadraticCurveTo(cx + rx * (0.6 - i * 0.05), cy - ry * (0.3 - i * 0.15), cx + rx * (0.45 + i * 0.15), cy + ry * (0.1 + i * 0.02));
      ctx.stroke();
    }
    for (const [px, py, pr] of PEBBLES) {
      ctx.fillStyle = '#a95a36aa';
      ctx.beginPath();
      ctx.arc(cx - rx + px! * rx * 2, cy - ry + py! * ry * 2, pr! * Math.max(1.5, board.tile * 0.035), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  /**
   * A boulder. While the rover is free, rocks still to drill glow gold like the places in the
   * world, and wobble gently (still, with reduced motion): tap me.
   */
  function drawRock(i: number, t: number) {
    const rock = drive.rocks[i]!;
    const { x, y } = rockCentre(rock.col, rock.row);
    const s = L!.board.tile * 0.72;
    const inviting = !rock.drilled && drive.phase === 'idle';
    const chosen = drive.target === rock;
    if (inviting || chosen) {
      const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 3 + i * 2);
      const glow = ctx.createRadialGradient(x, y, s * 0.1, x, y, s * 0.75 * pulse);
      glow.addColorStop(0, '#ffd75acc');
      glow.addColorStop(1, '#ffd75a00');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.75 * pulse, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x, y + s * 0.2);
    if (inviting && !reduced) ctx.rotate(Math.sin(t * 3.2 + i * 2.1) * 0.07);
    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.3, s * 0.08, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8e7a6a';
    ctx.strokeStyle = chosen ? '#ffd75a' : INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, 0);
    ctx.lineTo(-s * 0.26, -s * 0.22);
    ctx.lineTo(-s * 0.1, -s * 0.36);
    ctx.lineTo(s * 0.14, -s * 0.33);
    ctx.lineTo(s * 0.29, -s * 0.18);
    ctx.lineTo(s * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#b8a594';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, -s * 0.24);
    ctx.lineTo(s * 0.02, -s * 0.28);
    ctx.stroke();
    if (rock.drilled) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(s * 0.06, -s * 0.14, s * 0.05, s * 0.035, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWheel(x: number, y: number, r: number) {
    ctx.fillStyle = '#4a4440';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#b9b0a6';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const a = wheel + (i * TAU) / 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
      ctx.stroke();
    }
  }

  /** "Not now": a soft ring around the rover that grows and fades (holds still with reduced motion). */
  function drawNudge() {
    if (nudge <= 0) return;
    const { x, y, s } = roverAt();
    const k = 1 - nudge / NUDGE_TIME;
    const r = reduced ? s * 0.6 : s * (0.45 + 0.3 * k);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#fff6b0';
    ctx.lineWidth = Math.max(3, s * 0.06);
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.1, r, r * 0.75, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** Perseverance from the side, facing right before the mirror: six wheels, mast, arm. */
  function drawRover(t: number) {
    const { x: cx, y: cy, s } = roverAt();
    const bob = drive.phase === 'drive' && !reduced ? Math.sin(t * 22) * s * 0.008 : 0;
    ctx.save();
    ctx.translate(cx, cy + bob);
    if (drive.facing === 'left') ctx.scale(-1, 1);
    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.3, s * 0.48, s * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Rocker-bogie legs.
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2.5, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, s * 0.2);
    ctx.lineTo(-s * 0.18, s * 0.02);
    ctx.lineTo(0, s * 0.2);
    ctx.moveTo(-s * 0.09, s * 0.11);
    ctx.lineTo(s * 0.12, s * 0.02);
    ctx.lineTo(s * 0.36, s * 0.2);
    ctx.stroke();
    // The arm: tucked in front, or reaching down to drill.
    const drilling = drive.phase === 'drill';
    ctx.strokeStyle = '#d8d2c6';
    ctx.lineWidth = Math.max(4, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(s * 0.32, -s * 0.04);
    if (drilling) {
      ctx.lineTo(s * 0.5, -s * 0.08);
      ctx.lineTo(s * 0.52, s * 0.14);
    } else {
      ctx.lineTo(s * 0.46, -s * 0.12);
      ctx.lineTo(s * 0.44, s * 0.04);
    }
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#9a948b';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    const jiggle = drilling && !reduced ? Math.sin(t * 60) * s * 0.01 : 0;
    ctx.beginPath();
    if (drilling) ctx.roundRect(s * 0.45 + jiggle, s * 0.1, s * 0.14, s * 0.12, 3);
    else ctx.roundRect(s * 0.38, s * 0.0, s * 0.13, s * 0.1, 3);
    ctx.fill();
    ctx.stroke();
    if (drilling) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(s * 0.52 + jiggle, s * 0.22);
      ctx.lineTo(s * 0.52 + jiggle, s * 0.3);
      ctx.stroke();
    }
    // Body, with the power pack sloping off the back.
    ctx.fillStyle = '#5a5550';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, -s * 0.12);
    ctx.lineTo(-s * 0.5, -s * 0.2);
    ctx.lineTo(-s * 0.54, -s * 0.12);
    ctx.lineTo(-s * 0.4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f3efe6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-s * 0.4, -s * 0.15, s * 0.74, s * 0.16, s * 0.04);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9a45a';
    ctx.beginPath();
    ctx.roundRect(-s * 0.3, -s * 0.11, s * 0.5, s * 0.07, 2);
    ctx.fill();
    // The dish that talks to Earth.
    ctx.fillStyle = '#d8d2c6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(-s * 0.08, -s * 0.22, s * 0.11, s * 0.035, -0.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -s * 0.2);
    ctx.lineTo(-s * 0.08, -s * 0.15);
    ctx.stroke();
    // The mast and its camera head, looking ahead.
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(3, s * 0.045);
    ctx.beginPath();
    ctx.moveTo(s * 0.22, -s * 0.15);
    ctx.lineTo(s * 0.22, -s * 0.46);
    ctx.stroke();
    ctx.fillStyle = '#f3efe6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(s * 0.1, -s * 0.58, s * 0.26, s * 0.13, s * 0.03);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#28324a';
    for (const ex of [0.2, 0.3]) {
      ctx.beginPath();
      ctx.arc(s * ex, -s * 0.515, s * 0.032, 0, TAU);
      ctx.fill();
    }
    for (const wx of [-0.36, 0, 0.36]) drawWheel(s * wx, s * 0.21, s * 0.09);
    ctx.restore();
  }

  /** The message: a big glowing dot with a little drill bit inside. */
  function drawDot(x: number, y: number, r: number) {
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.2);
    glow.addColorStop(0, '#fff6b0dd');
    glow.addColorStop(1, '#fff6b000');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff3a0';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.35, y - r * 0.5);
    ctx.lineTo(x + r * 0.35, y - r * 0.5);
    ctx.lineTo(x, y + r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEarth() {
    const { earth: e } = L!;
    if (earth) ctx.drawImage(earth, e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
    else {
      ctx.fillStyle = '#2f6aa8';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, TAU);
    ctx.stroke();
  }

  /**
   * The clock beside Earth: while the message flies, its minute hand sweeps the real wait
   * (12 minutes of the hour) and the face fills behind it. With reduced motion it ticks a
   * minute at a time.
   */
  function drawClock() {
    const { clock } = L!;
    const k = messageProgress(drive);
    const top = -Math.PI / 2;
    const minutes = k === null ? 0 : reduced ? Math.floor(k * REAL_MINUTES) : k * REAL_MINUTES;
    const hand = top + (minutes / 60) * TAU;
    ctx.fillStyle = '#f8f0dd';
    ctx.beginPath();
    ctx.arc(clock.x, clock.y, clock.r, 0, TAU);
    ctx.fill();
    if (minutes > 0) {
      ctx.fillStyle = '#ffd75a';
      ctx.beginPath();
      ctx.moveTo(clock.x, clock.y);
      ctx.arc(clock.x, clock.y, clock.r * 0.92, top, hand);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(clock.x, clock.y, clock.r, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      ctx.beginPath();
      ctx.moveTo(clock.x + Math.cos(a) * clock.r * 0.78, clock.y + Math.sin(a) * clock.r * 0.78);
      ctx.lineTo(clock.x + Math.cos(a) * clock.r * 0.9, clock.y + Math.sin(a) * clock.r * 0.9);
      ctx.stroke();
    }
    // A short hour hand, so it reads as a clock; the long minute hand does the sweeping.
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(clock.x, clock.y);
    ctx.lineTo(clock.x + Math.cos(top - TAU / 6) * clock.r * 0.45, clock.y + Math.sin(top - TAU / 6) * clock.r * 0.45);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(clock.x, clock.y);
    ctx.lineTo(clock.x + Math.cos(hand) * clock.r * 0.8, clock.y + Math.sin(hand) * clock.r * 0.8);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(clock.x, clock.y, 3.5, 0, TAU);
    ctx.fill();
  }

  function drawTube(x: number, y: number, size: number, full: boolean) {
    const w = size * 0.42;
    ctx.fillStyle = full ? '#f3efe6' : '#f3efe633';
    ctx.strokeStyle = full ? INK : '#f8f0dd88';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y, w, size * 1.4, [2, 2, w / 2, w / 2]);
    ctx.fill();
    ctx.stroke();
    if (full) {
      ctx.fillStyle = '#b5683f';
      ctx.beginPath();
      ctx.roundRect(x - w / 2 + 3, y + size * 0.7, w - 6, size * 0.6, [0, 0, w / 2, w / 2]);
      ctx.fill();
      ctx.fillStyle = '#7d7468';
      ctx.fillRect(x - w / 2 - 1, y - 3, w + 2, 6);
    }
  }

  function drawTubes() {
    const { tubes } = L!;
    const slots = Math.max(3, Math.ceil(drive.samples / 3) * 3);
    const shown = Math.min(slots, 9);
    const step = tubes.size * 0.62;
    const flying = flyers.length;
    for (let i = 0; i < shown; i++) {
      const x = tubes.x - tubes.size * 0.25 - (shown - 1 - i) * step;
      drawTube(x, tubes.y, tubes.size, i < Math.min(drive.samples, 9) - flying);
    }
    for (const f of flyers) {
      const k = f.t * f.t * (3 - 2 * f.t);
      const x = f.x + (f.tx - tubes.size * 0.25 - f.x) * k;
      const y = f.y + (f.ty - f.y) * k - Math.sin(f.t * Math.PI) * tubes.size * 3;
      drawTube(x, y, tubes.size, true);
    }
  }

  function drawMessage() {
    const k = messageProgress(drive);
    if (k === null) return;
    const r = Math.max(14, Math.min(24, L!.board.tile * 0.2));
    if (reduced) {
      // Cuts, not a glide: at Earth, halfway, then at the rover, the wait unchanged.
      drawDot(...xy(flightPoint(Math.min(1, Math.floor(k * 3) / 2))), r);
      return;
    }
    for (let j = 1; j <= 5; j++) {
      const q = flightPoint(Math.max(0, k - j * 0.03));
      ctx.fillStyle = `rgba(255, 243, 160, ${0.4 - j * 0.07})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * (0.75 - j * 0.1), 0, TAU);
      ctx.fill();
    }
    drawDot(...xy(flightPoint(k)), r);
  }

  function draw(t: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSpace();
    if (!L) return;
    drawMars();
    drawEarth();
    drawClock();
    // Rocks behind the rover are drawn before it; the one it drills, and nearer ones, after.
    const order = drive.rocks.map((_, i) => i);
    const behind = (i: number) => drive.rocks[i]!.row < drive.y - 0.01;
    for (const i of order) if (behind(i)) drawRock(i, t);
    drawRover(t);
    for (const i of order) if (!behind(i)) drawRock(i, t);
    drawNudge();
    for (const d of dust) {
      ctx.fillStyle = `rgba(201, 140, 96, ${Math.max(0, d.life / 0.7)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, Math.max(2, L.board.tile * 0.04), 0, TAU);
      ctx.fill();
    }
    drawTubes();
    drawMessage();
  }

  function loop(now: number) {
    if (!open) return;
    const dt = last ? Math.min((now - last) / 1000, MAX_STEP) : 0;
    last = now;
    update(dt);
    draw(now / 1000);
    frame = requestAnimationFrame(loop);
  }

  /* --- input -------------------------------------------------------------- */

  back.addEventListener('click', () => api.close());
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
    }
  });
  const onResize = () => { if (open) resize(); };
  window.addEventListener('resize', onResize);
  // The caption's height feeds the layout; keep them in step when it changes.
  new MutationObserver(() => { if (open) { L = layout(); placeRocks(); } })
    .observe(caption, { childList: true, characterData: true, subtree: true });

  const api: MarsRover = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      host.append(root);
      root.classList.remove('is-hidden');
      reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      drive = createDrive(COLS, ROWS, PLAY_DELAY);
      wheel = 0;
      nudge = 0;
      nudges = 0;
      flyers = [];
      dust = [];
      say('Tap a rock!');
      resize();
      syncState();
      last = 0;
      frame = requestAnimationFrame(loop);
      rockButtons[0]!.focus();
      void earthPicture().then(found => { earth = found; });
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
      root.classList.add('is-hidden');
      root.remove();
    },
  };
  return api;
}

function xy(p: { x: number; y: number }): [number, number] {
  return [p.x, p.y];
}
