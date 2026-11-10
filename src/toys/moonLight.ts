/**
 * Moonlight: the Moon is bright because it reflects sunlight. Seen from above, the Sun
 * shines from the left edge, Earth sits in the middle with a tiny child on the side that
 * faces the Moon, and the Moon rides a dashed path round Earth. Whatever the Moon's place,
 * the half facing the Sun is lit and the far half is dark. A round window shows the Moon as
 * the child sees it, so dragging the Moon round (or pressing Move Moon) turns it from a
 * crescent to a half to a full disc and back to nothing, with the lit side on the right
 * way. The Sun is a button with a little switch: switch it off and the Moon, in both views,
 * goes dark, and Earth dims too. No Sun, no moonlight.
 *
 * A self-contained overlay like the Moon jump; it owns nothing in the 3D scene. The phase
 * maths is in moonPhase.ts.
 */
import './moonLight.css';
import { worldPicture } from '../ui/pictures';
import { createIcon } from '../ui/icons';
import { cueText } from '../audio/script';
import {
  angleDelta, angleFromOffset, litOutline, moonOffset, phaseName, phaseShape, stepAngle, wrapAngle,
  type PhaseShape,
} from './moonPhase';

export interface MoonLight {
  readonly isOpen: boolean;
  open(): void;
  /** The child's own way out: calls onClose. */
  close(): void;
  /** Taken away by a reset (flight, return, crash): no callback. */
  dismiss(): void;
}

export interface MoonLightOptions {
  onClose?(): void;
  /** A line of the script is now on screen as words; the host plays it if it has a recording. */
  onSay?(cueId: string, text: string): void;
}

const TAU = Math.PI * 2;
const MAX_STEP = 0.1;
/** The Moon eases an eighth of the way round in about a third of a second. */
const GLIDE_SPEED = TAU / 8 / 0.34;
/** Where the Moon starts: a little after the New Moon, a thin crescent for the first look. */
const START_ANGLE = TAU / 8;
const INK = '#2b2118';
/** Half of the Moon always faces the Sun, which is to the left: lit on the left, dark on the right. */
const SUN_FACING: Pick<PhaseShape, 'litSign' | 'terminator' | 'fraction'> = { litSign: -1, terminator: 0, fraction: 0.5 };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function seededStars(count: number, seed: number): [number, number, number][] {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: count }, () => [rand(), rand(), 0.4 + rand() * 1.2]);
}
const STARS = seededStars(90, 31);
const WINDOW_STARS = seededStars(26, 5);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

/** A world's face from its map: the middle half of the longitudes, as a ball. */
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
  return out;
}

type Balls = { earth: HTMLCanvasElement | null; moon: HTMLCanvasElement | null };
let balls: Promise<Balls> | null = null;
function worldBalls(): Promise<Balls> {
  balls ??= (async () => {
    const [earth, moon] = await Promise.all(['earth', 'moon'].map(id =>
      loadImage(`assets/${id}.jpg`).then(image => ballFrom(image, 256)).catch(() => null)));
    return { earth: earth ?? null, moon: moon ?? null };
  })();
  balls.catch(() => { balls = null; });
  return balls;
}

interface Layout {
  cx: number; cy: number; path: number; earthR: number; moonR: number;
  /** How far above and below Earth's level the sunbeams spread. */
  beams: number;
  sun: { x: number; y: number };
  win: { cx: number; cy: number; d: number };
}

export function createMoonLight(host: HTMLElement, options: MoonLightOptions = {}): MoonLight {
  const root = el('div', 'moon-light is-hidden');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Moonlight: why the Moon shines');
  const canvas = el('canvas', 'moon-light__canvas');
  canvas.setAttribute('aria-hidden', 'true');

  const caption = el('p', 'moon-light__caption');
  caption.setAttribute('aria-live', 'polite');

  const windowFrame = el('div', 'moon-light__window');
  windowFrame.setAttribute('role', 'img');
  const windowCanvas = el('canvas', '');
  windowFrame.append(windowCanvas);
  const tag = el('div', 'moon-light__tag');
  tag.append(createIcon('eye'), el('span', '', 'From Earth'));
  tag.setAttribute('aria-hidden', 'true');

  const sunButton = el('button', 'moon-light__sun');
  sunButton.type = 'button';
  const sunDisc = el('span', 'moon-light__sun-disc');
  sunDisc.append(el('span', 'moon-light__switch'));
  sunDisc.setAttribute('aria-hidden', 'true');
  const sunText = el('span', 'moon-light__sun-text');
  sunText.setAttribute('aria-hidden', 'true');
  sunButton.append(sunDisc, sunText);

  const back = el('button', 'moon-light__back');
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to the Moon');
  back.append(createIcon('back'), worldPicture('moon'));

  const moveButton = el('button', 'moon-light__move');
  moveButton.type = 'button';
  moveButton.setAttribute('aria-label', 'Move the Moon round Earth');
  moveButton.append(worldPicture('moon'), el('span', '', 'Move Moon'));

  root.append(canvas, caption, windowFrame, tag, sunButton, back, moveButton);

  const ctx = canvas.getContext('2d')!;
  const wctx = windowCanvas.getContext('2d')!;
  const reducedQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => Boolean(reducedQuery?.matches);

  let open = false;
  let frame = 0;
  let last = 0;
  let clock = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lay: Layout | null = null;
  let dirty = true;
  let pictures: Balls = { earth: null, moon: null };

  /** The Moon's place now (eased) and where it is heading. */
  let angle = START_ANGLE;
  let target = START_ANGLE;
  let sunOn = true;
  let touched = false;
  let dragId: number | null = null;

  /* --- layout ------------------------------------------------------------- */

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  function layout(): Layout {
    const wide = width > height * 1.15;
    const short = height <= 480;
    const controlsTop = height - 18 - (short ? 62 : width <= 520 ? 72 : 76);
    if (wide) {
      const moonR = clamp(height * 0.065, 18, 28);
      const earthR = clamp(height * 0.105, 28, 46);
      const path = clamp((controlsTop - 70) / 2 - moonR - 4, 60, 150);
      const cx = width * 0.42;
      const cy = clamp(70 + moonR + path, 70, controlsTop - path - moonR - 6);
      const d = clamp(height * 0.58, 120, 240);
      return {
        cx, cy, path, earthR, moonR,
        beams: Math.min((path + moonR) * 1.1, controlsTop - 16 - cy, cy - 28),
        sun: { x: 54, y: cy },
        win: { cx: width * 0.79, cy: 22 + d / 2, d },
      };
    }
    const moonR = clamp(width * 0.055, 16, 26);
    const earthR = clamp(width * 0.115, 28, 48);
    const path = clamp(width * 0.27, 60, 150);
    // The Sun button takes the left edge (about 100 px); the path never touches it.
    const cx = Math.max(width * 0.58, 106 + path + moonR);
    const cy = 112 + path + moonR;
    const winTop = cy + path + moonR + 18;
    const d = clamp(Math.min(width * 0.6, controlsTop - 8 - 40 - winTop), 100, 260);
    return {
      cx: Math.min(cx, width - path - moonR - 6), cy, path, earthR, moonR,
      beams: (path + moonR) * 1.1,
      sun: { x: 54, y: cy },
      win: { cx: width / 2, cy: winTop + d / 2, d },
    };
  }

  function place() {
    const L = lay = layout();
    const { win, sun } = L;
    windowFrame.style.left = `${win.cx - win.d / 2}px`;
    windowFrame.style.top = `${win.cy - win.d / 2}px`;
    windowFrame.style.width = windowFrame.style.height = `${win.d}px`;
    tag.style.left = `${win.cx}px`;
    tag.style.top = `${win.cy + win.d / 2 + 10}px`;
    sunButton.style.left = `${Math.max(4, sun.x - 46)}px`;
    sunButton.style.top = `${sun.y - 42}px`;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = root.clientWidth;
    height = root.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    place();
    const inner = Math.max(1, Math.round(windowFrame.clientWidth));
    windowCanvas.width = windowCanvas.height = Math.round(inner * dpr);
    dirty = true;
  }

  /* --- state --------------------------------------------------------------- */

  function say(cueId: string) {
    const text = cueText(cueId);
    caption.textContent = text;
    options.onSay?.(cueId, text);
  }

  function sync() {
    const name = phaseName(target);
    root.dataset.angle = String(Math.round((wrapAngle(target) * 180) / Math.PI));
    root.dataset.phase = name;
    root.dataset.sun = sunOn ? 'on' : 'off';
    root.classList.toggle('is-sun-off', !sunOn);
    const label = sunOn ? 'Sun off' : 'Sun on';
    sunText.textContent = label;
    sunButton.setAttribute('aria-label', label);
    sunButton.setAttribute('aria-pressed', String(!sunOn));
    windowFrame.setAttribute('aria-label', sunOn
      ? `From Earth the Moon looks like this: ${name}`
      : 'From Earth the Moon looks dark, because the Sun is off');
    dirty = true;
  }

  function setTarget(next: number, instant: boolean) {
    target = wrapAngle(next);
    touched = true;
    if (instant || reduced()) angle = target;
    sync();
  }

  function toggleSun() {
    sunOn = !sunOn;
    touched = true;
    say(sunOn ? 'moonlight-on' : 'moonlight-off');
    sync();
  }

  /* --- drawing ------------------------------------------------------------- */

  function drawMoonDisc(c: CanvasRenderingContext2D, x: number, y: number, r: number,
    shape: Pick<PhaseShape, 'litSign' | 'terminator' | 'fraction'>, lit: boolean) {
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.fillStyle = '#1a1e2c';
    c.fill();
    c.save();
    c.clip();
    // The dark side: the same ground, barely there. Earthshine is far too faint to show.
    if (pictures.moon) {
      c.globalAlpha = 0.17;
      c.drawImage(pictures.moon, -r, -r, r * 2, r * 2);
      c.globalAlpha = 1;
    }
    if (lit && shape.fraction > 0) {
      const outline = litOutline(shape, 22);
      c.beginPath();
      outline.forEach(([px, py], i) => (i ? c.lineTo(px * r, py * r) : c.moveTo(px * r, py * r)));
      c.closePath();
      c.save();
      c.clip();
      if (pictures.moon) c.drawImage(pictures.moon, -r, -r, r * 2, r * 2);
      else { c.fillStyle = '#d6d2c8'; c.fillRect(-r, -r, r * 2, r * 2); }
      c.fillStyle = '#fff8e022';
      c.fillRect(-r, -r, r * 2, r * 2);
      c.restore();
    }
    c.restore();
    c.lineWidth = Math.max(1.5, r * 0.05);
    c.strokeStyle = lit ? '#fff8e066' : '#8f98b455';
    c.beginPath();
    c.arc(0, 0, r - c.lineWidth / 2, 0, TAU);
    c.stroke();
    c.restore();
  }

  function drawChild(x: number, y: number, h: number, outward: number) {
    // Standing on the rim, feet down, head out into space (local -y is "up").
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(outward + Math.PI / 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, h * 0.09);
    // Legs and arms, waving at the Moon.
    ctx.beginPath();
    ctx.moveTo(-h * 0.1, -h * 0.34); ctx.lineTo(-h * 0.13, 0);
    ctx.moveTo(h * 0.1, -h * 0.34); ctx.lineTo(h * 0.13, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-h * 0.2, -h * 0.64); ctx.lineTo(-h * 0.36, -h * 0.82);
    ctx.moveTo(h * 0.2, -h * 0.64); ctx.lineTo(h * 0.36, -h * 0.82);
    ctx.stroke();
    ctx.fillStyle = '#f07a62';
    ctx.beginPath();
    ctx.roundRect(-h * 0.2, -h * 0.7, h * 0.4, h * 0.42, h * 0.1);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, h * 0.06);
    ctx.stroke();
    ctx.fillStyle = '#f6cfa6';
    ctx.beginPath();
    ctx.arc(0, -h * 0.86, h * 0.17, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawMain(L: Layout) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070a18';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    for (const [sx, sy, sr] of STARS) {
      ctx.globalAlpha = 0.45 + sr * 0.25;
      ctx.fillRect(sx * width, sy * height, sr, sr);
    }
    ctx.globalAlpha = 1;
    const { cx, cy, path, earthR, moonR } = L;

    // Sunlight, all the way across from the left: parallel rays behind everything else.
    if (sunOn) {
      const x0 = L.sun.x + 50;
      const x1 = cx + path + moonR + 16;
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffd25a99';
      ctx.setLineDash([12, 10]);
      const rows = 7;
      for (let i = 0; i < rows; i++) {
        const y = cy + ((i - (rows - 1) / 2) * L.beams * 2) / (rows - 1);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x1 - 9, y - 7); ctx.lineTo(x1, y); ctx.lineTo(x1 - 9, y + 7);
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.setLineDash([12, 10]);
      }
      ctx.setLineDash([]);
    }

    // The Moon's path.
    ctx.strokeStyle = '#d6def5aa';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([3, 9]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, path, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth: the Sun-facing half is day, the far half is night; with the Sun off, all of it is dark.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, TAU);
    ctx.clip();
    if (pictures.earth) ctx.drawImage(pictures.earth, cx - earthR, cy - earthR, earthR * 2, earthR * 2);
    else { ctx.fillStyle = '#2f6aa8'; ctx.fillRect(cx - earthR, cy - earthR, earthR * 2, earthR * 2); }
    ctx.fillStyle = sunOn ? '#05081ed0' : '#05081ee6';
    ctx.fillRect(sunOn ? cx : cx - earthR, cy - earthR, sunOn ? earthR : earthR * 2, earthR * 2);
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, TAU);
    ctx.stroke();

    // The Moon and the child who is looking at it.
    const at = moonOffset(angle, path);
    const mx = cx + at.x;
    const my = cy + at.y;
    const toward = Math.atan2(at.y, at.x);
    drawChild(cx + Math.cos(toward) * (earthR - 1), cy + Math.sin(toward) * (earthR - 1), earthR * 0.95, toward);
    if (!touched) {
      const pulse = reduced() ? 1 : 1 + 0.12 * Math.sin(clock * 3.4);
      ctx.strokeStyle = '#ffffffcc';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(mx, my, moonR * 1.55 * pulse, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawMoonDisc(ctx, mx, my, moonR, SUN_FACING, sunOn);
  }

  function drawWindow() {
    const size = windowCanvas.width / dpr;
    if (size < 2) return;
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.fillStyle = '#05060f';
    wctx.fillRect(0, 0, size, size);
    wctx.fillStyle = '#ffffff';
    for (const [sx, sy, sr] of WINDOW_STARS) {
      wctx.globalAlpha = 0.4 + sr * 0.25;
      wctx.fillRect(sx * size, sy * size, sr, sr);
    }
    wctx.globalAlpha = 1;
    drawMoonDisc(wctx, size / 2, size / 2, size * 0.36, phaseShape(angle), sunOn);
  }

  function draw() {
    const L = lay;
    if (!L) return;
    drawMain(L);
    drawWindow();
  }

  /* --- frame loop ----------------------------------------------------------- */

  function update(dt: number) {
    clock += dt;
    if (dragId === null && angle !== target) {
      const delta = angleDelta(angle, target);
      const step = GLIDE_SPEED * dt;
      angle = Math.abs(delta) <= step || reduced() ? target : wrapAngle(angle + Math.sign(delta) * step);
      dirty = true;
    }
    // The first-look ring pulses until the child touches the Moon (still with reduced motion).
    if (!touched && !reduced()) dirty = true;
  }

  function loop(now: number) {
    if (!open) return;
    const dt = last ? Math.min((now - last) / 1000, MAX_STEP) : 0;
    last = now;
    update(dt);
    if (dirty) {
      dirty = false;
      draw();
    }
    frame = requestAnimationFrame(loop);
  }

  /* --- input ----------------------------------------------------------------- */

  function pointerOffset(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const L = lay!;
    return { dx: event.clientX - rect.left - L.cx, dy: event.clientY - rect.top - L.cy };
  }

  canvas.addEventListener('pointerdown', event => {
    if (!lay) return;
    event.preventDefault();
    const { dx, dy } = pointerOffset(event);
    const near = Math.abs(Math.hypot(dx, dy) - lay.path) <= Math.max(48, lay.path * 0.5);
    if (!near) return;
    dragId = event.pointerId;
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture?.(event.pointerId);
    setTarget(angleFromOffset(dx, dy), true);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== dragId) return;
    const { dx, dy } = pointerOffset(event);
    // Too near Earth's middle the angle swings wildly under a small movement.
    if (Math.hypot(dx, dy) < lay!.earthR * 0.5) return;
    setTarget(angleFromOffset(dx, dy), true);
  });
  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== dragId) return;
    dragId = null;
    canvas.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);

  function step(direction: 1 | -1) {
    // A press while the Moon is still gliding carries on from where it is heading.
    setTarget(stepAngle(target, direction), false);
  }

  moveButton.addEventListener('click', () => step(1));
  sunButton.addEventListener('click', toggleSun);
  back.addEventListener('click', () => api.close());
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      step(-1);
    }
  });
  const onResize = () => { if (open) resize(); };
  window.addEventListener('resize', onResize);

  const api: MoonLight = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      angle = target = START_ANGLE;
      sunOn = true;
      touched = false;
      dragId = null;
      clock = 0;
      host.append(root);
      root.classList.remove('is-hidden');
      caption.textContent = cueText('moonlight-on');
      sync();
      resize();
      last = 0;
      frame = requestAnimationFrame(loop);
      moveButton.focus();
      options.onSay?.('toy-moonlight', cueText('toy-moonlight'));
      void worldBalls().then(found => { pictures = found; dirty = true; }).catch(() => {});
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
      canvas.classList.remove('is-dragging');
      root.classList.add('is-hidden');
      root.remove();
    },
  };
  return api;
}
