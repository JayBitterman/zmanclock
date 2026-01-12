// ============================================================================
// hebrew.js - Hebrew calendar and date utilities
// ============================================================================

import * as hcal from 'https://cdn.jsdelivr.net/npm/@hebcal/core@5.5.0/+esm';
import * as jDate from 'https://cdn.jsdelivr.net/npm/jewish-date@2.0.12/+esm';
import { state, WEEKDAY, MODERN_HOLIDAYS, DUB_PARSHA, OMER_DAY } from './config.js';

// Re-export for use in other modules
export { hcal, jDate };

// hebrew.js

/**
 * Updates the Hebrew date based on current time relative to tzeis
 * Now explicitly uses the target timezone to prevent "local time" rollover bugs
 */
export function updateHebrewDate(tzeis) {
  // 1. Get the current date components in the TARGET timezone
  const tz = state.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  
  // Format to parts to parse reliably
  const parts = formatter.formatToParts(state.date);
  const getPart = (type) => parseInt(parts.find(p => p.type === type).value, 10);
  
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');

  // 2. Create the HDate for "Today" (before sunset)
  // Use noon to avoid any edge cases with date boundaries
  const todayAtNoon = new Date(year, month - 1, day, 12, 0, 0);
  const todayHDate = new hcal.HDate(todayAtNoon);
  
  // 3. Determine if we are after Tzeis (conceptually "Tomorrow" in Hebrew)
  if (state.date < tzeis) {
    state.hdate = todayHDate;
  } else {
    // If after tzeis, we simply take the next Hebrew date
    state.hdate = todayHDate.next();
  }
}

/**
 * Gets formatted Hebrew date string
 * Uses target timezone to determine the correct Gregorian date
 */
export function getHebrewDateString() {
  // Get the date components in the TARGET timezone
  const tz = state.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  
  const parts = formatter.formatToParts(state.date);
  const getPart = (type) => parseInt(parts.find(p => p.type === type).value, 10);
  
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  
  // Create a date at noon in that calendar day (to avoid any edge cases)
  // This represents "today" in the target timezone
  const todayGregorian = new Date(year, month - 1, day, 12, 0, 0);
  
  // Create "tomorrow" in the target timezone
  const tomorrowGregorian = new Date(year, month - 1, day + 1, 12, 0, 0);
  
  let dateString;
  if (state.date < state.sunTimes['צאת']) {
    dateString = jDate.toHebrewJewishDate(jDate.toJewishDate(todayGregorian));
  } else {
    dateString = jDate.toHebrewJewishDate(jDate.toJewishDate(tomorrowGregorian));
  }
  
  return `${dateString.day} ${dateString.monthName} ${dateString.year}`;
}

/**
 * Gets the day of week string(s) for display
 */
export function getDayOfWeekDisplay() {
  const dow = WEEKDAY[state.date.getDay()];
  const tomorrowDow = WEEKDAY[(state.date.getDay() + 1) % 7];
  
  if (state.date >= state.sunTimes["צאת"]) {
    return tomorrowDow;
  } else if (state.date >= state.sunTimes["sunset"]) {
    return dow + "/" + tomorrowDow;
  }
  return dow;
}

/**
 * Checks if tomorrow is a Yom Tov (for candle lighting)
 * @param {boolean} inIsrael - Whether the user is in Israel
 */
export function checkYomTov(inIsrael) {
  const tomEvents = hcal.HebrewCalendar.getHolidaysOnDate(state.hdate.next());
  let hasChag = false;
  
  if (tomEvents) {
    for (const e of tomEvents) {
      if (inIsrael && e.getFlags() & hcal.flags.CHUL_ONLY) continue;
      if (!inIsrael && e.getFlags() & hcal.flags.IL_ONLY) continue;
      
      if (e.getFlags() & hcal.flags.CHAG) {
        hasChag = true;
        break;
      }
    }
  }
  
  return hasChag;
}

/**
 * Gets holidays for display
 * @param {boolean} inIsrael - Whether the user is in Israel
 */
export function getHolidays(inIsrael) {
  const events = hcal.HebrewCalendar.getHolidaysOnDate(state.hdate);
  const holidays = [];
  
  if (events) {
    for (const e of events) {
      if (inIsrael && e.getFlags() & hcal.flags.CHUL_ONLY) continue;
      if (!inIsrael && e.getFlags() & hcal.flags.IL_ONLY) continue;
      
      let holidayText = e.render('he').replace(/[\u0591-\u05C70-9]/g, '');
      
      // Correct Hanukkah display
      if (holidayText.includes("חנוכה")) {
        const hanukkahMap = {
          "חנוכה: א׳ נר": "",
          "חנוכה: ב׳ נרות": "חנוכה: יום א׳",
          "חנוכה: ג׳ נרות": "חנוכה: יום ב׳",
          "חנוכה: ד׳ נרות": "חנוכה: יום ג׳",
          "חנוכה: ה׳ נרות": "חנוכה: יום ד׳",
          "חנוכה: ו׳ נרות": "חנוכה: יום ה׳",
          "חנוכה: ז׳ נרות": "חנוכה: יום ו׳",
          "חנוכה: ח׳ נרות": "חנוכה: יום ז׳"
        };
        holidayText = hanukkahMap[holidayText] ?? holidayText;
      }
      
      // Exclude modern holidays
      if (MODERN_HOLIDAYS.includes(holidayText)) continue;
      
      if (holidayText) holidays.push(holidayText);
    }
  }
  
  return holidays;
}

/**
 * Gets the weekly sedra (Torah portion)
 * @param {boolean} inIsrael - Whether the user is in Israel
 */
export function getSedra(inIsrael) {
  let sedra = new hcal.Sedra(state.hdate.getFullYear(), inIsrael)
    .getString(state.hdate, 'he')
    .replace(/[\u0591-\u05C7]/g, '');
  
  if (sedra in DUB_PARSHA) {
    sedra = DUB_PARSHA[sedra];
  }
  
  return sedra;
}

/**
 * Gets Omer count if applicable
 */
export function getOmerCount() {
  const mm = state.hdate.mm;
  const dd = state.hdate.dd;
  
  if ((mm === 1 && dd >= 16) || mm === 2 || (mm === 3 && dd < 6)) {
    const omerDayNum = OMER_DAY[(mm * 100 + dd)];
    if (omerDayNum) {
      return new hcal.OmerEvent(state.hdate, omerDayNum)
        .render('he')
        .replace(/[\u0591-\u05C7]/g, '');
    }
  }
  
  return null;
}

/**
 * Convert number to Hebrew numeral for days 1-31
 */
export function numberToHebrewNumeral(num) {
  if (num < 1 || num > 31 || isNaN(num)) return num.toString();
  
  if (num === 15) return "ט\"ו";
  if (num === 16) return "ט\"ז";
  
  const units = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל"];
  
  if (num >= 1 && num <= 9) return units[num];
  if (num === 10) return tens[1];
  if (num >= 11 && num <= 19) return tens[1] + units[num - 10];
  if (num >= 20 && num <= 29) return tens[2] + units[num - 20];
  if (num === 30) return tens[3];
  if (num === 31) return tens[3] + units[1];
  
  return num.toString();
}