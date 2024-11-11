// Import necessary modules
import * as Astronomy from 'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/+esm';
import * as hcal from 'https://cdn.jsdelivr.net/npm/@hebcal/core@5.5.0/+esm';
import * as jDate from 'https://cdn.jsdelivr.net/npm/jewish-date@2.0.12/+esm';
import { point, booleanPointInPolygon } from 'https://cdn.jsdelivr.net/npm/@turf/turf@7.1.0/+esm';

// Get the clock hand element
const singleHand = document.querySelector('.single-hand');

// Hebrew labels for the hours on the clock
const hours = ["נץ", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י",
  "יא", "שקיעה", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח",
  "ט", "י", "יא",
];

// Modern Israeli holidays to exclude
const modernHoliday = ["ראש השנה למעשר בהמה", "יום הזכרון", "יום העצמאות", "יום הרצל", "יום ירושלים", "יום ז׳בוטינסקי",
  "יום בןגוריון", "יום הזכרון ליצחק רבין", "שמירת בית הספר ליום העליה", "סיגד", "יום העליה", "יום השפה העברית", "חג הבנות"
];

// Mapping from date code to Omer day
const omerDay = {116: 1, 117: 2, 118: 3, 119: 4, 120: 5, 121: 6, 122: 7, 123: 8, 124: 9, 125: 10, 126: 11,
  127: 12, 128: 13, 129: 14, 130: 15, 201: 16, 202: 17, 203: 18, 204: 19, 205: 20, 206: 21,
  207: 22, 208: 23, 209: 24, 210: 25, 211: 26, 212: 27, 213: 28, 214: 29, 215: 30, 216: 31,
  217: 32, 218: 33, 219: 34, 220: 35, 221: 36, 222: 37, 223: 38, 224: 39, 225: 40, 226: 41,
  227: 42, 228: 43, 229: 44, 301: 45, 302: 46, 303: 47, 304: 48, 305: 49
};

// Hebrew names for weekdays
const weekday = {0: "יום ראשון", 1: "יום שני", 2: "יום שלישי", 3: "יום רביעי", 4: "יום חמישי", 5: "יום שישי", 6: "שבת קודש"};

// Constants for rise and set
const rising = 1;
const setting = -1;

// User's latitude and longitude
let usr_lat;
let usr_lon;

// Elevation above sea level (default 0)
let elevation = 0;

// Number of days ahead to display (default 0)
let days_ahead = 0;

// Angle of the sun hand
let sunTheta;

// Global variables for date and hdate
let date;     // Global date variable
let hdate;    // Global Hebrew date variable

// Variable to hold GeoJSON data for Israel
let israelGeoJSON;

/**
 * Asynchronously load the GeoJSON data for Israel.
 */
async function loadGeoJSON() {
  const response = await fetch('il.json');
  israelGeoJSON = await response.json();
}

// Immediately invoke the function to load GeoJSON
(async () => {
  await loadGeoJSON();
})();

function p(a){
    console.log(a);
}

/**
 * Get the user's current geolocation.
 */
function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      // Success function
      function (position) {
        usr_lat = position.coords.latitude;
        usr_lon = position.coords.longitude;
        updateClock(); // Call updateClock after location is retrieved
      },
      null,
      // Options
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }
}

/**
 * Calculates various sun times and related times for the given location and date.
 * @param {number} latitude - Latitude of the location
 * @param {number} longitude - Longitude of the location
 * @returns {object} sunTimes - An object containing calculated times
 */
function calcSunTimes(latitude, longitude) {
  // Helper function to add milliseconds to a Date object
  const addTime = (baseTime, msToAdd) => new Date(baseTime.getTime() + msToAdd);

  // Create an observer object for the given location
  const observer = new Astronomy.Observer(latitude, longitude, elevation);

  // Get the date for the calculation
  date = new Date();
  date.setDate(date.getDate() + days_ahead);
  const todayDate = new Date(date);
  todayDate.setHours(0, 0, 0, 0); // Set to midnight of the date

  // Get dates for tomorrow and yesterday
  const nextDate = new Date(todayDate);
  nextDate.setDate(todayDate.getDate() + 1);
  const prevDate = new Date(todayDate);
  prevDate.setDate(todayDate.getDate() - 1);

  // Calculate sunrise and sunset times
  const sunrise = Astronomy.SearchRiseSet('Sun', observer, rising, todayDate, 1);
  const sunset = Astronomy.SearchRiseSet('Sun', observer, setting, todayDate, 1);

  // Calculate next sunrise and previous sunset
  const nextSunrise = Astronomy.SearchRiseSet('Sun', observer, rising, nextDate, 1);
  const prevSunset = Astronomy.SearchRiseSet('Sun', observer, setting, prevDate, 1);

  // Calculate day length and day hour in milliseconds
  const dayLengthMs = sunset.date.getTime() - sunrise.date.getTime();
  const dayHourMs = dayLengthMs / 12;

  // Calculate dawn (Alos Hashachar) at -16.1 degrees
  const dawn = Astronomy.SearchAltitude('Sun', observer, rising, todayDate, 1, -16.1);

  // Calculate Magen Avraham day length and hour
  const rTamDegrees = Astronomy.SearchAltitude('Sun', observer, setting, todayDate, 1, -16.1);
  const mgaDayLengthMs = rTamDegrees.date.getTime() - dawn.date.getTime();
  const mgaDayHourMs = mgaDayLengthMs / 12;

  // Calculate Mesheyakir at -10.2 degrees
  const mshyaker = Astronomy.SearchAltitude('Sun', observer, rising, todayDate, 1, -10.2);

  // Calculate Tzeis at -8.5 degrees
  const tzeis = Astronomy.SearchAltitude('Sun', observer, setting, todayDate, 1, -8.5);

  // Calculate R' Tam time (72 minutes after sunset)
  const rTam = addTime(sunset.date, 72 * 60 * 1000); // 72 minutes in milliseconds

  // Calculate midnight
  let midnight;
  if (rTam <= date) {
    // After R' Tam, calculate midnight between sunset and next sunrise
    midnight = new Date((sunset.date.getTime() + nextSunrise.date.getTime()) / 2);
  } else {
    // Before R' Tam, calculate midnight between previous sunset and sunrise
    midnight = new Date((prevSunset.date.getTime() + sunrise.date.getTime()) / 2);
  }

  // Calculate midday
  const midday = addTime(sunrise.date, dayLengthMs / 2);

  // Set the Hebrew date
  if (date < tzeis.date) {
    hdate = new hcal.HDate(date);
  }
  else {
    hdate = new hcal.HDate(nextDate);
  }

  // Store calculated times in an object
  const sunTimes = {
    'sunrise': sunrise.date,
    'sunset': sunset.date,
    'עלות': dawn.date,
    'ציצית': mshyaker.date,
    'צאת': tzeis.date,
    'חצות היום': midday,
    "ר' תם": rTam,
    'פלג המנחה': addTime(sunrise.date, 10.75 * dayHourMs),
    'מנחה קטנה': addTime(sunrise.date, 9.5 * dayHourMs),
    'מנחה גדולה': addTime(midday, Math.max(0.5 * 60 * 60 * 1000, dayHourMs / 2)), // Ensure at least 30 minutes after midday
    'שמע גר"א': addTime(sunrise.date, 3 * dayHourMs),
    'תפילה גר"א': addTime(sunrise.date, 4 * dayHourMs),
    'שמע מג״א': addTime(dawn.date, 3 * mgaDayHourMs),
    'חצות הלילה': midnight,
    'prevSunset': prevSunset.date,
    'nextSunrise': nextSunrise.date
  };

  return sunTimes;
}

/**
 * Places the sun times on the clock face.
 * @param {object} sunTimes - An object containing calculated sun times
 */
function placeSunTimes(sunTimes) {
  const clockFace = document.querySelector('.clock-face');
  const clockRadius = (clockFace.offsetWidth) / 2;
  const sunTimesContainer = document.getElementById("sun-times");

  const radius = clockRadius;
  const todaySunrise = sunTimes.sunrise;
  const todaySunset = sunTimes.sunset;
  const tomorrowSunrise = sunTimes.nextSunrise;
  const yesterdaySunset = sunTimes.prevSunset;

  // Clear previous sun times
  sunTimesContainer.innerHTML = '';

  for (const [name, time] of Object.entries(sunTimes)) {
    if (name == "prevSunset" || name == "nextSunrise") {
      continue;
    }
    if (!(time instanceof Date) || isNaN(time.getTime())) {
      console.warn(`Invalid time for ${name}: ${time}`);
      continue;
    }

    // Create sun time element
    const sunTimeElement = document.createElement('div');
    sunTimeElement.setAttribute("id", name);
    sunTimeElement.classList.add('sun-time');    
    sunTimeElement.style.display = "grid";    
    sunTimeElement.style.alignItems = "center";

    if (name !== "sunset" && name !== "sunrise") {
        if (name == "צאת" || name == "ר' תם" || name == "עלות" || name == "ציצית" || name == "🕯️🕯️"){
            sunTimeElement.textContent = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + " " + name;
            sunTimeElement.style.whiteSpace = "nowrap";
        }
        else{
            const nameElement = document.createElement('div');
            nameElement.style.whiteSpace = "nowrap";
            nameElement.textContent = name;
            sunTimeElement.appendChild(nameElement);

            const timeElement = document.createElement('div');
            timeElement.style.whiteSpace = "nowrap";
            timeElement.textContent = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
            sunTimeElement.appendChild(timeElement);
        }
    }
    else {
        sunTimeElement.textContent = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
        sunTimeElement.style.whiteSpace = "nowrap";
    }

    sunTimesContainer.appendChild(sunTimeElement);

    // Calculate the angle for positioning
    let theta;
    if (time >= todaySunrise && time < todaySunset) {
      const curAngle = (time - todaySunrise) / (todaySunset - todaySunrise);
      theta = curAngle * -180;
    } else {
      let curAngle;
      if (time >= todaySunset) {
        curAngle = (time - todaySunset) / (tomorrowSunrise - todaySunset);
      } else {
        curAngle = (time - yesterdaySunset) / (todaySunrise - yesterdaySunset);
      }
      theta = (curAngle * -180) - 180;
    }

    // Calculate position on the clock face
    const radians = theta * (Math.PI / 180);
    let x = Math.cos(radians) * radius;
    let y = Math.sin(radians) * radius;
    let xShift = sunTimeElement.offsetWidth / 1.4 * Math.cos(theta * (Math.PI / 180));
    let yShift = sunTimeElement.offsetHeight * Math.sin(theta * (Math.PI / 180));

    if (name == "מנחה גדולה") {
      y += sunTimeElement.offsetHeight * Math.sin(theta * (Math.PI / 180));
      x += sunTimeElement.offsetWidth * Math.cos(theta * (Math.PI / 180));
    }

    x += xShift;
    y += yShift;

    sunTimeElement.style.left = `${50 + (x / clockRadius) * 50}%`;
    sunTimeElement.style.top = `${50 + (y / clockRadius) * 50}%`;
    sunTimeElement.style.transform = `translate(-50%, -50%)`;

    // Color coding based on time
    let color;
    if (time < date) {
      color = '#888888'; // Grey for passed times
    } else if (time - date < 600000) { // 10 minutes in milliseconds
      color = '#FFFF00'; // Yellow for upcoming times
    } else {
      color = 'white'; // Default color
    }

    sunTimeElement.style.color = color;
  }
}

/**
 * Positions the moon on the clock face based on its current phase and position.
 * @param {object} sunTimes - An object containing calculated sun times
 */
function positionMoon(sunTimes) {
  const clockFace = document.querySelector('.clock-face');
  const clockRadius = clockFace.offsetWidth / 2;
  const moonHolder = document.getElementById('moon');

  // Create an observer object
  const observer = new Astronomy.Observer(usr_lat, usr_lon, elevation);

  // Calculate moonrise, moonset, and next moonrise
  const nextMoonrise = Astronomy.SearchRiseSet('Moon', observer, 1, date, 2);
  const nextMoonset = Astronomy.SearchRiseSet('Moon', observer, -1, date, 2);
  const prevMoonrise = Astronomy.SearchRiseSet('Moon', observer, 1, date, -2);
  const prevMoonset = Astronomy.SearchRiseSet('Moon', observer, -1, date, -2);

  // Calculate the moon's position
  const moonEqPosition = Astronomy.Equator('Moon', date, observer, true, true);
  const moonPosition = Astronomy.Horizon(date, observer, moonEqPosition.ra, moonEqPosition.dec);
  const moonAltitude = moonPosition.altitude;

  // Determine the progress angle
  let progressAngle;
  if (moonAltitude > 0) {
    // Moon is above horizon
    progressAngle = 180 * (date - prevMoonrise.date) / (nextMoonset.date - prevMoonrise.date);
  } else if (moonAltitude < 0) {
    progressAngle = 180 + 180 * (date - prevMoonset.date) / (nextMoonrise.date - prevMoonset.date);
  }
  progressAngle %= 360;

  // Position the moon
  const x = Math.cos(progressAngle * Math.PI / 180);
  const y = Math.sin(progressAngle * Math.PI / 180);

  const moonSize = 4; // vmin
  const left = 50 + x * 50;
  const top = 50 - y * 50;

  // Position the moon holder
  moonHolder.style.left = `${left}%`;
  moonHolder.style.top = `${top}%`;
  moonHolder.style.width = `${moonSize}vmin`;
  moonHolder.style.height = `${moonSize}vmin`;

  // Clear previous moon rendering
  moonHolder.innerHTML = '';

  // Calculate moon phase
  const waning = Astronomy.MoonPhase(date) > 180;
  const moonPhase = Astronomy.Illumination('Moon', date).phase_fraction;

  // Render moon with shading
  renderMoon(moonHolder, 220, 220, 220, moonSize / 2, moonPhase, waning);
}

/**
 * Renders the moon with shading to represent its current phase.
 * @param {HTMLElement} holderNode - The DOM node to hold the moon rendering
 * @param {number} rVal - Red color value
 * @param {number} gVal - Green color value
 * @param {number} bVal - Blue color value
 * @param {number} R - Radius of the moon
 * @param {number} phase - Moon phase (0 to 1)
 * @param {boolean} waning - Whether the moon is waning
 */
function renderMoon(holderNode, rVal, gVal, bVal, R, phase, waning) {
  // 'phase' ranges from 0 (new moon) to 1 (full moon)
  // 'waning' is a boolean indicating if the moon is waning

  const moon = document.getElementById('moon');
  const sphere = document.createElement("div");
  sphere.style.zIndex = "7";
  const hemiSphere = document.createElement("div");
  sphere.style.zIndex = "8";
  const dia = 2 * R;
  const brightColor = `rgb(${rVal},${gVal},${bVal})`;
  const darkColor = `rgb(${Math.round(0.2 * rVal)},${Math.round(0.2 * gVal)},${Math.round(0.2 * bVal)})`;

  // Corrected calculation of the illuminated width based on phase
  const angle = phase * Math.PI;
  let hw = R * Math.cos(angle);
  let sphereTxt = "";
  let hemiTxt = "";

  sphereTxt += `position:absolute; width:${dia}vmin; height:${dia}vmin; `;
  sphereTxt += `border-radius:${R}vmin; `;
  sphereTxt += "overflow:hidden; ";

  if (phase <= 0.5) {
    // Less than half illuminated
    sphereTxt += `background-color:${brightColor}; `;

    if (waning) {
      // Waning crescent (illumination on the left)
      hemiTxt += "position:absolute; right:0; ";
      hemiTxt += `width:${R + hw}vmin; height:${dia}vmin; `;
      hemiTxt += `border-top-left-radius:${hw}vmin ${R}vmin; `;
      hemiTxt += `border-bottom-left-radius:${hw}vmin ${R}vmin; `;
      hemiTxt += `border-top-right-radius:${R}vmin ${R}vmin; `;
      hemiTxt += `border-bottom-right-radius:${R}vmin ${R}vmin; `;
      moon.style.transform = `translate(-50%, -50%) rotate(${180 - sunTheta}deg)`;
    } else {
      // Waxing crescent (illumination on the right)
      hemiTxt += "position:absolute; left:0; ";
      hemiTxt += `width:${R + hw}vmin; height:${dia}vmin; `;
      hemiTxt += `border-top-left-radius:${R}vmin ${R}vmin; `;
      hemiTxt += `border-bottom-left-radius:${R}vmin ${R}vmin; `;
      hemiTxt += `border-top-right-radius:${hw}vmin ${R}vmin; `;
      hemiTxt += `border-bottom-right-radius:${hw}vmin ${R}vmin; `;
      moon.style.transform = `translate(-50%, -50%) rotate(${-sunTheta}deg)`;
    }

    hemiTxt += `background-color:${darkColor}; `;
  } else {
    // More than half illuminated
    sphereTxt += `background-color:${darkColor}; `;

    if (waning) {
      // Waning gibbous (shadow on the right)
      hemiTxt += "position:absolute; left:0; ";
      hemiTxt += `width:${R - hw}vmin; height:${dia}vmin; `;
      hemiTxt += `border-top-left-radius:${R}vmin ${R}vmin; `;
      hemiTxt += `border-bottom-left-radius:${R}vmin ${R}vmin; `;
      hemiTxt += `border-top-right-radius:${-hw}vmin ${R}vmin; `;
      hemiTxt += `border-bottom-right-radius:${-hw}vmin ${R}vmin; `;
      moon.style.transform = `translate(-50%, -50%) rotate(${180 - sunTheta}deg)`;
    } else {
      // Waxing gibbous (shadow on the left)
      hemiTxt += "position:absolute; right:0; ";
      hemiTxt += `width:${R - hw}vmin; height:${dia}vmin; `;
      hemiTxt += `border-top-left-radius:${-hw}vmin ${R}vmin; `;
      hemiTxt += `border-bottom-left-radius:${-hw}vmin ${R}vmin; `;
      hemiTxt += `border-top-right-radius:${R}vmin ${R}vmin; `;
      hemiTxt += `border-bottom-right-radius:${R}vmin ${R}vmin; `;
      moon.style.transform = `translate(-50%, -50%) rotate(${-sunTheta}deg)`;
    }

    hemiTxt += `background-color:${brightColor}; `;
  }

  sphere.style.cssText = sphereTxt;
  hemiSphere.style.cssText = hemiTxt;

  sphere.appendChild(hemiSphere);
  holderNode.appendChild(sphere);
}

/**
 * Positions the clock numbers around the clock face.
 */
function positionClockNumbers() {
  const clockFace = document.querySelector('.clock-face');
  const clockRadius = clockFace.offsetWidth / 2;
  const radius = clockRadius; // Adjust radius to position numbers closer to the edge
  const numberHolder = document.getElementById("clock-numbers");

  // Clear previous numbers
  numberHolder.innerHTML = "";
  let angle = 0;

  for (const h of hours) {
    const clockNumber = document.createElement('div');
    clockNumber.classList.add('clock-number');
    clockNumber.textContent = h;
    numberHolder.appendChild(clockNumber);

    let x = radius * Math.cos((angle) * (Math.PI / 180));
    let y = radius * Math.sin((angle) * (Math.PI / 180));
    const xShift = - clockNumber.offsetWidth / 1.7 * Math.cos((angle) * (Math.PI / 180));
    const yShift = - clockNumber.offsetHeight / 2 * Math.sin((angle) * (Math.PI / 180));
    x += xShift;
    y += yShift;

    // Position the number
    clockNumber.style.left = `${50 + (x / clockRadius) * 50}%`;
    clockNumber.style.top = `${50 + (y / clockRadius) * 50}%`;

    // Center the number both horizontally and vertically
    clockNumber.style.transform = `translate(-50%, -50%)`;

    angle -= 15;
  }
}

/**
 * Sets the digital times (standard and seasonal) displayed on the clock.
 * @param {object} sunTimes - An object containing calculated sun times
 */
function setDigitalTimes(sunTimes) {
  const digitalTimeHolder = document.getElementById("digital-time");
  const sDigitalTimeHolder = document.getElementById("seasonal-time");

  // Getting current time and date
  let hour = date.getHours();
  let min = date.getMinutes();
  let sec = date.getSeconds();
  let am_pm = "AM";

  // Setting time for 12-hour format
  if (hour >= 12) {
    if (hour > 12) hour -= 12;
    am_pm = "PM";
  } else if (hour == 0) {
    hour = 12;
    am_pm = "AM";
  }

  min = min < 10 ? "0" + min : min;
  sec = sec < 10 ? "0" + sec : sec;

  let currentTime = hour + ":" + min + ":" + sec + " " + am_pm;
  // Set digital time
  digitalTimeHolder.textContent = currentTime;

  // Now calculate seasonal digital time
  const { isDay, totalSeasonalMinutes, seasonalHourLength } = calculateSeasonalTime(date, sunTimes);

  const seasonalHour = Math.floor(totalSeasonalMinutes / 60);
  const seasonalMinute = Math.floor(totalSeasonalMinutes % 60);

  // Calculate chalakim (1/18th of a minute)
  const chalakimPerSeasonalMinute = 18;
  const fractionalMinute = totalSeasonalMinutes % 1;
  const totalChalakim = Math.floor(fractionalMinute * chalakimPerSeasonalMinute);

  const timeString = `${seasonalHour.toString().padStart(1, '0')}:${seasonalMinute.toString().padStart(2, '0')}:${totalChalakim.toString().padStart(2, '0')} ${isDay ? 'ביום' : 'בלילה'}`;

  // Set seasonal digital time
  sDigitalTimeHolder.textContent = timeString;
}

/**
 * Calculates the seasonal time (sha'ah zemanit) based on sunrise and sunset.
 * @param {Date} now - The current date and time
 * @param {object} sunTimes - An object containing calculated sun times
 * @returns {object} - An object containing isDay, seasonalHours, totalSeasonalMinutes, and seasonalHourLength
 */
function calculateSeasonalTime(now, sunTimes) {
  const { sunrise, sunset, nextSunrise, prevSunset } = sunTimes;
  let isDay, seasonalHourLength, seasonalHours, totalSeasonalMinutes;

  if (now >= sunrise && now < sunset) {
    // Daytime
    isDay = true;
    const dayLength = sunset.getTime() - sunrise.getTime();
    seasonalHourLength = dayLength / 12;
    const timeFromSunrise = now.getTime() - sunrise.getTime();
    seasonalHours = timeFromSunrise / seasonalHourLength;
  } else {
    // Nighttime
    isDay = false;
    let nightLength, timeFromSunset;
    if (now >= sunset) {
      nightLength = nextSunrise.getTime() - sunset.getTime();
      timeFromSunset = now.getTime() - sunset.getTime();
    } else {
      nightLength = sunrise.getTime() - prevSunset.getTime();
      timeFromSunset = (now.getTime() - prevSunset.getTime() + nightLength) % nightLength;
    }
    seasonalHourLength = nightLength / 12;
    seasonalHours = timeFromSunset / seasonalHourLength;
  }

  totalSeasonalMinutes = seasonalHours * 60;
  return { isDay, seasonalHours, totalSeasonalMinutes, seasonalHourLength };
}

/**
 * Sets the position of the clock hand and the sun element.
 * @param {object} sunTimes - An object containing calculated sun times
 */
function setClockHand(sunTimes) {
  const { isDay, seasonalHours } = calculateSeasonalTime(date, sunTimes);

  let totalDegrees = isDay ? (seasonalHours / 12) * 180 : 180 + (seasonalHours / 12) * 180;

  // Adjust for the clock's orientation
  totalDegrees = (360 - totalDegrees + 180) % 360;
  sunTheta = 180 - totalDegrees;

  const clockFace = document.querySelector('.clock-face');
  const clockRadius = clockFace.offsetWidth / 2;
  const sunElement = document.getElementById('sun');

  const x = Math.cos(sunTheta * Math.PI / 180);
  const y = Math.sin(sunTheta * Math.PI / 180);

  // Position the sun element
  const size = 6; // Size in vmin
  const scale = 0.9;
  sunElement.style.width = `${size}vmin`;
  sunElement.style.height = `${size}vmin`;

  const left = 50 + x * scale * 50 - 50 * sunElement.offsetWidth / (2 * clockRadius);
  const top = 50 - y * scale * 50 - 50 * sunElement.offsetHeight / (2 * clockRadius);

  sunElement.style.left = `${left}%`;
  sunElement.style.top = `${top}%`;

  // Rotate the hand
  singleHand.style.transform = `rotate(${totalDegrees}deg)`;
}

/**
 * Determines if the given coordinates are within Israel.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - True if in Israel, false otherwise
 */
function inIsrael(lat, lon) {
  if (!israelGeoJSON) {
    return false; // default behavior
  }
  const pt = point([lon, lat]); // Note: GeoJSON uses [longitude, latitude]
  const polygon = israelGeoJSON.features[0];
  return booleanPointInPolygon(pt, polygon);
}

/**
 * Sets the date, day of week, and holidays on the clock.
 * @param {object} sunTimes - An object containing calculated sun times
 */
function setDate(sunTimes) {
  let chag = 0;
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);

  const tomTomorrow = new Date(tomorrow);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateHolder = document.getElementById("date");
  const dowHolder = document.getElementById("day-of-week");
  const holidayHolder = document.getElementById("holiday");
  const omerHolder = document.getElementById("omer");
  const sedraHolder = document.getElementById("sedra");

  let dateString;
  const dow = weekday[date.getDay()];
  const tomorrowDow = weekday[(date.getDay() + 1) % 7];

  if (date >= sunTimes["צאת"]) {
    dowHolder.textContent = tomorrowDow;
  }
  else if (date >= sunTimes["sunset"]) {
    dowHolder.textContent = dow + "/" + tomorrowDow;
  }
  else {
    dowHolder.textContent = dow;
  }

  // Get holidays/events for today
  let events = hcal.HebrewCalendar.getHolidaysOnDate(hdate);
  let tomEvents = hcal.HebrewCalendar.getHolidaysOnDate(hdate.next());

  if (date < sunTimes['צאת']) {
    dateString = jDate.toHebrewJewishDate(jDate.toJewishDate(date));
  }
  else {
    dateString = jDate.toHebrewJewishDate(jDate.toJewishDate(tomorrow));
  }

  if(tomEvents){
    for (const e of tomEvents) {

      if (inIsrael(usr_lat, usr_lon) && e.getFlags() & (hcal.flags.CHUL_ONLY)) {
        continue;
      }
      else if (!inIsrael(usr_lat, usr_lon) && e.getFlags() & (hcal.flags.IL_ONLY)) {
        continue;
      }

      // tomorrow is yom tov
      if(e.getFlags() & (hcal.flags.CHAG)){
        chag = 1;
        sunTimes["🕯️🕯️"] = new Date(sunTimes["sunset"] - 18 * 60000);
      }
    }
  }

  if(dowHolder.textContent == "יום שישי"){
    sunTimes["🕯️🕯️"] = new Date(sunTimes["sunset"] - 18 * 60000);
  }
  else if("🕯️🕯️" in sunTimes && chag == 0){
    delete sunTimes["🕯️🕯️"];
  }

  dateHolder.textContent = dateString.day + " " + dateString.monthName + " " + dateString.year;

  // Calculate Omer count if applicable
  if (hdate.mm == 1 && hdate.dd >= 16 || hdate.mm == 2 || hdate.mm == 3 && hdate.dd < 6) {
    omerHolder.textContent = new hcal.OmerEvent(hdate, omerDay[(hdate.mm * 100 + hdate.dd)]).render('he').replace(/[\u0591-\u05C7]/g, '');
  }

  // Set this week's parsha sedra
  sedraHolder.textContent = new hcal.Sedra(hdate.getFullYear(), inIsrael(usr_lat, usr_lon)).getString(hdate, 'he').replace(/[\u0591-\u05C7]/g, '');
  holidayHolder.innerHTML = "";
  // Check if there is a Holiday Today
  if (events) {
    for (const e of events) {
      // Filter out events based on Israel/Chutz La'aretz
      if (inIsrael(usr_lat, usr_lon) && e.getFlags() & (hcal.flags.CHUL_ONLY)) {
        continue;
      }
      else if (!inIsrael(usr_lat, usr_lon) && e.getFlags() & (hcal.flags.IL_ONLY)) {
        continue;
      }
      
      let holidayText = e.render('he').replace(/[\u0591-\u05C70-9]/g, '');

      // Correct Hanukkah dates
      if (holidayText.includes("חנוכה")) {
        switch (holidayText) {
          case "חנוכה: א׳ נר":
            holidayText = ""
            break;
          case "חנוכה: ב׳ נרות":
            holidayText = "חנוכה: יום א׳";
            break;
          case "חנוכה: ג׳ נרות":
            holidayText = "חנוכה: יום ב׳";
            break;
          case "חנוכה: ד׳ נרות":
            holidayText = "חנוכה: יום ג׳";
            break;
          case "חנוכה: ה׳ נרות":
            holidayText = "חנוכה: יום ד׳";
            break;
          case "חנוכה: ו׳ נרות":
            holidayText = "חנוכה: יום ה׳";
            break;
          case "חנוכה: ז׳ נרות":
            holidayText = "חנוכה: יום ו׳";
            break;
          case "חנוכה: ח׳ נרות":
            holidayText = "חנוכה: יום ז׳";
            break;
        }
      }
      // Exclude modern holidays
      else if (modernHoliday.includes(holidayText)) {
        continue;
      }

      const holidayInstance = document.createElement('div');
      holidayInstance.textContent = holidayText;

      holidayHolder.appendChild(holidayInstance);
    }
  }
}

/**
 * Updates the clock by refreshing all dynamic elements.
 */
function updateClock() {
  const sunTimes = calcSunTimes(usr_lat, usr_lon);
  setClockHand(sunTimes);
  setDigitalTimes(sunTimes);
  positionMoon(sunTimes);
  setDate(sunTimes);
  placeSunTimes(sunTimes);
}

/**
 * Initializes the clock and sets up intervals for updates.
 */
function init() {
  getLocation();
  setInterval(updateClock, 1000);
  positionClockNumbers();
}

// Event listeners for window load and resize events
window.addEventListener('load', init);
window.addEventListener('resize', init);
