// ============================================================================
// astronomy.js - Sun and Moon astronomical calculations
// ============================================================================

import * as Astronomy from 'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/+esm';
import { state, RISING, SETTING } from './config.js';

// Re-export Astronomy for use in other modules
export { Astronomy };

/**
 * Get timezone offset in milliseconds for a given timezone at a given date
 */
function getTimezoneOffsetMs(timezone, date) {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return utcDate.getTime() - tzDate.getTime();
}

/**
 * Calculates various sun times and related times for the given location and date.
 * @param {number} latitude - Latitude of the location
 * @param {number} longitude - Longitude of the location
 */
export function calcSunTimes(latitude, longitude) {
  const addTime = (baseTime, msToAdd) => new Date(baseTime.getTime() + msToAdd);

  // Create observer
  state.observer = new Astronomy.Observer(latitude, longitude, state.elevation);
  
  // Calculate "today" in the TARGET timezone (or local if no custom timezone)
  const tz = state.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Get the year, month, and day parts specifically for the target timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(state.date);

  const getPart = (type) => parts.find(p => p.type === type).value;
  const targetYear = parseInt(getPart('year'));
  const targetMonth = parseInt(getPart('month')) - 1;
  const targetDay = parseInt(getPart('day'));

  // Create a date object representing midnight in that specific timezone
  const todayDate = new Date(Date.UTC(targetYear, targetMonth, targetDay));

  // Find the offset for this specific date in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric'
  });

  const dtString = formatter.format(todayDate);
  const [datePart, timePart] = dtString.split(', ');
  const [m, d, y] = datePart.split('/');
  const [h, min, s] = timePart.split(':');

  const localMidnight = new Date(Date.UTC(y, m-1, d, h, min, s));
  const tzOffsetMs = todayDate.getTime() - localMidnight.getTime();

  todayDate.setTime(todayDate.getTime() + tzOffsetMs);
    
  const nextDate = new Date(todayDate);
  nextDate.setDate(todayDate.getDate() + 1);
  const prevDate = new Date(todayDate);
  prevDate.setDate(todayDate.getDate() - 1);

  // Calculate sunrise and sunset
  const sunrise = Astronomy.SearchRiseSet('Sun', state.observer, RISING, todayDate, 1);
  const sunset = Astronomy.SearchRiseSet('Sun', state.observer, SETTING, todayDate, 1);
  const nextSunrise = Astronomy.SearchRiseSet('Sun', state.observer, RISING, nextDate, 1);
  const prevSunset = Astronomy.SearchRiseSet('Sun', state.observer, SETTING, prevDate, 1);

  if (!sunrise || !sunset || !nextSunrise || !prevSunset) {
    const error = new Error('POLAR_LOCATION');
    error.isPolarLocation = true;
    throw error;
  }

  // Calculate day length and hour
  const dayLengthMs = sunset.date.getTime() - sunrise.date.getTime();
  const dayHourMs = dayLengthMs / 12;

  // Dawn (Alos Hashachar) at -16.1 degrees
  const dawn = Astronomy.SearchAltitude('Sun', state.observer, RISING, todayDate, 1, -16.1);

  // Magen Avraham calculations
  const rTamDegrees = Astronomy.SearchAltitude('Sun', state.observer, SETTING, todayDate, 1, -16.1);
  
  if (!dawn || !rTamDegrees) {
    const error = new Error('POLAR_LOCATION');
    error.isPolarLocation = true;
    throw error;
  }
  
  const mgaDayLengthMs = rTamDegrees.date.getTime() - dawn.date.getTime();
  const mgaDayHourMs = mgaDayLengthMs / 12;

  const mshyaker = Astronomy.SearchAltitude('Sun', state.observer, RISING, todayDate, 1, -10.2);
  const tzeis = Astronomy.SearchAltitude('Sun', state.observer, SETTING, todayDate, 1, -8.5);
  const rTam = addTime(sunset.date, 72 * 60 * 1000);
  
  let midnight;
  if (rTam <= state.date) {
    midnight = new Date((sunset.date.getTime() + nextSunrise.date.getTime()) / 2);
  } else {
    midnight = new Date((prevSunset.date.getTime() + sunrise.date.getTime()) / 2);
  }

  const midday = addTime(sunrise.date, dayLengthMs / 2);

  state.sunTimes = {
    'sunrise': sunrise.date,
    'sunset': sunset.date,
    'alos': dawn.date,
    'misheyakir': mshyaker?.date || dawn.date,
    'tzeis': tzeis?.date || sunset.date,
    'chatzos': midday,
    'rTam': rTam,
    'plagHamincha': addTime(sunrise.date, 10.75 * dayHourMs),
    'minchaKetana': addTime(sunrise.date, 9.5 * dayHourMs),
    'minchaGedola': addTime(midday, Math.max(0.5 * 60 * 60 * 1000, dayHourMs / 2)),
    'shemaGra': addTime(sunrise.date, 3 * dayHourMs),
    'tefilaGra': addTime(sunrise.date, 4 * dayHourMs),
    'shemaMga': addTime(dawn.date, 3 * mgaDayHourMs),
    'chatzosLayla': midnight,
    'prevSunset': prevSunset.date,
    'nextSunrise': nextSunrise.date
  };
}

// Hebrew display names for zmanim (mapped from English keys)
export const ZMAN_DISPLAY_NAMES = {
  'alos': 'עלות',
  'misheyakir': 'ציצית', 
  'tzeis': 'צאת',
  'chatzos': 'חצות היום',
  'rTam': "ר' תם",
  'plagHamincha': 'פלג המנחה',
  'minchaKetana': 'מנחה קטנה',
  'minchaGedola': 'מנחה גדולה',
  'shemaGra': 'שמע גר"א',
  'tefilaGra': 'תפילה גר"א',
  'shemaMga': 'שמע מג"א',
  'chatzosLayla': 'חצות הלילה',
  'sunrise': 'נץ',
  'sunset': 'שקיעה',
  'biurChametz': 'סו"ז ביעור חמץ'
};

// Track special day status for display name modifications
export let specialDayStatus = {
  isMinorFast: false,
  isErevPesach: false,
  showBiurChametz: false
};

/**
 * Get the display name for a zman, with modifications for special days
 * @param {string} name - The zman key name
 * @returns {string} - The Hebrew display name, possibly modified for special days
 */
export function getZmanDisplayName(name) {
  const baseName = ZMAN_DISPLAY_NAMES[name] || name;
  
  // For minor fasts, modify alos and tzeis display
  if (specialDayStatus.isMinorFast) {
    if (name === 'alos') {
      return 'עלות / תחילת צום';
    }
    if (name === 'tzeis') {
      return 'צאת / סוף צום';
    }
  }
  
  return baseName;
}

/**
 * Calculates and adds biur chametz time to sunTimes if needed
 * Biur chametz is at the end of the 5th hour of the day
 * Should be called after calcSunTimes
 */
export function addBiurChametzTime() {
  // Remove biur chametz if it shouldn't be shown
  if (!specialDayStatus.showBiurChametz) {
    if (state.sunTimes && state.sunTimes.biurChametz) {
      delete state.sunTimes.biurChametz;
      // Also remove the DOM element if it exists
      const el = document.getElementById('biurChametz');
      if (el) el.remove();
    }
    return;
  }
  
  if (!state.sunTimes) return;
  
  const sunrise = state.sunTimes.sunrise;
  const sunset = state.sunTimes.sunset;
  
  if (!sunrise || !sunset) return;
  
  // Calculate day length and hour
  const dayLengthMs = sunset.getTime() - sunrise.getTime();
  const dayHourMs = dayLengthMs / 12;
  
  // Biur chametz is at the END of the 5th hour (i.e., 5 hours after sunrise)
  const biurChametzTime = new Date(sunrise.getTime() + 5 * dayHourMs);
  
  state.sunTimes.biurChametz = biurChametzTime;
}

/**
 * Calculates the seasonal time (sha'ah zemanit) based on sunrise and sunset.
 */
export function calculateSeasonalTime() {
  let isDay, seasonalHourLength, seasonalHours, totalSeasonalMinutes;

  if (state.date >= state.sunTimes['sunrise'] && state.date < state.sunTimes['sunset']) {
    isDay = true;
    const dayLength = state.sunTimes['sunset'].getTime() - state.sunTimes['sunrise'].getTime();
    seasonalHourLength = dayLength / 12;
    const timeFromSunrise = state.date.getTime() - state.sunTimes['sunrise'].getTime();
    seasonalHours = timeFromSunrise / seasonalHourLength;
  } else {
    isDay = false;
    let nightLength, timeFromSunset;
    if (state.date >= state.sunTimes['sunset']) {
      nightLength = state.sunTimes['nextSunrise'].getTime() - state.sunTimes['sunset'].getTime();
      timeFromSunset = state.date.getTime() - state.sunTimes['sunset'].getTime();
    } else {
      nightLength = state.sunTimes['sunrise'].getTime() - state.sunTimes['prevSunset'].getTime();
      timeFromSunset = (state.date.getTime() - state.sunTimes['prevSunset'].getTime() + nightLength) % nightLength;
    }
    seasonalHourLength = nightLength / 12;
    seasonalHours = timeFromSunset / seasonalHourLength;
  }

  totalSeasonalMinutes = seasonalHours * 60;
  return { isDay, seasonalHours, totalSeasonalMinutes, seasonalHourLength };
}

/**
 * Calculates moon position and orientation for observer's view.
 * Correctly accounts for Parallactic Angle (q) and Bright Limb Angle (chi).
 * * @returns {object} Moon data including position and orientation
 */
export function calculateMoonData() {
  const date = state.date;
  const observer = state.observer;
  
  // 1. Get Equatorial Coordinates (Topocentric to account for parallax)
  const moonEq = Astronomy.Equator('Moon', date, observer, true, true);
  const sunEq = Astronomy.Equator('Sun', date, observer, true, true);
  
  const DEG2RAD = Math.PI / 180.0;
  const HOUR2RAD = 15.0 * DEG2RAD;

  const raM = moonEq.ra * HOUR2RAD;
  const decM = moonEq.dec * DEG2RAD;
  const raS = sunEq.ra * HOUR2RAD;
  const decS = sunEq.dec * DEG2RAD;
  const phi = observer.latitude * DEG2RAD;

  // 2. Position Angle of Bright Limb (Chi) - Celestial orientation
  const yChi = Math.cos(decS) * Math.sin(raS - raM);
  const xChi = Math.sin(decS) * Math.cos(decM) - Math.cos(decS) * Math.sin(decM) * Math.cos(raS - raM);
  const chi = Math.atan2(yChi, xChi);

  // 3. Parallactic Angle (q) - The "Observer's Tilt"
  // Calculate Local Sidereal Time to find the Hour Angle (H)
  const gst = Astronomy.SiderealTime(date);
  const lst = gst + (observer.longitude / 15.0);
  const H = (lst - moonEq.ra) * HOUR2RAD; 

  const yQ = Math.sin(H);
  const xQ = Math.tan(phi) * Math.cos(decM) - Math.sin(decM) * Math.cos(H);
  const q = Math.atan2(yQ, xQ);
  
  // 4. Final Visual Rotation (Zeta)
  // chi - q gives the angle relative to Zenith (Up).
  // We use q - chi to convert CCW (Astronomy) to CW (CSS).
  let zeta = q - chi;

  let rotationDeg = (zeta * (180.0 / Math.PI)) % 360;
  if (rotationDeg < 0) rotationDeg += 360;

  // 5. Normalizing for Waning/Waxing
  // The math above handles the 360 rotation perfectly.
  // If your moon icon starts "Lit on Right", we subtract 90 deg.
  const finalRotation = rotationDeg - 90;

  // Calculate Progress Angle for clock position
  const nextMoonrise = Astronomy.SearchRiseSet('Moon', observer, RISING, date, 365);
  const nextMoonset = Astronomy.SearchRiseSet('Moon', observer, SETTING, date, 365);
  const prevMoonrise = Astronomy.SearchRiseSet('Moon', observer, RISING, date, -365);
  const prevMoonset = Astronomy.SearchRiseSet('Moon', observer, SETTING, date, -365);

  let progressAngle;
  if (nextMoonset.date < nextMoonrise.date) {
    progressAngle = 180 * (date - prevMoonrise.date) / (nextMoonset.date - prevMoonrise.date);
  } else {
    progressAngle = 180 + 180 * (date - prevMoonset.date) / (nextMoonrise.date - prevMoonset.date);
  }

  return {
    progressAngle: progressAngle % 360,
    rotationDeg: finalRotation,
    phaseAngle: Astronomy.Illumination('Moon', date).phase_angle
  };
}