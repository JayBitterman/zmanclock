// ============================================================================
// sky.js - Sky colors, sunrise/sunset glow, real star field, sky projection
// ============================================================================

import { state } from './config.js';
import { Astronomy } from './astronomy.js';
import { BACKGROUND_STARS } from './starData.js';

// Where the far ridge (the visible horizon) sits, as a fraction of the
// terrain container's height. The landscape draws its far hills around it.
export const FAR_RIDGE = 0.40;

const D2R = Math.PI / 180;
const OBLIQUITY = 23.4393 * D2R;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ============================================================================
// Colors
// ============================================================================

export function hexToRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

export function mixRgb(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

export function rgbString(c, alpha) {
  const [r, g, b] = c.map(v => Math.round(clamp(v, 0, 255)));
  return alpha === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Sky and light by sun altitude. `light` multiplies the landscape's daylight
// colors, so night turns the hills into blue silhouettes and golden hour warms them.
const SKY_KEYS = [
  { alt: -18, top: '#02040b', horizon: '#090e1d', light: [0.15, 0.17, 0.27] },
  { alt: -12, top: '#040917', horizon: '#111833', light: [0.16, 0.18, 0.29] },
  { alt: -8,  top: '#0a1431', horizon: '#232750', light: [0.2, 0.21, 0.34] },
  { alt: -4,  top: '#18244e', horizon: '#5a426d', light: [0.31, 0.27, 0.41] },
  { alt: -1,  top: '#29427c', horizon: '#ad6c72', light: [0.50, 0.39, 0.43] },
  { alt: 2,   top: '#3d64a5', horizon: '#d6a283', light: [0.80, 0.59, 0.46] },
  { alt: 6,   top: '#4c80c4', horizon: '#e2c4a2', light: [0.96, 0.81, 0.65] },
  { alt: 12,  top: '#4888d6', horizon: '#a8cce9', light: [1.01, 0.96, 0.88] },
  { alt: 25,  top: '#3c81d7', horizon: '#9ac5e9', light: [1.04, 1.02, 0.97] },
  { alt: 90,  top: '#367bd3', horizon: '#93c1e7', light: [1.05, 1.04, 1.01] },
].map(k => ({ ...k, top: hexToRgb(k.top), horizon: hexToRgb(k.horizon) }));

const GLOW_KEYS = [
  { alt: -9, color: hexToRgb('#6b3a63') },
  { alt: -4, color: hexToRgb('#c9503f') },
  { alt: 0,  color: hexToRgb('#f07534') },
  { alt: 4,  color: hexToRgb('#f6a548') },
  { alt: 9,  color: hexToRgb('#f8d58c') },
];

function sampleKeys(keys, alt) {
  if (alt <= keys[0].alt) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (alt <= b.alt) {
      const t = (alt - a.alt) / (b.alt - a.alt);
      const out = { alt };
      for (const k of Object.keys(a)) {
        if (k !== 'alt') out[k] = mixRgb(a[k], b[k], t);
      }
      return out;
    }
  }
  return keys[keys.length - 1];
}

// ============================================================================
// Sun & moon (refreshed every 10 s of simulated time)
// ============================================================================

const BODY_REFRESH_MS = 10 * 1000;
let bodies = null;

/** Sun/moon positions plus local sidereal time for the current state.date. */
export function getSkyBodies() {
  const ms = state.date.getTime();
  if (bodies && bodies.observer === state.observer && Math.abs(ms - bodies.dateMs) < BODY_REFRESH_MS) {
    return bodies;
  }
  const { date, observer } = state;
  const sunEq = Astronomy.Equator('Sun', date, observer, true, true);
  const sunHor = Astronomy.Horizon(date, observer, sunEq.ra, sunEq.dec, 'normal');
  const moonEq = Astronomy.Equator('Moon', date, observer, true, true);
  const moonHor = Astronomy.Horizon(date, observer, moonEq.ra, moonEq.dec, 'normal');
  bodies = {
    observer,
    dateMs: ms,
    sunAlt: sunHor.altitude,
    sunAz: sunHor.azimuth,
    sunLon: Astronomy.SunPosition(date).elon,
    moonAlt: moonHor.altitude,
    moonLit: Astronomy.Illumination('Moon', date).phase_fraction,
    lstDeg: (Astronomy.SiderealTime(date) * 15 + observer.longitude + 360) % 360,
  };
  return bodies;
}

// ============================================================================
// Projection
// ============================================================================
//
// Stereographic projection centered on the horizon point we face: south in
// the northern hemisphere, north in the southern (the side the sun and mazalos
// are on). The horizon is a straight line and shapes keep their proportions.
//
// Regular mode keeps east on the right to match the clock face. Compass mode
// is the true view, so facing south puts east on the left (and the CSS mirrors
// the dial so its sun rises on the left too).

let projection = null;

export function invalidateSkyLayout() {
  projection = null;
  starsDirty = true;
}

export function getProjection() {
  if (projection) return projection;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const compass = document.body.classList.contains('compass-mode');
  // In regular mode the horizon is the far ridge; in compass mode the ground
  // starts at the clock center.
  const horizonY = H * 0.5 + (compass ? 0 : H * 0.5 * FAR_RIDGE);
  const north = (state.latitude ?? 0) >= 0;
  const mirrored = compass && north;
  document.body.classList.toggle('facing-south', mirrored);
  projection = {
    W, H, compass, horizonY,
    cx: W / 2,
    scale: Math.max(horizonY - Math.min(W, H) * 0.03, 40),
    facingSouth: north,
    eastSign: mirrored ? -1 : 1,
    latRad: (state.latitude ?? 0) * D2R,
  };
  return projection;
}

/**
 * Project an equatorial position (degrees) to screen pixels.
 * Returns { x, y, up } where `up` is the sine of the altitude.
 */
export function projectEquatorial(raDeg, decDeg, lstDeg, p = getProjection()) {
  const h = (lstDeg - raDeg) * D2R;
  const d = decDeg * D2R;
  const sinLat = Math.sin(p.latRad), cosLat = Math.cos(p.latRad);
  const cosD = Math.cos(d), sinD = Math.sin(d), cosH = Math.cos(h);
  const up = sinLat * sinD + cosLat * cosD * cosH;
  const east = -cosD * Math.sin(h);
  const northward = sinD * cosLat - cosD * cosH * sinLat;
  const forward = p.facingSouth ? -northward : northward;
  const k = p.scale / Math.max(1 + forward, 0.05);
  return { x: p.cx + p.eastSign * east * k, y: p.horizonY - up * k, up };
}

/** Project a horizon position (altitude/azimuth in degrees) to screen pixels. */
export function projectHorizon(altDeg, azDeg, p = getProjection()) {
  const alt = altDeg * D2R, az = azDeg * D2R;
  const northward = Math.cos(alt) * Math.cos(az);
  const east = Math.cos(alt) * Math.sin(az);
  const up = Math.sin(alt);
  const forward = p.facingSouth ? -northward : northward;
  const k = p.scale / Math.max(1 + forward, 0.05);
  return { x: p.cx + p.eastSign * east * k, y: p.horizonY - up * k, up };
}

/** Ecliptic (of date) longitude/latitude in degrees to RA/Dec in degrees. */
export function eclipticToEquatorial(lonDeg, latDeg) {
  const l = lonDeg * D2R, b = latDeg * D2R;
  const ra = Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
  return { ra: ((ra / D2R) + 360) % 360, dec: dec / D2R };
}

// ============================================================================
// Star field
// ============================================================================

const TWINKLE_MAG = 1.6;  // stars brighter than this get a twinkling sparkle
// Redraw once the sky has turned this far (~7 s of real time at normal speed).
// During fast-forward that's every frame, so stars move as smoothly as the mazalos.
const STAR_REDRAW_LST_DEG = 0.03;

const stars = [];
for (let i = 0; i < BACKGROUND_STARS.length; i += 4) {
  stars.push({
    ra: BACKGROUND_STARS[i],
    dec: BACKGROUND_STARS[i + 1],
    mag: BACKGROUND_STARS[i + 2],
    bv: BACKGROUND_STARS[i + 3],
  });
}

let starCanvas = null;
let starCtx = null;
let starSprites = null;
let starDpr = 1;
let twinkleEls = [];
let starsDirty = true;
let lastStarLst = null;

/** Approximate star color from its B-V color index. */
export function starColor(bv) {
  const stops = [
    [-0.3, [160, 185, 255]], [0, [205, 218, 255]], [0.3, [244, 245, 255]],
    [0.6, [255, 243, 230]], [0.9, [255, 226, 190]], [1.2, [255, 206, 156]], [1.7, [255, 172, 112]],
  ];
  if (bv <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (bv <= stops[i][0]) {
      const t = (bv - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return mixRgb(stops[i - 1][1], stops[i][1], t);
    }
  }
  return stops[stops.length - 1][1];
}

const MAG_BUCKETS = [0.5, 1.5, 2.5, 3.2, 3.9, 4.5, 5.1];
const COLOR_BUCKETS = [-0.1, 0.4, 0.9, 1.4];

function magBucket(mag) {
  const i = MAG_BUCKETS.findIndex(m => mag <= m);
  return i === -1 ? MAG_BUCKETS.length - 1 : i;
}

function colorBucket(bv) {
  const i = COLOR_BUCKETS.findIndex(b => bv <= b);
  return i === -1 ? COLOR_BUCKETS.length - 1 : i;
}

// Pre-rendered glow sprites, one per magnitude/color bucket, so drawing a
// frame is just ~1,400 drawImage calls.
function buildStarSprites(dpr) {
  return MAG_BUCKETS.map((mag, mi) => COLOR_BUCKETS.map(bv => {
    const core = (1.9 - mi * 0.22) * dpr;
    const radius = Math.ceil(core * (mi < 2 ? 4.2 : 3));
    const alpha = clamp(1.05 - mi * 0.12, 0.38, 1);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = radius * 2;
    const ctx = canvas.getContext('2d');
    const c = starColor(bv);
    const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    g.addColorStop(core / radius * 0.55, `rgba(255, 255, 255, ${alpha * 0.92})`);
    g.addColorStop(core / radius, rgbString(c, alpha * 0.5));
    g.addColorStop(Math.min(1, core / radius * 2.2), rgbString(c, alpha * 0.1));
    g.addColorStop(1, rgbString(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, radius * 2, radius * 2);
    return { canvas, radius };
  }));
}

function resizeStarCanvas() {
  // Stars are soft glows, so 2x is plenty even on 3x phone screens
  starDpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  starCanvas.width = Math.round(W * starDpr);
  starCanvas.height = Math.round(H * starDpr);
  starCanvas.style.width = `${W}px`;
  starCanvas.style.height = `${H}px`;
  starCtx.setTransform(starDpr, 0, 0, starDpr, 0, 0);
  starSprites = buildStarSprites(starDpr);
}

function drawStars(lstDeg) {
  const p = getProjection();
  const ctx = starCtx;
  ctx.clearRect(0, 0, p.W, p.H);
  let t = 0;
  for (const s of stars) {
    const pos = projectEquatorial(s.ra, s.dec, lstDeg, p);
    if (pos.up < -0.02 || pos.x < -10 || pos.x > p.W + 10 || pos.y < -10) continue;
    const sprite = starSprites[magBucket(s.mag)][colorBucket(s.bv)];
    const r = sprite.radius / starDpr;
    ctx.drawImage(sprite.canvas, pos.x - r, pos.y - r, r * 2, r * 2);
    if (s.mag < TWINKLE_MAG && t < twinkleEls.length) {
      twinkleEls[t].style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px)`;
      twinkleEls[t].style.display = '';
      t++;
    }
  }
  for (; t < twinkleEls.length; t++) twinkleEls[t].style.display = 'none';
}

// ============================================================================
// Sky element writes (only on change)
// ============================================================================

const written = new Map();
function write(key, value, apply) {
  if (written.get(key) === value) return;
  written.set(key, value);
  apply(value);
}

let screenEl, skyEl, glowEl, starLayerEl;

export function initSky() {
  screenEl = document.getElementById('screen');
  skyEl = document.getElementById('sky');
  glowEl = document.getElementById('sun-glow');
  starLayerEl = document.getElementById('star-layer');
  starCanvas = document.getElementById('star-canvas');
  starCtx = starCanvas.getContext('2d');
  resizeStarCanvas();

  const twinkleHolder = document.getElementById('star-twinkles');
  const brightCount = stars.filter(s => s.mag < TWINKLE_MAG).length;
  twinkleEls = Array.from({ length: brightCount }, (_, i) => {
    const el = document.createElement('span');
    el.className = 'sky-twinkle';
    el.style.setProperty('--tw-dur', `${(1.6 + (i * 0.37) % 2.2).toFixed(2)}s`);
    el.style.setProperty('--tw-delay', `${(-(i * 0.71) % 3).toFixed(2)}s`);
    twinkleHolder.appendChild(el);
    return el;
  });

  window.addEventListener('resize', () => {
    resizeStarCanvas();
    invalidateSkyLayout();
  });
}

/**
 * Update sky colors, glow and stars for state.date. Returns the lighting the
 * landscape uses: { light, horizon, glow: { x, color, strength }, night, sunAlt }.
 */
export function updateSky() {
  const b = getSkyBodies();
  const p = getProjection();
  const sunAlt = b.sunAlt;

  // Moonlight brightens the night landscape and sky a little
  const night = smoothstep(-2, -12, sunAlt);
  const moonUp = clamp(Math.sin(b.moonAlt * D2R) * 1.6, 0, 1);
  const moonlight = b.moonLit * moonUp * night;

  const key = sampleKeys(SKY_KEYS, sunAlt);
  const top = mixRgb(key.top, [16, 28, 56], moonlight * 0.45);
  const horizon = mixRgb(key.horizon, [36, 50, 84], moonlight * 0.4);
  const light = key.light.map((v, i) => v + moonlight * [0.1, 0.12, 0.17][i]);

  // Sky gradient: zenith at the top, horizon color at the horizon line
  const hPct = (p.horizonY / p.H) * 100;
  const mid = mixRgb(top, horizon, 0.45);
  write('sky', `linear-gradient(to bottom, ${rgbString(top)} 0%, ${rgbString(mid)} ${(hPct * 0.6).toFixed(1)}%, ` +
    `${rgbString(horizon)} ${hPct.toFixed(1)}%, ${rgbString(horizon)} 100%)`,
    v => { screenEl.style.background = v; });

  // Sunrise/sunset glow on the horizon below the sun
  const glowStrength = Math.exp(-(((sunAlt - 0.5) / 5.5) ** 2));
  const glowColor = sampleKeys(GLOW_KEYS, sunAlt).color;
  const glowPos = projectHorizon(0, b.sunAz, p);
  const glowX = clamp(glowPos.x, -p.W * 0.15, p.W * 1.15);
  write('glow-pos', `translate(${glowX.toFixed(0)}px, ${p.horizonY.toFixed(0)}px)`,
    v => { glowEl.style.transform = `${v} translate(-50%, -50%)`; });
  write('glow-color', rgbString(glowColor), v => glowEl.style.setProperty('--glow-color', v));
  write('glow-opacity', (glowStrength * 0.95).toFixed(2), v => { glowEl.style.opacity = v; });

  // Stars fade in from tzeis-ish to full darkness (R' Tam / alos at ~-16°)
  const starOpacity = smoothstep(-3, -15, sunAlt) * (1 - moonlight * 0.25);
  write('stars', starOpacity.toFixed(2), v => { starLayerEl.style.opacity = v; });
  if (starOpacity > 0) {
    const moved = lastStarLst === null || Math.abs(((b.lstDeg - lastStarLst + 540) % 360) - 180) > STAR_REDRAW_LST_DEG;
    if (starsDirty || moved) {
      drawStars(b.lstDeg);
      starsDirty = false;
      lastStarLst = b.lstDeg;
    }
  }

  write('night', night.toFixed(2), v => skyEl.style.setProperty('--night', v));

  return {
    sunAlt,
    night,
    light,
    horizon,
    glow: { x: glowX / p.W, color: glowColor, strength: glowStrength },
  };
}
