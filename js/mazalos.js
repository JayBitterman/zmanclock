// ============================================================================
// mazalos.js - The 12 mazalos
//
// Regular mode: an even ring around the clock that turns with the sun, with
// this month's mazal on the sun's position. Compass mode: the same pattern
// laid along the sun's path across the sky, rising and setting with it, so
// this month's mazal is overhead at chatzos.
// ============================================================================

import { state } from './config.js';
import { MAZAL_FIGURES } from './mazalData.js';
import { sunTimesLayoutVersion } from './clock.js';
import {
  getSkyBodies, getProjection, projectEquatorial, eclipticToEquatorial, starColor, rgbString
} from './sky.js';

export const MAZALOS = [
  { key: 'taleh', name: 'טלה' },
  { key: 'shor', name: 'שור' },
  { key: 'teomim', name: 'תאומים' },
  { key: 'sartan', name: 'סרטן' },
  { key: 'aryeh', name: 'אריה' },
  { key: 'besulah', name: 'בתולה' },
  { key: 'moznayim', name: 'מאזניים' },
  { key: 'akrav', name: 'עקרב' },
  { key: 'keshes', name: 'קשת' },
  { key: 'gedi', name: 'גדי' },
  { key: 'dli', name: 'דלי' },
  { key: 'dagim', name: 'דגים' },
];

/** Mazal index (0 = טלה) for a Hebrew month (Nisan = 1 ... Adar II = 13). Both Adars are דגים. */
export function mazalIndexForMonth(month) {
  return Math.min(month, 12) - 1;
}

const FIGURE_FILL = 0.8;        // fraction of the box the stick figure spans
const CURRENT_SCALE = 1.22;     // this month's mazal is drawn larger
const SKY_SCALE = 1.65;         // mazalos are larger out in the sky
const TRANSITION_MS = 1200;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const D2R = Math.PI / 180;

let layerEl = null;
let items = [];
let currentIndex = -1;
let layout = null;

// ============================================================================
// Building the figures
// ============================================================================

function starStyle(mag, bv, dimmer) {
  const c = starColor(bv);
  const size = dimmer
    ? clamp((5.6 - mag) * 0.75 + 1.1, 1.1, 2.8)
    : clamp((5.3 - mag) * 1.65 + 1.9, 2.4, 10.5);
  const background = dimmer
    ? `radial-gradient(circle, ${rgbString(c, 0.95)} 0%, ${rgbString(c, 0.5)} 35%, ${rgbString(c, 0)} 70%)`
    : `radial-gradient(circle, #fff 0%, #fff 15%, ${rgbString(c, 0.92)} 27%, ` +
      `${rgbString(c, 0.32)} 46%, ${rgbString(c, 0.08)} 60%, ${rgbString(c, 0)} 72%)`;
  return { size, background };
}

function buildMazal(mazal, index) {
  const fig = MAZAL_FIGURES[mazal.key];
  const xs = fig.stars.map(s => s[0]);
  const ys = fig.stars.map(s => s[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const toBox = (x, y) => [
    50 + ((x - cx) / span) * 100 * FIGURE_FILL,
    50 - ((y - cy) / span) * 100 * FIGURE_FILL,
  ];

  const root = document.createElement('div');
  root.className = 'mazal';
  const figure = document.createElement('div');
  figure.className = 'mazal-figure';

  const stars = fig.stars.map(([x, y, mag, bv]) => {
    const [px, py] = toBox(x, y);
    return { px, py, ...starStyle(mag, bv, false) };
  });

  // Lines stop short of each star so the glows read as separate points
  let d = '';
  for (const [a, b] of fig.lines) {
    const s1 = stars[a], s2 = stars[b];
    const dx = s2.px - s1.px, dy = s2.py - s1.py;
    const len = Math.hypot(dx, dy);
    const gap1 = s1.size * 0.3 + 1.4, gap2 = s2.size * 0.3 + 1.4;
    if (len <= gap1 + gap2) continue;
    const ux = dx / len, uy = dy / len;
    d += `M${(s1.px + ux * gap1).toFixed(2)} ${(s1.py + uy * gap1).toFixed(2)}` +
      `L${(s2.px - ux * gap2).toFixed(2)} ${(s2.py - uy * gap2).toFixed(2)}`;
  }
  figure.insertAdjacentHTML('beforeend',
    `<svg class="mazal-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`);

  for (const [x, y, mag, bv] of fig.field) {
    const [px, py] = toBox(x, y);
    if (px < -5 || px > 105 || py < -5 || py > 105) continue;
    const { size, background } = starStyle(mag, bv, true);
    const el = document.createElement('span');
    el.className = 'mazal-field';
    el.style.cssText = `left:${px.toFixed(2)}%;top:${py.toFixed(2)}%;width:${size.toFixed(2)}%;` +
      `height:${size.toFixed(2)}%;background:${background}`;
    figure.appendChild(el);
  }

  stars.forEach((s, i) => {
    const el = document.createElement('span');
    el.className = 'mazal-star';
    el.style.cssText = `left:${s.px.toFixed(2)}%;top:${s.py.toFixed(2)}%;width:${s.size.toFixed(2)}%;` +
      `height:${s.size.toFixed(2)}%;background:${s.background};` +
      `--tw-dur:${(2.1 + ((index * 7 + i * 13) % 23) / 10).toFixed(1)}s;` +
      `--tw-delay:${(-((index * 5 + i * 11) % 37) / 10).toFixed(1)}s`;
    figure.appendChild(el);
  });

  const name = document.createElement('div');
  name.className = 'mazal-name';
  name.textContent = mazal.name;

  root.append(figure, name);
  layerEl.appendChild(root);

  return {
    root,
    figure,
    // Keep a hint of the real size difference between constellations
    sizeFactor: clamp(Math.pow(span / 30, 0.3), 0.82, 1.18),
    written: {},
  };
}

export function initMazalos() {
  layerEl = document.getElementById('mazal-layer');
  if (!layerEl) return;
  layerEl.replaceChildren();
  items = MAZALOS.map(buildMazal);
  window.addEventListener('resize', () => { layout = null; });
}

// ============================================================================
// Placement
// ============================================================================

function getRingLayout() {
  if (layout) return layout;
  const W = window.innerWidth, H = window.innerHeight;
  const vmin = Math.min(W, H) / 100;
  const size = 11 * vmin;
  const clockRadius = 25 * vmin;  // --clock-size is 50vmin
  const margin = 1.2 * vmin;
  layout = {
    size,
    cx: W / 2,
    cy: H / 2,
    // Outside the zman labels; as wide/tall as the screen allows
    rx: Math.max(Math.min(W / 2 - size * 0.55 - margin, 2.6 * clockRadius), 1.3 * clockRadius),
    ry: Math.max(Math.min(H / 2 - size * 0.62 - margin, 2.6 * clockRadius), 1.3 * clockRadius),
  };
  return layout;
}

// ============================================================================
// Keeping clear of the zman labels
// ============================================================================

// Label boxes, re-measured only when the labels move (or appear/disappear),
// and once more after a compass toggle's dial flip has finished
let labelRects = [];
let labelRectsKey = '';
let modeChanges = 0;

function getLabelRects() {
  const els = document.querySelectorAll('.sun-time');
  const key = `${sunTimesLayoutVersion}|${els.length}|${window.innerWidth}x${window.innerHeight}|${modeChanges}`;
  if (key === labelRectsKey) return labelRects;
  const pad = Math.min(window.innerWidth, window.innerHeight) * 0.006;
  labelRects = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width) labelRects.push({ x0: r.left - pad, y0: r.top - pad, x1: r.right + pad, y1: r.bottom + pad });
  }
  labelRectsKey = key;
  return labelRects;
}

/**
 * Push a mazal (a square box of half-size `half` centered at x, y) outward
 * from the clock until it clears the zman labels. The push grows smoothly as
 * it nears a label, so nothing jumps. If clearing would take it off screen or
 * farther than `maxPush`, it stops there and reports how blocked it still is.
 */
function clearOfLabels(x, y, half, cx, cy, maxPush) {
  let dx = x - cx, dy = y - cy;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  // Room before the box would leave the screen
  const W = window.innerWidth, H = window.innerHeight, m = half * 0.25;
  let room = maxPush;
  if (dx > 0.01) room = Math.min(room, (W - m - half - x) / dx);
  if (dx < -0.01) room = Math.min(room, (m + half - x) / dx);
  if (dy > 0.01) room = Math.min(room, (H - m - half - y) / dy);
  if (dy < -0.01) room = Math.min(room, (m + half - y) / dy);
  room = Math.max(0, room);

  let px = x, py = y, pushed = 0;
  const rects = getLabelRects();
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const r of rects) {
      if (px + half <= r.x0 || px - half >= r.x1 || py + half <= r.y0 || py - half >= r.y1) continue;
      let t = Infinity;
      if (dx > 0.01) t = Math.min(t, (r.x1 - (px - half)) / dx);
      if (dx < -0.01) t = Math.min(t, (r.x0 - (px + half)) / dx);
      if (dy > 0.01) t = Math.min(t, (r.y1 - (py - half)) / dy);
      if (dy < -0.01) t = Math.min(t, (r.y0 - (py + half)) / dy);
      if (!Number.isFinite(t) || t <= 0) continue;
      px += dx * t;
      py += dy * t;
      pushed += t;
      moved = true;
    }
    if (!moved) break;
  }
  if (pushed <= room) return { x: px, y: py, blocked: 0 };
  return { x: x + dx * room, y: y + dy * room, blocked: Math.min(1, (pushed - room) / (half * 1.5)) };
}

function writeItem(item, transform, rotation, opacity) {
  const w = item.written;
  if (w.transform !== transform) {
    w.transform = transform;
    item.root.style.transform = transform;
  }
  if (w.rotation !== rotation) {
    w.rotation = rotation;
    item.figure.style.transform = `rotate(${rotation}deg)`;
  }
  if (w.opacity !== opacity) {
    w.opacity = opacity;
    item.root.style.opacity = opacity;
  }
}

function placeOnRing(monthIndex, dayNight) {
  const { cx, cy, rx, ry, size } = getRingLayout();
  items.forEach((item, i) => {
    // Next month's mazal rises after the sun, so it trails it around the clock
    const a = (state.sunTheta - 30 * (i - monthIndex)) * D2R;
    const x = cx + rx * Math.cos(a);
    const y = cy - ry * Math.sin(a);
    // Point each figure's north outward from the clock
    const normal = Math.atan2(Math.sin(a) / ry, Math.cos(a) / rx);
    const rotation = (90 - normal / D2R).toFixed(1);
    const scale = item.sizeFactor * (i === monthIndex ? CURRENT_SCALE : 1);
    const half = size * scale * 0.45;
    const spot = clearOfLabels(x, y, half, cx, cy, half * 2);
    const opacity = (dayNight * (0.42 + 0.58 * smoothstep(-0.35, 0.05, Math.sin(a))) *
      (1 - 0.6 * spot.blocked)).toFixed(2);
    writeItem(item, `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`,
      rotation, opacity);
    // Names go on the outer side, away from the zman labels around the clock
    setLabelAbove(item, Math.sin(a) > 0.25);
    setNameHidden(item, spot.blocked > 0.3);
  });
}

function setLabelAbove(item, above) {
  if (item.written.labelAbove === above) return;
  item.written.labelAbove = above;
  item.root.classList.toggle('label-above', above);
}

function placeInSky(monthIndex, dayNight) {
  const b = getSkyBodies();
  const p = getProjection();
  // The clock, which mazalos pass behind
  const vmin = Math.min(p.W, p.H) / 100;
  const clockRadius = 25 * vmin;
  const clockX = p.W / 2, clockY = p.H / 2;
  items.forEach((item, i) => {
    // Evenly spaced along the ecliptic, anchored so this month's mazal is on the sun
    const lon = b.sunLon + 30 * (i - monthIndex);
    const eq = eclipticToEquatorial(lon, 0);
    const pos = projectEquatorial(eq.ra, eq.dec, b.lstDeg, p);
    const northEq = eclipticToEquatorial(lon, 6);
    const north = projectEquatorial(northEq.ra, northEq.dec, b.lstDeg, p);
    const rotation = (Math.atan2(north.x - pos.x, -(north.y - pos.y)) / D2R).toFixed(1);
    const scale = SKY_SCALE * item.sizeFactor * (i === monthIndex ? CURRENT_SCALE : 1);
    const half = 11 * vmin * scale * 0.45;
    const isCurrent = i === monthIndex;
    const fromClock = Math.hypot(pos.x - clockX, pos.y - clockY) / clockRadius;
    // Step aside from the zman labels. This month's mazal is left in place while
    // it's over the clock (at chatzos it stands right above the center).
    const spot = isCurrent && fromClock < 1.15
      ? { x: pos.x, y: pos.y, blocked: 0 }
      : clearOfLabels(pos.x, pos.y, half, clockX, clockY, half * 2);
    // Seen through the clock glass they're softened so the dial stays clear;
    // this month's mazal stays bright (at chatzos it's right above the center)
    const offDisc = isCurrent ? 1 : 0.5 + 0.5 * smoothstep(1.0, 1.3, Math.hypot(spot.x - clockX, spot.y - clockY) / clockRadius);
    // Dim those passing under the date and time in the top corners
    const corner = spot.x < p.W * 0.3 || spot.x > p.W * 0.7 ? smoothstep(0.26, 0.14, spot.y / p.H) : 0;
    const visible = offDisc * (1 - 0.6 * spot.blocked) * (1 - 0.65 * corner);
    const opacity = (dayNight * smoothstep(-0.05, 0.05, pos.up) * visible).toFixed(2);
    writeItem(item, `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`,
      rotation, opacity);
    // Names go on the side away from the clock, and hide where still covered
    setLabelAbove(item, spot.y < clockY - clockRadius * 0.5 && spot.y > p.H * 0.32);
    setNameHidden(item, !isCurrent && (spot.blocked > 0.3 || corner > 0.5 || offDisc < 0.85));
  });
}

function setNameHidden(item, hidden) {
  if (item.written.nameHidden === hidden) return;
  item.written.nameHidden = hidden;
  item.root.classList.toggle('name-hidden', hidden);
}

let transitionTimer = null;

/** Animate the move between the clock ring and the sky (compass toggle). */
export function animateMazalModeChange() {
  if (!layerEl) return;
  layout = null;
  layerEl.classList.add('mazal-moving');
  modeChanges++;
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    layerEl.classList.remove('mazal-moving');
    modeChanges++;   // labels have finished moving with the dial
  }, TRANSITION_MS);
}

/**
 * Place the mazalos for state.date. `sky` is updateSky()'s result; the
 * mazalos are faint by day and bright at night.
 */
export function updateMazalos(sky) {
  if (!layerEl || !state.hdate || !items.length) return;

  const monthIndex = mazalIndexForMonth(state.hdate.getMonth());
  if (monthIndex !== currentIndex) {
    items.forEach((item, i) => item.root.classList.toggle('is-current', i === monthIndex));
    currentIndex = monthIndex;
  }

  // Faint by day, bright at night
  const dayNight = 0.4 + 0.6 * sky.night;
  if (document.body.classList.contains('compass-mode')) {
    placeInSky(monthIndex, dayNight);
  } else {
    placeOnRing(monthIndex, dayNight);
  }
}
