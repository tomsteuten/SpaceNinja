/**
 * Moonlight, the "bounce" picture: the Moon is bright because sunlight bounces off it.
 * Nothing to drag. A big Sun sits at the left edge, the Moon is lit on the side that faces
 * it, and Earth's night curve at the bottom carries a little house. Dotted beams flow from
 * the Sun to the Moon and then down from the Moon to the house, which sits in a soft glow.
 * One control, a big Sun switch: off, the Sun goes grey, the beams vanish, the Moon goes
 * dark and the house loses its glow. No Sun, no moonlight.
 *
 * A self-contained overlay like the Moon jump; it owns nothing in the 3D scene. The layout
 * follows the owner's mock (design/visit-screen/moonlight-bounce.png); the beams' dots flow
 * by a CSS animation that reduced motion turns off, leaving them drawn still.
 */
import './moonLight.css';
import { cueText } from '../audio/script';
import sunUrl from '../pictures/sun.svg';
import houseUrl from '../pictures/house.svg';

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

const SVG_NS = 'http://www.w3.org/2000/svg';
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

/* --- pictures: a lit ball drawn from a world's map ---------------------------------- */

interface Texture { w: number; h: number; d: Uint8ClampedArray; gain: number }

function loadTexture(url: string, width: number, gain: number): Promise<Texture | null> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = width / 2;
        const x = c.getContext('2d')!;
        x.drawImage(image, 0, 0, c.width, c.height);
        resolve({ w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data, gain });
      } catch { resolve(null); }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

type Textures = { moon: Texture | null; earth: Texture | null };
let textures: Promise<Textures> | null = null;
function worldTextures(): Promise<Textures> {
  textures ??= Promise.all([
    loadTexture('assets/moon.jpg', 1024, 1.25),
    loadTexture('assets/earth.jpg', 1536, 1.15),
  ]).then(([moon, earth]) => ({ moon, earth }));
  return textures;
}

/** A textured ball seen from the front, lit from `light` (x right, y up, z towards the viewer). */
function drawBall(canvas: HTMLCanvasElement, size: number, tex: Texture | null,
  light: [number, number, number], ambient: number) {
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  if (!tex) return;
  const out = ctx.createImageData(size, size);
  const len = Math.hypot(...light);
  const L = light.map(v => v / len) as [number, number, number];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = ((px + 0.5) / size) * 2 - 1;
      const y = 1 - ((py + 0.5) / size) * 2;
      const r2 = x * x + y * y;
      if (r2 > 1) continue;
      const z = Math.sqrt(1 - r2);
      const lon = Math.atan2(x, z);
      const lat = Math.asin(y);
      const u = Math.min(tex.w - 1, Math.floor((0.5 + lon / (2 * Math.PI)) * tex.w));
      const v = Math.min(tex.h - 1, Math.floor((0.5 - lat / Math.PI) * tex.h));
      const ti = (v * tex.w + u) * 4;
      const oi = (py * size + px) * 4;
      const d = x * L[0] + y * L[1] + z * L[2];
      const lit = clamp(d * 6 + 0.5, 0, 1);
      const k = ambient + (1 - ambient) * lit * (0.75 + 0.25 * Math.max(0, d));
      out.data[oi] = tex.d[ti]! * k * tex.gain;
      out.data[oi + 1] = tex.d[ti + 1]! * k * tex.gain;
      out.data[oi + 2] = tex.d[ti + 2]! * k * tex.gain;
      out.data[oi + 3] = r2 > 0.985 ? (255 * (1 - r2)) / 0.015 : 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

function seededStars(width: number, height: number, count: number): string {
  let s = 13 * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const shadows: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * height);
    const spread = rand() < 0.12 ? 1 : 0;
    shadows.push(`${x}px ${y}px 0 ${spread}px rgba(255,255,255,${(0.25 + rand() * 0.7).toFixed(2)})`);
  }
  return shadows.join(',');
}

/** Where everything stands, in pixels of the overlay. */
interface Layout {
  landscape: boolean;
  scale: number;
  sun: { cx: number; cy: number; d: number };
  moon: { cx: number; cy: number; r: number };
  earth: { cx: number; cy: number; r: number };
  house: { cx: number; bottom: number; w: number };
}

export function createMoonLight(host: HTMLElement, options: MoonLightOptions = {}): MoonLight {
  const root = el('div', 'moon-light is-hidden');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Moonlight: why the Moon shines');

  const stars = el('div', 'moon-light__stars');
  const sunDisc = el('div', 'moon-light__sun');
  const earthCanvas = el('canvas', 'moon-light__earth');
  const moonCanvas = el('canvas', 'moon-light__moon');
  for (const c of [earthCanvas, moonCanvas]) c.setAttribute('aria-hidden', 'true');
  const beams = svgEl('svg', { class: 'moon-light__beams', 'aria-hidden': 'true' });
  const glow = el('div', 'moon-light__glow');
  const house = el('img', 'moon-light__house');
  house.alt = '';
  house.src = houseUrl;
  house.draggable = false;
  const caption = el('p', 'moon-light__caption');
  caption.setAttribute('aria-live', 'polite');

  const back = el('button', 'moon-light__back');
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to the Moon');
  const backArrow = svgEl('svg', { width: 30, height: 24, viewBox: '0 0 30 24', 'aria-hidden': 'true' });
  backArrow.append(svgEl('path', {
    d: 'M12 3 L3 11 L12 19 M3 11 H20 q7 0 7 8', fill: 'none', stroke: '#2b2118',
    'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));
  const thumb = el('span', 'moon-light__thumb');
  thumb.setAttribute('aria-hidden', 'true');
  thumb.style.backgroundImage = 'url(./assets/moon.jpg)';
  back.append(backArrow, thumb);

  const sunSwitch = el('button', 'moon-light__switch');
  sunSwitch.type = 'button';
  sunSwitch.setAttribute('role', 'switch');
  sunSwitch.setAttribute('aria-label', 'Sun');
  const sunPicture = el('img', '');
  sunPicture.alt = '';
  sunPicture.src = sunUrl;
  sunPicture.draggable = false;
  const toggle = el('span', 'moon-light__toggle');
  toggle.setAttribute('aria-hidden', 'true');
  sunSwitch.append(sunPicture, toggle);

  root.append(stars, sunDisc, earthCanvas, beams, glow, moonCanvas, house, caption, back, sunSwitch);

  let open = false;
  let sunOn = true;
  let lay: Layout | null = null;
  let tex: Textures = { moon: null, earth: null };
  /** Painted balls per state and size, so a flick of the switch costs nothing. */
  const painted = new Map<string, HTMLCanvasElement>();

  /* --- layout, from the mock (360x740 portrait, 800x360 landscape) ---------------- */

  function layout(width: number, height: number): Layout {
    const landscape = width > height * 1.15;
    const k = landscape ? Math.min(width / 800, height / 360) : clamp(width / 360, 0.8, 1.5);
    const s = clamp(k, 1, 1.3);
    const houseW = Math.round(56 * clamp(k, 1, 1.4));
    let l: Layout;
    if (landscape) {
      const er = 420 * k;
      l = {
        landscape, scale: s,
        sun: { cx: -70 * k, cy: (150 / 360) * height, d: 300 * k },
        moon: { cx: (455 / 800) * width, cy: (92 / 360) * height, r: 60 * k },
        earth: { cx: (600 / 800) * width, cy: (250 / 360) * height + er, r: er },
        house: { cx: (610 / 800) * width, bottom: 0, w: houseW },
      };
    } else {
      const er = 340 * k;
      l = {
        landscape, scale: s,
        sun: { cx: -70 * k, cy: (300 / 740) * height, d: 280 * k },
        moon: { cx: (262 / 360) * width, cy: (170 / 740) * height, r: 68 * k },
        earth: { cx: (250 / 360) * width, cy: (560 / 740) * height + er, r: er },
        house: { cx: (262 / 360) * width, bottom: 0, w: houseW },
      };
    }
    const surface = () => l.earth.cy - Math.sqrt(Math.max(0, l.earth.r ** 2 - (l.house.cx - l.earth.cx) ** 2));
    l.house.bottom = surface() + l.house.w * 0.1;
    // The house must stay clear of the Sun switch (bottom right), so Earth's curve rides up a little if not.
    const switchW = 170 * s;
    const switchTop = height - 14 - 92 * s;
    const overlapsX = l.house.cx + l.house.w / 2 > width - 12 - switchW - 4;
    if (overlapsX && l.house.bottom > switchTop - 10) {
      const lift = l.house.bottom - (switchTop - 10);
      l.earth.cy -= lift;
      l.house.bottom -= lift;
    }
    return l;
  }

  function place(width: number, height: number) {
    const L = lay = layout(width, height);
    root.style.setProperty('--ml-s', String(L.scale));
    stars.style.boxShadow = seededStars(width, height, 110);
    const put = (node: HTMLElement, x: number, y: number, w: number, h: number) => {
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
    };
    put(sunDisc, L.sun.cx - L.sun.d / 2, L.sun.cy - L.sun.d / 2, L.sun.d, L.sun.d);
    put(earthCanvas, L.earth.cx - L.earth.r, L.earth.cy - L.earth.r, L.earth.r * 2, L.earth.r * 2);
    put(moonCanvas, L.moon.cx - L.moon.r, L.moon.cy - L.moon.r, L.moon.r * 2, L.moon.r * 2);
    const houseTop = L.house.bottom - L.house.w * 0.9;
    house.style.left = `${L.house.cx - L.house.w / 2}px`;
    house.style.top = `${houseTop}px`;
    house.style.width = house.style.height = `${L.house.w}px`;
    put(glow, L.house.cx - 70, houseTop - 0.05 * L.house.w, 140, 70);
    caption.style.left = L.landscape ? 'auto' : '14px';
    caption.style.right = L.landscape ? '14px' : 'auto';
    drawBeams(L, houseTop);
    painted.clear();
    paintBalls();
  }

  function arrow(ax: number, ay: number, bx: number, by: number, color: string, w: number) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const g = svgEl('g');
    g.append(
      svgEl('path', { class: 'flow', d: `M${ax} ${ay} L${bx} ${by}`, stroke: color, 'stroke-width': w }),
      svgEl('path', {
        class: 'tip', stroke: color, 'stroke-width': w,
        d: `M${bx - ux * 14 - uy * 9} ${by - uy * 14 + ux * 9} L${bx} ${by} L${bx - ux * 14 + uy * 9} ${by - uy * 14 - ux * 9}`,
      }),
    );
    return g;
  }

  function drawBeams(L: Layout, houseTop: number) {
    beams.replaceChildren();
    const k = L.landscape ? L.moon.r / 60 : L.moon.r / 68;
    const x0 = L.sun.cx + L.sun.d / 2 + 6;
    for (const o of [-26, 0, 26]) {
      beams.append(arrow(x0, L.sun.cy - 40 * k + o * 0.6 * k, L.moon.cx - L.moon.r - 12, L.moon.cy + o * k, '#ffd564', 5));
    }
    for (const o of [-16, 16]) {
      beams.append(arrow(L.moon.cx - 14 * k + o * k, L.moon.cy + L.moon.r + 12, L.house.cx + o * 0.6 * k, houseTop - 12, '#fff3c4', 4.5));
    }
  }

  function ball(canvas: HTMLCanvasElement, kind: 'moon' | 'earth', css: number) {
    const lit = sunOn;
    const res = kind === 'moon' ? clamp(window.devicePixelRatio || 1, 1, 2) : 1;
    const size = Math.max(2, Math.round(css * res));
    const key = `${kind}|${size}|${lit}|${tex[kind] ? 1 : 0}`;
    let img = painted.get(key);
    if (!img) {
      img = document.createElement('canvas');
      const light: [number, number, number] = !lit ? [0, 0, -1] : kind === 'moon' ? [-1, -0.1, 0.3] : [-1, -0.35, 0.1];
      drawBall(img, size, tex[kind], light, kind === 'moon' ? 0.06 : 0.16);
      painted.set(key, img);
    }
    canvas.width = canvas.height = size;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
  }

  function paintBalls() {
    if (!lay) return;
    ball(moonCanvas, 'moon', lay.moon.r * 2);
    ball(earthCanvas, 'earth', lay.earth.r * 2);
  }

  /* --- state -------------------------------------------------------------------- */

  function say(cueId: string) {
    const text = cueText(cueId);
    caption.textContent = text;
    options.onSay?.(cueId, text);
  }

  function sync() {
    root.dataset.sun = sunOn ? 'on' : 'off';
    root.classList.toggle('is-sun-off', !sunOn);
    moonCanvas.dataset.lit = String(sunOn);
    sunSwitch.setAttribute('aria-checked', String(sunOn));
    beams.style.display = sunOn ? '' : 'none';
    glow.style.display = sunOn ? '' : 'none';
    paintBalls();
  }

  function toggleSun() {
    sunOn = !sunOn;
    say(sunOn ? 'moonlight-on' : 'moonlight-off');
    sync();
  }

  function resize() {
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (!width || !height) return;
    place(width, height);
  }

  sunSwitch.addEventListener('click', toggleSun);
  back.addEventListener('click', () => api.close());
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
    }
  });
  const onResize = () => { if (open) resize(); };
  window.addEventListener('resize', onResize);

  const api: MoonLight = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      sunOn = true;
      host.append(root);
      root.classList.remove('is-hidden');
      caption.textContent = cueText('moonlight-on');
      sync();
      resize();
      sunSwitch.focus();
      options.onSay?.('toy-moonlight', cueText('toy-moonlight'));
      void worldTextures().then(found => {
        tex = found;
        if (open) { painted.clear(); paintBalls(); }
      }).catch(() => {});
    },
    close() {
      if (!open) return;
      api.dismiss();
      options.onClose?.();
    },
    dismiss() {
      if (!open) return;
      open = false;
      root.classList.add('is-hidden');
      root.remove();
    },
  };
  return api;
}
