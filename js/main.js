// ============================================================================
// main.js - Main application entry point
// ============================================================================

import { point, booleanPointInPolygon } from 'https://cdn.jsdelivr.net/npm/@turf/turf@7.1.0/+esm';
import { state, DAY_BUTTONS, SPEED_BUTTONS } from './config.js';
import { calcSunTimes, specialDayStatus, addBiurChametzTime } from './astronomy.js';
import { positionClockNumbers, setClockHand, positionMoon, placeSunTimes } from './clock.js';
import { setDigitalTimes, setDate, setAtmosphere, updateResetButton } from './ui.js';
import { getSpecialDayStatus } from './hebrew.js';
import { initCalendar } from './calendar.js';
import { 
  generateTerrain, 
  generateVegetation, 
  initStars,
  forceCloudUpdate,
  updateSceneVisuals,
  initWeatherEffects,
  updateVegetationSeason,
  updatePersonClothing,
  initBirds,
  startPeriodicCleanup,
  stopPeriodicCleanup,
  getTimeAccelerationFactor,
  cancelPendingCloudSpawns,
  cleanupClouds
} from './scene.js';
import { fetchWeather, weatherState } from './weather.js';
import { initLocation, locationState, getTimezoneForLocation } from './location.js';
import { getKidushLevanaState } from './kidushLevana.js';
import { renderZodiacs, updateZodiacPositions } from './zodiac.js';

// ============================================================================
// Israel Detection (GeoJSON)
// ============================================================================

const IL_GEOJSON_CACHE_KEY = 'zc:israel-geojson:v1';

async function loadGeoJSON() {
  // Subsequent boots: read from localStorage and refresh in the background.
  const cached = localStorage.getItem(IL_GEOJSON_CACHE_KEY);
  if (cached) {
    try {
      state.israelGeoJSON = JSON.parse(cached);
      // Refresh silently — do not block the first paint on this.
      fetch('il.json')
        .then(r => r.json())
        .then(data => {
          state.israelGeoJSON = data;
          try { localStorage.setItem(IL_GEOJSON_CACHE_KEY, JSON.stringify(data)); } catch {}
        })
        .catch(() => {});
      return;
    } catch {
      // Cached value was corrupt; fall through to a fresh fetch.
    }
  }

  // First boot: must await before continuing.
  try {
    const response = await fetch('il.json');
    const data = await response.json();
    state.israelGeoJSON = data;
    try { localStorage.setItem(IL_GEOJSON_CACHE_KEY, JSON.stringify(data)); } catch {}
  } catch (err) {
    console.warn("Could not load Israel GeoJSON:", err);
  }
}

function inIsrael(lat, lon) {
  if (!state.israelGeoJSON) return false;
  const pt = point([lon, lat]);
  const polygon = state.israelGeoJSON.features[0];
  return booleanPointInPolygon(pt, polygon);
}

// ============================================================================
// Weather Update System (Non-disruptive)
// ============================================================================

let weatherUpdateInterval = null;

/**
 * Silently update weather without disrupting UI state
 */
async function silentWeatherUpdate() {
  try {
    await fetchWeather();
    
    // Update vegetation season if weather changed significantly
    updateVegetationSeason();
    
    // Update person clothing
    updatePersonClothing();
  } catch (err) {
    console.warn('Silent weather update failed:', err);
  }
}

/**
 * Start the weather update interval (every 10 minutes)
 */
function startWeatherUpdates() {
  // Clear any existing interval
  if (weatherUpdateInterval) {
    clearInterval(weatherUpdateInterval);
  }
  
  // Update every 10 minutes (600000ms)
  weatherUpdateInterval = setInterval(silentWeatherUpdate, 600000);
  
}

// ============================================================================
// Geolocation
// ============================================================================

const LAST_LOCATION_KEY = 'zc:last-location:v1';

function getLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by this browser.");
    return;
  }

  if (!window.isSecureContext) {
    alert("Location requires HTTPS. Please open this site over https:// (localhost is OK).");
    return;
  }

  if (state.clockIntervalId) {
    clearInterval(state.clockIntervalId);
    state.clockIntervalId = null;
  }

  const startClockLoop = () => {
    // Start clock immediately
    updateClock();
    // Update every 20ms (50 FPS) for smoother animation
    // Previous value was 100ms (10 FPS)
    state.clockIntervalId = setInterval(updateClock, 50);
    startWeatherUpdates();

    // Fetch weather in background, then update clouds
    fetchWeather().then(() => {
      forceCloudUpdate();
      updateVegetationSeason();
      updatePersonClothing();
    }).catch(err => {
      console.warn('Initial weather fetch failed:', err);
    });
  };

  // Render immediately with the last known location while we wait for a fresh
  // geolocation fix. Eliminates the multi-second blank wait on repeat visits.
  const cached = localStorage.getItem(LAST_LOCATION_KEY);
  if (cached) {
    try {
      const { lat, lon, timezone } = JSON.parse(cached);
      if (typeof lat === 'number' && typeof lon === 'number') {
        state.latitude = lat;
        state.longitude = lon;
        if (timezone) state.timezone = timezone;
        startClockLoop();
      }
    } catch {}
  }

  const onSuccess = (position) => {
    state.latitude = position.coords.latitude;
    state.longitude = position.coords.longitude;

    try {
      localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({
        lat: state.latitude,
        lon: state.longitude,
        timezone: state.timezone
      }));
    } catch {}

    // If we already started from cache, the loop is already running — just
    // let the next tick pick up the fresh coords. Otherwise, kick it off now.
    if (!state.clockIntervalId) {
      startClockLoop();
    }
  };

  const showError = (error) => {
    const messages = {
      [error.PERMISSION_DENIED]:
        "Location permission is blocked. Enable it for this site in your browser settings, then refresh.",
      [error.POSITION_UNAVAILABLE]:
        "Location is unavailable (device/network can't provide a fix). Try switching networks or disabling VPN.",
      [error.TIMEOUT]:
        "Location request timed out. Retrying…",
      [error.UNKNOWN_ERROR]:
        "An unknown location error occurred."
    };
    // Drop the boot overlay so the location picker stays reachable even when
    // we never get a fix. updateClock() bails out early without coords, so
    // nothing else hides it for us in this branch.
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
    alert(messages[error.code] || "Error getting location.");
  };

  const lowAccuracyOpts = { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 };
  const highAccuracyOpts = { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 };

  navigator.geolocation.getCurrentPosition(
    onSuccess,
    (err) => {
      if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
        navigator.geolocation.getCurrentPosition(onSuccess, showError, highAccuracyOpts);
        return;
      }
      showError(err);
    },
    lowAccuracyOpts
  );
}

// ============================================================================
// Day Navigation
// ============================================================================

function changeDay(direction) {
  if (direction === 0) {
    // Full reset - back to current time
    state.daysAhead = 0;
    state.offset = 0;
    state.speedMultiplier = 0;
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    updateSpeedIndicator();
  } else {
    state.daysAhead += direction;
  }
  updateResetButton();
}

// Debounce timer for day button clicks
let dayButtonDebounceTimer = null;

function setupDayButtons() {
  // New button IDs
  const dayBtns = [
    { id: 'btn-prev-day', change: -1 },
    { id: 'btn-next-day', change: 1 },
    { id: 'btn-reset', change: 0 }
  ];
  
  const handleDayButtonClick = (change) => {
    changeDay(change);
    
    // Clear existing debounce timer
    if (dayButtonDebounceTimer) {
      clearTimeout(dayButtonDebounceTimer);
      // Cancel pending cloud spawns on rapid navigation
      cancelPendingCloudSpawns();
    }
    
    // Debounce the heavy work - wait 80ms of no clicks before full update
    dayButtonDebounceTimer = setTimeout(() => {
      dayButtonDebounceTimer = null;
      document.getElementById("sun-times").innerHTML = '';
      updateClock();
    }, 80);
  };
  
  dayBtns.forEach(button => {
    const btn = document.getElementById(button.id);
    if (btn) {
      btn.addEventListener('click', () => handleDayButtonClick(button.change));
    }
  });
  
  // Also support legacy button IDs
  DAY_BUTTONS.forEach(button => {
    const btn = document.getElementById(button.id);
    if (btn) {
      btn.addEventListener('click', () => handleDayButtonClick(button.change));
    }
  });
}

// ============================================================================
// Speed Navigation
// ============================================================================

function handleSpeedButtonClick(change) {
  if (change === 0) {
    state.speedMultiplier = 0;
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.offset = 0;
    updateSpeedIndicator();
    updateClock();
    return;
  }
  
  const speedLevels = [-100, -10, 0, 10, 100];
  const currentIndex = speedLevels.indexOf(state.speedMultiplier);
  
  if (change === 1 && currentIndex < speedLevels.length - 1) {
    state.speedMultiplier = speedLevels[currentIndex + 1];
  } else if (change === -1 && currentIndex > 0) {
    state.speedMultiplier = speedLevels[currentIndex - 1];
  }
  
  clearInterval(state.intervalId);
  state.intervalId = setInterval(() => {
    state.offset += 1000 * state.speedMultiplier;
  }, 10);
  
  updateSpeedIndicator();
}

function updateSpeedIndicator() {
  // Multiplier text intentionally hidden — the visible animation rate plus
  // the forward/reverse button icons are signal enough.
  const indicator = document.getElementById('speed-indicator');
  if (!indicator) return;
  indicator.classList.remove('visible');
  indicator.textContent = '';
}

function setupSpeedButtons() {
  // New button IDs
  const speedBtns = [
    { id: 'btn-speed-back', change: -1 },
    { id: 'btn-speed-fwd', change: 1 }
  ];
  
  speedBtns.forEach(button => {
    const btn = document.getElementById(button.id);
    if (btn) {
      btn.addEventListener('click', () => {
        handleSpeedButtonClick(button.change);
        updateResetButton();
      });
    }
  });
  
  // Also support legacy button IDs
  SPEED_BUTTONS.forEach(button => {
    const btn = document.getElementById(button.id);
    if (btn) {
      btn.addEventListener('click', () => {
        handleSpeedButtonClick(button.change);
        updateResetButton();
      });
    }
  });
}

// ============================================================================
// Toolbar Toggle
// ============================================================================

// ============================================================================
// Terrain Mode Toggle (Compass View)
// ============================================================================

function setupTerrainToggle() {
  const terrainBtn = document.getElementById('btn-terrain');
  if (!terrainBtn) return;

  // Compass mode now also drives zodiac visibility — one toggle, two layers.
  const savedMode = localStorage.getItem('compassMode');
  if (savedMode === 'true') {
    document.body.classList.add('compass-mode');
    terrainBtn.classList.add('active');
    updateZodiacPositions(state.date, state.observer, { force: true });
  }

  terrainBtn.addEventListener('click', () => {
    const isActive = document.body.classList.toggle('compass-mode');
    terrainBtn.classList.toggle('active', isActive);
    updateZodiacPositions(state.date, state.observer, { force: true });
    localStorage.setItem('compassMode', isActive);
  });
}

// Stale 'zodiacMode' flag from the previous standalone toggle — clear it once
// so it doesn't linger in localStorage on existing clients.
try { localStorage.removeItem('zodiacMode'); } catch {}

// main.js

function setupToolbarToggle() {
  const toggle = document.getElementById('toolbar-toggle');
  const controls = document.getElementById('controls-container');
  
  if (!toggle || !controls) return;
  
  toggle.addEventListener('click', () => {
    const isOpening = !controls.classList.contains('visible');
    
    toggle.classList.toggle('active');
    controls.classList.toggle('visible');
    
    // If closing toolbar, also close popups
    if (!isOpening) {
      const locationWrapper = document.getElementById('location-wrapper');
      const calendarWrapper = document.getElementById('calendar-wrapper');
      if (locationWrapper) locationWrapper.style.display = 'none';
      if (calendarWrapper) calendarWrapper.style.display = 'none';
    }
  });
}

// ============================================================================
// Kiddush Levana display
// ============================================================================

// Cached previous values per-span so we only touch the DOM when something
// visibly changes. Color applies only to the number span, per spec.
let klLastHebrew = null;
let klLastNumber = null;
let klLastEmoji  = null;
let klLastColor  = null;
let klLastVisible = null;

function updateKidushLevana() {
  const root = document.getElementById('kidush-levana');
  if (!root) return;

  const hebrewEl = root.querySelector('.kl-hebrew');
  const numberEl = root.querySelector('.kl-number');
  const emojiEl  = root.querySelector('.kl-emoji');
  if (!hebrewEl || !numberEl || !emojiEl) return;

  const s = getKidushLevanaState(state.date);

  if (s === null) {
    if (klLastVisible !== false) {
      root.style.display = 'none';
      klLastVisible = false;
    }
    return;
  }

  if (klLastVisible !== true) {
    root.style.display = '';
    klLastVisible = true;
  }

  if (s.hebrew !== klLastHebrew) {
    hebrewEl.textContent = s.hebrew;
    klLastHebrew = s.hebrew;
  }
  if (s.number !== klLastNumber) {
    numberEl.textContent = s.number;
    klLastNumber = s.number;
  }
  if (s.emoji !== klLastEmoji) {
    emojiEl.textContent = s.emoji;
    klLastEmoji = s.emoji;
  }
  if (s.color !== klLastColor) {
    numberEl.style.color = s.color;
    klLastColor = s.color;
  }
}

// ============================================================================
// Main Update Loop
// ============================================================================

let lastSlowUpdate = 0;
let firstFrameDone = false;
let firstFrameTime = 0;
const bootStart = performance.now();

function updateClock() {
  if (state.latitude === null || state.longitude === null) return;
  
  // Skip if we're in a polar location state
  if (window._polarLocationActive) return;
  
  // 1. CALCULATE ACTUAL TIME
  const baseNow = Date.now();
  const navigationOffset = state.offset || 0;
  const daysAheadOffset = (state.daysAhead || 0) * 24 * 60 * 60 * 1000;

  const actualTime = baseNow + navigationOffset + daysAheadOffset;
  state.date = new Date(actualTime);

  // 2. CALCULATE SUN TIMES (with polar region check)
  try {
    calcSunTimes(state.latitude, state.longitude);
  } catch (err) {
    if (err.isPolarLocation) {
      window._polarLocationActive = true;
      showPolarLocationPopup();
      return;
    }
    console.error('Error calculating sun times:', err);
    return;
  }
  
  // 3. FAST UPDATES (Run every frame - ~50fps)
  // These are lightweight and critical for smooth animation
  setClockHand();
  setDigitalTimes();
  updateKidushLevana();

  // Handle Atmosphere & Scene
  const elevation = setAtmosphere();
  updateSceneVisuals(elevation);

  positionMoon();

  // 4. SLOW UPDATES (Throttled to ~10fps)
  // These involve heavier DOM manipulation (creating/destroying elements)
  // We skip them if less than 100ms has passed since the last update
  const now = Date.now();
  if (now - lastSlowUpdate > 100) {
    setDate(inIsrael);

    // Update special day status (minor fasts, erev pesach)
    const dayStatus = getSpecialDayStatus(inIsrael(state.latitude, state.longitude));
    specialDayStatus.isMinorFast = dayStatus.isMinorFast;
    specialDayStatus.showBiurChametz = dayStatus.showBiurChametz;

    // Add biur chametz time if needed
    addBiurChametzTime();

    placeSunTimes();
    updateZodiacPositions(state.date, state.observer);
    lastSlowUpdate = now;
  }

  // Hide the boot overlay as soon as we've painted real content once. Doing
  // this here (instead of at the end of init()) lets us drop it the moment
  // the cached-location code path produces a usable frame.
  if (!firstFrameDone) {
    firstFrameDone = true;
    firstFrameTime = performance.now();
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }
}

// ============================================================================
// Zodiac diagnostics
//
// Run window.zodiacDebug() in the browser console to see the altitude /
// azimuth / hour-angle the math currently produces for each zodiac at
// state.date. The "highest altitude" row should be the zodiac the sun is
// currently in (sidereal/IAU), since that constellation crosses the meridian
// alongside the sun. Use this to diagnose any apparent placement off-by-one.
// ============================================================================

import('./zodiac.js').then(({ ZODIAC_DATA }) => import('./astronomy.js').then(({ Astronomy }) => {
  window.zodiacDebug = function zodiacDebug() {
    if (!state.observer || !state.date) {
      console.warn('zodiacDebug: observer / date not yet ready');
      return;
    }
    const lstHours = Astronomy.SiderealTime(state.date) + state.observer.longitude / 15;
    const rows = ZODIAC_DATA.map(sign => {
      const horizon = Astronomy.Horizon(
        state.date, state.observer,
        sign.equatorial.ra, sign.equatorial.dec, 'normal'
      );
      let ha = (lstHours - sign.equatorial.ra) % 24;
      if (ha > 12)  ha -= 24;
      if (ha < -12) ha += 24;
      return {
        key: sign.key,
        name: sign.name,
        lambda_deg: sign.longitude,
        ra_h: +sign.equatorial.ra.toFixed(3),
        dec_deg: +sign.equatorial.dec.toFixed(2),
        hourAngle_h: +ha.toFixed(3),
        altitude_deg: +horizon.altitude.toFixed(2),
        azimuth_deg: +horizon.azimuth.toFixed(2),
      };
    }).sort((a, b) => b.altitude_deg - a.altitude_deg);
    console.log(
      `zodiacDebug @ ${state.date.toISOString()} | observer (${state.observer.latitude.toFixed(2)}, ${state.observer.longitude.toFixed(2)}) | LST = ${(((lstHours % 24) + 24) % 24).toFixed(3)}h`
    );
    console.table(rows);
    return rows;
  };
}));

// ============================================================================
// Calendar Integration
// ============================================================================

function setupCalendarEvents() {
  // Original calendar toggle logic
  const legacyToggle = document.getElementById('calendar-toggle');
  if (legacyToggle) {
    legacyToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrap = document.getElementById('calendar-wrapper');
      const locationWrap = document.getElementById('location-wrapper');
      // Hide location popup when opening calendar
      if (locationWrap) locationWrap.style.display = 'none';
      if (wrap) {
        wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
      }
    });
  }
  
  // New calendar button in toolbar
  const calBtn = document.getElementById('btn-calendar');
  if (calBtn) {
    calBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrap = document.getElementById('calendar-wrapper');
      const locationWrap = document.getElementById('location-wrapper');
      // Hide location popup when opening calendar
      if (locationWrap) locationWrap.style.display = 'none';
      if (wrap) {
        wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
      }
    });
  }
  
  // Debounce timer for calendar date selection
  let calendarDebounceTimer = null;
  
  // Listen for calendar date selection
  window.addEventListener('calendarDateSelected', (e) => {
    const { gDate } = e.detail;
    
    // Calculate how many days ahead/behind from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffMs = gDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    
    // Reset speed if running
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    state.speedMultiplier = 0;
    state.offset = 0;
    
    // Set the day offset immediately for responsive feel
    state.daysAhead = diffDays;
    
    // Clear existing debounce timer
    if (calendarDebounceTimer) {
      clearTimeout(calendarDebounceTimer);
      // Cancel pending cloud spawns on rapid navigation to prevent memory buildup
      cancelPendingCloudSpawns();
    }
    
    // Debounce the heavy work - wait 100ms of no clicks before full update
    // This prevents memory accumulation during rapid clicking
    calendarDebounceTimer = setTimeout(() => {
      calendarDebounceTimer = null;
      
      // Clear and rebuild sun times display
      document.getElementById("sun-times").innerHTML = '';
      
      // Update the clock
      updateClock();
      updateResetButton();
      updateSpeedIndicator();
    }, 100);
    
    // Don't close calendar - allow user to click through multiple days
  });
}
// ============================================================================
// Location Change Handler
// ============================================================================

/**
 * Show popup for polar locations where zmanim can't be calculated
 */
function showPolarLocationPopup() {
  // Don't create duplicate popups
  if (document.getElementById('polar-popup')) return;
  
  // Stop the clock interval to prevent repeated errors
  if (state.clockIntervalId) {
    clearInterval(state.clockIntervalId);
    state.clockIntervalId = null;
  }
  
  const popup = document.createElement('div');
  popup.id = 'polar-popup';
  popup.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: linear-gradient(145deg, rgba(30, 40, 60, 0.98), rgba(20, 28, 45, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1rem;
    padding: 2rem;
    max-width: 90%;
    width: 320px;
    text-align: center;
    color: white;
    font-family: 'Heebo', 'Inter', sans-serif;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  `;
  
  content.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: 1rem;">🌍</div>
    <h3 style="margin: 0 0 1rem; font-size: 1.2rem; font-weight: 600;">Location Not Supported</h3>
    <p style="margin: 0 0 1.5rem; font-size: 0.95rem; line-height: 1.5; color: rgba(255,255,255,0.8);">
      Zmanim are not available for this location.<br>
      <strong style="color: #4a9eff;">Consult a Rov.</strong>
    </p>
    <button id="polar-popup-close" style="
      background: #4a9eff;
      border: none;
      color: white;
      padding: 0.75rem 2rem;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    ">OK</button>
  `;
  
  popup.appendChild(content);
  document.body.appendChild(popup);
  
  const closePopup = () => {
    popup.remove();
    // DON'T reset the polar flag here - it stays true until valid location is set
  };
  
  document.getElementById('polar-popup-close').addEventListener('click', closePopup);
  popup.addEventListener('click', (e) => {
    if (e.target === popup) closePopup();
  });
}

function setupLocationChangeHandler() {
  window.addEventListener('locationChanged', async (e) => {
    const { lat, lon, timezone, isCustom } = e.detail;
    
    const overlay = document.getElementById('loading-overlay');
    
    // Store previous state for potential rollback
    const prevLat = state.latitude;
    const prevLon = state.longitude;
    const prevTimezone = state.timezone;
    
    // Temporarily set for testing
    state.date = state.date || new Date();
    state.timezone = timezone;

    try {
      // Pre-test if this location supports zmanim calculation
      try {
        calcSunTimes(lat, lon);
      } catch (err) {
        if (err.isPolarLocation) {
          showPolarLocationPopup();
          
          // Revert state
          state.latitude = prevLat;
          state.longitude = prevLon;
          state.timezone = prevTimezone;
          
          // Dispatch event to revert location UI
          window.dispatchEvent(new CustomEvent('locationReverted', {
            detail: { lat: prevLat, lon: prevLon }
          }));
          
          if (overlay) overlay.style.display = 'none';
          return;
        }
        throw err;
      }
      
      // Location is valid - clear polar flag and update state
      window._polarLocationActive = false;
      state.latitude = lat;
      state.longitude = lon;
      
      // Restart clock interval if it was stopped
      if (!state.clockIntervalId) {
        state.clockIntervalId = setInterval(updateClock, 1000);
      }
            
      // Force cloud regeneration for new location
      forceCloudUpdate();
      
      // Update season-dependent visuals
      updateVegetationSeason();
      updatePersonClothing();
      
      // Now update clock
      updateClock();
      
    } catch (err) {
      console.error('Error updating location visuals:', err);
      updateClock();
    } finally {
      if (overlay) overlay.style.display = 'none';
    }
  });
}

// ============================================================================
// Updated Reset Button
// ============================================================================

// Override the updateResetButton to work with new structure
const originalUpdateResetButton = updateResetButton;

// Monkey-patch to also update new reset button
window.updateResetButtonNew = function() {
  // Call original
  originalUpdateResetButton();
  
  // Also update new reset button
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    if (state.daysAhead !== 0 || state.intervalId !== null) {
      resetBtn.classList.add('visible');
    } else {
      resetBtn.classList.remove('visible');
    }
  }
};

// ============================================================================
// Initialization
// ============================================================================

async function init() {
  await loadGeoJSON();
  generateTerrain();
  generateVegetation();
  initStars();
  initWeatherEffects();
  initBirds();
  positionClockNumbers();
  renderZodiacs();
  setupDayButtons();
  setupSpeedButtons();
  setupToolbarToggle();
  setupTerrainToggle();
  setupCalendarEvents();
  setupLocationChangeHandler();
  
  // Initialize calendar module
  await initCalendar();
  
  // Initialize location module
  await initLocation();
  
  // Get location and start clock — overlay is now hidden inside updateClock()
  // on the first painted frame, not here.
  getLocation();

  if (location.search.includes('perf')) {
    // Wait until we've actually painted something before sampling.
    const sampleWhenReady = () => {
      if (!firstFrameDone) {
        setTimeout(sampleWhenReady, 50);
        return;
      }
      logBootPerf();
    };
    sampleWhenReady();
  }
}

// ============================================================================
// Boot perf instrumentation (gated behind ?perf)
// ============================================================================

function logBootPerf() {
  const resources = performance.getEntriesByType('resource');
  const turf = resources.find(r => r.name.includes('@turf/turf'));

  console.group('⏱ Zman Clock boot perf');
  console.log(`Total boot → first paint: ${Math.round(firstFrameTime - bootStart)} ms`);
  console.log(`Resources fetched: ${resources.length}`);

  if (turf) {
    const transferred = turf.transferSize ?? turf.encodedBodySize ?? 0;
    console.log(
      `Turf module: ${turf.duration.toFixed(0)} ms `
      + `(transferred ${transferred} B, decoded ${turf.decodedBodySize ?? '?'} B, `
      + `${turf.transferSize === 0 ? 'served from disk cache' : 'from network'})`
    );
  } else {
    console.log('Turf module: not found in resource list (cached at script eval?)');
  }

  console.log('Top 10 slowest resources:');
  console.table(
    resources
      .map(r => ({
        url: r.name.replace(/^https?:\/\//, '').slice(0, 70),
        ms: Math.round(r.duration),
        bytes: r.transferSize ?? 0
      }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 10)
  );

  if (state.israelGeoJSON) {
    // 1k iterations to amortize cost of performance.now() and the loop itself.
    const lat = state.latitude ?? 31.78;
    const lon = state.longitude ?? 35.22;
    const N = 1000;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) inIsrael(lat + (i % 7) * 0.001, lon);
    const avg = (performance.now() - t0) / N;
    console.log(`inIsrael() avg over ${N} calls: ${avg.toFixed(4)} ms`);
  }

  console.groupEnd();
}

// Event listeners
window.addEventListener('load', init);
window.addEventListener('resize', () => {
  positionClockNumbers();
  updateZodiacPositions(state.date, state.observer, { force: true });
  if (state.latitude !== null) {
    updateClock();
  }
});
