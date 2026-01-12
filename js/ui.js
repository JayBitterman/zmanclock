import { state } from './config.js';
import { calculateSeasonalTime, Astronomy } from './astronomy.js';
import { 
  getHebrewDateString, 
  getDayOfWeekDisplay, 
  getHolidays, 
  getSedra, 
  getOmerCount,
  checkYomTov,
  updateHebrewDate
} from './hebrew.js';

// Helper function to blend colors based on sun elevation
function lerpColor(color1, color2, factor) {
  // Simple helper to blend hex colors. 
  // You might want to use a library for HSL, but this works for RGB/Hex
  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);

  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Sets the digital times (standard and seasonal) displayed on the clock
 */
export function setDigitalTimes() {
  const digitalTimeHolder = document.getElementById("digital-time");
  const sDigitalTimeHolder = document.getElementById("seasonal-time");
  
  if (!digitalTimeHolder || !sDigitalTimeHolder) return;

  const tz = state.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeString = state.date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: tz
  });
  
  // OPTIMIZATION: Only update DOM if text changed
  if (digitalTimeHolder.textContent !== timeString) {
    digitalTimeHolder.textContent = timeString;
  }
    
  // Seasonal time
  const { isDay, totalSeasonalMinutes } = calculateSeasonalTime();
  
  const seasonalHour = Math.floor(totalSeasonalMinutes / 60);
  const seasonalMinute = Math.floor(totalSeasonalMinutes % 60);
  const fractionalMinute = totalSeasonalMinutes % 1;
  const totalChalakim = Math.floor(fractionalMinute * 18);
  
  const stimeString = `${seasonalHour}:${seasonalMinute.toString().padStart(2, '0')}:${totalChalakim.toString().padStart(2, '0')} ${isDay ? 'ביום' : 'בלילה'}`;
  
  // OPTIMIZATION: Only update DOM if text changed
  if (sDigitalTimeHolder.textContent !== stimeString) {
    sDigitalTimeHolder.textContent = stimeString;
  }
}

// ui.js

/**
 * Sets the date, day of week, and holidays on the clock
 * @param {Function} inIsraelFn - Function to check if user is in Israel
 */
export function setDate(inIsraelFn) {
  // Update Hebrew date first
  updateHebrewDate(state.sunTimes['tzeis']);
  
  const dateHolder = document.getElementById("date");
  const dowHolder = document.getElementById("day-of-week");
  const holidayHolder = document.getElementById("holiday");
  const omerHolder = document.getElementById("omer");
  
  if (!dateHolder || !dowHolder || !holidayHolder || !omerHolder) return;
  
  const inIsrael = inIsraelFn(state.latitude, state.longitude);
  
  // --- FIX START: Get Date/Day info relative to Timezone ---
  const tz = state.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // 1. Get Day of Week Index (0-6) for the target timezone
  // We use a trick: format 'weekday' as 'numeric' returns a string "1" (Monday) to "7" (Sunday) or similar depending on locale, 
  // but standard 'en-US' 'weekday: short' is easier to map if we just use the date string.
  // Better approach: Create a Date object that is shifted by the offset so .getDay() works, 
  // OR just use Intl to print the name directly.
  
  // Let's print the Hebrew day name based on the target Gregorian date
  const dowFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short' // "Sun", "Mon", etc.
  });
  const dowString = dowFormatter.format(state.date);
  
  // Map English short days to your WEEKDAY config (Assuming config.js is ordered Sun-Sat)
  const englishDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowIndex = englishDays.indexOf(dowString);
  
  // Import these from config if not available, or hardcode the array here for safety:
  const HEBREW_WEEKDAYS = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];
  const currentDayName = HEBREW_WEEKDAYS[dowIndex];
  const nextDayName = HEBREW_WEEKDAYS[(dowIndex + 1) % 7];
  
  // 2. Determine display string based on sunset/tzeis
  let displayDow;
  if (state.date >= state.sunTimes["tzeis"]) {
    displayDow = nextDayName;
  } else if (state.date >= state.sunTimes["sunset"]) {
    displayDow = currentDayName + "/" + nextDayName;
  } else {
    displayDow = currentDayName;
  }
  
  if (dowHolder.textContent !== displayDow) {
    dowHolder.textContent = displayDow;
  }
  
  // 3. Format Date String (MM/DD/YYYY) in target timezone
  const datePartsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: 'numeric', day: 'numeric'
  });
  const dateFormatted = datePartsFormatter.format(state.date); // "1/6/2026"
  // --- FIX END ---
  
  // Hebrew date text
  const hDateStr = getHebrewDateString();
  if (dateHolder.textContent !== hDateStr) {
    dateHolder.textContent = hDateStr;
  }
  
  // Omer count
  const omer = getOmerCount() || "";
  if (omerHolder.textContent !== omer) {
    omerHolder.textContent = omer;
  }
  
  // Handle candle lighting
  // We use the HDate's greg() function to compare dates, but we must ensure we compare apples to apples
  // The 'dateFormatted' we calculated above is the correct "wall clock" date string
  // Format hdateFormatted in the same way to ensure proper comparison
  const hdateGreg = state.hdate.greg();
  const hdateFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: 'numeric', day: 'numeric'
  }).format(new Date(hdateGreg.getFullYear(), hdateGreg.getMonth(), hdateGreg.getDate(), 12, 0, 0)); 
  
  const hasChag = checkYomTov(inIsrael);
  
  // Logic: If it is Friday (or Erev Chag) AND the Hebrew date matches the Gregorian date
  // (Note: This logic checks if today is the day to light candles)
  if ((displayDow.includes("יום שישי") || hasChag) && hdateFormatted === dateFormatted) {
    // Ensure candle lighting exists in sunTimes, calculate if missing (18 min before sunset)
    if (!state.sunTimes["🕯️🕯️"]) {
       state.sunTimes["🕯️🕯️"] = new Date(state.sunTimes["sunset"].getTime() - 18 * 60000);
    }
  } else if (document.getElementById('🕯️🕯️') && !hasChag) {
    // Remove if it exists and shouldn't
    const el = document.getElementById('🕯️🕯️');
    if (el) el.remove();
    delete state.sunTimes["🕯️🕯️"];
  }
  
  // Holidays
  // Only update if holidays changed to avoid DOM thrashing
  const holidays = getHolidays(inIsrael);
  const sedra = getSedra(inIsrael);
  
  // Quick check if we need to update
  // We construct the HTML string and compare it
  let newHtml = '';
  for (const holidayText of holidays) {
    newHtml += `<div>${holidayText}</div>`;
  }
  newHtml += `<div>${sedra}</div>`;
  
  if (holidayHolder.innerHTML !== newHtml) {
    holidayHolder.innerHTML = newHtml;
  }
}

export function setAtmosphere() {
    // Calculate Sun Elevation
    const sunPos = Astronomy.Equator('Sun', state.date, state.observer, true, true);
    const sunHor = Astronomy.Horizon(state.date, state.observer, sunPos.ra, sunPos.dec, 'normal');
    const elevation = sunHor.altitude;

    // --- COLOR PALETTE ---
    const C = {
        deepNight: "#000000",
        nightBlue: "#0a101e",
        twilightPurple: "#2d2045",
        sunsetRed: "#b84e3d",
        sunsetOrange: "#d98d45",
        dayBlueTop: "#4A90E2",
        dayBlueBot: "#87CEEB"
    };

    const root = document.documentElement;
    let top, bot, glowOpacity, terrainBright;

    // --- LOGIC ---
    if (elevation > 10) { 
        // DAY
        top = C.dayBlueTop; bot = C.dayBlueBot;
        glowOpacity = 0; terrainBright = 1.0;
    } 
    else if (elevation > 0) { 
        // GOLDEN HOUR (10° down to 0°)
        const t = (10 - elevation) / 10;
        top = lerpColor(C.dayBlueTop, C.twilightPurple, t);
        bot = lerpColor(C.dayBlueBot, C.sunsetOrange, t);
        glowOpacity = t * 0.8;
        terrainBright = 1.0 - (t * 0.3);
    } 
    else if (elevation > -12) { 
        // TWILIGHT (0° down to -12°)
        const t = (0 - elevation) / 12;
        top = lerpColor(C.twilightPurple, C.deepNight, t);
        bot = lerpColor(C.sunsetRed, C.nightBlue, t);
        glowOpacity = (1 - t) * 0.6; // Fade out glow
        terrainBright = 0.7 - (t * 0.5); // Get dark
    } 
    else { 
        // NIGHT
        top = C.deepNight; bot = C.nightBlue;
        glowOpacity = 0; terrainBright = 0.25;
    }

    // Apply CSS Variables
    document.getElementById('screen').style.background = `linear-gradient(to bottom, ${top}, ${bot})`;
    root.style.setProperty('--horizon-glow-opacity', glowOpacity);
    root.style.setProperty('--terrain-brightness', terrainBright);
    root.style.setProperty('--terrain-contrast', elevation < 0 ? 1.2 : 1.0); // Higher contrast at night

    return elevation; // Return for use in main.js
}

function updatePersonState(elevation) {
    // Logic to swap the person image based on context
    // Example: If it's very late, maybe he's holding a lantern?
    // Or if it's Shabbos (check state.sunTimes), change attire.
}

/**
 * Updates the reset button visibility (both legacy and new)
 */
export function updateResetButton() {
  // Legacy reset button
  const resetButton = document.getElementById('reset');
  // New reset button
  const newResetButton = document.getElementById('btn-reset');
  
  const shouldShow = state.daysAhead !== 0 || state.intervalId !== null;
  
  if (resetButton) {
    if (shouldShow) {
      resetButton.classList.add('visible');
    } else {
      resetButton.classList.remove('visible');
    }
  }
  
  if (newResetButton) {
    if (shouldShow) {
      newResetButton.classList.add('visible');
    } else {
      newResetButton.classList.remove('visible');
    }
  }
}
