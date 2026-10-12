// ============================================================================
// landscape.js - Judean hills: terraced limestone hills, olive and cypress
// trees, a stone village, seasonal ground cover, day/night lighting, and the
// person's outfit.
//
// The scene is one static SVG drawn from a fixed seed (so it looks the same on
// every visit and every resize). Its colors are CSS variables on the terrain
// container, recomputed from the sky's light, so a day/night change is a
// recolor rather than a rebuild.
// ============================================================================

import { state } from './config.js';
import { FAR_RIDGE, hexToRgb, mixRgb, rgbString } from './sky.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LANDSCAPE_SEED = 5786;
const RELIGHT_MIN_MS = 250;   // cap recolors during fast-forward

// ============================================================================
// Seasons
// ============================================================================

export function getSeason(date, latitude) {
  const seasons = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer',
    'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
  const season = seasons[date.getMonth()];
  if (latitude >= 0) return season;
  return { spring: 'fall', summer: 'winter', fall: 'spring', winter: 'summer' }[season];
}

function dayOfYear(date) {
  return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
}

/** Almond trees blossom around Tu BiShvat, leaf out in spring, yellow in fall. */
function almondPhase(date, latitude) {
  let day = dayOfYear(date);
  if (latitude < 0) day = (day + 182) % 365;
  if (day >= 20 && day < 70) return 'blossom';
  if (day >= 70 && day < 285) return 'leaf';
  if (day >= 285 && day < 335) return 'autumn';
  return 'bare';
}

// Daylight colors. The hills are green in the rainy season and golden in the
// dry summer, as in the Judean hills.
const COMMON_COLORS = {
  stone: '#ddd5c2', shade: '#6d6450', house: '#e6dfcf', houseShade: '#b3a78f', window: '#3f3830',
  trunk: '#5a4a3b', oliveDark: '#4f5d3c', olive: '#76865a', oliveLight: '#a8b48e',
  cypress: '#263d29', cypressLight: '#3f5f3d',
  rock: '#d2cab6', rockShade: '#8e8574', rockLight: '#ede7d8',
  blossom: '#fbf3f4', blossomPink: '#f3c4cf', almondLeaf: '#7d9b4c', autumnLeaf: '#c9a248',
  anemone: '#d3242c', anemoneCenter: '#2a1418', flowerYellow: '#ecc93b', flowerWhite: '#f4f1e6',
};

const SEASON_COLORS = {
  winter: {
    scrub: '#4c6534',
    far: '#8e9ba2', far2: '#8a9a83', mid: '#7e9861', near: '#738f4e',
    fgTop: '#6f8a47', fgBottom: '#4d6332', grass: '#88a85a', grassDark: '#59763a',
  },
  spring: {
    scrub: '#53703a',
    far: '#909ea1', far2: '#8fa07e', mid: '#88a35f', near: '#7f9c51',
    fgTop: '#7c9a4b', fgBottom: '#566d34', grass: '#9cbb5d', grassDark: '#647f3a',
  },
  summer: {
    scrub: '#6f6a42',
    far: '#a7a29a', far2: '#aa9d80', mid: '#b5a176', near: '#bca46f',
    fgTop: '#c0a56c', fgBottom: '#8c7348', grass: '#d6bb7d', grassDark: '#a48653',
  },
  fall: {
    scrub: '#6a6743',
    far: '#a19d98', far2: '#a3987f', mid: '#ad9b73', near: '#b19b6c',
    fgTop: '#b39b67', fgBottom: '#836c45', grass: '#c8ad76', grassDark: '#98804f',
  },
};

// The person's daylight colors, lit like the foreground
const PERSON_COLORS = {
  shirt: '#ece8df', jacket: '#1d1e23', coat: '#222329', trousers: '#25272d', skin: '#c59a7d',
  hair: '#2b221c', shoes: '#111113', tzitzis: '#f2efe4', hat: '#18191e', band: '#3d3d44',
};

// Where each layer's base line sits, as a fraction of the terrain container
// (whose top edge is the clock center). Compass mode lifts the land up to the
// horizon at the clock center, so the same hills fill the whole lower half.
const LAYOUTS = {
  regular: { far: FAR_RIDGE + 0.03, far2: 0.5, mid: 0.6, near: 0.75, fg: 0.87, hills: 1 },
  // Compass mode has twice the depth to fill, so it gets a third terraced row.
  // Its farthest land is a flat plain right on the horizon, so the land meets
  // the clock's horizontal diameter; every nearer hill stays below it.
  compass: { far: 0, flatFar: true, far2: 0.13, mid: 0.26, near: 0.43, front: 0.62, fg: 0.82, hills: 1.3 },
};

// The earth cut-away in the clock's lower half (compass mode): terra rossa
// topsoil over layered limestone
const EARTH_COLORS = {
  top: '#6a4430', mid: '#5c4a39', deep: '#2b231d', limestone: '#a8977a',
  seam: '#33291f', stone: '#c4b597', topsoil: '#4e3222',
};

// How much each layer fades toward the horizon color with distance
const HAZE = { far: 0.6, far2: 0.44, mid: 0.27, near: 0.13, fg: 0.03 };

// Which colors each layer needs, as CSS variables named --<layer>-<color>
const LAYER_COLORS = {
  far2: ['house', 'houseShade', 'window'],
  mid: ['ground', 'stone', 'shade', 'scrub', 'house', 'houseShade', 'window', 'trunk', 'oliveDark', 'olive', 'oliveLight', 'cypress', 'cypressLight'],
  near: ['ground', 'stone', 'shade', 'scrub', 'trunk', 'oliveDark', 'olive', 'oliveLight', 'cypress', 'cypressLight'],
  fg: ['fgTop', 'fgBottom', 'stone', 'shade', 'trunk', 'oliveDark', 'olive', 'oliveLight', 'cypress',
    'cypressLight', 'rock', 'rockShade', 'rockLight', 'grass', 'grassDark', 'blossom', 'blossomPink',
    'almondLeaf', 'autumnLeaf', 'anemone', 'anemoneCenter', 'flowerYellow', 'flowerWhite'],
};

// ============================================================================
// Geometry helpers
// ============================================================================

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise in [-1, 1], defined for x in [-1000, 2000]
function makeNoise(rand, wavelength) {
  const values = Array.from({ length: Math.ceil(3000 / wavelength) + 4 }, () => rand() * 2 - 1);
  return x => {
    const p = (Math.min(Math.max(x, -1000), 2000) + 1000) / wavelength;
    const i = Math.floor(p);
    const t = p - i;
    const s = t * t * (3 - 2 * t);
    return values[i] * (1 - s) + values[i + 1] * s;
  };
}

const f = n => n.toFixed(1);

function ellipse(cx, cy, rx, ry) {
  return `M${f(cx - rx)},${f(cy)}a${f(rx)},${f(ry)} 0 1,0 ${f(2 * rx)},0a${f(rx)},${f(ry)} 0 1,0 ${f(-2 * rx)},0Z`;
}

// Smooth path through points using quadratic curves between midpoints
function smoothLine(pts) {
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${f(pts[i][0])},${f(pts[i][1])} ${f(mx)},${f(my)}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${f(last[0])},${f(last[1])}`;
}

function makeRidge(rand, base, amp, waves) {
  const n1 = makeNoise(rand, waves[0]);
  const n2 = makeNoise(rand, waves[1]);
  // Shape the noise so hilltops are rounded domes and valleys are gentler
  const yAt = x => {
    const n = 0.72 * n1(x) + 0.28 * n2(x);
    return base - amp * Math.sign(n) * Math.pow(Math.abs(n), 0.85);
  };
  const pts = [];
  for (let x = -20; x <= 1020; x += 6) pts.push([x, yAt(x)]);
  return { yAt, pts };
}

// A layer of rounded hills: overlapping domes over a base line, roughened a
// little. The domes are kept so terraces can follow each hill's shape.
function makeHills(rand, base, halfWidth, height, u, roughness) {
  const domes = [];
  let x = -halfWidth[1];
  while (x < 1000 + halfWidth[1]) {
    const W = halfWidth[0] + rand() * (halfWidth[1] - halfWidth[0]);
    const H = height[0] + rand() * (height[1] - height[0]);
    domes.push({ cx: x + W * 0.5, W, H, p: 1.2 + rand() * 0.8 });
    x += W * (0.85 + rand() * 0.55);
  }
  const noise = makeNoise(rand, 7 * u);
  const domeY = (d, px) => {
    const t = (px - d.cx) / d.W;
    return Math.abs(t) >= 1 ? base : base - d.H * Math.pow(Math.cos(t * Math.PI / 2), d.p);
  };
  const yAt = px => {
    let y = base;
    for (const d of domes) y = Math.min(y, domeY(d, px));
    return y + noise(px) * roughness;
  };
  const pts = [];
  for (let px = -20; px <= 1020; px += 5) pts.push([px, yAt(px)]);
  return { yAt, pts, domes, base, domeY };
}

function fillToBottom(ridge, bottom) {
  return `${smoothLine(ridge.pts)}L1020,${f(bottom)}L-20,${f(bottom)}Z`;
}

// ============================================================================
// Trees, rocks, ground cover (accumulated into one path per color)
// ============================================================================

function olive(acc, rand, x, y, w, u) {
  const small = w < 4 * u;
  const h = w * 0.6;
  const trunkH = w * (small ? 0.18 : 0.3);
  const lean = (rand() - 0.5) * w * 0.14;
  acc.groundShadow += ellipse(x + w * 0.06, y + w * 0.015, w * 0.46, w * 0.06);
  if (small) {
    acc.trunk += `M${f(x - w * 0.06)},${f(y)}L${f(x + lean * 0.5 - w * 0.03)},${f(y - trunkH)}` +
      `L${f(x + lean * 0.5 + w * 0.03)},${f(y - trunkH)}L${f(x + w * 0.06)},${f(y)}Z`;
  } else {
    // Gnarled trunk: a wide base splitting into two limbs
    const bw = w * 0.09, tw = w * 0.045;
    acc.trunk += `M${f(x - bw)},${f(y)}C${f(x - bw * 0.5)},${f(y - trunkH * 0.4)} ${f(x - tw * 1.4 + lean)},${f(y - trunkH * 0.7)} ` +
      `${f(x - tw * 3 + lean)},${f(y - trunkH * 1.1)}L${f(x - tw * 0.6 + lean)},${f(y - trunkH * 0.92)}` +
      `L${f(x + tw * 1.6 + lean)},${f(y - trunkH * 1.15)}C${f(x + tw * 1.5 + lean)},${f(y - trunkH * 0.6)} ` +
      `${f(x + bw * 0.4)},${f(y - trunkH * 0.35)} ${f(x + bw)},${f(y)}Z`;
  }
  const cx = x + lean, cy = y - trunkH - h * 0.38;
  if (small) {
    // A dark mass, two mid blobs and a silvery top
    acc.oliveDark += ellipse(cx, cy + h * 0.06, w * 0.46, h * 0.36);
    acc.olive += ellipse(cx - w * 0.13, cy - h * 0.02, w * 0.27, h * 0.29);
    acc.olive += ellipse(cx + w * 0.14, cy + h * 0.03, w * 0.25, h * 0.26);
    acc.oliveLight += ellipse(cx - w * 0.05 + (rand() - 0.5) * w * 0.12, cy - h * 0.15, w * 0.2, h * 0.16);
    return;
  }
  // Big tree: a few lobes, each a cluster of leaf blobs
  const lobes = 4 + Math.floor(rand() * 2);
  for (let l = 0; l < lobes; l++) {
    const t = l / (lobes - 1);
    const lx = cx + (t - 0.5) * w * 0.66 + (rand() - 0.5) * w * 0.08;
    const ly = cy - Math.sin(t * Math.PI) * h * 0.16 + (rand() - 0.4) * h * 0.18;
    const lw = w * (0.19 + rand() * 0.07);
    acc.oliveDark += ellipse(lx, ly + lw * 0.22, lw * 1.05, lw * 0.6);
    for (let i = 0; i < 8; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand());
      const bx = lx + Math.cos(a) * r * lw * 0.8, by = ly + Math.sin(a) * r * lw * 0.45;
      const br = lw * (0.2 + rand() * 0.16);
      const key = by > ly + lw * 0.1 ? 'oliveDark' : (by < ly - lw * 0.1 ? 'oliveLight' : 'olive');
      acc[key] += ellipse(bx, by, br, br * 0.72);
    }
  }
}

function cypress(acc, rand, x, y, h) {
  const w = h * (0.16 + rand() * 0.05);
  const sk = (rand() - 0.5) * w * 0.35;
  acc.cypress += `M${f(x - w * 0.5)},${f(y)}C${f(x - w * 0.64)},${f(y - h * 0.45)} ${f(x - w * 0.32 + sk)},${f(y - h * 0.86)} ` +
    `${f(x + sk)},${f(y - h)}C${f(x + w * 0.32 + sk)},${f(y - h * 0.86)} ${f(x + w * 0.64)},${f(y - h * 0.45)} ${f(x + w * 0.5)},${f(y)}Z`;
  acc.cypressLight += `M${f(x + w * 0.04)},${f(y - h * 0.06)}C${f(x + w * 0.42)},${f(y - h * 0.4)} ` +
    `${f(x + w * 0.22 + sk)},${f(y - h * 0.8)} ${f(x + sk)},${f(y - h * 0.97)}C${f(x + w * 0.1 + sk)},${f(y - h * 0.7)} ` +
    `${f(x + w * 0.22)},${f(y - h * 0.4)} ${f(x + w * 0.04)},${f(y - h * 0.06)}Z`;
}

function almond(acc, rand, x, y, w, phase, u) {
  const h = w * 0.9;
  const topX = x + (rand() - 0.5) * w * 0.1, topY = y - h * 0.32;
  acc.almondTrunk += `M${f(x)},${f(y)}C${f(x - w * 0.04)},${f(y - h * 0.15)} ${f(topX + w * 0.03)},${f(topY + h * 0.1)} ${f(topX)},${f(topY)}`;
  const tips = [];
  const branches = 5 + Math.floor(rand() * 2);
  for (let i = 0; i < branches; i++) {
    const a = (-160 + (140 * (i + 0.5)) / branches + (rand() - 0.5) * 14) * Math.PI / 180;
    const len = h * (0.38 + rand() * 0.2);
    const ex = topX + Math.cos(a) * len * 0.8, ey = topY + Math.sin(a) * len;
    const mx = topX + Math.cos(a) * len * 0.35 + (rand() - 0.5) * w * 0.06, my = topY + Math.sin(a) * len * 0.5;
    acc.almondBranch += `M${f(topX)},${f(topY)}Q${f(mx)},${f(my)} ${f(ex)},${f(ey)}`;
    for (let t = 0; t < 2; t++) {
      const ta = a + (rand() - 0.5) * 1.1;
      const tl = len * (0.22 + rand() * 0.18);
      const sx = (mx + ex) / 2, sy = (my + ey) / 2;
      const tx = sx + Math.cos(ta) * tl, ty = sy + Math.sin(ta) * tl;
      acc.almondTwig += `M${f(sx)},${f(sy)}L${f(tx)},${f(ty)}`;
      tips.push([tx, ty]);
    }
    tips.push([ex, ey]);
  }
  if (phase === 'bare') return;
  // Blossoms (late winter), leaves (spring-summer) or a few yellow leaves (fall)
  const perTip = phase === 'autumn' ? 4 : 11;
  for (const [tx, ty] of tips) {
    for (let i = 0; i < perTip; i++) {
      const bx = tx + (rand() - 0.5) * w * 0.17, by = ty + (rand() - 0.6) * w * 0.13;
      const r = (0.35 + rand() * 0.45) * u * (phase === 'blossom' ? 0.8 : 1.15);
      const key = phase === 'blossom' ? (rand() > 0.35 ? 'blossom' : 'blossomPink')
        : phase === 'leaf' ? (rand() > 0.4 ? 'almondLeaf' : 'oliveDark') : 'autumnLeaf';
      acc[key] += ellipse(bx, by, r, r * 0.85);
    }
  }
}

function rock(acc, rand, x, y, r) {
  const h = r * (0.55 + rand() * 0.25);
  const skew = (rand() - 0.5) * r * 0.4;
  acc.rock += `M${f(x - r)},${f(y)}C${f(x - r * 1.02)},${f(y - h * 0.7)} ${f(x - r * 0.4 + skew)},${f(y - h * 1.08)} ` +
    `${f(x + skew)},${f(y - h)}C${f(x + r * 0.55 + skew)},${f(y - h * 0.95)} ${f(x + r * 1.05)},${f(y - h * 0.55)} ${f(x + r)},${f(y)}Z`;
  acc.rockShade += `M${f(x - r * 0.2)},${f(y)}C${f(x + r * 0.25)},${f(y - h * 0.4)} ${f(x + r * 0.7)},${f(y - h * 0.62)} ` +
    `${f(x + r * 0.98)},${f(y - h * 0.3)}L${f(x + r)},${f(y)}Z`;
  acc.rockLight += ellipse(x - r * 0.35 + skew * 0.5, y - h * 0.72, r * 0.26, h * 0.12);
}

function stoneWall(acc, rand, x0, x1, yAt, u) {
  // A dry-stone field wall: two courses of rounded limestone blocks
  for (let course = 0; course < 2; course++) {
    let x = x0 + (course ? 0.6 * u : 0);
    while (x < x1) {
      const w = (0.9 + rand() * 0.8) * u, h = (0.5 + rand() * 0.25) * u;
      const y = yAt(x) - course * 0.6 * u;
      acc.wallShade += ellipse(x + w / 2, y + h * 0.18, w * 0.52, h * 0.55);
      acc.wallStone += ellipse(x + w / 2, y, w * 0.5, h * 0.5);
      x += w * (0.92 + rand() * 0.12);
    }
  }
}

// ============================================================================
// Building the scene
// ============================================================================

let terrainEl = null;
let svgEl = null;
let compassSvgEl = null;
let built = { key: null, season: null, phase: null };

function newPaths() {
  return new Proxy({}, { get: (t, k) => (k in t ? t[k] : '') });
}

function pathEl(d, fill, extra = '') {
  return d ? `<path d="${d}" style="fill:${fill}"${extra}/>` : '';
}

function strokeEl(d, stroke, width, extra = '') {
  return d ? `<path d="${d}" style="fill:none;stroke:${stroke};stroke-width:${f(width)};stroke-linecap:round"${extra}/>` : '';
}

// Trees for a hill layer, merged into one path per color
function treeRowMarkup(acc, layer) {
  return pathEl(acc.groundShadow, `var(--${layer}-shade)`, ' opacity="0.3"') +
    pathEl(acc.trunk, `var(--${layer}-trunk)`) +
    pathEl(acc.cypress, `var(--${layer}-cypress)`) +
    pathEl(acc.cypressLight, `var(--${layer}-cypressLight)`) +
    pathEl(acc.oliveDark, `var(--${layer}-oliveDark)`) +
    pathEl(acc.olive, `var(--${layer}-olive)`) +
    pathEl(acc.oliveLight, `var(--${layer}-oliveLight)`);
}

// Terraced hills: each dome gets stone terrace walls that curve around it (a
// horizontal contour seen from slightly above), with olive groves on some hills.
// Shading for each hill: the half facing away from the sun darkens toward its
// edge. Both halves are drawn; CSS variables fade whichever side is lit.
function domeShading(hills, u) {
  let markup = '';
  for (const d of hills.domes) {
    for (const side of [-1, 1]) {
      const pts = [];
      // Follow this dome's own outline (where it's visible), so the shading
      // tapers to nothing where the dome meets its neighbors
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const px = d.cx + side * t * d.W;
        pts.push([px, Math.max(hills.domeY(d, px), hills.yAt(px))]);
      }
      const d0 = `${smoothLine(pts)}L${f(d.cx)},${f(hills.base)}Z`;
      markup += `<path d="${d0}" fill="url(#shade-${side < 0 ? 'left' : 'right'})"/>`;
    }
  }
  return markup;
}

// Low shrubs speckling the hillsides, and patches of bare limestone
function hillTexture(rand, layer, hills, Hv, u, count, size) {
  let scrub = '', rock = '';
  for (let i = 0; i < count; i++) {
    const x = rand() * 1020 - 10;
    const top = hills.yAt(x) + 0.4 * u;
    const y = top + Math.pow(rand(), 1.4) * (hills.base + 0.12 * Hv - top);
    const r = size * (0.5 + rand() * 0.8);
    scrub += ellipse(x, y, r, r * 0.7);
  }
  for (const d of hills.domes) {
    if (rand() > 0.6) continue;
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x = d.cx + (rand() - 0.5) * d.W * 0.9;
      const y = hills.yAt(x) + (0.6 + rand() * 2.5) * u;
      rock += ellipse(x, y, (0.8 + rand() * 1.6) * u, (0.25 + rand() * 0.25) * u);
    }
  }
  return pathEl(rock, `var(--${layer}-stone)`, ' opacity="0.45"') +
    pathEl(scrub, `var(--${layer}-scrub)`, ' opacity="0.7"');
}

function terracedHills(rand, layer, hills, Hv, u, opts) {
  let markup = pathEl(fillToBottom(hills, Hv + 40), `var(--${layer}-ground)`);
  markup += domeShading(hills, u);
  markup += hillTexture(rand, layer, hills, Hv, u, opts.scrub, opts.scrubSize);
  let stone = '', shade = '';
  const trees = [];
  const flush = pts => {
    if (pts.length > 1) {
      stone += smoothLine(pts);
      shade += smoothLine(pts.map(([px, py]) => [px, py + 0.3 * u]));
    }
  };

  for (const d of hills.domes) {
    const levels = opts.levels[0] + Math.floor(rand() * (opts.levels[1] - opts.levels[0] + 1));
    const density = rand() < opts.grove ? 0.6 + rand() * 0.5 : 0.08 + rand() * 0.12;
    const hasCypress = rand() < opts.cypress;
    for (let k = 1; k <= levels; k++) {
      const h = d.H * Math.pow(1 - k / (levels + 1), 0.9);
      const a = d.W * (2 / Math.PI) * Math.acos(Math.pow(h / d.H, 1 / d.p));
      const tilt = a * opts.tilt;
      const arcY = px => hills.base - h + tilt * Math.sqrt(Math.max(0, 1 - ((px - d.cx) / a) ** 2));
      const visible = px => arcY(px) > hills.yAt(px) + 0.25 * u;

      // Terrace wall in broken runs, only where it lies on the visible hillside
      let x = d.cx - a, on = rand() > 0.15;
      while (x < d.cx + a) {
        const len = on ? (4 + rand() * 16) * u : (0.5 + rand() * 2.5) * u;
        if (on) {
          let pts = [];
          for (let px = x; px <= Math.min(x + len, d.cx + a); px += 1.5 * u) {
            if (visible(px)) {
              pts.push([px, arcY(px)]);
            } else {
              flush(pts);
              pts = [];
            }
          }
          flush(pts);
        }
        x += len;
        on = !on;
      }

      // Olive trees standing along this terrace
      const cleared = x => opts.clear && x > opts.clear[0] && x < opts.clear[1];
      for (let tx = d.cx - a + rand() * 2 * u; tx < d.cx + a; tx += opts.treeSize * (1.1 + rand() * 1.6) / density) {
        if (!visible(tx) || cleared(tx)) continue;
        trees.push({ kind: 'olive', x: tx, y: arcY(tx) - 0.15 * u, size: opts.treeSize * (0.75 + rand() * 0.5) });
      }
      // A line of cypresses on one terrace of some hills
      if (hasCypress && k === Math.ceil(levels / 2)) {
        const start = d.cx + (rand() - 0.5) * a;
        for (let i = 0; i < 3 + Math.floor(rand() * 4); i++) {
          const cx = start + i * opts.cypressSize * 0.24;
          if (visible(cx) && !cleared(cx)) trees.push({ kind: 'cypress', x: cx, y: arcY(cx), size: opts.cypressSize * (0.8 + rand() * 0.4) });
        }
      }
    }
  }
  markup += strokeEl(shade, `var(--${layer}-shade)`, 0.42 * u, ' opacity="0.5"') +
    strokeEl(stone, `var(--${layer}-stone)`, 0.22 * u, ' opacity="0.75"');

  // Trees back to front, in batches so nearer trees cover farther ones
  trees.sort((p, q) => p.y - q.y);
  for (let i = 0; i < trees.length; i += 24) {
    const acc = newPaths();
    for (const t of trees.slice(i, i + 24)) {
      if (t.kind === 'olive') olive(acc, rand, t.x, t.y, t.size, u);
      else cypress(acc, rand, t.x, t.y, t.size);
    }
    markup += treeRowMarkup(acc, layer);
  }
  return markup;
}

// A hilltop village of flat-roofed limestone houses stepping down the slope.
// Windows are dark by day and glow warm at night (with a halo each), street
// lamps line the road below, and the whole village casts a soft warm glow.
function village(rand, layer, hills, xCenter, u, { count, size, spread }) {
  const houses = [];
  for (let i = 0; i < count; i++) {
    const x = xCenter + (rand() + rand() - 1) * spread * u;
    const depth = Math.pow(rand(), 1.6) * 2.6 * size * u;   // how far down the slope
    const w = (0.9 + rand() * 1.2) * size * u;
    const h = (0.55 + rand() * 0.55) * size * u * (rand() > 0.75 ? 1.6 : 1);
    houses.push({ x, y: hills.yAt(x + w / 2) + 0.25 * size * u + depth, w, h });
  }
  houses.sort((p, q) => p.y - q.y);   // higher (farther) houses first

  let walls = '', shade = '', dark = '', lit = '', halos = '';
  for (const { x, y, w, h } of houses) {
    walls += `M${f(x)},${f(y)}h${f(w)}v${f(-h)}h${f(-w)}Z`;
    // A shaded side and a thin parapet line along the flat roof
    shade += `M${f(x + w * 0.78)},${f(y)}h${f(w * 0.22)}v${f(-h)}h${f(-w * 0.22)}Z`;
    shade += `M${f(x)},${f(y - h)}h${f(w)}v${f(h * 0.1)}h${f(-w)}Z`;
    const floors = h > 1.2 * size * u ? 2 : 1;
    const ww = 0.17 * size * u, wh = 0.24 * size * u;
    const perFloor = Math.max(1, Math.floor((w * 0.7) / (ww * 2.4)));
    for (let fl = 0; fl < floors; fl++) {
      const wy = y - h * (floors === 2 ? (fl ? 0.72 : 0.36) : 0.55) - wh / 2;
      for (let k = 0; k < perFloor; k++) {
        const wx = x + w * 0.1 + k * ww * 2.4 + ww * 0.4;
        const win = `M${f(wx)},${f(wy)}h${f(ww)}v${f(wh)}h${f(-ww)}Z`;
        dark += win;
        if (rand() < 0.62) {
          lit += win;
          halos += `<ellipse cx="${f(wx + ww / 2)}" cy="${f(wy + wh / 2)}" rx="${f(ww * 3.2)}" ry="${f(wh * 2.4)}"/>`;
        }
      }
    }
  }

  // Street lamps along a road winding down from the village
  let lamps = '';
  const lampCount = Math.round(4 + rand() * 4);
  const dir = rand() > 0.5 ? 1 : -1;
  for (let i = 1; i <= lampCount; i++) {
    const lx = xCenter + dir * i * spread * 0.45 * u + Math.sin(i * 1.7) * 0.8 * u;
    const ly = hills.yAt(lx) + (1.5 + i * 0.9) * size * u;
    lamps += `<ellipse cx="${f(lx)}" cy="${f(ly)}" rx="${f(0.45 * size * u)}" ry="${f(0.35 * size * u)}"/>`;
    lit += ellipse(lx, ly, 0.09 * size * u, 0.09 * size * u);
  }

  const top = Math.min(...houses.map(p => p.y - p.h));
  const bottom = Math.max(...houses.map(p => p.y));
  return `<ellipse class="village-glow" cx="${f(xCenter)}" cy="${f((top + bottom) / 2)}" ` +
      `rx="${f(spread * 1.9 * u)}" ry="${f((bottom - top) * 1.4 + 2 * size * u)}"/>` +
    pathEl(walls, `var(--${layer}-house)`) +
    pathEl(shade, `var(--${layer}-houseShade)`) +
    pathEl(dark, `var(--${layer}-window)`) +
    `<g class="village-lights">${halos}${lamps}</g>` +
    `<path class="village-windows" d="${lit}"/>`;
}

// The hilltop for a village: the highest dome whose top lies within [x0, x1]
function villageSite(hills, x0, x1) {
  const candidates = hills.domes.filter(d => d.cx > x0 && d.cx < x1);
  if (!candidates.length) return (x0 + x1) / 2;
  return candidates.reduce((best, d) => (d.H > best.H ? d : best)).cx;
}

const LANDSCAPE_DEFS = `<defs>
    <linearGradient id="far-grad" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" style="stop-color:var(--far-0)"/><stop offset="0.5" style="stop-color:var(--far-1)"/><stop offset="1" style="stop-color:var(--far-2)"/>
    </linearGradient>
    <linearGradient id="far2-grad" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" style="stop-color:var(--far2-0)"/><stop offset="0.5" style="stop-color:var(--far2-1)"/><stop offset="1" style="stop-color:var(--far2-2)"/>
    </linearGradient>
    <linearGradient id="shade-left" x1="1" x2="0" y1="0" y2="0">
      <stop offset="0" style="stop-color:var(--hill-shadow);stop-opacity:0"/>
      <stop offset="1" style="stop-color:var(--hill-shadow);stop-opacity:var(--shade-left)"/>
    </linearGradient>
    <linearGradient id="shade-right" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" style="stop-color:var(--hill-shadow);stop-opacity:0"/>
      <stop offset="1" style="stop-color:var(--hill-shadow);stop-opacity:var(--shade-right)"/>
    </linearGradient>
    <radialGradient id="window-glow">
      <stop offset="0" stop-color="#ffc56b" stop-opacity="0.55"/><stop offset="1" stop-color="#ffc56b" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="village-glow">
      <stop offset="0" stop-color="#ffb35c" stop-opacity="0.32"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fg-grad" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" style="stop-color:var(--fg-fgTop)"/><stop offset="1" style="stop-color:var(--fg-fgBottom)"/>
    </linearGradient>
  </defs>`;

// The whole scene for one layout. Each layout starts from the same seed, so
// regular and compass mode show the same hills, trees and village.
function buildScene(layout, { u, Hv, widthVmin, season, phase }) {
  const rand = mulberry32(LANDSCAPE_SEED);
  const k = layout.hills;

  const farHeight = layout.flatFar ? [0, 0] : [0.03 * Hv * k, 0.085 * Hv * k];
  const far = makeHills(rand, layout.far * Hv, [16 * u, 34 * u], farHeight, u, layout.flatFar ? 0 : 0.2 * u);
  const far2 = makeHills(rand, layout.far2 * Hv, [12 * u, 26 * u], [0.03 * Hv * k, 0.08 * Hv * k], u, 0.25 * u);
  const mid = makeHills(rand, layout.mid * Hv, [10 * u, 21 * u], [0.05 * Hv * k, 0.11 * Hv * k], u, 0.3 * u);
  const near = makeHills(rand, layout.near * Hv, [15 * u, 28 * u], [0.05 * Hv * k, 0.1 * Hv * k], u, 0.35 * u);
  const fg = makeRidge(rand, layout.fg * Hv, 0.016 * Hv, [40 * u, 18 * u]);

  // Distant ridges, with a stone village on each side catching the light
  let markup = pathEl(fillToBottom(far, Hv + 40), 'url(#far-grad)');
  markup += pathEl(fillToBottom(far2, Hv + 40), 'url(#far2-grad)');
  markup += domeShading(far2, u);
  const farVillageX = villageSite(far2, 700, 860);
  markup += village(rand, 'far2', far2, farVillageX, u, { count: 12, size: 0.7, spread: 4.5 });

  // Terraced hills with olive groves and cypresses, and a village on a hilltop
  const villageX = villageSite(mid, 110, 330);
  const villageSpread = 6;
  markup += terracedHills(rand, 'mid', mid, Hv, u,
    { levels: [3, 6], tilt: 0.12, treeSize: 1.5 * u, cypressSize: 3.6 * u, grove: 0.5, cypress: 0.25,
      scrub: Math.round(widthVmin * 3), scrubSize: 0.22 * u,
      clear: [villageX - villageSpread * 1.6 * u, villageX + villageSpread * 1.6 * u] });
  markup += village(rand, 'mid', mid, villageX, u, { count: 18, size: 1.1, spread: villageSpread });
  markup += terracedHills(rand, 'near', near, Hv, u,
    { levels: [2, 4], tilt: 0.14, treeSize: 2.8 * u, cypressSize: 6.5 * u, grove: 0.45, cypress: 0.3,
      scrub: Math.round(widthVmin * 2), scrubSize: 0.38 * u });
  if (layout.front) {
    // Drawn with the near hills' colors; its own seed keeps the rows above unchanged
    const frontRand = mulberry32(LANDSCAPE_SEED + 7);
    const front = makeHills(frontRand, layout.front * Hv, [18 * u, 32 * u], [0.06 * Hv * k, 0.12 * Hv * k], u, 0.4 * u);
    markup += terracedHills(frontRand, 'near', front, Hv, u,
      { levels: [2, 4], tilt: 0.16, treeSize: 3.8 * u, cypressSize: 8.5 * u, grove: 0.5, cypress: 0.3,
        scrub: Math.round(widthVmin * 1.6), scrubSize: 0.5 * u });
  }

  // Foreground: ground, stone wall, rocks, grass and flowers, big trees
  const acc = newPaths();
  const wallY = x => fg.yAt(x) + 2.2 * u;
  // A gap in the wall behind the person, like a field gate
  const personHalfGap = 5 * u;
  stoneWall(acc, rand, -10, 500 - personHalfGap, wallY, u);
  stoneWall(acc, rand, 500 + personHalfGap, 1010, wallY, u);

  for (let i = 0; i < Math.round(widthVmin / 14); i++) {
    const side = rand() > 0.5 ? 1 : -1;
    const x = 500 + side * (personHalfGap + 4 * u + rand() * 480);
    const top = wallY(x) + 1.5 * u;
    rock(acc, rand, x, top + rand() * Math.max(Hv - top, 0) * 0.85, (0.8 + rand() * 1.8) * u);
  }

  const grassCount = Math.round(widthVmin * 2.2);
  for (let i = 0; i < grassCount; i++) {
    const x = rand() * 1020 - 10;
    const top = fg.yAt(x) + 0.4 * u;
    const y = top + rand() * (Hv - top);
    const h = (0.6 + rand() * 1.3) * u * (0.7 + 0.6 * (y - top) / Math.max(Hv - top, 1));
    const lean = (rand() - 0.5) * h * 0.8;
    acc[rand() > 0.45 ? 'grass' : 'grassDark'] += `M${f(x)},${f(y)}q${f(lean * 0.3)},${f(-h * 0.55)} ${f(lean)},${f(-h)}`;
  }

  const flowerCount = { winter: 0.35, spring: 0.9, summer: 0, fall: 0.12 }[season] * widthVmin;
  for (let i = 0; i < flowerCount; i++) {
    const x = rand() * 1000;
    const top = fg.yAt(x) + 0.8 * u;
    const y = top + rand() * (Hv - top);
    const r = (0.28 + rand() * 0.32) * u;
    if (season === 'fall') {
      // Sea squill: a tall white spike
      acc.flowerWhite += ellipse(x, y - r * 2.2, r * 0.45, r * 1.4);
    } else if (season === 'spring' && rand() > 0.55) {
      acc.flowerYellow += ellipse(x, y, r, r * 0.8);
    } else {
      acc.anemone += ellipse(x, y, r, r * 0.82);
      acc.anemoneCenter += ellipse(x, y - r * 0.05, r * 0.3, r * 0.26);
    }
  }

  // Big trees frame the scene on both sides, clear of the clock and person
  const leftX = 1000 * (0.03 + rand() * 0.05) + 9 * u;
  olive(acc, rand, leftX, wallY(leftX) + 3 * u, 22 * u, u);
  const rightX = 1000 - (1000 * (0.04 + rand() * 0.04) + 8 * u);
  almond(acc, rand, rightX, wallY(rightX) + 3.5 * u, 17 * u, phase, u);
  const cypX = 1000 - (1000 * 0.2 + 6 * u);
  cypress(acc, rand, cypX, wallY(cypX) + 1.2 * u, 21 * u);
  cypress(acc, rand, cypX + 3.2 * u, wallY(cypX + 3.2 * u) + 1.5 * u, 25 * u);

  markup += pathEl(fillToBottom(fg, Hv + 40), 'url(#fg-grad)');
  markup += pathEl(acc.wallShade, 'var(--fg-shade)') + pathEl(acc.wallStone, 'var(--fg-rock)');
  markup += pathEl(acc.rock, 'var(--fg-rock)') + pathEl(acc.rockShade, 'var(--fg-rockShade)') +
    pathEl(acc.rockLight, 'var(--fg-rockLight)');
  markup += strokeEl(acc.grassDark, 'var(--fg-grassDark)', 0.24 * u) + strokeEl(acc.grass, 'var(--fg-grass)', 0.22 * u);
  markup += pathEl(acc.anemone, 'var(--fg-anemone)') + pathEl(acc.anemoneCenter, 'var(--fg-anemoneCenter)') +
    pathEl(acc.flowerYellow, 'var(--fg-flowerYellow)') + pathEl(acc.flowerWhite, 'var(--fg-flowerWhite)');
  markup += strokeEl(acc.almondTrunk, 'var(--fg-trunk)', 1.1 * u) + strokeEl(acc.almondBranch, 'var(--fg-trunk)', 0.5 * u) +
    strokeEl(acc.almondTwig, 'var(--fg-trunk)', 0.22 * u);
  markup += pathEl(acc.almondLeaf, 'var(--fg-almondLeaf)') + pathEl(acc.autumnLeaf, 'var(--fg-autumnLeaf)') +
    pathEl(acc.blossomPink, 'var(--fg-blossomPink)') + pathEl(acc.blossom, 'var(--fg-blossom)');
  markup += treeRowMarkup(acc, 'fg');
  return markup;
}

/** Build the landscape SVGs for the current size, season and almond phase. */
export function generateLandscape() {
  terrainEl = document.querySelector('.terrain-container');
  svgEl = document.getElementById('land-svg');
  compassSvgEl = document.getElementById('land-svg-compass');
  if (!terrainEl || !svgEl) return;

  const date = state.date || new Date();
  const lat = state.latitude ?? 40;
  const season = getSeason(date, lat);
  const phase = almondPhase(date, lat);
  const W = Math.max(terrainEl.clientWidth, 1);
  const Hpx = Math.max(terrainEl.clientHeight, 1);
  const key = `${W}x${Hpx}|${season}|${phase}`;
  if (built.key === key) return;

  const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
  const ctx = {
    u: (1000 / W) * vmin,          // viewBox units per vmin
    Hv: 1000 * (Hpx / W),          // viewBox height
    widthVmin: W / vmin,
    season,
    phase,
  };

  const viewBox = `0 0 1000 ${f(ctx.Hv)}`;
  svgEl.setAttribute('viewBox', viewBox);
  svgEl.innerHTML = LANDSCAPE_DEFS + buildScene(LAYOUTS.regular, ctx);
  if (compassSvgEl) {
    // Uses the gradients defined in #land-svg
    compassSvgEl.setAttribute('viewBox', viewBox);
    compassSvgEl.innerHTML = buildScene(LAYOUTS.compass, ctx);
  }

  built = { key, season, phase };
  lastLightKey = null;
}

// ============================================================================
// Lighting
// ============================================================================

let lastLightKey = null;
let lastRelight = 0;

function lit(hex, light, horizon, haze) {
  const c = hexToRgb(hex).map((v, i) => v * light[i]);
  return mixRgb(c, horizon, haze);
}

/** Recolor the landscape (and the person) for the sky's current light. */
export function updateLandscape(sky) {
  if (!terrainEl) return;
  const date = state.date || new Date();
  const lat = state.latitude ?? 40;
  const season = getSeason(date, lat);
  if (season !== built.season || almondPhase(date, lat) !== built.phase) {
    generateLandscape();
  }
  if (season !== dressedFor) updatePersonClothing();

  const lightKey = [season, ...sky.light.map(v => v.toFixed(2)), ...sky.horizon.map(Math.round),
    sky.glow.x.toFixed(2), sky.glow.strength.toFixed(2), sky.night.toFixed(2)].join('|');
  const now = performance.now();
  if (lightKey === lastLightKey || now - lastRelight < RELIGHT_MIN_MS) return;
  lastLightKey = lightKey;
  lastRelight = now;

  const colors = { ...COMMON_COLORS, ...SEASON_COLORS[season] };
  const vars = {};
  for (const [layer, keys] of Object.entries(LAYER_COLORS)) {
    for (const k of keys) {
      const base = k === 'ground' ? colors[layer] : colors[k];
      vars[`--${layer}-${k}`] = rgbString(lit(base, sky.light, sky.horizon, HAZE[layer]));
    }
  }

  // Far ridges: brighter and warmer on the side of the sunrise/sunset glow
  for (const layer of ['far', 'far2']) {
    const baseColor = lit(colors[layer], sky.light, sky.horizon, HAZE[layer]);
    [0, 0.5, 1].forEach((stop, i) => {
      const nearGlow = Math.max(0, 1 - Math.abs(stop - sky.glow.x) / 0.65);
      const amount = sky.glow.strength * nearGlow * (layer === 'far' ? 0.38 : 0.2);
      vars[`--${layer}-${i}`] = rgbString(mixRgb(baseColor, sky.glow.color, amount));
    });
  }

  vars['--village-lights'] = Math.max(0, Math.min(1, (sky.night - 0.25) / 0.6)).toFixed(2);

  // Hills are shaded on the side away from the sun; strongest when it's low
  const lowSun = Math.max(0, Math.min(1, 1 - (sky.sunAlt - 5) / 40));
  const daylight = 1 - sky.night;
  const sunSide = Math.max(-1, Math.min(1, (sky.glow.x - 0.5) * 2.2));  // -1 = sun far left
  const base = 0.1 + 0.08 * sky.night;
  vars['--shade-left'] = (base + daylight * lowSun * 0.42 * Math.max(0, sunSide)).toFixed(2);
  vars['--shade-right'] = (base + daylight * lowSun * 0.42 * Math.max(0, -sunSide)).toFixed(2);
  vars['--hill-shadow'] = rgbString(mixRgb([30, 34, 58], sky.horizon, 0.25));

  for (const [name, value] of Object.entries(vars)) terrainEl.style.setProperty(name, value);

  // The earth cut-away and the ground compass are lit like the foreground,
  // with a floor so they stay readable at night
  const floorLight = sky.light.map(v => Math.max(v, 0.4));
  const earth = document.getElementById('clock-earth');
  if (earth) {
    for (const [name, hex] of Object.entries(EARTH_COLORS)) {
      earth.style.setProperty(`--earth-${name}`, rgbString(lit(hex, floorLight, sky.horizon, 0)));
    }
    earth.style.setProperty('--earth-surface', vars['--fg-grass']);
  }
  const groundCompass = document.querySelector('.ground-compass');
  if (groundCompass) {
    const luma = 0.3 * sky.light[0] + 0.55 * sky.light[1] + 0.15 * sky.light[2];
    groundCompass.style.setProperty('--gc-light', Math.max(0.45, Math.min(1, luma)).toFixed(2));
  }

  // The person is lit like the foreground, a little brighter at night so the
  // figure still reads against the dark ground
  const person = document.querySelector('.person-wrapper');
  if (person) {
    const light = sky.light.map(v => Math.max(v, 0.26));
    for (const [name, hex] of Object.entries(PERSON_COLORS)) {
      const c = lit(hex, light, sky.horizon, 0);
      person.style.setProperty(`--p-${name}`, rgbString(c));
      person.style.setProperty(`--p-${name}-shade`, rgbString(c.map(v => v * 0.72)));
    }
  }
}

let dressedFor = null;

/** Dress the person for the season: coat in winter, suit jacket in spring and fall. */
export function updatePersonClothing() {
  const person = document.querySelector('.person');
  if (!person) return;
  const season = getSeason(state.date || new Date(), state.latitude ?? 40);
  dressedFor = season;
  person.classList.toggle('winter-coat', season === 'winter');
  person.classList.toggle('jacket', season === 'spring' || season === 'fall');
}
