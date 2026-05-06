// ============================================================================
// zodiac.js - Zodiac constellation overlay
// ============================================================================

import { Astronomy } from './astronomy.js';

const DEG2RAD = Math.PI / 180;
const OBLIQUITY_DEG = 23.4393;
const MIN_POSITION_DELTA_PX = 0.5;
const MIN_RADIUS_DELTA_PX = 1;
const MIN_ALTITUDE_DELTA_DEG = 0.08;

const CONSTELLATIONS = {
  aries: {
    stars: [[18, 58, 2.4], [34, 42, 1.8], [51, 38, 1.5], [68, 48, 1.4], [80, 62, 1.1]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
  },
  taurus: {
    stars: [[17, 36, 1.5], [32, 48, 1.7], [46, 54, 2.5], [61, 45, 1.4], [76, 30, 1.3], [71, 65, 1.5], [85, 74, 1.1]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]]
  },
  gemini: {
    stars: [[24, 20, 2.3], [36, 32, 1.5], [45, 46, 1.4], [55, 61, 1.3], [66, 76, 1.1], [59, 18, 2.1], [67, 34, 1.5], [74, 50, 1.3], [82, 66, 1.2]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [1, 6], [3, 7]]
  },
  cancer: {
    stars: [[48, 22, 1.5], [34, 43, 1.3], [52, 50, 2.0], [68, 40, 1.3], [60, 72, 1.4], [42, 68, 1.1]],
    lines: [[0, 2], [1, 2], [2, 3], [2, 4], [4, 5]]
  },
  leo: {
    stars: [[18, 66, 2.4], [31, 52, 1.7], [47, 48, 1.5], [63, 57, 1.6], [78, 68, 1.4], [58, 34, 1.4], [66, 20, 1.3], [79, 28, 1.2]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7]]
  },
  virgo: {
    stars: [[19, 71, 1.5], [34, 58, 1.3], [49, 46, 1.4], [64, 34, 1.2], [78, 24, 1.1], [44, 69, 2.3], [57, 77, 1.2]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6]]
  },
  libra: {
    stars: [[24, 35, 1.5], [43, 28, 1.9], [64, 35, 1.4], [74, 61, 1.5], [49, 71, 1.2], [29, 59, 1.3]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4]]
  },
  scorpio: {
    stars: [[19, 30, 1.4], [31, 43, 1.5], [43, 53, 2.5], [55, 60, 1.4], [68, 70, 1.3], [80, 63, 1.2], [83, 49, 1.1], [73, 40, 1.2]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]
  },
  sagittarius: {
    stars: [[25, 68, 1.4], [38, 52, 1.6], [55, 41, 1.5], [73, 32, 1.3], [49, 65, 1.8], [66, 73, 1.2], [34, 31, 1.2], [58, 22, 1.1]],
    lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [2, 7], [7, 6], [6, 1]]
  },
  capricorn: {
    stars: [[20, 34, 1.4], [36, 51, 1.5], [55, 65, 1.6], [74, 57, 1.3], [83, 38, 1.4], [66, 28, 1.1], [43, 26, 1.2]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]]
  },
  aquarius: {
    stars: [[19, 44, 1.3], [33, 35, 1.5], [47, 42, 1.8], [62, 34, 1.3], [77, 42, 1.4], [39, 60, 1.2], [53, 70, 1.3], [69, 64, 1.1]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [7, 4]]
  },
  pisces: {
    stars: [[21, 33, 1.3], [36, 26, 1.2], [51, 33, 1.4], [65, 45, 1.2], [78, 60, 1.3], [57, 70, 1.4], [40, 72, 1.2], [25, 61, 1.1]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]]
  }
};

function makeConstellationSvg(key, stars, lines) {
  const lineMarkup = lines.map(([from, to]) => {
    const [x1, y1] = stars[from];
    const [x2, y2] = stars[to];
    return `<line class="zodiac-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
  }).join('');

  const starMarkup = stars.map(([x, y, radius]) => {
    const glowRadius = (radius * 2.7).toFixed(2);
    return [
      `<circle class="zodiac-star-glow" cx="${x}" cy="${y}" r="${glowRadius}" />`,
      `<circle class="zodiac-star" cx="${x}" cy="${y}" r="${radius}" />`
    ].join('');
  }).join('');

  return `<svg class="zodiac-svg" viewBox="0 0 100 100" role="img" focusable="false" data-sign="${key}">${lineMarkup}${starMarkup}</svg>`;
}

export const ZODIAC_DATA = [
  // Rough constellation-center ecliptic longitudes, intentionally not equal 30-degree sign spans.
  { key: 'aries',       name: '\u05d8\u05dc\u05d4',      longitude: 39,  symbol: '\u2648' },
  { key: 'taurus',      name: '\u05e9\u05d5\u05e8',      longitude: 70,  symbol: '\u2649' },
  { key: 'gemini',      name: '\u05ea\u05d0\u05d5\u05de\u05d9\u05dd', longitude: 101, symbol: '\u264a' },
  { key: 'cancer',      name: '\u05e1\u05e8\u05d8\u05df', longitude: 126, symbol: '\u264b' },
  { key: 'leo',         name: '\u05d0\u05e8\u05d9\u05d4', longitude: 152, symbol: '\u264c' },
  { key: 'virgo',       name: '\u05d1\u05ea\u05d5\u05dc\u05d4', longitude: 190, symbol: '\u264d' },
  { key: 'libra',       name: '\u05de\u05d0\u05d6\u05e0\u05d9\u05d9\u05dd', longitude: 225, symbol: '\u264e' },
  { key: 'scorpio',     name: '\u05e2\u05e7\u05e8\u05d1', longitude: 242, symbol: '\u264f' },
  { key: 'sagittarius', name: '\u05e7\u05e9\u05ea',      longitude: 283, symbol: '\u2650' },
  { key: 'capricorn',   name: '\u05d2\u05d3\u05d9',      longitude: 307, symbol: '\u2651' },
  { key: 'aquarius',    name: '\u05d3\u05dc\u05d9',      longitude: 338, symbol: '\u2652' },
  { key: 'pisces',      name: '\u05d3\u05d2\u05d9\u05dd', longitude: 12,  symbol: '\u2653' }
].map(sign => ({
  ...sign,
  equatorial: eclipticLongitudeToEquatorial(sign.longitude),
  svg: makeConstellationSvg(
    sign.key,
    CONSTELLATIONS[sign.key].stars,
    CONSTELLATIONS[sign.key].lines
  )
}));

const zodiacElements = new Map();
const lastLayoutByKey = new Map();

function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function eclipticLongitudeToEquatorial(longitudeDeg) {
  const lambda = longitudeDeg * DEG2RAD;
  const obliquity = OBLIQUITY_DEG * DEG2RAD;
  const raDeg = Math.atan2(
    Math.cos(obliquity) * Math.sin(lambda),
    Math.cos(lambda)
  ) / DEG2RAD;
  const decDeg = Math.asin(Math.sin(obliquity) * Math.sin(lambda)) / DEG2RAD;

  return {
    ra: normalizeDegrees(raDeg) / 15,
    dec: decDeg
  };
}

function normalizeSignedDegrees(degrees) {
  const normalized = normalizeDegrees(degrees);
  return normalized > 180 ? normalized - 360 : normalized;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getSkyProjectionMetrics(layer, clockFace) {
  const screen = document.getElementById('screen');
  const terrain = document.querySelector('.terrain-container');
  const screenRect = screen?.getBoundingClientRect();
  const terrainRect = terrain?.getBoundingClientRect();

  if (screenRect && terrainRect) {
    layer.style.left = `${screenRect.width / 2}px`;
    layer.style.top = `${terrainRect.top - screenRect.top}px`;
  }

  const clockRadius = clockFace.offsetWidth / 2;
  const screenWidth = screenRect?.width || window.innerWidth || clockRadius * 4;
  const screenHeight = screenRect?.height || window.innerHeight || clockRadius * 4;

  return {
    clockRadius,
    horizontalRadius: Math.min(
      screenWidth * 0.49,
      Math.max(clockRadius * 2.25, screenWidth * 0.34)
    ),
    verticalRadius: Math.min(
      screenHeight * 0.47,
      Math.max(clockRadius * 1.7, screenHeight * 0.42)
    )
  };
}

function projectHorizonToSky(altitudeDeg, azimuthDeg, observer, metrics) {
  const forwardAzimuth = observer.latitude >= 0 ? 180 : 0;
  const hemisphereDirection = observer.latitude >= 0 ? -1 : 1;
  const relativeAzimuth = normalizeSignedDegrees(azimuthDeg - forwardAzimuth) * DEG2RAD;
  const projectedAltitude = clamp(altitudeDeg, -35, 90) * DEG2RAD;

  return {
    x: hemisphereDirection * Math.sin(relativeAzimuth) * Math.cos(projectedAltitude) * metrics.horizontalRadius,
    y: -Math.sin(projectedAltitude) * metrics.verticalRadius
  };
}

export function renderZodiacs() {
  const layer = document.getElementById('zodiac-layer');
  if (!layer || layer.dataset.rendered === 'true') return;

  layer.replaceChildren();
  zodiacElements.clear();
  lastLayoutByKey.clear();

  ZODIAC_DATA.forEach(sign => {
    const zodiac = document.createElement('div');
    zodiac.className = 'zodiac below-horizon';
    zodiac.dataset.zodiac = sign.key;
    zodiac.title = `${sign.symbol} ${sign.name}`;
    zodiac.innerHTML = `
      <div class="zodiac-illustration">${sign.svg}</div>
      <div class="zodiac-name">${sign.name}</div>
    `;

    layer.appendChild(zodiac);
    zodiacElements.set(sign.key, zodiac);
  });

  layer.dataset.rendered = 'true';
}

export function updateZodiacPositions(date, observer, options = {}) {
  if (!date || !observer) return;

  const layer = document.getElementById('zodiac-layer');
  const clockFace = document.querySelector('.clock-face');
  if (!layer || !clockFace || clockFace.offsetWidth === 0) return;

  if (layer.dataset.rendered !== 'true') {
    renderZodiacs();
  }

  const metrics = getSkyProjectionMetrics(layer, clockFace);

  ZODIAC_DATA.forEach(sign => {
    const element = zodiacElements.get(sign.key);
    if (!element) return;

    const horizon = Astronomy.Horizon(
      date,
      observer,
      sign.equatorial.ra,
      sign.equatorial.dec,
      'normal'
    );
    const { x, y } = projectHorizonToSky(
      horizon.altitude,
      horizon.azimuth,
      observer,
      metrics
    );
    const belowHorizon = horizon.altitude < 0;
    const ghostOpacity = clamp(0.9 - Math.abs(horizon.altitude) / 110, 0.42, 0.9);

    const previous = lastLayoutByKey.get(sign.key);
    const positionChanged = !previous
      || Math.abs(x - previous.x) >= MIN_POSITION_DELTA_PX
      || Math.abs(y - previous.y) >= MIN_POSITION_DELTA_PX;
    const altitudeChanged = !previous || Math.abs(horizon.altitude - previous.altitude) >= MIN_ALTITUDE_DELTA_DEG;
    const radiusChanged = !previous
      || Math.abs(metrics.horizontalRadius - previous.horizontalRadius) >= MIN_RADIUS_DELTA_PX
      || Math.abs(metrics.verticalRadius - previous.verticalRadius) >= MIN_RADIUS_DELTA_PX
      || Math.abs(metrics.clockRadius - previous.clockRadius) >= MIN_RADIUS_DELTA_PX;
    const horizonChanged = !previous || belowHorizon !== previous.belowHorizon;

    if (!options.force && !positionChanged && !altitudeChanged && !radiusChanged && !horizonChanged) return;

    element.style.left = `${x.toFixed(2)}px`;
    element.style.top = `${y.toFixed(2)}px`;
    element.style.setProperty('--zodiac-ghost-opacity', ghostOpacity.toFixed(2));
    element.classList.toggle('below-horizon', belowHorizon);
    element.classList.toggle('above-horizon', !belowHorizon);

    lastLayoutByKey.set(sign.key, {
      x,
      y,
      altitude: horizon.altitude,
      horizontalRadius: metrics.horizontalRadius,
      verticalRadius: metrics.verticalRadius,
      clockRadius: metrics.clockRadius,
      belowHorizon
    });
  });
}
