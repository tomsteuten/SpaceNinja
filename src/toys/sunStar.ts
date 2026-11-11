/**
 * Far away: the Sun is a star like the others in the sky, just much closer. The Sun opens
 * huge and glowing over the game's real starfield. A paper band along the bottom is the only
 * control: a track with four pictures (the Sun, Earth, Neptune, a star) and a round rocket
 * the child drags along it. The rocket's place sets the distance directly (starDistance.ts:
 * the Sun shrinks in proportion to 1 / distance); at the far end the Sun is one star among the
 * others, ringed with dashes, and tapping another star makes it bloom into a little sun.
 * Tapping the track moves the rocket there; tapping a picture goes to it. The thumb is a
 * proper slider for keyboards and remotes. The small rocket in the sky is decoration.
 *
 * Reduced motion: no tap animation, no twinkle, no hint movement.
 *
 * A self-contained overlay like the Moon jump; it owns nothing in the 3D scene. Nothing here
 * claims a ship could really fly that far.
 */
import './sunStar.css';
import { worldPicture } from '../ui/pictures';
import { cueText } from '../audio/script';
import rocketUrl from '../pictures/rocket.svg';
import handUrl from '../pictures/hand.svg';
import sunUrl from '../pictures/sun.svg';
import glowstarUrl from '../pictures/glowstar.svg';
import {
  MILESTONES, TRACK_STOPS, apparentRadius, distanceAt, drawnSun, glowStrength, nearestStop,
  progressFromTrack, type StopId,
} from './starDistance';

export interface SunStar {
  readonly isOpen: boolean;
  open(): void;
  /** The child's own way out: calls onClose. */
  close(): void;
  /** Taken away by a reset (flight, return, crash): no callback. */
  dismiss(): void;
}

export interface SunStarOptions {
  onClose?(): void;
  /** A line of the script is now on screen as words; the host plays it if it has a recording. */
  onSay?(cueId: string, text: string): void;
}

const TAU = Math.PI * 2;
/** An arrow key moves the rocket this far along the track. */
const KEY_STEP = 0.06;
/** A press this far from where it began is a drag, not a tap. */
const DRAG_SLOP = 6;
/** Closer than this (px) to a picture, a tap goes to that picture. */
const PICTURE_REACH = 30;
const BLOOM_SECONDS = 1.4;
const CAPTION_CUES: Record<StopId, string> = {
  start: 'sunstar-start', earth: 'sunstar-earth', neptune: 'sunstar-neptune', far: 'sunstar-far',
};
/** The words on the chip. The far line is shorter than its narration cue, which adds that the other stars are suns too. */
const CAPTION_TEXT: Record<StopId, string> = {
  start: 'Up close, the Sun is huge.', earth: 'From Earth, the Sun looks this big.',
  neptune: 'From Neptune it is a very bright star.', far: 'Far, far away the Sun is a star.',
};
const INK = '#2b2118';
const FAR_AT = 0.985;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function picture(src: string, className: string): HTMLImageElement {
  const image = el('img', className);
  image.src = src;
  image.alt = '';
  image.draggable = false;
  image.setAttribute('aria-hidden', 'true');
  return image;
}

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
/** Fallback sky if the starfield picture has not loaded. */
const BACKDROP = (() => { const r = seeded(17); return Array.from({ length: 110 }, () => [r(), r(), 0.4 + r() * 1.2] as const); })();
/** The other stars that twinkle and bloom at the far end: fractions of the sky. */
const FAR_STARS = (() => {
  const r = seeded(9);
  return Array.from({ length: 30 }, () => ({ x: 0.06 + r() * 0.88, y: 0.1 + r() * 0.85, size: 1.6 + r() * 1.8, phase: r() * TAU, speed: 1.4 + r() * 2.2 }));
})();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}
let starfield: Promise<HTMLImageElement> | null = null;
function loadStarfield() {
  starfield ??= loadImage('assets/starfield.jpg');
  starfield.catch(() => { starfield = null; });
  return starfield;
}

const smooth = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const BACK_ARROW = '<svg width="30" height="24" viewBox="0 0 30 24" aria-hidden="true"><path d="M12 3 L3 11 L12 19 M3 11 H20 q7 0 7 8" fill="none" stroke="#2b2118" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HINT_ARC = '<svg class="sun-star__arc" width="150" height="40" viewBox="0 0 150 40" aria-hidden="true"><path d="M4 26 Q70 0 132 22" fill="none" stroke="#2b2118" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 9"/><path d="M120 8 L136 23 L116 30" fill="none" stroke="#2b2118" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function createSunStar(host: HTMLElement, options: SunStarOptions = {}): SunStar {
  const root = el('div', 'sun-star is-hidden');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Fly far away from the Sun');
  const canvas = el('canvas', 'sun-star__canvas');
  canvas.setAttribute('aria-hidden', 'true');

  const caption = el('p', 'sun-star__caption');
  caption.setAttribute('aria-live', 'polite');

  // Decoration: the rocket you are flying in. Not a control.
  const skyRocket = picture(rocketUrl, 'sun-star__sky-rocket');

  const back = el('button', 'sun-star__back');
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to the Sun');
  back.innerHTML = BACK_ARROW;

  // The band: a track with four pictures and the rocket thumb.
  const band = el('div', 'sun-star__band');
  const rail = el('div', 'sun-star__rail');
  const track = el('div', 'sun-star__track');
  track.append(el('div', 'sun-star__fill'));
  const stations: HTMLElement[] = [];
  const stopIds: StopId[] = ['start', ...MILESTONES.map(m => m.id)];
  for (let i = 0; i < TRACK_STOPS.length; i++) {
    const station = el('div', 'sun-star__stn');
    station.dataset.stop = stopIds[i]!;
    station.style.setProperty('--at', String(TRACK_STOPS[i]));
    station.setAttribute('aria-hidden', 'true');
    if (i === 0) station.append(picture(sunUrl, 'sun-star__stn-img'));
    else if (i === 1) station.append(worldPicture('earth'));
    else if (i === 2) station.append(el('span', 'sun-star__neptune'));
    else station.append(picture(glowstarUrl, 'sun-star__stn-img'));
    stations.push(station);
  }
  const thumb = el('div', 'sun-star__thumb');
  thumb.tabIndex = 0;
  thumb.setAttribute('role', 'slider');
  thumb.setAttribute('aria-label', 'Rocket: drag it away from the Sun');
  thumb.setAttribute('aria-orientation', 'horizontal');
  thumb.setAttribute('aria-valuemin', '0');
  thumb.setAttribute('aria-valuemax', '100');
  thumb.append(picture(rocketUrl, 'sun-star__thumb-img'));
  // First-visit hint: a dotted arc and a pointing hand, gone once the child has dragged.
  const hint = el('div', 'sun-star__hint');
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = HINT_ARC;
  hint.append(picture(handUrl, 'sun-star__hand'));
  rail.append(track, ...stations, thumb, hint);
  band.append(rail);

  root.append(canvas, caption, skyRocket, back, band);

  const ctx = canvas.getContext('2d')!;
  const reducedQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => Boolean(reducedQuery?.matches);

  let open = false;
  let frame = 0;
  let last = 0;
  let clock = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let dirty = true;
  let sky: HTMLImageElement | null = null;

  /** The rocket's place on its track (0 to 1), shown and heading, and the journey it means. */
  let shown = 0;
  let heading = 0;
  let progress = 0;
  let stop: StopId = 'start';
  let moved = false;
  let blooms: { star: number; age: number }[] = [];
  let bloomCount = 0;

  type Press = { id: number; mode: 'thumb' | 'tap' | 'drag'; offset: number; startX: number } | null;
  let press: Press = null;

  /* --- layout ------------------------------------------------------------- */

  interface Layout { sx: number; sy: number; r0: number; wide: boolean; bandTop: number; ship: number }
  let lay: Layout = { sx: 0, sy: 0, r0: 0, wide: false, bandTop: 0, ship: 64 };

  function layout(): Layout {
    const wide = width > height * 1.15;
    const bandTop = band.getBoundingClientRect().top - root.getBoundingClientRect().top;
    if (wide) {
      const r0 = clamp(bandTop * 0.4, 60, 260);
      return { sx: width * 0.525, sy: bandTop / 2 + 4, r0, wide, bandTop, ship: 64 };
    }
    // Above the band, with the Back button at the left under the Sun.
    const r0 = clamp(Math.min(width * 0.42, (bandTop - 170) / 2), 60, 240);
    return { sx: width / 2, sy: Math.max(r0 + 70, bandTop / 2 - 20), r0, wide, bandTop, ship: 70 };
  }

  /** The decorative rocket sits clear of the Sun, lower right, edging up as the Sun shrinks. */
  function placeRocket() {
    const { sy, r0, wide, ship } = lay;
    const real = apparentRadius(distanceAt(progress), r0);
    const reach = clamp(real * 1.2 + ship * 0.4, 110, r0 * 1.2 + ship * 0.4);
    const x = wide ? width * 0.8 : Math.min(width - ship * 0.9, width * 0.72);
    const y = wide ? sy - 20 : Math.min(sy + reach, lay.bandTop - ship * 0.9);
    skyRocket.style.width = `${ship}px`;
    skyRocket.style.left = `${x - ship / 2}px`;
    skyRocket.style.top = `${y - ship / 2}px`;
    skyRocket.style.transform = `rotate(${wide ? 45 : 70}deg)`;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = root.clientWidth;
    height = root.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    lay = layout();
    placeRocket();
    dirty = true;
  }

  /* --- state --------------------------------------------------------------- */

  function valueText(): string {
    const near = TRACK_STOPS.findIndex(t => Math.abs(t - shown) < 0.04);
    return near === 0 ? 'Close to the Sun'
      : near === 1 ? 'As far away as Earth is'
        : near === 2 ? 'As far away as Neptune is'
          : near === 3 ? 'Far, far away' : 'Flying away from the Sun';
  }

  function sync() {
    progress = progressFromTrack(shown);
    const near = nearestStop(shown);
    if (near !== stop) {
      stop = near;
      const cue = CAPTION_CUES[near];
      caption.textContent = CAPTION_TEXT[near];
      options.onSay?.(cue, cueText(cue));
      for (const node of stations) node.classList.toggle('is-here', node.dataset.stop === near);
    }
    root.classList.toggle('is-far', progress >= FAR_AT);
    root.classList.toggle('has-moved', moved);
    root.dataset.progress = progress.toFixed(3);
    root.dataset.track = shown.toFixed(3);
    root.dataset.milestone = stop;
    root.dataset.blooms = String(bloomCount);
    root.dataset.ring = progress >= FAR_AT ? 'on' : 'off';
    root.style.setProperty('--f', shown.toFixed(4));
    thumb.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
    thumb.setAttribute('aria-valuetext', valueText());
    placeRocket();
    dirty = true;
  }

  function setTrack(next: number, animate: boolean) {
    heading = clamp(next, 0, 1);
    if (!animate || reduced()) shown = heading;
    sync();
  }

  /* --- drawing ------------------------------------------------------------- */

  function drawBackdrop() {
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, width, height);
    if (sky) {
      const scale = Math.max(width / sky.naturalWidth, height / sky.naturalHeight);
      const w = sky.naturalWidth * scale;
      const h = sky.naturalHeight * scale;
      ctx.drawImage(sky, (width - w) / 2, (height - h) / 2, w, h);
      ctx.fillStyle = '#05060f55';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#ffffff';
      for (const [x, y, s] of BACKDROP) {
        ctx.globalAlpha = 0.4 + s * 0.3;
        ctx.fillRect(x * width, y * height, s, s);
      }
      ctx.globalAlpha = 1;
    }
  }

  function farStarAt(i: number) {
    const s = FAR_STARS[i]!;
    return { x: s.x * width, y: 70 + s.y * Math.max(60, lay.bandTop - 150), s };
  }

  function drawFarStars(alpha: number) {
    if (alpha <= 0) return;
    const still = reduced();
    for (let i = 0; i < FAR_STARS.length; i++) {
      const { x, y, s } = farStarAt(i);
      // Keep the Sun's own spot clear.
      if (Math.hypot(x - lay.sx, y - lay.sy) < 34) continue;
      const tw = still ? 0.85 : 0.65 + 0.35 * Math.sin(clock * s.speed + s.phase);
      const bloom = blooms.find(b => b.star === i);
      const k = bloom ? (still ? 1 : Math.sin(Math.min(1, bloom.age / BLOOM_SECONDS) * Math.PI)) : 0;
      const r = s.size * (1 + tw * 0.4) + k * 15;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3 + 6);
      glow.addColorStop(0, `rgba(255,248,214,${(0.5 + 0.4 * k) * alpha * tw})`);
      glow.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 3 + 6, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = alpha;
      if (k > 0.05) {
        // A little sun: warm disc with an ink edge, then it settles back to a star.
        ctx.fillStyle = '#ffd25a';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = '#fffbea';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawSun() {
    const distance = distanceAt(progress);
    const strength = Math.max(0.55, glowStrength(progress));
    const { sx, sy } = lay;
    const real = apparentRadius(distance, lay.r0);
    const { radius, alpha } = drawnSun(real, 3.2);
    root.dataset.sunRadius = radius.toFixed(1);
    root.dataset.sunY = sy.toFixed(1);
    // The glow spills well beyond the disc close up, and shrinks to a glimmer far away.
    const glowR = radius * (1.25 + 1.1 * strength) + 14 * strength;
    const glow = ctx.createRadialGradient(sx, sy, radius * 0.4, sx, sy, glowR);
    glow.addColorStop(0, `rgba(255,236,160,${0.95 * strength * alpha})`);
    glow.addColorStop(0.4, `rgba(255,190,80,${0.45 * strength * alpha})`);
    glow.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, glowR, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha;
    const body = ctx.createRadialGradient(sx - radius * 0.3, sy - radius * 0.3, radius * 0.1, sx, sy, radius);
    body.addColorStop(0, '#fff7cc');
    body.addColorStop(0.55, '#ffd45e');
    body.addColorStop(1, '#f4a42c');
    ctx.fillStyle = radius > 4 ? body : '#fff3c0';
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, TAU);
    ctx.fill();
    if (radius > 14) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = clamp(radius * 0.025, 1.5, 3.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (progress >= FAR_AT) {
      // "Here it is": a dashed ring round the Sun's dot among the other stars.
      ctx.strokeStyle = '#f2b632';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackdrop();
    drawFarStars(smooth((progress - 0.85) / 0.13));
    drawSun();
  }

  /* --- frame loop ----------------------------------------------------------- */

  function update(dt: number) {
    clock += dt;
    if (shown !== heading && press?.mode !== 'drag' && press?.mode !== 'thumb') {
      const diff = heading - shown;
      shown = reduced() || Math.abs(diff) < 1e-4 ? heading : shown + diff * (1 - Math.exp(-12 * dt));
      sync();
    }
    for (const b of blooms) b.age += dt;
    const before = blooms.length;
    blooms = blooms.filter(b => b.age < (reduced() ? 1.2 : BLOOM_SECONDS));
    if (blooms.length || before) dirty = true;
    // The far stars twinkle unless motion is reduced.
    if (progress > 0.85 && !reduced()) dirty = true;
  }

  function loop(now: number) {
    if (!open) return;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    update(dt);
    if (dirty) {
      dirty = false;
      draw();
    }
    frame = requestAnimationFrame(loop);
  }

  /* --- input ----------------------------------------------------------------- */

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (progress < 0.9) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best = -1;
    let bestDistance = 46;
    for (let i = 0; i < FAR_STARS.length; i++) {
      const p = farStarAt(i);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDistance && Math.hypot(p.x - lay.sx, p.y - lay.sy) >= 34) { best = i; bestDistance = d; }
    }
    if (best >= 0) {
      blooms = blooms.filter(b => b.star !== best);
      blooms.push({ star: best, age: 0 });
      bloomCount++;
      sync();
    }
  });

  /** Where along the rail (0 to 1) a pointer is, measured fresh so a turn of the phone is fine. */
  function trackAt(clientX: number): number {
    const rect = rail.getBoundingClientRect();
    return rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
  }

  band.addEventListener('pointerdown', event => {
    if (press) return;
    event.preventDefault();
    band.setPointerCapture?.(event.pointerId);
    const target = event.target as Element;
    if (target.closest('.sun-star__thumb')) {
      // Grab the rocket where it was touched, so it does not jump under the finger.
      press = { id: event.pointerId, mode: 'thumb', offset: shown - trackAt(event.clientX), startX: event.clientX };
      heading = shown;
      thumb.classList.add('is-held');
      return;
    }
    const picked = target.closest<HTMLElement>('.sun-star__stn');
    let to = trackAt(event.clientX);
    if (picked) to = Number(picked.style.getPropertyValue('--at'));
    else {
      // Close to a picture's centre also counts as that picture.
      const rect = rail.getBoundingClientRect();
      for (const stopAt of TRACK_STOPS) {
        if (Math.abs(rect.left + stopAt * rect.width - event.clientX) <= PICTURE_REACH) to = stopAt;
      }
    }
    press = { id: event.pointerId, mode: 'tap', offset: 0, startX: event.clientX };
    moved = true;
    setTrack(to, true);
  });
  band.addEventListener('pointermove', event => {
    if (!press || event.pointerId !== press.id) return;
    if (press.mode === 'tap') {
      if (Math.abs(event.clientX - press.startX) < DRAG_SLOP) return;
      press.mode = 'drag';
    } else if (press.mode === 'thumb') {
      if (Math.abs(event.clientX - press.startX) < 1) return;
      moved = true;
    }
    setTrack(trackAt(event.clientX) + press.offset, false);
  });
  const endPress = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    press = null;
    thumb.classList.remove('is-held');
    sync();
  };
  band.addEventListener('pointerup', endPress);
  band.addEventListener('pointercancel', endPress);
  band.addEventListener('lostpointercapture', endPress);

  // The thumb is a slider: arrows step, Home and End jump. Remotes work the same way.
  thumb.addEventListener('keydown', event => {
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = heading + KEY_STEP;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = heading - KEY_STEP;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 1;
    if (next === null) return;
    event.preventDefault();
    moved = true;
    setTrack(next, true);
  });

  back.addEventListener('click', () => api.close());
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
      return;
    }
    // Elsewhere (the Back button) the arrows still move the rocket.
    if (event.target === thumb) return;
    const forward = event.key === 'ArrowUp' || event.key === 'ArrowRight';
    const backward = event.key === 'ArrowDown' || event.key === 'ArrowLeft';
    if (!forward && !backward) return;
    event.preventDefault();
    moved = true;
    setTrack(heading + (forward ? KEY_STEP : -KEY_STEP), true);
  });
  const onResize = () => { if (open) resize(); };
  window.addEventListener('resize', onResize);

  const api: SunStar = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      shown = heading = 0;
      progress = 0;
      stop = 'start';
      press = null;
      blooms = [];
      bloomCount = 0;
      clock = 0;
      caption.textContent = CAPTION_TEXT.start;
      thumb.classList.remove('is-held');
      for (const node of stations) node.classList.toggle('is-here', node.dataset.stop === 'start');
      host.append(root);
      root.classList.remove('is-hidden');
      sync();
      resize();
      last = 0;
      frame = requestAnimationFrame(loop);
      thumb.focus({ preventScroll: true });
      options.onSay?.('toy-sun', cueText('toy-sun'));
      void loadStarfield().then(image => { sky = image; dirty = true; }).catch(() => {});
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
      press = null;
      root.classList.add('is-hidden');
      root.remove();
    },
  };
  return api;
}
