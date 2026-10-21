import { state, activeTimezone, getDateFormatter, CHELEK_MS } from './config.js';
import { calculateSeasonalTime } from './astronomy.js';
import { 
  getHebrewDateString, 
  getDayOfWeekDisplay, 
  getHolidays, 
  getSedra, 
  getOmerCount,
  checkYomTov,
  updateHebrewDate
} from './hebrew.js';

const CLOCK_TIME = { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true };
const WEEKDAY_SHORT = { weekday: 'short' };
const DAY_PARTS = { year: 'numeric', month: 'numeric', day: 'numeric' };

/** Set an element's text, touching the DOM only when it changed. */
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

/**
 * Sets the digital times (standard and seasonal) displayed on the clock
 */
export function setDigitalTimes() {
  const digitalTimeHolder = document.getElementById("digital-time");
  const sClockHolder = document.getElementById("seasonal-clock");
  const sChalakimHolder = document.getElementById("seasonal-chalakim");
  const sPeriodHolder = document.getElementById("seasonal-period");

  if (!digitalTimeHolder || !sClockHolder || !sChalakimHolder || !sPeriodHolder) return;

  const timeString = getDateFormatter(activeTimezone(), CLOCK_TIME).format(state.date);
  
  // OPTIMIZATION: Only update DOM if text changed
  if (digitalTimeHolder.textContent !== timeString) {
    digitalTimeHolder.textContent = timeString;
  }
    
  // Seasonal time
  const { isDay, totalSeasonalMinutes, seasonalHourLength } = calculateSeasonalTime();

  const seasonalHour = Math.floor(totalSeasonalMinutes / 60);
  const seasonalMinute = Math.floor(totalSeasonalMinutes % 60);
  const fractionalMinute = totalSeasonalMinutes % 1;
  const seasonalSecond = Math.floor(fractionalMinute * 60);

  // Chalakim are fixed 3⅓-second units, not seasonal: count the real time
  // elapsed since this seasonal minute began. A seasonal minute isn't 60 real
  // seconds, so the count runs past 17 on long days and stops short on short ones.
  const msIntoSeasonalMinute = fractionalMinute * seasonalHourLength / 60;
  const chalakim = Math.floor(msIntoSeasonalMinute / CHELEK_MS);

  setText(sClockHolder, `${seasonalHour}:${seasonalMinute.toString().padStart(2, '0')}:${seasonalSecond.toString().padStart(2, '0')}`);
  // The span is dir="rtl", so this reads in Hebrew order beside the LTR clock
  setText(sChalakimHolder, `(${chalakim} ${chalakim === 1 ? 'חלק' : 'חלקים'})`);
  setText(sPeriodHolder, isDay ? 'ביום' : 'בלילה');
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
  const parshaHolder = document.getElementById("parsha");
  const holidayHolder = document.getElementById("holiday");
  const omerHolder = document.getElementById("omer");

  if (!dateHolder || !dowHolder || !parshaHolder || !holidayHolder || !omerHolder) return;
  
  const inIsrael = inIsraelFn(state.latitude, state.longitude);
  
  // --- FIX START: Get Date/Day info relative to Timezone ---
  const tz = activeTimezone();

  // 1. Get Day of Week Index (0-6) for the target timezone
  // We use a trick: format 'weekday' as 'numeric' returns a string "1" (Monday) to "7" (Sunday) or similar depending on locale,
  // but standard 'en-US' 'weekday: short' is easier to map if we just use the date string.
  // Better approach: Create a Date object that is shifted by the offset so .getDay() works,
  // OR just use Intl to print the name directly.

  // Let's print the Hebrew day name based on the target Gregorian date
  const dowString = getDateFormatter(tz, WEEKDAY_SHORT).format(state.date); // "Sun", "Mon", etc.
  
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
  const datePartsFormatter = getDateFormatter(tz, DAY_PARTS);
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
  // Compare the Hebrew date's calendar day with the location's calendar day
  // ('dateFormatted', "M/D/YYYY"). Build the same string from greg()'s own
  // year/month/day; converting it through a clock time would shift it a day
  // whenever the location is 12+ hours from this device's timezone.
  const hdateGreg = state.hdate.greg();
  const hdateFormatted = `${hdateGreg.getMonth() + 1}/${hdateGreg.getDate()}/${hdateGreg.getFullYear()}`;
  
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
  
  // Parsha (sedra) lives in its own holder right under the date so it's
  // always the second row, never pushed third by holiday entries.
  const sedra = getSedra(inIsrael);
  if (parshaHolder.textContent !== sedra) {
    parshaHolder.textContent = sedra || '';
  }

  // Holidays follow below. Only update if changed to avoid DOM thrashing.
  const holidays = getHolidays(inIsrael);
  let newHtml = '';
  for (const holidayText of holidays) {
    newHtml += `<div>${holidayText}</div>`;
  }

  if (holidayHolder.innerHTML !== newHtml) {
    holidayHolder.innerHTML = newHtml;
  }
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