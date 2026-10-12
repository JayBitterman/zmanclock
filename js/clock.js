import { state, HOURS } from './config.js';
import { calculateSeasonalTime, calculateMoonData, ZMAN_DISPLAY_NAMES } from './astronomy.js';
import { getHolidays } from './hebrew.js';

/**
 * Positions the clock numbers around the clock face
 */
export function positionClockNumbers() {
  const clockFace = document.querySelector('.clock-face');
  if (!clockFace) return;
  
  const clockRadius = clockFace.offsetWidth / 2;
  const radius = clockRadius;
  const numberHolder = document.getElementById("clock-numbers");
  
  numberHolder.innerHTML = "";
  let angle = 0;
  
  for (const h of HOURS) {
    const clockNumber = document.createElement('div');
    clockNumber.classList.add('clock-number');
    clockNumber.textContent = h;
    numberHolder.appendChild(clockNumber);
    
    let x = radius * Math.cos(angle * Math.PI / 180);
    let y = radius * Math.sin(angle * Math.PI / 180);
    const xShift = -clockNumber.offsetWidth / 1.7 * Math.cos(angle * Math.PI / 180);
    const yShift = -clockNumber.offsetHeight / 2 * Math.sin(angle * Math.PI / 180);
    x += xShift;
    y += yShift;
    
    clockNumber.style.left = `${50 + (x / clockRadius) * 50}%`;
    clockNumber.style.top = `${50 + (y / clockRadius) * 50}%`;
    // Centered with the `translate` property, leaving `transform` free for the
    // CSS that flips the lettering back when the dial is mirrored
    clockNumber.style.translate = '-50% -50%';
    
    angle -= 15;
  }
}

/**
 * Sets the clock hand position and updates sun position
 * IMPROVED: Handles CSS transition for smooth movement at normal speed,
 * but disables transition during time acceleration for responsive fast-forward
 */
export function setClockHand() {
  const singleHand = document.querySelector('.single-hand');
  if (!singleHand) return;
  
  const { isDay, seasonalHours } = calculateSeasonalTime();
  
  let totalDegrees = isDay
    ? (seasonalHours / 12) * 180
    : 180 + (seasonalHours / 12) * 180;
  
  // Adjust for clock orientation
  totalDegrees = (360 - totalDegrees + 180) % 360;
  state.sunTheta = 180 - totalDegrees;
  
  // Smooth rotation across 360° boundary
  if (state.prevTotalDegrees !== null) {
    let deltaDegrees = totalDegrees - state.prevTotalDegrees;
    
    if (deltaDegrees > 180) deltaDegrees -= 360;
    else if (deltaDegrees < -180) deltaDegrees += 360;
    
    state.accumulatedRotation += deltaDegrees;
  } else {
    state.accumulatedRotation = totalDegrees;
  }
  
  state.prevTotalDegrees = totalDegrees;

  // Disable CSS transition during time acceleration for responsive fast-forward
  // At 10x+ speed, the hand needs to jump quickly to show passage of time
  const isAccelerated = Math.abs(state.speedMultiplier || 0) >= 10;
  setStyle(singleHand, 'transition', isAccelerated ? 'none' : 'transform 150ms linear');

  // At normal speed the hand moves ~0.0002° per frame; rounding to 0.01°
  // means the DOM is touched every couple of seconds instead of every frame.
  setStyle(singleHand, 'transform', `rotate(${state.accumulatedRotation.toFixed(2)}deg)`);

  // Position sun element
  positionSun();
}

// Last value written per element + property, so unchanged values skip the DOM
// (every style write costs a style recalc, even when the value is the same).
const writtenStyles = new WeakMap();

function setStyle(element, property, value) {
  let written = writtenStyles.get(element);
  if (!written) {
    written = {};
    writtenStyles.set(element, written);
  }
  if (written[property] === value) return;
  written[property] = value;
  element.style[property] = value;
}

/**
 * Positions the sun on the clock face
 */
function positionSun() {
  const sunElement = document.getElementById('sun');
  if (!sunElement) return;

  const x = Math.cos(state.sunTheta * Math.PI / 180);
  const y = Math.sin(state.sunTheta * Math.PI / 180);

  const size = 6;
  const scale = 0.9;
  setStyle(sunElement, 'width', `${size}vmin`);
  setStyle(sunElement, 'height', `${size}vmin`);

  // Centered via translate(-50%, -50%) so no layout read is needed per frame.
  setStyle(sunElement, 'transform', 'translate(-50%, -50%)');
  const left = 50 + x * scale * 50;
  const top = 50 - y * scale * 50;
  setStyle(sunElement, 'left', `${left.toFixed(2)}%`);
  setStyle(sunElement, 'top', `${top.toFixed(2)}%`);

  // In compass mode the lower half of the dial is the earth: when the sun is
  // down there, a warm glow marks where it's buried
  const glow = document.getElementById('earth-sun-glow');
  if (glow) {
    const cx = left.toFixed(1), cy = (top - 50).toFixed(1);
    const opacity = Math.max(0, Math.min(1, (top - 50) / 4)).toFixed(2);
    const w = writtenStyles.get(glow) || {};
    if (w.cx !== cx || w.cy !== cy || w.opacity !== opacity) {
      glow.setAttribute('cx', cx);
      glow.setAttribute('cy', cy);
      glow.setAttribute('opacity', opacity);
      writtenStyles.set(glow, { cx, cy, opacity });
    }
  }
}

let lastMoonPhase = null;

/**
 * Positions and renders the moon with correct orientation
 */
export function positionMoon() {
  const moonHolder = document.getElementById('moon');
  if (!moonHolder) return;

  const moonData = calculateMoonData();
  if (!moonData) {
    // Moon doesn't rise or set today at this latitude
    setStyle(moonHolder, 'display', 'none');
    return;
  }
  setStyle(moonHolder, 'display', '');

  // Position on clock face
  const x = Math.cos(moonData.progressAngle * Math.PI / 180);
  const y = Math.sin(moonData.progressAngle * Math.PI / 180);
  const moonSize = 4;

  setStyle(moonHolder, 'left', `${(50 + x * 50).toFixed(2)}%`);
  setStyle(moonHolder, 'top', `${(50 - y * 50).toFixed(2)}%`);
  setStyle(moonHolder, 'width', `${moonSize}vmin`);
  setStyle(moonHolder, 'height', `${moonSize}vmin`);

  // Apply the correct rotation for observer's view
  setStyle(moonHolder, 'transform', `translate(-50%, -50%) rotate(${moonData.rotationDeg}deg)`);

  // Render moon phase (only rebuilt when the phase is recalculated)
  if (moonData.phaseAngle !== lastMoonPhase || !moonHolder.firstChild) {
    lastMoonPhase = moonData.phaseAngle;
    moonHolder.innerHTML = '';
    renderMoon(moonHolder, moonSize / 2, moonData.phaseAngle, moonData.waning);
  }
}

/**
 * Renders the moon with shading to represent its current phase
 */
function renderMoon(holderNode, R, phase, waning) {
  const sphere = document.createElement("div");
  const hemiSphere = document.createElement("div");
  const dia = 2 * R;
  
  const brightColor = `rgb(160,160,150)`;
  const darkColor = `rgb(20,20,25)`;
  const brightGradient = `radial-gradient(circle at 30% 30%, #f0f0e0, ${brightColor} 70%, #6c6c64 100%)`;
  
  const angle = Math.PI - (phase * Math.PI / 180);
  let hw = R * Math.cos(angle);
  
  let sphereTxt = `position:absolute; width:${dia}vmin; height:${dia}vmin; border-radius:${R}vmin; box-shadow: 0 0.1vmin 0.25vmin rgba(0,0,0,0.4);`;
  let hemiTxt = "";
  
  if (phase >= 90) {
    // Less than half illuminated
    sphereTxt += `background: ${brightGradient}; `;
    hemiTxt += `box-shadow: ${0.1 * R}vmin 0 ${0.3 * R}vmin 0vmin rgba(0,0,0,0.5);`;
    
    if (waning) {
      hemiTxt += `position:absolute; right:0; width:${R + hw}vmin; height:${dia}vmin; `;
      hemiTxt += `border-top-left-radius:${hw}vmin ${R}vmin; border-bottom-left-radius:${hw}vmin ${R}vmin; `;
      hemiTxt += `border-top-right-radius:${R}vmin ${R}vmin; border-bottom-right-radius:${R}vmin ${R}vmin; `;
    } else {
      hemiTxt += `position:absolute; left:0; width:${R + hw}vmin; height:${dia}vmin; `;
      hemiTxt += `border-top-left-radius:${R}vmin ${R}vmin; border-bottom-left-radius:${R}vmin ${R}vmin; `;
      hemiTxt += `border-top-right-radius:${hw}vmin ${R}vmin; border-bottom-right-radius:${hw}vmin ${R}vmin; `;
    }
    hemiTxt += `background: ${darkColor}; `;
  } else {
    // More than half illuminated
    sphereTxt += `background: ${darkColor}; `;
    hemiTxt += `box-shadow:inset ${0.1 * R}vmin 0 ${0.3 * R}vmin 0vmin rgba(0,0,0,0.5);`;
    
    if (waning) {
      hemiTxt += `position:absolute; left:0; width:${R - hw}vmin; height:${dia}vmin; `;
      hemiTxt += `border-top-left-radius:${R}vmin ${R}vmin; border-bottom-left-radius:${R}vmin ${R}vmin; `;
      hemiTxt += `border-top-right-radius:${-hw}vmin ${R}vmin; border-bottom-right-radius:${-hw}vmin ${R}vmin; `;
    } else {
      hemiTxt += `position:absolute; right:0; width:${R - hw}vmin; height:${dia}vmin; `;
      hemiTxt += `border-top-left-radius:${-hw}vmin ${R}vmin; border-bottom-left-radius:${-hw}vmin ${R}vmin; `;
      hemiTxt += `border-top-right-radius:${R}vmin ${R}vmin; border-bottom-right-radius:${R}vmin ${R}vmin; `;
    }
    hemiTxt += `background: ${brightGradient}; `;
  }
  
  sphere.style.cssText = sphereTxt;
  hemiSphere.style.cssText = hemiTxt;
  
  sphere.appendChild(hemiSphere);
  holderNode.appendChild(sphere);
}

// Bumped whenever a zman label moves, so other layers (the mazalos) know to
// re-measure the labels instead of reading layout every frame.
export let sunTimesLayoutVersion = 0;

/**
 * Places sun times around the clock face
 * OPTIMIZED: Reuse existing elements instead of destroying/creating
 */
export function placeSunTimes() {
  if (state.latitude === null || !state.sunTimes || !state.sunTimes.sunrise || isNaN(state.sunTimes.sunrise.getTime())) {
    return;
  }

  const clockFace = document.querySelector('.clock-face');
  const sunTimesContainer = document.getElementById("sun-times");
  if (!clockFace || !sunTimesContainer || !state.sunTimes.sunrise) return;

  // Reading offsetWidth forces a synchronous style recalc, so only do it when
  // a label actually needs repositioning (this runs 10x per second).
  let clockRadius = null;

  const todaySunrise = state.sunTimes.sunrise;
  const todaySunset = state.sunTimes.sunset;
  const tomorrowSunrise = state.sunTimes.nextSunrise;
  const yesterdaySunset = state.sunTimes.prevSunset;
  
  // Minor Fast Day Detection
  const holidays = getHolidays(false); 
  const minorFasts = ["צום גדליה", "עשרה בטבת", "תענית אסתר", "שבעה עשר בתמוז", "י\"ז בתמוז", "תענית בכורות"];
  const isFastDay = holidays.some(h => minorFasts.some(fast => h.includes(fast)));

  for (const [name, time] of Object.entries(state.sunTimes)) {
    if (name === "prevSunset" || name === "nextSunrise" || !time) continue;
    
    const timeMs = time.getTime();
    let sunTimeElement = document.getElementById(name);
    
    // Check if we need to full update (text/pos) or just color
    // If element exists and time is same, we only update color (fast)
    let needsPosUpdate = true;
    
    if (!sunTimeElement) {
      // Create new element
      sunTimeElement = document.createElement('div');
      sunTimeElement.setAttribute("id", name);
      sunTimeElement.classList.add('sun-time');
      sunTimeElement.style.display = "grid";
      sunTimeElement.style.alignItems = "center";
      sunTimeElement.style.whiteSpace = "nowrap";
      sunTimesContainer.appendChild(sunTimeElement);
    } else {
      const prevTime = parseInt(sunTimeElement.getAttribute("time") || "0");
      if (prevTime === timeMs) {
        needsPosUpdate = false;
      }
    }

    // Always check color (cheap)
    // Color coding: yellow in the last 10 minutes; passed zmanim fade out
    // (as faded white, so they stay readable on both the day and night sky)
    const past = time < state.date;
    const color = !past && time - state.date < 600000 ? 'yellow' : 'white';
    if (sunTimeElement.style.color !== color) {
      sunTimeElement.style.color = color;
    }
    if (sunTimeElement.classList.contains('past') !== past) {
      sunTimeElement.classList.toggle('past', past);
    }

    // If time hasn't changed, skip DOM layout calculations
    if (!needsPosUpdate) continue;
    sunTimesLayoutVersion++;

    // UPDATE CONTENT & POSITION
    sunTimeElement.setAttribute("time", timeMs);
    
    const options = { hour: 'numeric', minute: '2-digit', second: '2-digit' };
    if (state.timezone) {
      options.timeZone = state.timezone;
    }
    const timeStr = time.toLocaleTimeString([], options);  
    
    // Get display name (Hebrew) for this zman
    let displayName = ZMAN_DISPLAY_NAMES[name] || name;
    
    // Append Fast Start/End labels
    if (isFastDay) {
      if (name === 'alos') displayName += " / תחילת הצום";
      if (name === 'tzeis') displayName += " / סוף הצום";
    }

    // Update Text Content
    if (name !== "sunset" && name !== "sunrise") {
       if (["tzeis", "rTam", "alos", "misheyakir", "🕯️🕯️", "biurChametz"].includes(name)) {
         sunTimeElement.textContent = timeStr + " " + displayName;
       } else {
         sunTimeElement.innerHTML = `<div>${displayName}</div><div>${timeStr}</div>`;
       }
    } else {
       sunTimeElement.textContent = timeStr;
    }
    
    // Calculate position angle
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
    
    // Position on clock face
    if (clockRadius === null) clockRadius = clockFace.offsetWidth / 2;
    const radius = clockRadius;
    const radians = theta * Math.PI / 180;
    let x = Math.cos(radians) * radius;
    let y = Math.sin(radians) * radius;
    
    // Offset correction for element size (approximate center)
    // We use a fixed offset here or dynamic if element is rendered. 
    // Since we appended it, offsetWidth is available.
    
    let xShift = sunTimeElement.offsetWidth / 1.4 * Math.cos(theta * Math.PI / 180);
    let yShift = sunTimeElement.offsetHeight * Math.sin(theta * Math.PI / 180);
    
    if (name === "minchaGedola") {
      y += sunTimeElement.offsetHeight * Math.sin(theta * Math.PI / 180);
      x += sunTimeElement.offsetWidth * Math.cos(theta * Math.PI / 180);
    }

    if (name === "chatzosLayla") {
      y -= sunTimeElement.offsetHeight/2;
    }
    
    x += xShift;
    y += yShift;

    sunTimeElement.style.left = `${50 + (x / clockRadius) * 50}%`;
    sunTimeElement.style.top = `${50 + (y / clockRadius) * 50}%`;
    sunTimeElement.style.translate = '-50% -50%';
  }
}
