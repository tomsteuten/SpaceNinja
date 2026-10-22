/**
 * Mars rover: Mars is so far away that messages take minutes. Earth hangs in space on one
 * side; Perseverance waits on the floor of Jezero crater on the other. Each arrow the child
 * presses leaves Earth as a glowing dot, and the rover does nothing until it arrives, so
 * they soon learn to send several moves ahead, as real rover drivers do. Drill on a rock to
 * collect a sample tube. The real wait is about 12 minutes on a typical day (3 to 22); the
 * toy shrinks it to three seconds while a little clock says the real number.
 *
 * A self-contained overlay like the Saturn bath; it owns nothing in the 3D scene. The
 * timing is in roverDelay.ts.
 */
import './marsRover.css';
import { worldPicture } from '../ui/pictures';
import { createIcon } from '../ui/icons';
import {
  PLAY_DELAY, allDrilled, createDrive, progress, realDelayLabel, rockAt, rocksFor, roverPosition, send,
  stepDrive, type Command, type Drive, type Move,
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
/** Minutes of a clock hour the message really takes; the clock shows that much of its face. */
const REAL_LABEL = realDelayLabel();
const REAL_MINUTES = Number(REAL_LABEL.match(/\d+/)![0]);
const MOVES: readonly Move[] = ['up', 'left', 'down', 'right'];
const MOVE_NAMES: Record<Move, string> = { up: 'up', down: 'down', left: 'left', right: 'right' };
/** Arrow glyph angle, pointing right at 0. */
const ANGLE: Record<Move, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

interface Layout {
  wide: boolean;
  earth: { x: number; y: number; r: number };
  clock: { x: number; y: number; r: number };
  label: { x: number; y: number; size: number };
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

function arrowSvg(move: Move): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'mars-rover__arrow');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M4 9.5h9V5l7 7-7 7v-4.5H4Z');
  path.setAttribute('transform', `rotate(${(ANGLE[move] * 180) / Math.PI} 12 12)`);
  svg.append(path);
  return svg;
}

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

  const pad = el('div', 'mars-rover__pad');
  const moveButtons = MOVES.map(move => {
    const button = el('button', `mars-rover__key mars-rover__key--${move}`);
    button.type = 'button';
    button.dataset.move = move;
    button.setAttribute('aria-label', `Drive ${MOVE_NAMES[move]}`);
    button.append(arrowSvg(move));
    button.addEventListener('click', () => command(move, button));
    return button;
  });
  pad.append(...moveButtons);

  const drillButton = el('button', 'mars-rover__drill');
  drillButton.type = 'button';
  drillButton.setAttribute('aria-label', 'Drill a rock');
  drillButton.append(createIcon('drill'), el('span', '', 'Drill'));
  drillButton.addEventListener('click', () => command('drill', drillButton));

  root.append(canvas, caption, back, drillButton, pad);

  const ctx = canvas.getContext('2d')!;
  let open = false;
  let frame = 0;
  let last = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let L: Layout | null = null;
  let earth: HTMLCanvasElement | null = null;
  let drive: Drive = createDrive(COLS, ROWS);
  let round = 0;
  let restock = 0;
  let wheel = 0;
  let flyers: Flyer[] = [];
  let dust: Dust[] = [];
  let sent = false;

  function say(text: string) {
    if (caption.textContent !== text) caption.textContent = text;
  }

  function command(c: Command, button: HTMLElement) {
    if (!open) return;
    if (!send(drive, c)) {
      // The list is full: a little shake, nothing lost.
      button.classList.remove('is-full');
      void button.offsetWidth;
      button.classList.add('is-full');
      return;
    }
    if (!sent) {
      sent = true;
      say('Wait… Mars is far away!');
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
    const padBox = rectOf(pad);
    const backBox = rectOf(back);
    const drillBox = rectOf(drillButton);
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
      region = { x0: spaceW + gap * 1.5, y0: gap, x1: Math.min(padBox.left, drillBox.left) - gap, y1: height - gap };
    } else {
      root.style.removeProperty('--space-w');
      const r = Math.max(30, Math.min(width * 0.12, height * 0.075, 80));
      earthAt = { x: gap + r + 8, y: captionBottom + r + 16, r };
      const horizon = earthAt.y + r + Math.max(46, r * 0.75);
      limb = { x: width / 2, y: horizon + width * 2.4, r: width * 2.4 };
      region = { x0: gap, y0: horizon + gap * 1.6, x1: width - gap, y1: Math.min(padBox.top, backBox.top, drillBox.top) - gap };
    }
    // The clock sits out of the dots' way: under Earth when Mars is beside it, beside Earth
    // when Mars is below, with its words beside or under it.
    const clockR = earthAt.r * 0.62;
    const labelSize = Math.round(Math.max(17, Math.min(26, earthAt.r * 0.36)));
    const clock = wide
      ? { x: earthAt.x, y: earthAt.y + earthAt.r + 14 + clockR, r: clockR }
      : { x: earthAt.x + earthAt.r + 16 + clockR, y: earthAt.y, r: clockR };
    const label = wide
      ? { x: clock.x - clockR, y: clock.y + clockR + 8, size: labelSize }
      : { x: clock.x + clockR + 12, y: clock.y - labelSize * 0.6, size: labelSize };
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
    return { wide, earth: earthAt, clock, label, tubes, limb, board };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = root.clientWidth;
    height = root.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    L = layout();
  }

  function squareCentre(col: number, row: number) {
    const b = L!.board;
    return { x: b.x + (col + 0.5) * b.tile, y: b.y + (row + 0.5) * b.tile };
  }

  /**
   * The rover's middle on screen and its size. On a square with a rock it parks just behind
   * the rock, so the rock shows in front of it and the drill reaches it.
   */
  function roverAt() {
    const p = roverPosition(drive);
    const c = squareCentre(p.col, p.row);
    const tile = L!.board.tile;
    const dir = drive.facing === 'right' ? 1 : -1;
    const a = drive.action;
    const back = (col: number, row: number) => (rockAt(drive, col, row) ? -dir * tile * 0.3 : 0);
    let shift = back(drive.col, drive.row);
    if (a?.kind === 'drive') {
      const t = Math.min(1, a.elapsed / a.duration);
      const k = t * t * (3 - 2 * t);
      shift = back(a.from[0], a.from[1]) * (1 - k) + back(a.to[0], a.to[1]) * k;
    }
    return { x: c.x + shift, y: c.y, s: tile * 0.95, dir };
  }

  /** Where the dots arrive: the rover's antenna, wherever it is now. */
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
    root.dataset.col = String(drive.col);
    root.dataset.row = String(drive.row);
    root.dataset.samples = String(drive.samples);
    root.dataset.flying = String(drive.messages.length);
    root.dataset.busy = drive.action ? drive.action.kind : '';
  }

  /* --- update ------------------------------------------------------------- */

  function update(dt: number) {
    const events = stepDrive(drive, dt);
    if (drive.action?.kind === 'drive') wheel += dt * 6 * (drive.facing === 'right' ? 1 : -1);
    if (drive.action?.kind === 'drill' && L) {
      const { x, y, s, dir } = roverAt();
      const tip = { x: x + s * 0.52 * dir, y: y + s * 0.22 };
      if (Math.random() < dt * 30) {
        dust.push({ x: tip.x, y: tip.y, vx: (Math.random() - 0.5) * s * 1.2, vy: -s * (0.4 + Math.random() * 0.6), life: 0.7 });
      }
    }
    if (events.sampled && L) {
      const c = squareCentre(drive.col, drive.row);
      flyers.push({ x: c.x, y: c.y, tx: L.tubes.x, ty: L.tubes.y, t: 0 });
      say(allDrilled(drive) ? 'Three samples!' : 'A rock sample!');
      if (allDrilled(drive)) restock = 2.5;
    }
    if (restock > 0 && !drive.action) {
      restock -= dt;
      if (restock <= 0) {
        round++;
        drive.rocks = rocksFor(round, COLS, ROWS, [drive.col, drive.row]);
      }
    }
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

  function drawMars(t: number) {
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
    // Chalk dots on the squares, so steps can be counted.
    ctx.fillStyle = '#fff3dd88';
    for (let c = 0; c <= COLS; c++) {
      for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.arc(board.x + c * board.tile, board.y + r * board.tile, Math.max(2, board.tile * 0.035), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    void t;
  }

  /** A boulder, low on its square, so a rover parked behind it can reach it with the drill. */
  function drawRock(col: number, row: number, drilled: boolean) {
    const centre = squareCentre(col, row);
    const x = centre.x;
    const y = centre.y + L!.board.tile * 0.1;
    const s = L!.board.tile * 0.72;
    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.2, s * 0.3, s * 0.08, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8e7a6a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, y + s * 0.2);
    ctx.lineTo(x - s * 0.26, y - s * 0.02);
    ctx.lineTo(x - s * 0.1, y - s * 0.16);
    ctx.lineTo(x + s * 0.14, y - s * 0.13);
    ctx.lineTo(x + s * 0.29, y + s * 0.02);
    ctx.lineTo(x + s * 0.3, y + s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#b8a594';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.18, y - s * 0.04);
    ctx.lineTo(x + s * 0.02, y - s * 0.08);
    ctx.stroke();
    if (drilled) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(x + s * 0.06, y + s * 0.06, s * 0.05, s * 0.035, 0, 0, TAU);
      ctx.fill();
    }
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

  /** Perseverance from the side, facing right before the mirror: six wheels, mast, arm. */
  function drawRover(t: number) {
    const { x: cx, y: cy, s } = roverAt();
    const c = { x: cx, y: cy };
    const a = drive.action;
    let wobble = 0;
    if (a?.kind === 'bump') wobble = Math.sin((a.elapsed / a.duration) * Math.PI * 4) * s * 0.05;
    const bob = a?.kind === 'drive' ? Math.sin(t * 22) * s * 0.008 : 0;
    ctx.save();
    ctx.translate(c.x + wobble, c.y + bob);
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
    const drilling = a?.kind === 'drill';
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
    const jiggle = drilling ? Math.sin(t * 60) * s * 0.01 : 0;
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

  /** A command's glowing dot, with its arrow (or a drill bit) inside. */
  function drawDot(x: number, y: number, r: number, c: Command, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2);
    glow.addColorStop(0, '#fff6b0cc');
    glow.addColorStop(1, '#fff6b000');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff3a0';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.translate(x, y);
    ctx.fillStyle = INK;
    if (c === 'drill') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, -r * 0.5);
      ctx.lineTo(r * 0.35, -r * 0.5);
      ctx.lineTo(0, r * 0.6);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.rotate(ANGLE[c]);
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.2);
      ctx.lineTo(r * 0.05, -r * 0.2);
      ctx.lineTo(r * 0.05, -r * 0.5);
      ctx.lineTo(r * 0.6, 0);
      ctx.lineTo(r * 0.05, r * 0.5);
      ctx.lineTo(r * 0.05, r * 0.2);
      ctx.lineTo(-r * 0.55, r * 0.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEarth() {
    const { earth: e, clock, label } = L!;
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
    // The little clock: a slice of its face for the real wait, and a hand that runs through
    // it while the oldest message is on its way.
    ctx.fillStyle = '#f8f0dd';
    ctx.beginPath();
    ctx.arc(clock.x, clock.y, clock.r, 0, TAU);
    ctx.fill();
    const top = -Math.PI / 2;
    const slice = (REAL_MINUTES / 60) * TAU;
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath();
    ctx.moveTo(clock.x, clock.y);
    ctx.arc(clock.x, clock.y, clock.r * 0.92, top, top + slice);
    ctx.closePath();
    ctx.fill();
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
    const oldest = drive.messages[0];
    const hand = top + (oldest ? progress(drive, oldest) : 0) * slice;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(clock.x, clock.y);
    ctx.lineTo(clock.x + Math.cos(hand) * clock.r * 0.75, clock.y + Math.sin(hand) * clock.r * 0.75);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(clock.x, clock.y, 3, 0, TAU);
    ctx.fill();
    ctx.font = `${label.size}px 'Patrick Hand', cursive`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f8f0dd';
    ctx.fillText(REAL_LABEL, label.x, label.y);
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

  function draw(t: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSpace();
    if (!L) return;
    drawMars(t);
    drawEarth();
    // Rocks behind the rover's row are drawn before it, the rest after.
    const p = roverPosition(drive);
    for (const r of drive.rocks) if (r.row <= p.row && !(r.col === drive.col && r.row === drive.row)) drawRock(r.col, r.row, r.drilled);
    drawRover(t);
    const under = rockAt(drive, drive.col, drive.row);
    if (under) drawRock(under.col, under.row, under.drilled);
    for (const r of drive.rocks) if (r.row > p.row) drawRock(r.col, r.row, r.drilled);
    for (const d of dust) {
      ctx.fillStyle = `rgba(201, 140, 96, ${Math.max(0, d.life / 0.7)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, Math.max(2, L.board.tile * 0.04), 0, TAU);
      ctx.fill();
    }
    drawTubes();
    const r = Math.max(11, Math.min(20, L.board.tile * 0.17));
    // Arrived, waiting their turn: stacked over the rover's antenna.
    const ant = antenna();
    drive.waiting.forEach((c, i) => drawDot(ant.x, ant.y - r * 1.2 - i * r * 2.3, r * 0.85, c));
    // On their way: a faint trail behind each dot.
    for (const m of drive.messages) {
      const k = progress(drive, m);
      for (let j = 1; j <= 4; j++) {
        const q = flightPoint(Math.max(0, k - j * 0.035));
        ctx.fillStyle = `rgba(255, 243, 160, ${0.35 - j * 0.07})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * (0.7 - j * 0.1), 0, TAU);
        ctx.fill();
      }
      const at = flightPoint(k);
      drawDot(at.x, at.y, r, m.command);
    }
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
  const KEYS: Record<string, Move> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
      return;
    }
    const move = KEYS[event.key];
    if (move) {
      event.preventDefault();
      command(move, moveButtons[MOVES.indexOf(move)]!);
    }
  });
  const onResize = () => { if (open) resize(); };
  window.addEventListener('resize', onResize);
  // The caption's height feeds the layout; keep them in step when it changes.
  new MutationObserver(() => { if (open) L = layout(); }).observe(caption, { childList: true, characterData: true, subtree: true });

  const api: MarsRover = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      host.append(root);
      root.classList.remove('is-hidden');
      drive = createDrive(COLS, ROWS, PLAY_DELAY);
      round = 0;
      restock = 0;
      wheel = 0;
      flyers = [];
      dust = [];
      sent = false;
      say('Send the rover a message!');
      resize();
      syncState();
      last = 0;
      frame = requestAnimationFrame(loop);
      moveButtons[0]!.focus();
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
