// ============================================================================
// location.js - Location Picker with Map, Zip Code, and City Search
// Uses Leaflet.js (free, no API key) and Nominatim for geocoding
// ============================================================================

import { state } from './config.js';
import { processWeatherData } from './weather.js';

// Location state
export const locationState = {
  customLat: null,
  customLon: null,
  isCustomLocation: false,
  timezone: null,
  map: null,
  marker: null
};

// Initialize Leaflet CSS
function loadLeafletCSS() {
  if (!document.querySelector('link[href*="leaflet"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
}

// Load Leaflet JS dynamically
async function loadLeafletJS() {
  if (window.L) return window.L;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Initialize location module
 */
export function initLocation() {
  loadLeafletCSS();
  setupLocationButton();
  setupTabSwitching();
  setupZipCodeSearch();
  setupCitySearch();
  setupResetButton();
  setupClickOutside();
  // Listen for location revert (from polar location error)
  window.addEventListener('locationReverted', (e) => {
    const { lat, lon } = e.detail;
    
    // Revert location state
    locationState.customLat = null;
    locationState.customLon = null;
    locationState.isCustomLocation = false;
    
    // Update map marker if map exists
    if (locationState.map && locationState.marker && lat && lon) {
      locationState.marker.setLatLng([lat, lon]);
      locationState.map.setView([lat, lon], 10);
      updateMapCoords(lat, lon);
    }
    
    updateLocationIndicator(false);
  });
}

/**
 * Setup location button toggle
 */
function setupLocationButton() {
  const btn = document.getElementById('btn-location');
  const wrapper = document.getElementById('location-wrapper');
  
  if (!btn || !wrapper) return;
  
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    const isVisible = wrapper.style.display !== 'none';
    
    // Hide calendar popup when opening location (mutual exclusion)
    const calendarWrapper = document.getElementById('calendar-wrapper');
    if (calendarWrapper) calendarWrapper.style.display = 'none';
    
    wrapper.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      // Initialize map when popup opens (if not already)
      await initMap();
    }
  });
}

/**
 * Initialize Leaflet map
 * FIXED: Better tile loading, error handling, and invalidateSize timing
 */
async function initMap() {
  const mapContainer = document.getElementById('location-map');
  if (!mapContainer) return;
  
  // If map already exists, just refresh it
  if (locationState.map) {
    // Force multiple invalidateSize calls to fix dark tiles
    locationState.map.invalidateSize();
    setTimeout(() => locationState.map.invalidateSize(), 100);
    setTimeout(() => locationState.map.invalidateSize(), 300);
    return;
  }
  
  try {
    const L = await loadLeafletJS();
    
    // Clear loading indicator
    mapContainer.innerHTML = '';
    
    // Use current location or default
    const lat = state.latitude || 31.7769; 
    const lon = state.longitude || 35.2224;
    
    // Create map with enhanced zoom
    locationState.map = L.map('location-map', {
      center: [lat, lon],
      zoom: 10,
      zoomControl: true,
      zoomDelta: 2,
      zoomSnap: 1,
      wheelPxPerZoomLevel: 60
    });
    
    // Add OpenStreetMap tiles with better error handling
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      keepBuffer: 4,
      updateWhenZooming: false,
      updateWhenIdle: true,
      // Error handling for tiles
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    });
    
    // Handle tile loading errors
    tileLayer.on('tileerror', function(error) {
      console.warn('Tile load error, retrying...', error.coords);
      // Retry loading after a short delay
      setTimeout(() => {
        error.tile.src = error.tile.src;
      }, 1000);
    });
    
    // Handle when all tiles are loaded
    tileLayer.on('load', function() {
      // Extra invalidateSize after tiles load to fix any rendering issues
      if (locationState.map) {
        locationState.map.invalidateSize();
      }
    });
    
    tileLayer.addTo(locationState.map);
    
    // Add draggable marker
    locationState.marker = L.marker([lat, lon], {
      draggable: true
    }).addTo(locationState.map);
    
    // Update coordinates on marker drag
    locationState.marker.on('dragend', function(e) {
      const pos = e.target.getLatLng();
      updateMapCoords(pos.lat, pos.lng);
    });
    
    // Update marker on map click
    locationState.map.on('click', function(e) {
      locationState.marker.setLatLng(e.latlng);
      updateMapCoords(e.latlng.lat, e.latlng.lng);
    });
    
    // Update initial coordinates display
    updateMapCoords(lat, lon);
    
    // Setup confirm button
    setupMapConfirm();
    
    // Fix map size with multiple calls to handle different rendering timings
    // This is the key fix for dark tiles
    const refreshMap = () => {
      if (locationState.map) {
        locationState.map.invalidateSize();
      }
    };
    
    // Immediate
    refreshMap();
    // After CSS transitions
    setTimeout(refreshMap, 100);
    // After popup animation completes
    setTimeout(refreshMap, 300);
    // Final safety check
    setTimeout(refreshMap, 500);
    
  } catch (err) {
    console.error('Failed to initialize map:', err);
    mapContainer.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 2rem;">Failed to load map. Please try zip code or city search.</p>';
  }
}

function cleanLonData(lon) {
  // Wraps longitude to stay between -180 and 180
  // This handles both positive (East) and negative (West) overflows
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

/**
 * Update coordinates display
 */
function updateMapCoords(lat, lon) {
  // Fixes value overflow for longitude values
  lon = cleanLonData(lon);
  const coordsEl = document.getElementById('map-coords');
  if (coordsEl) {
    coordsEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
  // Store temporarily for confirm
  locationState.customLat = lat;
  locationState.customLon = lon;
}

/**
 * Setup map confirm button
 */
function setupMapConfirm() {
  const btn = document.getElementById('map-confirm-btn');
  if (!btn) return;
  
  btn.addEventListener('click', async () => {
    if (locationState.customLat && locationState.customLon) {
      await applyCustomLocation(locationState.customLat, locationState.customLon);
      closeLocationPopup();
    }
  });
}

/**
 * Setup tab switching
 * FIXED: Better map refresh when switching to map tab
 */
function setupTabSwitching() {
  const tabs = document.querySelectorAll('input[name="locationTab"]');
  
  tabs.forEach(tab => {
    tab.addEventListener('change', (e) => {
      const value = e.target.value;
      
      // Hide all tab contents
      document.querySelectorAll('.location-tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      // Show selected tab
      const selectedTab = document.getElementById(`tab-${value}`);
      if (selectedTab) {
        selectedTab.classList.add('active');
      }
      
      // Refresh map size if map tab - multiple calls to fix dark tiles
      if (value === 'map' && locationState.map) {
        const refreshMap = () => locationState.map.invalidateSize();
        setTimeout(refreshMap, 50);
        setTimeout(refreshMap, 150);
        setTimeout(refreshMap, 300);
      }
    });
  });
}

/**
 * Setup zip code search
 */
function setupZipCodeSearch() {
  const btn = document.getElementById('zip-search-btn');
  const input = document.getElementById('zip-input');
  const country = document.getElementById('zip-country');
  const result = document.getElementById('zip-result');
  
  if (!btn || !input) return;
  
  const doSearch = async () => {
    const zip = input.value.trim();
    if (!zip) return;
    
    result.innerHTML = '<p class="searching"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</p>';
    
    try {
      const countryCode = country?.value || 'US';
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&country=${countryCode}&format=json&limit=1`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'ZmanClock/1.0' } }
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const place = data[0];
        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);
        
        // CLICKABLE CARD: Logic moved to the container div
        result.innerHTML = `
          <div class="location-result-item" role="button">
            <div>
              <div class="result-name"><i class="fa-solid fa-location-dot"></i> ${place.display_name}</div>
              <div class="result-coords">${lat.toFixed(4)}, ${lon.toFixed(4)}</div>
            </div>
            <i class="fa-solid fa-chevron-right" style="opacity:0.5;"></i>
          </div>
        `;
        
        // Add click listener to the whole item
        const item = result.querySelector('.location-result-item');
        item.addEventListener('click', async () => {
          await applyCustomLocation(lat, lon);
          closeLocationPopup();
        });
        
      } else {
        result.innerHTML = '<p class="no-results">No location found for this zip code</p>';
      }
      
    } catch (err) {
      console.error('Zip search error:', err);
      result.innerHTML = '<p class="error">Search failed. Please try again.</p>';
    }
  };
  
  btn.addEventListener('click', doSearch);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doSearch();
  });
}

/**
 * Setup city search
 */
function setupCitySearch() {
  const btn = document.getElementById('city-search-btn');
  const input = document.getElementById('city-input');
  const result = document.getElementById('city-result');
  
  if (!btn || !input) return;
  
  const doSearch = async () => {
    const query = input.value.trim();
    if (!query) return;
    
    result.innerHTML = '<p class="searching"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</p>';
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1&dedupe=1`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'ZmanClock/1.0' } }
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        // Create list of clickable items
        result.innerHTML = data.map((place, index) => {
          const lat = parseFloat(place.lat);
          const lon = parseFloat(place.lon);
          // Store data in attributes to retrieve on click
          return `
            <div class="location-result-item" role="button" data-index="${index}">
              <div>
                <div class="result-name"><i class="fa-solid fa-location-dot"></i> ${place.display_name.split(',')[0]}</div>
                <div class="result-coords" style="font-size:0.7em; opacity:0.7;">${place.display_name}</div>
              </div>
              <i class="fa-solid fa-check" style="color:#4a9eff; display:none;"></i>
            </div>
          `;
        }).join('');
        
        // Attach listeners
        const items = result.querySelectorAll('.location-result-item');
        items.forEach((item, index) => {
           item.addEventListener('click', async () => {
             const place = data[index];
             await applyCustomLocation(parseFloat(place.lat), parseFloat(place.lon));
             closeLocationPopup();
           });
        });
        
      } else {
        result.innerHTML = '<p class="no-results">No locations found.</p>';
      }
      
    } catch (err) {
      console.error('City search error:', err);
      result.innerHTML = '<p class="error">Search failed. Please try again.</p>';
    }
  };
  
  btn.addEventListener('click', doSearch);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doSearch();
  });
}

/**
 * Setup reset button - Fetches fresh current location
 */
function setupResetButton() {
  const btn = document.getElementById('location-reset-btn');
  if (!btn) return;
  
  btn.addEventListener('click', () => {
    // Show loading overlay
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      if (overlay) overlay.style.display = 'none';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        // Apply this location, but mark isCustom as FALSE (this is the "Auto" location)
        await applyCustomLocation(lat, lon, false);
        
        closeLocationPopup();
      },
      (err) => {
        console.error("Error resetting location:", err);
        alert("Could not retrieve current location. Please check permissions.");
        if (overlay) overlay.style.display = 'none';
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 } // maximumAge: 0 forces fresh result
    );
  });
}

/**
 * Setup click outside to close
 */
function setupClickOutside() {
  document.addEventListener('mousedown', (e) => {
    const wrapper = document.getElementById('location-wrapper');
    const btn = document.getElementById('btn-location');
    const calendarWrapper = document.getElementById('calendar-wrapper');
    const controlsContainer = document.getElementById('controls-container');
    const toolbarToggle = document.getElementById('toolbar-toggle');
    
    // Don't close if clicking inside the popup
    if (wrapper?.contains(e.target)) return;
    
    // Don't close if clicking the location button (it toggles)
    if (btn?.contains(e.target)) return;
    
    // Don't close if clicking inside controls container
    if (controlsContainer?.contains(e.target)) return;
    
    // Don't close if clicking toolbar toggle
    if (toolbarToggle?.contains(e.target)) return;
    
    // Close if clicking outside and popup is visible
    if (wrapper && wrapper.style.display !== 'none') {
      wrapper.style.display = 'none';
    }
  });
}

/**
 * Close location popup
 */
function closeLocationPopup() {
  const wrapper = document.getElementById('location-wrapper');
  if (wrapper) {
    wrapper.style.display = 'none';
  }
}

/**
 * Apply location (Custom or Auto-Reset)
 * @param {number} lat 
 * @param {number} lon 
 * @param {boolean} isCustom - true for manual search, false for auto-detect/reset
 */
async function applyCustomLocation(lat, lon, isCustom = true) {  
  // Store previous state for rollback on error
  const prevLat = state.latitude;
  const prevLon = state.longitude;
  const prevTimezone = state.timezone;
  const prevCustomLat = locationState.customLat;
  const prevCustomLon = locationState.customLon;
  const prevIsCustom = locationState.isCustomLocation;
  
  // Show loading overlay immediately
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'flex';

  try {
    // 1. Fetch timezone FIRST before changing any state
    const tz = await getTimezoneForLocation(lat, lon);
    
    // 2. Only update state after successful timezone fetch
    state.latitude = lat;
    state.longitude = lon;
    state.timezone = tz;
    
    // Only set custom state if this is explicitly a custom search
    if (isCustom) {
      locationState.customLat = lat;
      locationState.customLon = lon;
    } else {
      locationState.customLat = null;
      locationState.customLon = null;
    }
    
    locationState.isCustomLocation = isCustom;
    locationState.timezone = tz;
    
    // 3. Update map marker
    if (locationState.map && locationState.marker) {
      locationState.marker.setLatLng([lat, lon]);
      locationState.map.setView([lat, lon], 10);
      updateMapCoords(lat, lon); // Update the text display too
    }
    
    updateLocationIndicator(isCustom);
    
    // 4. Dispatch event with all data - main.js handles the rest
    window.dispatchEvent(new CustomEvent('locationChanged', {
      detail: { lat, lon, isCustom, timezone: tz }
    }));
    
  } catch (err) {
    console.error('Location change failed, reverting:', err);
    
    // Rollback all state
    state.latitude = prevLat;
    state.longitude = prevLon;
    state.timezone = prevTimezone;
    locationState.customLat = prevCustomLat;
    locationState.customLon = prevCustomLon;
    locationState.isCustomLocation = prevIsCustom;
    
    // Revert map marker if needed
    if (locationState.map && locationState.marker && prevLat && prevLon) {
      locationState.marker.setLatLng([prevLat, prevLon]);
      locationState.map.setView([prevLat, prevLon], 10);
      updateMapCoords(prevLat, prevLon);
    }
    
    updateLocationIndicator(prevIsCustom);
    alert("Failed to update location data. Please check connection.");
  } finally {
    // Hide overlay
    if (overlay) overlay.style.display = 'none';
  }
}

/**
 * Update location button indicator AND Reset button visibility
 */
function updateLocationIndicator(isCustom) {
  // Update the Toolbar Button
  const btn = document.getElementById('btn-location');
  if (btn) {
    if (isCustom) {
      btn.classList.add('custom-location');
    } else {
      btn.classList.remove('custom-location');
    }
  }

  // Update the Reset Button inside the popup
  const resetBtn = document.getElementById('location-reset-btn');
  if (resetBtn) {
    if (isCustom) {
      resetBtn.classList.add('visible');
    } else {
      resetBtn.classList.remove('visible');
    }
  }
}

/**
 * Get timezone for a location using free API with retry and multiple fallbacks
 */
export async function getTimezoneForLocation(lat, lon) {
  // Use Open-Meteo to get BOTH timezone and weather in one shot
  // We mirror the params from weather.js to ensure data consistency
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: [
      'temperature_2m',
      'apparent_temperature', 
      'weather_code',
      'cloud_cover',
      'precipitation',
      'wind_speed_10m',
      'snowfall',
      'is_day',
      'relative_humidity_2m',
      'wind_direction_10m',
      'wind_gusts_10m'
    ].join(','),
    timezone: 'auto', // This triggers the timezone lookup
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh'
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  
  // Allow retries
  let tries = 3; 
  while (tries > 0) {
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        
        // PRE-LOAD THE WEATHER STATE!
        // This avoids fetching weather again in main.js
        processWeatherData(data);
        
        return data.timezone;
    } catch (error) {
        tries -= 1;
        console.error("Failed to fetch timezone/weather:", error);
    }
  }
  
  // API failed - use longitude-based estimate
  const fallbackTz = estimateTimezoneFromLongitude(lon, lat);
  console.warn(`Timezone API failed, using estimate: ${fallbackTz}`);
  return fallbackTz;
}

/**
 * Estimate timezone from longitude (and latitude for edge cases)
 */
function estimateTimezoneFromLongitude(lon, lat) {
  // More accurate mapping based on longitude ranges
  // This handles most common cases reasonably well
  
  // Special cases for specific regions
  if (lat > 60 && lon > -30 && lon < 40) return 'Europe/London'; // Northern Europe
  if (lat > 20 && lat < 45 && lon > 25 && lon < 45) return 'Asia/Jerusalem'; // Middle East
  if (lat > 20 && lat < 55 && lon > 100 && lon < 150) return 'Asia/Shanghai'; // China/East Asia
  if (lat > -50 && lat < 0 && lon > 110 && lon < 160) return 'Australia/Sydney'; // Australia
  
  // General longitude-based estimation
  const offsetHours = Math.round(lon / 15);
  
  const timezoneMap = {
    '-12': 'Etc/GMT+12', '-11': 'Pacific/Midway', '-10': 'Pacific/Honolulu',
    '-9': 'America/Anchorage', '-8': 'America/Los_Angeles', '-7': 'America/Denver',
    '-6': 'America/Chicago', '-5': 'America/New_York', '-4': 'America/Halifax',
    '-3': 'America/Sao_Paulo', '-2': 'Atlantic/South_Georgia', '-1': 'Atlantic/Azores',
    '0': 'Europe/London', '1': 'Europe/Paris', '2': 'Europe/Berlin',
    '3': 'Europe/Moscow', '4': 'Asia/Dubai', '5': 'Asia/Karachi',
    '6': 'Asia/Dhaka', '7': 'Asia/Bangkok', '8': 'Asia/Shanghai',
    '9': 'Asia/Tokyo', '10': 'Australia/Sydney', '11': 'Pacific/Noumea', '12': 'Pacific/Auckland'
  };
  
  return timezoneMap[String(offsetHours)] || Intl.DateTimeFormat().resolvedOptions().timeZone;
}