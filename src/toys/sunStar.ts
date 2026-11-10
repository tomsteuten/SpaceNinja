/**
 * Far away: the Sun is a star like the others in the sky, just much closer. The Sun opens
 * huge and glowing over the game's real starfield, with a small ship. Hold Fly away and the
 * ship flies off; the Sun shrinks the honest way (in proportion to 1 / distance, on a
 * logarithmic travel scale), its glow fades, and three pictured milestones pass on a strip:
 * Earth, Neptune and, at about the distance of the nearest stars, "far, far away", where
 * the Sun is one dot among the other stars (a thin ring marks it for a few seconds). There the
 * other stars twinkle, and tapping one makes it bloom briefly into a small sun. Releasing stops;
 * Fly back (or dragging the strip back) returns.
 *
 * Reduced motion: no continuous flight or twinkle; a press jumps to the next milestone.
 *
 * A self-contained overlay like the Moon jump; it owns nothing in the 3D scene. The maths is
 * in starDistance.ts. Nothing here claims a ship could really fly that far.
 */
import './sunStar.css';
import { worldPicture } from '../ui/pictures';
import { createIcon } from '../ui/icons';
import { cueText } from '../audio/script';
import {
  MILESTONES, apparentRadius, distanceAt, drawnSun, glowStrength, milestoneNear, nextStop, travel,
  type MilestoneId,
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
const MAX_STEP = 0.1;
/** An arrow key moves the ship this far along the strip. */
const KEY_STEP = 0.06;
/** A quick tap on Fly away still hops a little. */
const TAP_HOP = 0.03;
const TAP_MS = 250;
const SLIDER_MAX = 1000;
const RING_SECONDS = 5;
const BLOOM_SECONDS = 1.4;
const CAPTION_CUES: Record<MilestoneId, string> = {
  earth: 'sunstar-earth', neptune: 'sunstar-neptune', far: 'sunstar-far',
};
const INK = '#2b2118';

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
/** Fallback sky if the starfield picture has not loaded. */
const BACKDROP = (() => { const r = seeded(17); return Array.from({ length: 110 }, () => [r(), r(), 0.4 + r() * 1.2] as const); })();
/** The other stars that twinkle and bloom at the far end: fractions of the stage. */
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

export function createSunStar(host: HTMLElement, options: SunStarOptions = {}): SunStar {
  const root = el('div', 'sun-star is-hidden');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Fly far away from the Sun');
  const canvas = el('canvas', 'sun-star__canvas');
  canvas.setAttribute('aria-hidden', 'true');

  const caption = el('p', 'sun-star__caption');
  caption.setAttribute('aria-live', 'polite');

  // The strip: three pictured milestones over a slider that is also the way to drag back.
  const strip = el('div', 'sun-star__strip');
  const marks = el('div', 'sun-star__marks');
  marks.setAttribute('aria-hidden', 'true');
  const markNodes = new Map<MilestoneId, HTMLElement>();
  const picture = (id: MilestoneId): { node: HTMLElement; word: string } => {
    if (id === 'earth') return { node: worldPicture('earth'), word: 'Earth' };
    if (id === 'neptune') return { node: el('span', 'sun-star__neptune'), word: 'Neptune' };
    return { node: el('span', 'sun-star__sun-dot'), word: 'Far, far away' };
  };
  for (const m of MILESTONES) {
    const { node, word } = picture(m.id);
    const mark = el('div', `sun-star__mark sun-star__mark--${m.id}`);
    mark.style.setProperty('--at', m.progress.toFixed(4));
    const tag = el('div', 'sun-star__mark-tag');
    tag.append(node, el('span', '', word));
    mark.append(tag, el('div', 'sun-star__tick'));
    marks.append(mark);
    markNodes.set(m.id, mark);
  }
  const slider = el('input', 'sun-star__slider');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(SLIDER_MAX);
  slider.step = String(Math.round(KEY_STEP * SLIDER_MAX));
  slider.setAttribute('aria-label', 'How far from the Sun');
  strip.append(marks, slider);

  const controls = el('div', 'sun-star__controls');
  const back = el('button', 'sun-star__back');
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to the Sun');
  back.append(createIcon('back'), worldPicture('sun'));
  const returnButton = el('button', 'sun-star__return');
  returnButton.type = 'button';
  returnButton.setAttribute('aria-label', 'Fly back towards the Sun');
  returnButton.append(createIcon('rocket'), el('span', '', 'Fly back'));
  const flyButton = el('button', 'sun-star__fly');
  flyButton.type = 'button';
  flyButton.setAttribute('aria-label', 'Fly away from the Sun. Hold to keep flying.');
  flyButton.append(createIcon('rocket'), el('span', '', 'Fly away'));
  controls.append(back, returnButton, flyButton);

  root.append(canvas, caption, strip, controls);

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

  /** Shown progress (eased) and where it is heading. */
  let progress = 0;
  let target = 0;
  let flying: 0 | 1 | -1 = 0;
  let facing: 1 | -1 = 1;
  let heldAt = 0;
  let lastPointerAt = -1e9;
  let lastKeyAt = -1e9;
  let milestone: MilestoneId | null = null;
  let ring = 0;
  let ringed = false;
  let blooms: { star: number; age: number }[] = [];
  let bloomCount = 0;
  let sliderDragging = false;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  /* --- layout ------------------------------------------------------------- */

  interface Layout { sx: number; sy: number; r0: number; shipX: number; shipY: number; ship: number; stageBottom: number }
  let lay: Layout = { sx: 0, sy: 0, r0: 0, shipX: 0, shipY: 0, ship: 0, stageBottom: 0 };

  function layout(): Layout {
    const wide = width > height * 1.15;
    const small = Math.min(width, height);
    const r0 = clamp(small * (wide ? 0.4 : 0.38), 90, 240);
    const stripTop = strip.getBoundingClientRect().top - root.getBoundingClientRect().top;
    const sx = wide ? width * 0.3 : width * 0.44;
    const sy = wide ? height * 0.46 : clamp(height * 0.33, r0 * 0.9, stripTop - r0 * 0.6);
    const ship = clamp(small * 0.17, 46, 80);
    const shipX = wide ? width * 0.62 : width * 0.76;
    const shipY = wide ? height * 0.34 : clamp(sy + r0 * 1.1, 0, stripTop - ship * 0.9);
    return { sx, sy, r0, shipX, shipY, ship, stageBottom: stripTop - 12 };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = root.clientWidth;
    height = root.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    lay = layout();
    dirty = true;
  }

  /* --- state --------------------------------------------------------------- */

  function sync() {
    const near = milestoneNear(progress);
    if (near !== milestone) {
      milestone = near;
      if (near) {
        const cue = CAPTION_CUES[near];
        const text = cueText(cue);
        caption.textContent = text;
        options.onSay?.(cue, text);
      } else caption.textContent = '';
      for (const [id, node] of markNodes) node.classList.toggle('is-here', id === near);
    }
    const far = progress >= 0.985;
    if (far && !ringed) { ringed = true; ring = RING_SECONDS; }
    if (progress < 0.9) { ringed = false; ring = 0; }
    root.classList.toggle('is-far', far);
    root.dataset.progress = progress.toFixed(3);
    root.dataset.milestone = near ?? '';
    root.dataset.flying = flying === 0 ? 'no' : flying === 1 ? 'away' : 'back';
    root.dataset.ring = ring > 0 ? 'on' : 'off';
    root.dataset.blooms = String(bloomCount);
    const text = near === 'earth' ? 'As far away as Earth is'
      : near === 'neptune' ? 'As far away as Neptune is'
        : near === 'far' ? 'Far, far away'
          : progress < MILESTONES[0]!.progress ? 'Close to the Sun' : 'Flying away from the Sun';
    slider.setAttribute('aria-valuetext', text);
    if (!sliderDragging) slider.value = String(Math.round(progress * SLIDER_MAX));
    slider.style.setProperty('--fill', `${(progress * 100).toFixed(1)}%`);
    dirty = true;
  }

  function setTarget(next: number) {
    target = clamp(next, 0, 1);
    if (reduced()) progress = target;
  }

  function startFly(direction: 1 | -1) {
    if (flying === direction) return;
    flying = direction;
    facing = direction;
    heldAt = performance.now();
    (direction === 1 ? flyButton : returnButton).classList.add('is-held');
    // Reduced motion: no sweeping flight; a press cuts to the next milestone.
    if (reduced()) setTarget(nextStop(target, direction));
    sync();
  }

  function stopFly() {
    if (flying === 0) return;
    const direction = flying;
    flying = 0;
    flyButton.classList.remove('is-held');
    returnButton.classList.remove('is-held');
    // A quick tap still goes a little way, for small fingers and remote controls.
    if (!reduced() && performance.now() - heldAt < TAP_MS) setTarget(target + direction * TAP_HOP);
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
    return { x: s.x * width, y: 20 + s.y * Math.max(60, lay.stageBottom - 20), s };
  }

  function drawFarStars(alpha: number) {
    if (alpha <= 0) return;
    const still = reduced();
    for (let i = 0; i < FAR_STARS.length; i++) {
      const { x, y, s } = farStarAt(i);
      // Keep the Sun's own spot clear.
      if (Math.hypot(x - lay.sx, y - lay.sy) < 26) continue;
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
    const strength = glowStrength(progress);
    const { sx, sy } = lay;
    const real = apparentRadius(distance, lay.r0);
    const { radius, alpha } = drawnSun(real, 1.8);
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
    if (ring > 0) {
      // "Here it is": a thin ring round the Sun's dot until the child has had time to find it.
      const fade = reduced() ? 1 : Math.min(1, ring);
      ctx.strokeStyle = `rgba(255,243,192,${0.95 * fade})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 17 + (reduced() ? 0 : Math.sin(clock * 4) * 1.5), 0, TAU);
      ctx.stroke();
    }
  }

  function drawShip() {
    const { shipX, shipY, ship } = lay;
    // Points away from the Sun while flying away, back towards it when flying back.
    const away = Math.atan2(shipY - lay.sy, shipX - lay.sx);
    const angle = facing === 1 ? away : away + Math.PI;
    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(angle);
    const u = ship / 2;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, u * 0.1);
    ctx.strokeStyle = INK;
    if (flying !== 0) {
      const flick = reduced() ? 1 : 0.85 + 0.15 * Math.sin(clock * 40);
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.moveTo(-u * 0.85, -u * 0.22);
      ctx.lineTo(-u * (1.6 + 0.5 * flick), 0);
      ctx.lineTo(-u * 0.85, u * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Fins, body, nose, window.
    ctx.fillStyle = '#f07a62';
    ctx.beginPath();
    ctx.moveTo(-u * 0.7, -u * 0.3); ctx.lineTo(-u * 1.0, -u * 0.8); ctx.lineTo(-u * 0.2, -u * 0.35);
    ctx.moveTo(-u * 0.7, u * 0.3); ctx.lineTo(-u * 1.0, u * 0.8); ctx.lineTo(-u * 0.2, u * 0.35);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8f0dd';
    ctx.beginPath();
    ctx.moveTo(-u * 0.9, 0);
    ctx.quadraticCurveTo(-u * 0.9, -u * 0.42, -u * 0.2, -u * 0.42);
    ctx.lineTo(u * 0.3, -u * 0.38);
    ctx.quadraticCurveTo(u * 1.1, -u * 0.2, u * 1.15, 0);
    ctx.quadraticCurveTo(u * 1.1, u * 0.2, u * 0.3, u * 0.38);
    ctx.lineTo(-u * 0.2, u * 0.42);
    ctx.quadraticCurveTo(-u * 0.9, u * 0.42, -u * 0.9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7fd0ee';
    ctx.beginPath();
    ctx.arc(u * 0.25, 0, u * 0.22, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackdrop();
    drawFarStars(smooth((progress - 0.85) / 0.13));
    drawSun();
    drawShip();
  }

  /* --- frame loop ----------------------------------------------------------- */

  function update(dt: number) {
    clock += dt;
    if (flying !== 0 && !reduced()) target = travel(target, flying, dt);
    if (progress !== target) {
      const diff = target - progress;
      progress = reduced() || Math.abs(diff) < 1e-4 ? target : progress + diff * (1 - Math.exp(-14 * dt));
      sync();
    } else if (flying !== 0 && !reduced()) sync();
    if (ring > 0) {
      ring = reduced() ? Math.max(0, ring - dt) : ring - dt;
      if (ring <= 0) { ring = 0; root.dataset.ring = 'off'; }
      dirty = true;
    }
    for (const b of blooms) b.age += dt;
    const before = blooms.length;
    blooms = blooms.filter(b => b.age < (reduced() ? 1.2 : BLOOM_SECONDS));
    if (blooms.length || before) dirty = true;
    // The far stars twinkle, and the Sun's ring breathes, unless motion is reduced.
    if (progress > 0.85 && !reduced()) dirty = true;
    if (flying !== 0) dirty = true;
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
      if (d < bestDistance && Math.hypot(p.x - lay.sx, p.y - lay.sy) >= 26) { best = i; bestDistance = d; }
    }
    if (best >= 0) {
      blooms = blooms.filter(b => b.star !== best);
      blooms.push({ star: best, age: 0 });
      bloomCount++;
      sync();
    }
  });

  function bindHold(button: HTMLButtonElement, direction: 1 | -1) {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      lastPointerAt = performance.now();
      button.setPointerCapture?.(event.pointerId);
      startFly(direction);
    });
    const end = () => stopFly();
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
    button.addEventListener('contextmenu', event => event.preventDefault());
    // Keyboard and remote: Enter or Space held flies, a tap hops.
    button.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (event.repeat) return;
      lastKeyAt = performance.now();
      startFly(direction);
    });
    button.addEventListener('keyup', event => {
      if (event.key === 'Enter' || event.key === ' ') end();
    });
    button.addEventListener('blur', end);
    // A click that no press or key made (assistive technology's own "activate"): next milestone.
    button.addEventListener('click', () => {
      const now = performance.now();
      if (now - lastPointerAt < 800 || now - lastKeyAt < 800) return;
      facing = direction;
      setTarget(nextStop(target, direction));
      sync();
    });
  }
  bindHold(flyButton, 1);
  bindHold(returnButton, -1);

  slider.addEventListener('input', () => {
    facing = Number(slider.value) / SLIDER_MAX >= target ? 1 : -1;
    setTarget(Number(slider.value) / SLIDER_MAX);
    sync();
  });
  slider.addEventListener('pointerdown', () => { sliderDragging = true; });
  const endSlide = () => { sliderDragging = false; };
  slider.addEventListener('pointerup', endSlide);
  slider.addEventListener('pointercancel', endSlide);
  slider.addEventListener('blur', endSlide);

  back.addEventListener('click', () => api.close());
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
      return;
    }
    // The slider handles its own arrow keys; everywhere else they step along the strip.
    if (event.target === slider) return;
    const forward = event.key === 'ArrowUp' || event.key === 'ArrowRight';
    const backward = event.key === 'ArrowDown' || event.key === 'ArrowLeft';
    if (!forward && !backward) return;
    event.preventDefault();
    facing = forward ? 1 : -1;
    setTarget(target + (forward ? KEY_STEP : -KEY_STEP));
    sync();
  });
  const onResize = () => { if (open) resize(); };
  window.addEventListener('resize', onResize);

  const api: SunStar = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      progress = target = 0;
      flying = 0;
      facing = 1;
      milestone = null;
      ring = 0;
      ringed = false;
      blooms = [];
      bloomCount = 0;
      sliderDragging = false;
      clock = 0;
      caption.textContent = '';
      flyButton.classList.remove('is-held');
      returnButton.classList.remove('is-held');
      host.append(root);
      root.classList.remove('is-hidden');
      sync();
      resize();
      last = 0;
      frame = requestAnimationFrame(loop);
      flyButton.focus();
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
      flying = 0;
      root.classList.add('is-hidden');
      root.remove();
    },
  };
  return api;
}
