// ============================================================================
// config.js - Constants, settings, and shared state
// ============================================================================

// Hebrew labels for the hours on the clock
export const HOURS = [
  "נץ", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י",
  "יא", "שקיעה", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח",
  "ט", "י", "יא"
];

// Modern Israeli holidays to exclude
export const MODERN_HOLIDAYS = [
  "ראש השנה למעשר בהמה", "יום הזכרון", "יום העצמאות", "יום הרצל",
  "יום ירושלים", "יום ז׳בוטינסקי", "יום בןגוריון", "יום הזכרון ליצחק רבין",
  "שמירת בית הספר ליום העליה", "סיגד", "יום העליה", "יום השפה העברית", "חג הבנות"
];

// Mapping from date code to Omer day
export const OMER_DAY = {
  116: 1, 117: 2, 118: 3, 119: 4, 120: 5, 121: 6, 122: 7, 123: 8, 124: 9, 125: 10, 126: 11,
  127: 12, 128: 13, 129: 14, 130: 15, 201: 16, 202: 17, 203: 18, 204: 19, 205: 20, 206: 21,
  207: 22, 208: 23, 209: 24, 210: 25, 211: 26, 212: 27, 213: 28, 214: 29, 215: 30, 216: 31,
  217: 32, 218: 33, 219: 34, 220: 35, 221: 36, 222: 37, 223: 38, 224: 39, 225: 40, 226: 41,
  227: 42, 228: 43, 229: 44, 301: 45, 302: 46, 303: 47, 304: 48, 305: 49
};

// Hebrew names for weekdays
export const WEEKDAY = {
  0: "יום ראשון",
  1: "יום שני",
  2: "יום שלישי",
  3: "יום רביעי",
  4: "יום חמישי",
  5: "יום שישי",
  6: "שבת קודש"
};

// Double Parsha corrections
export const DUB_PARSHA = {
  "פרשת ויקהלפקודי": "פרשת ויקהל-פקודי",
  "פרשת תזריעמצרע": "פרשת תזריע-מצרע",
  "פרשת אחרי מותקדשים": "פרשת אחרי מות-קדשים",
  "פרשת בהרבחקתי": "פרשת בהר-בחקתי",
  "פרשת חקתבלק": "פרשת חקת-בלק",
  "פרשת מטותמסעי": "פרשת מטות-מסעי",
  "פרשת נצביםוילך": "פרשת נצבים-וילך"
};

// Direction constants
export const RISING = 1;
export const SETTING = -1;

// ============================================================================
// Shared State - Mutable application state
// ============================================================================

export const state = {
  // User location
  latitude: null,
  longitude: null,
  elevation: 0,
  
  // Timezone offset for custom locations (milliseconds)
  timezoneOffsetMs: 0,

  // Target timezone string (e.g., "Asia/Jerusalem")
  timezone: null,

  // Astronomy observer
  observer: null,
  
  // Time navigation
  daysAhead: 0,
  offset: 0,
  speedMultiplier: 0,
  intervalId: null,
  
  // Current date/time (updated each tick)
  date: null,
  hdate: null,
  
  // Calculated sun times
  sunTimes: {},
  
  // Sun angle for background
  sunTheta: 0,
  
  // Clock hand rotation tracking
  accumulatedRotation: 0,
  prevTotalDegrees: null,
  
  // GeoJSON for Israel detection
  israelGeoJSON: null
};

// ============================================================================
// Day & Speed Navigation Button Config
// ============================================================================

export const DAY_BUTTONS = [
  { id: 'yesterday', change: -1 },
  { id: 'tomorrow', change: 1 },
  { id: 'reset', change: 0 }
];

export const SPEED_BUTTONS = [
  { id: 'speed-forward', change: 1 },
  { id: 'speed-backward', change: -1 },
  { id: 'reset', change: 0 }
];