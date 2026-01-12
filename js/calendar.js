// ============================================================================
// calendar.js - Hebrew/Gregorian Calendar Component
// A clean, responsive, user-friendly calendar with proper RTL Hebrew support
// ============================================================================

import { numberToHebrewNumeral } from './hebrew.js';

// ============================================================================
// Library Import (Dynamic)
// ============================================================================

let toJewishDate, toGregorianDate, isLeapYear, calcDaysInMonth, JewishMonth;
let libraryLoaded = false;

// Month type mapping for jewish-date library
const MONTH_TYPES = {
  1: 'Nisan', 2: 'Iyyar', 3: 'Sivan', 4: 'Tammuz', 5: 'Av', 6: 'Elul',
  7: 'Tishri', 8: 'Cheshvan', 9: 'Kislev', 10: 'Tevet', 11: 'Shevat',
  12: 'Adar', 13: 'AdarII'
};

// Hebrew month names (user-facing, 1-indexed)
const HEBREW_MONTHS = [
  "", "ניסן", "אייר", "סיון", "תמוז", "אב", "אלול",
  "תשרי", "חשוון", "כסלו", "טבת", "שבט", "אדר", "אדר ב׳"
];

const GREGORIAN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const GREGORIAN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HEBREW_WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

// Map library month names to our 1-13 system
const MONTH_NAME_TO_NUM = {
  "Nisan": 1, "Iyyar": 2, "Sivan": 3, "Tammuz": 4, "Av": 5, "Elul": 6,
  "Tishri": 7, "Cheshvan": 8, "Kislev": 9, "Tevet": 10, "Shevat": 11,
  "Adar": 12, "Adar I": 12, "AdarII": 13
};

// ============================================================================
// State
// ============================================================================

let currentMode = 'gregorian'; // 'gregorian' or 'hebrew'
let currentGregorianDate = new Date();
let currentHebrewDate = { year: 5785, month: 7, day: 1 }; // Will be updated

// ============================================================================
// DOM References
// ============================================================================

let elements = {};

function getElements() {
  elements = {
    wrapper: document.getElementById('calendar-wrapper'),
    container: document.querySelector('.calendar-container'),
    toggle: document.getElementById('calendar-toggle'),
    monthYear: document.getElementById('month-year'),
    weekdays: document.getElementById('weekdays'),
    daysGrid: document.getElementById('days-grid'),
    prevBtn: document.getElementById('prev-month'),
    nextBtn: document.getElementById('next-month'),
    goBtn: document.getElementById('go-button'),
    monthInput: document.getElementById('month-input'),
    dayInput: document.getElementById('day-input'),
    yearInput: document.getElementById('year-input'),
    gregorianRadio: document.getElementById('gregorian'),
    hebrewRadio: document.getElementById('hebrew')
  };
}

// ============================================================================
// Library Initialization
// ============================================================================

async function loadLibrary() {
  try {
    const module = await import('https://esm.sh/jewish-date@2.0.20');
    ({ toJewishDate, toGregorianDate, isLeapYear, calcDaysInMonth, JewishMonth } = module);
    libraryLoaded = true;
    
    // Initialize current Hebrew date from today
    const today = new Date();
    const jewishToday = toJewishDate(today);
    currentHebrewDate = {
      year: jewishToday.year,
      month: MONTH_NAME_TO_NUM[jewishToday.monthName] || 7,
      day: jewishToday.day
    };
    
    return true;
  } catch (err) {
    console.error("Failed to load jewish-date library:", err);
    return false;
  }
}

// ============================================================================
// Rendering
// ============================================================================

function render() {
  if (!libraryLoaded || !elements.daysGrid) return;
  
  elements.daysGrid.innerHTML = '';
  elements.weekdays.innerHTML = '';
  
  const isHebrew = currentMode === 'hebrew';
  
  // Update container direction
  if (elements.container) {
    elements.container.classList.toggle('hebrew', isHebrew);
  }
  
  // Get current view parameters
  const year = isHebrew ? currentHebrewDate.year : currentGregorianDate.getFullYear();
  const month = isHebrew ? currentHebrewDate.month : currentGregorianDate.getMonth();
  
  // Calculate days in month
  const daysInMonth = isHebrew 
    ? calcDaysInMonth(year, month)
    : new Date(year, month + 1, 0).getDate();
  
  // Get first day of week (0=Sunday)
  let firstDayOfWeek;
  if (isHebrew) {
    const firstDayGreg = toGregorianDate({ 
      year, 
      monthName: JewishMonth[MONTH_TYPES[month]], 
      day: 1 
    });
    firstDayOfWeek = firstDayGreg.getDay();
  } else {
    firstDayOfWeek = new Date(year, month, 1).getDay();
  }
  
  // Render header
  renderHeader(year, month, isHebrew);
  
  // Render weekday labels
  const weekdays = isHebrew ? HEBREW_WEEKDAYS : GREGORIAN_WEEKDAYS;
  weekdays.forEach(day => {
    const div = document.createElement('div');
    div.className = 'weekday-label';
    div.textContent = day;
    elements.weekdays.appendChild(div);
  });
  
  // Calculate padding days
  const daysFromPrev = firstDayOfWeek;
  
  // FIX: Always render 42 cells (6 rows x 7 days) to prevent layout jumping
  const totalCells = 42; 
  const daysFromNext = totalCells - daysFromPrev - daysInMonth;
  
  // Get previous month's days
  const prevMonthDays = getPrevMonthDays(year, month, isHebrew);
  
  // Render previous month padding
  for (let i = daysFromPrev - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const div = createDayCell(dayNum, isHebrew, true);
    elements.daysGrid.appendChild(div);
  }
  
  // Render current month days
  const today = new Date();
  const todayJewish = libraryLoaded ? toJewishDate(today) : null;
  
  for (let i = 1; i <= daysInMonth; i++) {
    const div = createDayCell(i, isHebrew, false);
    
    // Check if today
    if (isHebrew) {
      const todayMonth = todayJewish ? MONTH_NAME_TO_NUM[todayJewish.monthName] : null;
      if (i === todayJewish?.day && month === todayMonth && year === todayJewish?.year) {
        div.classList.add('today');
      }
    } else {
      if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        div.classList.add('today');
      }
    }
    
    // Add click handler
    div.addEventListener('click', () => handleDayClick(i, year, month, isHebrew));
    
    elements.daysGrid.appendChild(div);
  }
  
  // Render next month padding
  for (let i = 1; i <= daysFromNext; i++) {
    const div = createDayCell(i, isHebrew, true);
    elements.daysGrid.appendChild(div);
  }
}

function renderHeader(year, month, isHebrew) {
  if (isHebrew) {
    let monthName;
    if (month === 12 && isLeapYear(year)) {
      monthName = "אדר א׳";
    } else {
      monthName = HEBREW_MONTHS[month];
    }
    elements.monthYear.textContent = `${monthName} ${year}`;
  } else {
    elements.monthYear.textContent = `${GREGORIAN_MONTHS[month]} ${year}`;
  }
}

function createDayCell(num, isHebrew, isOtherMonth) {
  const div = document.createElement('div');
  div.className = 'day' + (isOtherMonth ? ' other-month' : '');
  div.textContent = isHebrew ? numberToHebrewNumeral(num) : num;
  return div;
}

function getPrevMonthDays(year, month, isHebrew) {
  if (isHebrew) {
    let prevMonth = month === 1 ? 12 : month - 1;
    let prevYear = month === 1 ? year - 1 : year;
    // Handle leap year edge case
    if (prevMonth === 12 && !isLeapYear(prevYear)) {
      // Stay at 12 (Adar)
    }
    return calcDaysInMonth(prevYear, prevMonth);
  } else {
    return new Date(year, month, 0).getDate();
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

function handleDayClick(day, year, month, isHebrew) {
  // Remove previous selection
  const selected = elements.daysGrid.querySelector('.selected');
  if (selected) selected.classList.remove('selected');
  
  // Add selection to clicked day
  event.target.classList.add('selected');
  
  // Update inputs
  elements.monthInput.value = isHebrew ? month : month + 1;
  elements.dayInput.value = day;
  elements.yearInput.value = year;
  
  // Get Gregorian date and dispatch event
  let gDate;
  if (isHebrew) {
    currentHebrewDate = { year, month, day };
    gDate = toGregorianDate({ 
      year, 
      monthName: JewishMonth[MONTH_TYPES[month]], 
      day 
    });
  } else {
    gDate = new Date(year, month, day);
    currentGregorianDate = gDate;
    // Update Hebrew mirror
    const jewish = toJewishDate(gDate);
    currentHebrewDate = {
      year: jewish.year,
      month: MONTH_NAME_TO_NUM[jewish.monthName],
      day: jewish.day
    };
  }
  
  // Dispatch event to main app
  dispatchDateSelected(gDate);
}

// Helper: Logic to go back one month
function execPrevMonth() {
  if (currentMode === 'gregorian') {
    // FIX: Set to 1st of month to avoid skipping months with fewer days (e.g. Jan 30 -> Feb 30 skips to Mar)
    currentGregorianDate.setDate(1); 
    currentGregorianDate.setMonth(currentGregorianDate.getMonth() - 1);
  } else {
    let { year, month, day } = currentHebrewDate;
    if (month === 1) {
      year--;
      month = isLeapYear(year) ? 13 : 12;
    } else if (month === 13) {
      month = 12;
    } else {
      month--;
    }
    const maxDay = calcDaysInMonth(year, month);
    currentHebrewDate = { year, month, day: Math.min(day, maxDay) };
  }
  render();
}

// Helper: Logic to go forward one month
function execNextMonth() {
  if (currentMode === 'gregorian') {
    // FIX: Set to 1st of month to avoid skipping months
    currentGregorianDate.setDate(1);
    currentGregorianDate.setMonth(currentGregorianDate.getMonth() + 1);
  } else {
    let { year, month, day } = currentHebrewDate;
    const leap = isLeapYear(year);
    if (month === 12 && leap) {
      month = 13;
    } else if (month === 12 || month === 13) {
      year++;
      month = 1;
    } else {
      month++;
    }
    const maxDay = calcDaysInMonth(year, month);
    currentHebrewDate = { year, month, day: Math.min(day, maxDay) };
  }
  render();
}

// Button Handlers with Swapped Logic for Hebrew
function handlePrevMonth() {
  if (!libraryLoaded) return;
  // If Hebrew, Left Arrow (PrevBtn) means GO NEXT. 
  // If Secular, Left Arrow means GO PREV.
  if (currentMode === 'hebrew') {
    execNextMonth();
  } else {
    execPrevMonth();
  }
}

function handleNextMonth() {
  if (!libraryLoaded) return;
  // If Hebrew, Right Arrow (NextBtn) means GO PREV.
  // If Secular, Right Arrow means GO NEXT.
  if (currentMode === 'hebrew') {
    execPrevMonth();
  } else {
    execNextMonth();
  }
}

function handleModeChange(mode) {
  currentMode = mode;
  
  // Reset to today when switching modes
  currentGregorianDate = new Date();
  if (libraryLoaded) {
    const jewish = toJewishDate(currentGregorianDate);
    currentHebrewDate = {
      year: jewish.year,
      month: MONTH_NAME_TO_NUM[jewish.monthName],
      day: jewish.day
    };
  }
  
  // Clear inputs
  elements.monthInput.value = '';
  elements.dayInput.value = '';
  elements.yearInput.value = '';
  
  render();
}

function handleGoButton() {
  if (!libraryLoaded) {
    alert("Calendar not ready. Please try again.");
    return;
  }
  
  const m = parseInt(elements.monthInput.value, 10);
  const d = parseInt(elements.dayInput.value, 10);
  const y = parseInt(elements.yearInput.value, 10);
  
  if (isNaN(m) || isNaN(d) || isNaN(y)) {
    alert("Please enter valid numbers for month, day, and year.");
    return;
  }
  
  let gDate;
  
  if (currentMode === 'gregorian') {
    const test = new Date(y, m - 1, d);
    if (test.getFullYear() !== y || test.getMonth() !== m - 1 || test.getDate() !== d) {
      alert("That Gregorian date doesn't exist.");
      return;
    }
    currentGregorianDate = test;
    gDate = test;
    
    // Update Hebrew mirror
    const jewish = toJewishDate(test);
    currentHebrewDate = {
      year: jewish.year,
      month: MONTH_NAME_TO_NUM[jewish.monthName],
      day: jewish.day
    };
  } else {
    // Hebrew mode
    if (m < 1 || m > 13) {
      alert("Month must be between 1 and 13.");
      return;
    }
    if (m === 13 && !isLeapYear(y)) {
      alert("Month 13 (Adar II) only exists in leap years.");
      return;
    }
    
    try {
      gDate = toGregorianDate({ 
        year: y, 
        monthName: JewishMonth[MONTH_TYPES[m]], 
        day: d 
      });
      currentHebrewDate = { year: y, month: m, day: d };
      currentGregorianDate = gDate;
    } catch (err) {
      alert("That Hebrew date doesn't exist.");
      return;
    }
  }
  
  render();
  dispatchDateSelected(gDate);
}

function dispatchDateSelected(gDate) {
  const midnight = new Date(gDate);
  midnight.setHours(0, 0, 0, 0);
  
  window.dispatchEvent(new CustomEvent("calendarDateSelected", { 
    detail: { gDate: midnight } 
  }));
}

// ============================================================================
// Toggle Visibility
// ============================================================================

function toggleCalendar() {
  if (elements.wrapper) {
    const isHidden = elements.wrapper.style.display === 'none';
    elements.wrapper.style.display = isHidden ? 'block' : 'none';
  }
}

// ============================================================================
// Initialization
// ============================================================================

export async function initCalendar() {
  getElements();
  
  const loaded = await loadLibrary();
  if (!loaded) {
    if (elements.monthYear) {
      elements.monthYear.textContent = "Error loading calendar";
    }
    return;
  }
  
  // Set up event listeners (toggle is handled by main.js)
  if (elements.prevBtn) {
    elements.prevBtn.addEventListener('click', handlePrevMonth);
  }
  
  if (elements.nextBtn) {
    elements.nextBtn.addEventListener('click', handleNextMonth);
  }
  
  if (elements.goBtn) {
    elements.goBtn.addEventListener('click', handleGoButton);
  }
  
  if (elements.gregorianRadio) {
    elements.gregorianRadio.addEventListener('change', () => handleModeChange('gregorian'));
  }
  
  if (elements.hebrewRadio) {
    elements.hebrewRadio.addEventListener('change', () => handleModeChange('hebrew'));
  }

  // --- NEW: Click outside to close ---
  document.addEventListener('click', (e) => {
    // If wrapper exists, is visible, and the click was NOT inside the wrapper
    // AND the click was NOT on the toggle button itself (to prevent immediate reopening)
    if (elements.wrapper && 
        elements.wrapper.style.display !== 'none' && 
        !elements.wrapper.contains(e.target) && 
        e.target !== elements.toggle && 
        !elements.toggle.contains(e.target)) { // handle icon inside button
      
      elements.wrapper.style.display = 'none';
    }
  });
  
  // Initial render
  render();
}