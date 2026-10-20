/**
 * Moon jump: the same child jumps on Earth and on the Moon, side by side, with one button.
 * Same push, real gravities, same scale — the Moon jump goes about six times higher and
 * floats about six times longer. The child's own height is the ruler: on the Moon they jump
 * over their own head. Moon dust flies in clean arcs and the footprints stay (no air, no
 * wind); Earth dust puffs and drifts.
 *
 * A prototype toy: a self-contained overlay with its own frame loop, opened from the Moon
 * visit. It owns nothing in the 3D scene.
 */
import './moonJump.css';
import { worldPicture } from '../ui/pictures';
import { createIcon } from '../ui/icons';
import {
  CHILD_HEIGHT, EARTH_GRAVITY, MOON_GRAVITY, createJumper, jump, peakHeight, stepJumper,
  type Jumper,
} from './jumpPhysics';

export interface MoonJump {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
}

interface Dust {
  x: number; // metres from the jumper
  y: number; // metres above ground
  vx: number;
  vy: number;
  age: number;
  life: number;
  r: number;
}

interface Side {
  name: 'earth' | 'moon';
  jumper: Jumper;
  dust: Dust[];
  footprints: number[]; // metres from the jumper
  crouch: number; // seconds of take-off squash left
  landSquash: number;
  jumps: number;
}

const CROUCH_S = 0.09;
const MAX_STEP = 0.1;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** A fixed scatter so the stars do not shimmer between frames. */
function seededStars(count: number): [number, number, number][] {
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: count }, () => [rand(), rand(), 0.4 + rand() * 1.2]);
}
const STARS = seededStars(70);

export function createMoonJump(host: HTMLElement, onClose: () => void = () => {}): MoonJump {
  const root = el('div', 'moon-jump is-hidden');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Jump on Earth and on the Moon');
  const canvas = el('canvas', 'moon-jump__canvas');
  canvas.setAttribute('aria-hidden', 'true');

  const labels = el('div', 'moon-jump__labels');
  const earthLabel = el('div', 'moon-jump__label');
  earthLabel.append(worldPicture('earth'), el('span', '', 'Earth'));
  const moonLabel = el('div', 'moon-jump__label');
  moonLabel.append(worldPicture('moon'), el('span', '', 'Moon'));
  labels.append(earthLabel, moonLabel);

  const back = el('button', 'moon-jump__back');
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to the Moon');
  back.append(createIcon('back'), worldPicture('moon'));

  const caption = el('p', 'moon-jump__caption is-hidden');
  caption.setAttribute('aria-live', 'polite');

  const jumpButton = el('button', 'moon-jump__jump');
  jumpButton.type = 'button';
  jumpButton.append(createIcon('jump'), el('span', '', 'Jump!'));

  root.append(canvas, labels, back, caption, jumpButton);
  // Only in the page while open: the scene's canvas stays the page's one canvas otherwise.

  const ctx = canvas.getContext('2d')!;
  let open = false;
  let frame = 0;
  let last = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;

  const sides: Side[] = [];
  function freshSides() {
    sides.length = 0;
    for (const name of ['earth', 'moon'] as const) {
      sides.push({
        name,
        jumper: createJumper(name === 'earth' ? EARTH_GRAVITY : MOON_GRAVITY),
        dust: [], footprints: [], crouch: 0, landSquash: 0, jumps: 0,
      });
    }
  }
  freshSides();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = root.clientWidth;
    height = root.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  function doJump() {
    for (const side of sides) {
      if (side.jumper.airborne || side.crouch > 0) continue;
      side.crouch = CROUCH_S;
    }
  }

  function land(side: Side) {
    side.landSquash = 0.14;
    side.jumps++;
    const moon = side.name === 'moon';
    const count = moon ? 18 : 10;
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      side.dust.push(moon
        ? { x: dir * 0.15, y: 0.02, vx: dir * (0.4 + Math.random() * 1.3), vy: 0.6 + Math.random() * 1.6, age: 0, life: 99, r: 2 + Math.random() * 2 }
        : { x: dir * 0.15, y: 0.03, vx: dir * (0.2 + Math.random() * 0.6), vy: 0.15 + Math.random() * 0.35, age: 0, life: 1.1 + Math.random() * 0.6, r: 5 + Math.random() * 4 });
    }
    if (moon) {
      const drift = ((side.jumps * 37) % 7 - 3) * 0.05;
      side.footprints.push(drift - 0.09, drift + 0.09);
      if (side.footprints.length > 40) side.footprints.splice(0, 2);
      if (side.jumps === 1) {
        caption.textContent = 'Same jump! On the Moon you fly over your own head.';
        caption.classList.remove('is-hidden');
      }
    }
  }

  function update(dt: number) {
    for (const side of sides) {
      const j = side.jumper;
      if (side.crouch > 0) {
        side.crouch -= dt;
        if (side.crouch <= 0) { side.crouch = 0; jump(j); }
      }
      if (side.landSquash > 0) side.landSquash = Math.max(0, side.landSquash - dt);
      if (stepJumper(j, dt)) land(side);
      const moon = side.name === 'moon';
      for (const d of side.dust) {
        d.age += dt;
        if (moon) {
          // No air: every grain flies its own clean arc and drops straight back.
          d.vy -= MOON_GRAVITY * dt;
        } else {
          // Air: the puff slows at once, hangs, and drifts.
          const drag = Math.exp(-4 * dt);
          d.vx *= drag;
          d.vy = d.vy * drag + 0.05 * dt;
        }
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (moon && d.y <= 0) d.life = 0;
      }
      side.dust = side.dust.filter(d => d.age < d.life);
    }
  }

  /* --- drawing ------------------------------------------------------------- */

  function drawSky(side: Side, x0: number, w: number, ground: number) {
    if (side.name === 'earth') {
      const g = ctx.createLinearGradient(0, 0, 0, ground);
      g.addColorStop(0, '#4fa8e8');
      g.addColorStop(1, '#bfe5fb');
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, w, ground);
      ctx.fillStyle = '#ffe58a';
      ctx.beginPath();
      ctx.arc(x0 + w * 0.2, ground * 0.2, Math.min(w, ground) * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffffd0';
      for (const [cx, cy, s] of [[0.68, 0.16, 1], [0.45, 0.32, 0.7]] as const) {
        const r = w * 0.06 * s;
        ctx.beginPath();
        ctx.arc(x0 + w * cx, ground * cy, r, 0, Math.PI * 2);
        ctx.arc(x0 + w * cx + r, ground * cy + r * 0.2, r * 0.8, 0, Math.PI * 2);
        ctx.arc(x0 + w * cx - r, ground * cy + r * 0.25, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#05070f';
      ctx.fillRect(x0, 0, w, ground);
      ctx.fillStyle = '#ffffff';
      for (const [sx, sy, r] of STARS) {
        ctx.globalAlpha = 0.5 + r * 0.3;
        ctx.fillRect(x0 + sx * w, sy * ground * 0.9, r, r);
      }
      ctx.globalAlpha = 1;
      // Earth hanging in the Moon's sky.
      const er = Math.min(w, ground) * 0.07;
      const ex = x0 + w * 0.76;
      const ey = ground * 0.2;
      ctx.fillStyle = '#2f6fc4';
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6fb05a';
      ctx.beginPath();
      ctx.ellipse(ex - er * 0.25, ey - er * 0.1, er * 0.35, er * 0.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffffb0';
      ctx.beginPath();
      ctx.ellipse(ex + er * 0.3, ey + er * 0.35, er * 0.4, er * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround(side: Side, x0: number, w: number, ground: number) {
    if (side.name === 'earth') {
      ctx.fillStyle = '#5fae4c';
      ctx.fillRect(x0, ground, w, height - ground);
      ctx.fillStyle = '#4b9440';
      ctx.fillRect(x0, ground, w, 6);
    } else {
      ctx.fillStyle = '#a5a7ab';
      ctx.fillRect(x0, ground, w, height - ground);
      ctx.fillStyle = '#8c8e93';
      for (const [cx, cy, r] of [[0.15, 0.3, 0.09], [0.62, 0.55, 0.13], [0.88, 0.22, 0.06], [0.35, 0.75, 0.07]] as const) {
        ctx.beginPath();
        ctx.ellipse(x0 + w * cx, ground + (height - ground) * cy, w * r, w * r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#c1c3c6';
      ctx.fillRect(x0, ground, w, 4);
    }
  }

  function drawChild(cx: number, feetY: number, px: number, side: Side) {
    const j = side.jumper;
    const squash = side.crouch > 0 ? 0.86 : side.landSquash > 0 ? 0.9 : 1;
    const stretch = j.airborne && j.velocity > 0 ? 1.04 : 1;
    const h = px * squash * stretch;
    const w = px * 0.5 * (2 - squash);
    const up = j.airborne;
    ctx.save();
    ctx.translate(cx, feetY);
    ctx.lineCap = 'round';
    // Legs
    ctx.strokeStyle = '#e8743b';
    ctx.lineWidth = w * 0.2;
    const hip = -h * 0.42;
    const knee = up ? 0.18 : 0.12;
    ctx.beginPath();
    ctx.moveTo(-w * 0.14, hip); ctx.lineTo(-w * knee * 1.6, -h * 0.05);
    ctx.moveTo(w * 0.14, hip); ctx.lineTo(w * knee * 1.6, -h * 0.05);
    ctx.stroke();
    // Boots
    ctx.fillStyle = '#3c4a5e';
    ctx.beginPath();
    ctx.ellipse(-w * knee * 1.6, -h * 0.03, w * 0.15, h * 0.04, 0, 0, Math.PI * 2);
    ctx.ellipse(w * knee * 1.6, -h * 0.03, w * 0.15, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    // Arms: up when flying, by the sides when standing.
    ctx.strokeStyle = '#e8743b';
    ctx.lineWidth = w * 0.17;
    const shoulder = -h * 0.68;
    ctx.beginPath();
    if (up) {
      ctx.moveTo(-w * 0.3, shoulder); ctx.lineTo(-w * 0.62, shoulder - h * 0.22);
      ctx.moveTo(w * 0.3, shoulder); ctx.lineTo(w * 0.62, shoulder - h * 0.22);
    } else {
      ctx.moveTo(-w * 0.3, shoulder); ctx.lineTo(-w * 0.42, shoulder + h * 0.24);
      ctx.moveTo(w * 0.3, shoulder); ctx.lineTo(w * 0.42, shoulder + h * 0.24);
    }
    ctx.stroke();
    // Body
    ctx.fillStyle = '#f08a45';
    ctx.beginPath();
    ctx.roundRect(-w * 0.32, -h * 0.76, w * 0.64, h * 0.38, w * 0.14);
    ctx.fill();
    ctx.fillStyle = '#ffffffd8';
    ctx.beginPath();
    ctx.roundRect(-w * 0.14, -h * 0.68, w * 0.28, h * 0.12, w * 0.05);
    ctx.fill();
    // Helmet and visor
    const hr = h * 0.15;
    ctx.fillStyle = '#f4f6f8';
    ctx.beginPath();
    ctx.arc(0, -h * 0.86, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b5f8f';
    ctx.beginPath();
    ctx.ellipse(hr * 0.15, -h * 0.86, hr * 0.68, hr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff90';
    ctx.beginPath();
    ctx.ellipse(hr * 0.4, -h * 0.9, hr * 0.18, hr * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSide(side: Side, x0: number, w: number, ground: number, ppm: number) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, w, height);
    ctx.clip();
    drawSky(side, x0, w, ground);
    drawGround(side, x0, w, ground);
    const cx = x0 + w / 2;
    const moon = side.name === 'moon';

    // Footprints stay on the Moon: nothing blows them away.
    ctx.fillStyle = '#5c5e64';
    for (const f of side.footprints) {
      ctx.beginPath();
      ctx.ellipse(cx + f * ppm, ground + 9, ppm * 0.08, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // The child's own height: the line a Moon jump clears.
    const headY = ground - CHILD_HEIGHT * ppm;
    ctx.strokeStyle = moon ? '#ffffff55' : '#1d3b5a55';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(x0 + 12, headY);
    ctx.lineTo(x0 + w - 12, headY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Shadow shrinks as the child rises.
    const j = side.jumper;
    const shrink = 1 / (1 + j.height * 0.8);
    ctx.fillStyle = moon ? '#00000066' : '#0000003a';
    ctx.beginPath();
    ctx.ellipse(cx, ground + 4, ppm * 0.3 * shrink, 5 * shrink, 0, 0, Math.PI * 2);
    ctx.fill();

    // How high the feet got this jump: a gold bar beside the child, from the ground to the
    // top of the jump, that stays until the next one. The two bars compare at a glance.
    if (j.lastPeak > 0.02) {
      const py = ground - j.lastPeak * ppm;
      const sx = cx + ppm * 0.75;
      ctx.strokeStyle = '#ffd25a';
      ctx.lineCap = 'round';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(sx, ground - 3);
      ctx.lineTo(sx, py);
      ctx.stroke();
      ctx.fillStyle = '#ffd25a';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 5 : 11;
        ctx.lineTo(sx + Math.cos(a) * r, py + Math.sin(a) * r);
      }
      ctx.fill();
    }

    drawChild(cx, ground - j.height * ppm, CHILD_HEIGHT * ppm, side);

    for (const d of side.dust) {
      const fade = moon ? 1 : 1 - d.age / d.life;
      ctx.fillStyle = moon ? `rgba(200,201,205,${fade})` : `rgba(160,130,90,${0.55 * fade})`;
      const r = moon ? d.r : d.r * (1 + d.age * 1.5);
      ctx.beginPath();
      ctx.arc(cx + d.x * ppm, ground - d.y * ppm, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = width / 2;
    const ground = Math.round(height - Math.max(150, height * 0.2));
    // One scale for both sides, sized so the Moon jump (plus the child) fits under the labels.
    const ppm = Math.min((ground - 96) / (peakHeight(MOON_GRAVITY) + CHILD_HEIGHT + 0.15), w / 2.4);
    sides.forEach((side, i) => drawSide(side, i * w, w, ground, ppm));
    ctx.fillStyle = '#0b1324';
    ctx.fillRect(w - 2, 0, 4, height);
  }

  function loop(now: number) {
    if (!open) return;
    const dt = last ? Math.min((now - last) / 1000, MAX_STEP) : 0;
    last = now;
    update(dt);
    draw();
    frame = requestAnimationFrame(loop);
  }

  jumpButton.addEventListener('click', doJump);
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    doJump();
  });
  back.addEventListener('click', () => api.close());
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
    }
  });
  const onResize = () => { if (open) resize(); };
  window.addEventListener('resize', onResize);

  const api: MoonJump = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      freshSides();
      caption.classList.add('is-hidden');
      host.append(root);
      root.classList.remove('is-hidden');
      resize();
      last = 0;
      frame = requestAnimationFrame(loop);
      jumpButton.focus();
    },
    close() {
      if (!open) return;
      open = false;
      cancelAnimationFrame(frame);
      root.classList.add('is-hidden');
      root.remove();
      onClose();
    },
  };
  return api;
}
