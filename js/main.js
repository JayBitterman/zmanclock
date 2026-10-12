// ============================================================================
// main.js - Main application entry point
// ============================================================================

import { point, booleanPointInPolygon } from 'https://cdn.jsdelivr.net/npm/@turf/turf@7.1.0/+esm';
import { state, DAY_BUTTONS, SPEED_BUTTONS } from './config.js';
import { calcSunTimes, specialDayStatus, addBiurChametzTime } from './astronomy.js';
import { positionClockNumbers, setClockHand, positionMoon, placeSunTimes } from './clock.js';
import { setDigitalTimes, setDate, updateResetButton } from './ui.js';
import { getSpecialDayStatus } from './hebrew.js';
import { initCalendar } from './calendar.js';
import { initSky, updateSky, invalidateSkyLayout } from './sky.js';
import { initMazalos, updateMazalos, animateMazalModeChange } from './mazalos.js';
import { generateLandscape, updateLandscape, updatePersonClothing } from './landscape.js';
import { initLocation } from './location.js';
import { getKidushLevanaState } from './kidushLevana.js';

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

// Called twice per slow update; only the location changes the answer.
let inIsraelCache = { lat: null, lon: null, geoJSON: null, result: false };

function inIsrael(lat, lon) {
  if (!state.israelGeoJSON) return false;
  const cache = inIsraelCache;
  if (cache.lat === lat && cache.lon === lon && cache.geoJSON === state.israelGeoJSON) {
    return cache.result;
  }
  const pt = point([lon, lat]);
  const polygon = state.israelGeoJSON.features[0];
  const result = booleanPointInPolygon(pt, polygon);
  inIsraelCache = { lat, lon, geoJSON: state.israelGeoJSON, result };
  return result;
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
    // Update every 50ms (20 FPS)
    state.clockIntervalId = setInterval(updateClock, 50);
    updatePersonClothing();
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
    // The hemisphere decides which way the sky view faces
    invalidateSkyLayout();
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
    
    // Debounce the heavy work - wait 80ms of no clicks before full update
    clearTimeout(dayButtonDebounceTimer);
    dayButtonDebounceTimer = setTimeout(() => {
      dayButtonDebounceTimer = null;
      document.getElementById("sun-times").innerHTML = '';
      updateClock();
      updatePersonClothing();
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

  // Compass mode also moves the mazalos from the clock ring out into the sky.
  const savedMode = localStorage.getItem('compassMode');
  if (savedMode === 'true') {
    document.body.classList.add('compass-mode');
    terrainBtn.classList.add('active');
    invalidateSkyLayout();
  }

  terrainBtn.addEventListener('click', () => {
    const isActive = document.body.classList.toggle('compass-mode');
    terrainBtn.classList.toggle('active', isActive);
    invalidateSkyLayout();
    animateMazalModeChange();
    if (state.latitude !== null) updateClock();
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

  // Sky, landscape lighting and the mazalos
  const sky = updateSky();
  updateLandscape(sky);
  updateMazalos(sky);

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
    
    // Debounce the heavy work - wait 100ms of no clicks before full update
    clearTimeout(calendarDebounceTimer);
    calendarDebounceTimer = setTimeout(() => {
      calendarDebounceTimer = null;
      
      // Clear and rebuild sun times display
      document.getElementById("sun-times").innerHTML = '';
      
      // Update the clock
      updateClock();
      updatePersonClothing();
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
        state.clockIntervalId = setInterval(updateClock, 50);
      }
            
      // Hemisphere and season may have changed
      invalidateSkyLayout();
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
  initSky();
  generateLandscape();
  initMazalos();
  positionClockNumbers();
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

// Resize events fire continuously while dragging or zooming; redraw once it settles.
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    positionClockNumbers();
    generateLandscape();
    invalidateSkyLayout();
    if (state.latitude !== null) {
      document.getElementById('sun-times').innerHTML = '';
      updateClock();
    }
  }, 150);
});
