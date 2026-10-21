/**
 * Saturn's bath: Saturn is so light for its size that it would float. A giant bath hangs in
 * space with four worlds on a shelf above it; the child drags them in (or presses Plop!).
 * Earth, Mars and the Moon go plop and sink to the bottom; Saturn bobs and floats with about
 * seven tenths of itself under water, because its average density (0.69 g/cm³) is less than
 * water's. The sizes are not to scale: real Saturn is more than nine Earths wide.
 *
 * A self-contained overlay like the Moon jump and the bedtime spin; it owns nothing in the
 * 3D scene. The physics is in bathPhysics.ts.
 */
import './saturnBath.css';
import { worldPicture } from '../ui/pictures';
import { createIcon } from '../ui/icons';
import {
  BATH_WORLDS, DENSITY, createFloater, floats, isSettled, stepFloater, type BathWorld, type Floater,
} from './bathPhysics';

export interface SaturnBath {
  readonly isOpen: boolean;
  open(): void;
  /** The child's own way out: calls onClose. */
  close(): void;
  /** Taken away by a reset (flight, return, crash): no callback. */
  dismiss(): void;
}

export interface SaturnBathOptions {
  onClose?(): void;
}

const TAU = Math.PI * 2;
const MAX_STEP = 0.1;
/** Body radius in layout units (not to scale: Saturn would be over nine Earths wide). */
const SIZE: Record<BathWorld, number> = { saturn: 1, earth: 0.62, mars: 0.48, moon: 0.38 };
/** Saturn's rings reach this many of its radii, as in the 3D scene. */
const RING_OUTER = 2.1;
const RING_INNER = 1.28;
const RING_FLATTEN = 0.24;
const NAMES: Record<BathWorld, string> = { earth: 'Earth', mars: 'Mars', moon: 'The Moon', saturn: 'Saturn' };
const SHELF_LABELS: Record<BathWorld, string> = { earth: 'Earth', mars: 'Mars', moon: 'Moon', saturn: 'Saturn' };
const FALLBACK: Record<BathWorld, string> = { earth: '#2f6aa8', mars: '#c0603a', moon: '#a9a39a', saturn: '#d9b77a' };
/** Units of layout: tub interior width and water depth, rim to water, shelf height. */
const TUB_WIDTH = 8;
const WATER_DEPTH = 2.8;
const RIM_TO_WATER = 0.4;
const INK = '#2b2118';

interface Body {
  id: BathWorld;
  mode: 'shelf' | 'held' | 'bath';
  /** Screen position while on the shelf (eased) or held. */
  x: number;
  y: number;
  /** Across the tub interior, 0 to 1, while in the bath. */
  u: number;
  floater: Floater | null;
  /** Seconds since it last went in, for the "floats" caption. */
  wet: number;
}

interface Drop { x: number; y: number; vx: number; vy: number; life: number }
interface Bubble { x: number; y: number; r: number; vy: number; life: number }
interface Ripple { x: number; age: number; size: number }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function seededStars(count: number): [number, number, number][] {
  let s = 23;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: count }, () => [rand(), rand(), 0.4 + rand() * 1.2]);
}
const STARS = seededStars(90);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

/** A world's face from its map: the middle half of the longitudes, as a shaded ball. */
function ballFrom(image: HTMLImageElement, size: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const ctx = out.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, TAU);
  ctx.clip();
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  ctx.drawImage(image, w * 0.25, 0, w * 0.5, h, 0, 0, size, size);
  const shade = ctx.createRadialGradient(size * 0.38, size * 0.34, size * 0.1, size / 2, size / 2, size / 2);
  shade.addColorStop(0, '#ffffff22');
  shade.addColorStop(0.7, '#00000000');
  shade.addColorStop(1, '#00000077');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);
  return out;
}

let balls: Promise<Partial<Record<BathWorld, HTMLCanvasElement>>> | null = null;
function worldBalls() {
  balls ??= (async () => {
    const out: Partial<Record<BathWorld, HTMLCanvasElement>> = {};
    await Promise.all(BATH_WORLDS.map(id => loadImage(`assets/${id}.jpg`)
      .then(image => { out[id] = ballFrom(image, 256); })
      .catch(() => {})));
    return out;
  })();
  return balls;
}

export function createSaturnBath(host: HTMLElement, options: SaturnBathOptions = {}): SaturnBath {
  const root = el('div', 'saturn-bath is-hidden');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Saturn bath time');
  const canvas = el('canvas', 'saturn-bath__canvas');
  canvas.setAttribute('aria-hidden', 'true');

  const caption = el('p', 'saturn-bath__caption');
  caption.setAttribute('aria-live', 'polite');

  const back = el('button', 'saturn-bath__back');
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to Saturn');
  back.append(createIcon('back'), worldPicture('saturn'));

  const plopButton = el('button', 'saturn-bath__plop');
  plopButton.type = 'button';
  const plopPicture = el('span', 'saturn-bath__plop-picture');
  const plopLabel = el('span', '', 'Plop!');
  plopButton.append(plopPicture, plopLabel);

  root.append(canvas, caption, back, plopButton);

  const ctx = canvas.getContext('2d')!;
  let open = false;
  let frame = 0;
  let last = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let pictures: Partial<Record<BathWorld, HTMLCanvasElement>> = {};
  let bodies: Body[] = [];
  let drops: Drop[] = [];
  let bubbles: Bubble[] = [];
  let ripples: Ripple[] = [];
  let held: Body | null = null;
  let heldId: number | null = null;
  let grab = { x: 0, y: 0 };
  let saturnAnnounced = false;
  let allAnnounced = false;

  function layout() {
    const landscape = width > height * 1.3;
    const short = height < 480;
    const pad = 14;
    const top = landscape ? pad : 74;
    const bottom = height - (short ? 88 : 112);
    // Shelf, its name labels, the tap over the rim, the water and the feet.
    const unitsHigh = 2.2 + 0.6 + 0.85 + RIM_TO_WATER + WATER_DEPTH + 0.6;
    const U = Math.max(20, Math.min((width - pad * 2) / (TUB_WIDTH + 0.6), (bottom - top) / unitsHigh, 92));
    const free = Math.max(0, bottom - top - unitsHigh * U);
    const shelfLine = top + free * 0.3 + 2.2 * U;
    const floorY = bottom - free * 0.3 - 0.6 * U;
    const waterY = floorY - WATER_DEPTH * U;
    const rimY = waterY - RIM_TO_WATER * U;
    const cx = width / 2;
    // The shelf sits beside the caption in a short landscape view, under it otherwise.
    const shelfLeft = landscape ? Math.min(width * 0.36, width - 8.6 * U - pad) : pad;
    return {
      U, cx, rimY, waterY, floorY, shelfLine, shelfLeft, shelfRight: width - pad,
      tubL: cx - (TUB_WIDTH / 2) * U, tubR: cx + (TUB_WIDTH / 2) * U,
    };
  }

  function radius(b: Body, U = layout().U) { return SIZE[b.id] * U; }
  /** Half the width a body takes up: Saturn's rings reach well past it. */
  function halfWidth(b: Body, U = layout().U) { return radius(b, U) * (b.id === 'saturn' ? RING_OUTER : 1); }

  function shelfSpot(b: Body) {
    const L = layout();
    const order = BATH_WORLDS;
    const widths = order.map(id => SIZE[id] * (id === 'saturn' ? RING_OUTER : 1) * 2 * L.U);
    const gap = Math.max(10, ((L.shelfRight - L.shelfLeft) - widths.reduce((a, w) => a + w, 0)) / (order.length + 1));
    let x = L.shelfLeft + gap;
    for (let i = 0; i < order.length; i++) {
      if (order[i] === b.id) return { x: x + widths[i]! / 2, y: L.shelfLine - SIZE[b.id] * L.U };
      x += widths[i]! + gap;
    }
    return { x: L.cx, y: L.shelfLine };
  }

  function bathX(b: Body) {
    const L = layout();
    const inner = halfWidth(b, L.U) + L.U * 0.12;
    const left = L.tubL + inner;
    const right = L.tubR - inner;
    return left + (right - left) * b.u;
  }

  function floorDepth(b: Body) {
    const L = layout();
    const r = radius(b, L.U);
    return (L.floorY - r - L.waterY) / r;
  }

  function position(b: Body) {
    if (b.mode === 'bath' && b.floater) {
      const L = layout();
      return { x: bathX(b), y: L.waterY + b.floater.depth * radius(b, L.U) };
    }
    return { x: b.x, y: b.y };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = root.clientWidth;
    height = root.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    for (const b of bodies) {
      if (b.mode === 'shelf') Object.assign(b, shelfSpot(b));
      if (b.floater) b.floater.floor = floorDepth(b);
    }
  }

  function nextOnShelf() { return bodies.find(b => b.mode === 'shelf') ?? null; }

  function syncButton() {
    const next = nextOnShelf();
    plopPicture.replaceChildren(next ? worldPicture(next.id) : createIcon('bath'));
    plopLabel.textContent = next ? 'Plop!' : 'Again';
    plopButton.setAttribute('aria-label', next ? `Drop ${NAMES[next.id]} in the bath` : 'Empty the bath');
  }

  function syncState() {
    const inBath = bodies.filter(b => b.mode === 'bath');
    root.dataset.floating = inBath.filter(b => b.floater && floats(b.floater.density) && isSettled(b.floater)).map(b => b.id).join(' ');
    root.dataset.sunk = inBath.filter(b => b.floater?.onFloor).map(b => b.id).join(' ');
    root.dataset.shelf = bodies.filter(b => b.mode === 'shelf').map(b => b.id).join(' ');
  }

  function say(text: string) {
    if (caption.textContent !== text) caption.textContent = text;
  }

  /** Into the water from wherever it is now, at that height. */
  function putInBath(b: Body, x: number, y: number) {
    const L = layout();
    const r = radius(b, L.U);
    b.mode = 'bath';
    const inner = halfWidth(b, L.U) + L.U * 0.12;
    b.u = Math.min(1, Math.max(0, (x - (L.tubL + inner)) / Math.max(1, L.tubR - L.tubL - inner * 2)));
    const floor = floorDepth(b);
    b.floater = createFloater(DENSITY[b.id], Math.min(floor, (y - L.waterY) / r), floor);
    b.wet = 0;
    syncButton();
  }

  function dropNext() {
    const next = nextOnShelf();
    if (!next) {
      emptyBath();
      return;
    }
    const L = layout();
    // Over a clear part of the bath, just above the rim.
    const others = bodies.filter(b => b.mode === 'bath').map(bathX);
    const spots = [0.5, 0.2, 0.8, 0.35, 0.65].map(u => L.tubL + 0.6 * L.U + u * (L.tubR - L.tubL - 1.2 * L.U));
    const x = spots.find(sx => others.every(ox => Math.abs(ox - sx) > L.U * 1.2)) ?? L.cx;
    putInBath(next, x, L.rimY - radius(next, L.U) * 1.4);
  }

  function emptyBath() {
    for (const b of bodies) {
      if (b.mode === 'bath') {
        const at = position(b);
        b.x = at.x;
        b.y = at.y;
        b.mode = 'shelf';
        b.floater = null;
      }
    }
    saturnAnnounced = false;
    allAnnounced = false;
    say('Drag a planet into the bath!');
    syncButton();
  }

  function splash(b: Body) {
    const L = layout();
    const x = bathX(b);
    const r = radius(b, L.U);
    const n = Math.round(6 + r / 6);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.15 + 0.7 * (i / (n - 1)));
      const speed = L.U * (2.5 + ((i * 7) % 5) * 0.5);
      drops.push({ x: x + Math.cos(a) * r * 0.8, y: L.waterY, vx: -Math.cos(a) * speed * 0.7, vy: -Math.sin(a) * speed, life: 1.2 });
    }
    ripples.push({ x, age: 0, size: r });
  }

  function update(dt: number) {
    const L = layout();
    for (const b of bodies) {
      if (b.mode === 'shelf') {
        const spot = shelfSpot(b);
        const k = 1 - Math.exp(-10 * dt);
        b.x += (spot.x - b.x) * k;
        b.y += (spot.y - b.y) * k;
      } else if (b.mode === 'bath' && b.floater) {
        const events = stepFloater(b.floater, dt);
        b.wet += dt;
        if (events.splash) splash(b);
        if (events.bottom) {
          say(`Plop! ${NAMES[b.id]} sinks.`);
          const r = radius(b, L.U);
          for (let i = 0; i < 5; i++) {
            bubbles.push({ x: bathX(b) + (i - 2) * r * 0.3, y: L.floorY - r * (1.2 + i * 0.25), r: 3 + (i % 3) * 2, vy: L.U * (0.8 + (i % 2) * 0.4), life: 3 });
          }
        }
        if (floats(b.floater.density) && !saturnAnnounced && b.floater.depth > -1 && b.wet > 0.8) {
          saturnAnnounced = true;
          say('Saturn floats! It is lighter than water.');
        }
      }
    }
    // Worlds in the bath shuffle sideways rather than sit inside each other.
    const wet = bodies.filter(b => b.mode === 'bath' && b.floater);
    for (let i = 0; i < wet.length; i++) {
      for (let j = i + 1; j < wet.length; j++) {
        const a = wet[i]!;
        const c = wet[j]!;
        const pa = position(a);
        const pc = position(c);
        const ra = radius(a, L.U);
        const rc = radius(c, L.U);
        const dx = pc.x - pa.x;
        const overlap = ra + rc - Math.hypot(dx, pc.y - pa.y);
        if (overlap <= 0) continue;
        const span = L.tubR - L.tubL - L.U;
        const push = Math.min(overlap, L.U * 3 * dt) / span;
        const dir = dx === 0 ? (a.id < c.id ? 1 : -1) : Math.sign(dx);
        a.u = Math.min(1, Math.max(0, a.u - dir * push));
        c.u = Math.min(1, Math.max(0, c.u + dir * push));
      }
    }
    if (!allAnnounced && bodies.every(b => b.mode === 'bath' && b.floater && isSettled(b.floater))) {
      allAnnounced = true;
      say('Only Saturn floats!');
    }
    const gravity = L.U * 9;
    for (const d of drops) {
      d.vy += gravity * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
    }
    drops = drops.filter(d => d.life > 0 && d.y < L.waterY + 4);
    for (const bubble of bubbles) {
      bubble.y -= bubble.vy * dt;
      bubble.life -= dt;
    }
    bubbles = bubbles.filter(bubble => bubble.life > 0 && bubble.y > L.waterY + bubble.r);
    for (const ripple of ripples) ripple.age += dt;
    ripples = ripples.filter(ripple => ripple.age < 1.4);
    syncState();
  }

  /* --- drawing ------------------------------------------------------------ */

  function tubPath(L: ReturnType<typeof layout>, grow: number) {
    const left = L.tubL - grow;
    const right = L.tubR + grow;
    const top = L.rimY;
    const bottom = L.floorY + grow;
    const r = Math.min(L.U * 1.1 + grow, (bottom - top) * 0.9);
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom - r);
    ctx.quadraticCurveTo(left, bottom, left + r, bottom);
    ctx.lineTo(right - r, bottom);
    ctx.quadraticCurveTo(right, bottom, right, bottom - r);
    ctx.lineTo(right, top);
    ctx.closePath();
  }

  function drawTubBack(L: ReturnType<typeof layout>) {
    const wall = L.U * 0.28;
    // Little claw feet.
    ctx.fillStyle = '#f2b632';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    for (const fx of [L.tubL + L.U * 0.9, L.tubR - L.U * 0.9]) {
      ctx.beginPath();
      ctx.ellipse(fx, L.floorY + wall + L.U * 0.2, L.U * 0.28, L.U * 0.24, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    tubPath(L, wall);
    ctx.fillStyle = '#fbf7ee';
    ctx.fill();
    ctx.stroke();
    // The inside of the bath, a shade darker than its enamel outside.
    tubPath(L, 0);
    ctx.fillStyle = '#e6e2d6';
    ctx.fill();
  }

  function drawTubFront(L: ReturnType<typeof layout>, t: number) {
    // The water, see-through, so sunken worlds still show on the bottom.
    ctx.save();
    tubPath(L, 0);
    ctx.clip();
    const water = ctx.createLinearGradient(0, L.waterY, 0, L.floorY);
    water.addColorStop(0, '#6cc7f08c');
    water.addColorStop(1, '#2f84c8b0');
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.moveTo(L.tubL - 2, L.floorY + 2);
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const x = L.tubL + ((L.tubR - L.tubL) * i) / steps;
      let y = L.waterY + Math.sin(t * 2 + i * 0.7) * 1.5;
      for (const ripple of ripples) {
        const d = Math.abs(x - ripple.x) - ripple.age * L.U * 2.5;
        if (Math.abs(d) < L.U * 0.8) y -= Math.cos((d / (L.U * 0.8)) * Math.PI * 0.5) * ripple.size * 0.12 * (1 - ripple.age / 1.4);
      }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(L.tubR + 2, L.floorY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffffcc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = L.tubL + ((L.tubR - L.tubL) * i) / steps;
      const y = L.waterY + Math.sin(t * 2 + i * 0.7) * 1.5;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (const bubble of bubbles) {
      ctx.strokeStyle = '#ffffffdd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // The rim, and a tap at the end.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    const wall = L.U * 0.28;
    ctx.fillStyle = '#fbf7ee';
    ctx.beginPath();
    ctx.roundRect(L.tubL - wall * 1.6, L.rimY - wall * 0.7, L.tubR - L.tubL + wall * 3.2, wall * 1.1, wall * 0.55);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9c4b8';
    const tapX = L.tubR - L.U * 0.5;
    ctx.beginPath();
    ctx.moveTo(tapX, L.rimY - wall * 0.7);
    ctx.lineTo(tapX, L.rimY - L.U * 0.5);
    ctx.quadraticCurveTo(tapX, L.rimY - L.U * 0.8, tapX - L.U * 0.35, L.rimY - L.U * 0.75);
    ctx.lineTo(tapX - L.U * 0.5, L.rimY - L.U * 0.62);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tapX, L.rimY - L.U * 0.55, L.U * 0.12, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  function drawRings(x: number, y: number, r: number, half: 'back' | 'front') {
    const [from, to] = half === 'back' ? [Math.PI, TAU] : [0, Math.PI];
    const bands: [number, string, number][] = [
      [RING_OUTER - 0.12, '#e4d3a6', 0.24],
      [1.72, '#c9b27a', 0.3],
      [RING_INNER + 0.12, '#a99467', 0.22],
    ];
    ctx.lineCap = 'butt';
    for (const [k, color, w] of bands) {
      ctx.strokeStyle = color;
      ctx.lineWidth = r * w;
      ctx.beginPath();
      ctx.ellipse(x, y, r * k, r * k * RING_FLATTEN, -0.08, from, to);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    for (const k of [RING_OUTER, RING_INNER]) {
      ctx.beginPath();
      ctx.ellipse(x, y, r * k, r * k * RING_FLATTEN, -0.08, from, to);
      ctx.stroke();
    }
  }

  function drawBody(b: Body, U: number) {
    const { x, y } = position(b);
    const r = radius(b, U);
    if (b === held) {
      ctx.fillStyle = '#00000044';
      ctx.beginPath();
      ctx.arc(x + 6, y + 8, r, 0, TAU);
      ctx.fill();
    }
    if (b.id === 'saturn') drawRings(x, y, r, 'back');
    const picture = pictures[b.id];
    if (picture) {
      ctx.drawImage(picture, x - r, y - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = FALLBACK[b.id];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    if (b.id === 'saturn') drawRings(x, y, r, 'front');
  }

  function drawShelf(L: ReturnType<typeof layout>) {
    const plank = L.U * 0.22;
    ctx.fillStyle = '#c98f5a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(L.shelfLeft, L.shelfLine, L.shelfRight - L.shelfLeft, plank, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8f0dd';
    ctx.font = `${Math.round(Math.max(16, Math.min(24, L.U * 0.32)))}px 'Patrick Hand', cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const b of bodies) {
      const spot = shelfSpot(b);
      // Names stay by the empty spot too, so the shelf reads the same before and after.
      ctx.globalAlpha = b.mode === 'shelf' ? 1 : 0.45;
      ctx.fillText(SHELF_LABELS[b.id], spot.x, L.shelfLine + plank + 4);
    }
    ctx.globalAlpha = 1;
  }

  function draw(t: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070a18';
    ctx.fillRect(0, 0, width, height);
    for (const [sx, sy, sr] of STARS) {
      ctx.fillStyle = '#ffffff99';
      ctx.fillRect(sx * width, sy * height, sr, sr);
    }
    const L = layout();
    drawShelf(L);
    drawTubBack(L);
    // Sunk worlds first, floating ones over them.
    const inBath = bodies.filter(b => b.mode === 'bath').sort((a, c) => position(c).y - position(a).y);
    for (const b of inBath) drawBody(b, L.U);
    drawTubFront(L, t);
    for (const b of bodies) if (b.mode === 'shelf') drawBody(b, L.U);
    for (const d of drops) {
      ctx.fillStyle = '#8fd6f5';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(d.x, d.y, Math.max(3, L.U * 0.07), 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    if (held) drawBody(held, L.U);
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

  function pointerAt(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function bodyAt(x: number, y: number): Body | null {
    const U = layout().U;
    let best: Body | null = null;
    let bestD = Infinity;
    for (const b of bodies) {
      const p = position(b);
      const r = radius(b, U);
      const d = Math.hypot(x - p.x, y - p.y);
      const reach = Math.max(r * 1.25, 30) + (b.id === 'saturn' ? r * 0.3 : 0);
      if (d < reach && d / reach < bestD) {
        best = b;
        bestD = d / reach;
      }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (heldId !== null) return;
    const p = pointerAt(event);
    const b = bodyAt(p.x, p.y);
    if (!b) return;
    const at = position(b);
    held = b;
    heldId = event.pointerId;
    grab = { x: at.x - p.x, y: at.y - p.y };
    b.x = at.x;
    b.y = at.y;
    b.mode = 'held';
    b.floater = null;
    canvas.setPointerCapture?.(event.pointerId);
    syncButton();
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== heldId || !held) return;
    const p = pointerAt(event);
    held.x = p.x + grab.x;
    held.y = p.y + grab.y;
  });
  const release = (event: PointerEvent) => {
    if (event.pointerId !== heldId || !held) return;
    const b = held;
    held = null;
    heldId = null;
    const L = layout();
    // Let go anywhere over the bath and it goes in; anywhere else, back to the shelf.
    if (b.x > L.tubL && b.x < L.tubR && b.y > L.shelfLine && b.y < L.floorY + L.U) putInBath(b, b.x, b.y);
    else b.mode = 'shelf';
    syncButton();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  plopButton.addEventListener('click', () => dropNext());
  back.addEventListener('click', () => api.close());
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      dropNext();
    }
  });
  const onResize = () => { if (open) resize(); };
  window.addEventListener('resize', onResize);

  const api: SaturnBath = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      host.append(root);
      root.classList.remove('is-hidden');
      resize();
      bodies = BATH_WORLDS.map(id => ({ id, mode: 'shelf', x: 0, y: 0, u: 0.5, floater: null, wet: 0 }));
      for (const b of bodies) Object.assign(b, shelfSpot(b));
      drops = [];
      bubbles = [];
      ripples = [];
      held = null;
      heldId = null;
      saturnAnnounced = false;
      allAnnounced = false;
      say('Drag a planet into the bath!');
      syncButton();
      syncState();
      last = 0;
      frame = requestAnimationFrame(loop);
      plopButton.focus();
      void worldBalls().then(found => { pictures = found; }).catch(() => {});
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
      held = null;
      heldId = null;
      root.classList.add('is-hidden');
      root.remove();
    },
  };
  return api;
}
