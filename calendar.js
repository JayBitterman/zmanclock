// Use dynamic import for the library from esm.sh
let toJewishDate, toGregorianDate, isLeapYear, calcDaysInMonth, JewishMonth;

import('https://esm.sh/jewish-date@2.0.20')
    .then(module => {
        // Assign the named exports to variables
        ({ JewishMonth, toJewishDate, toGregorianDate, isLeapYear, calcDaysInMonth } = module);

        // Initialize dates and render calendar after the library is loaded
        currentGregorianDate = new Date(); // Get today's Gregorian date

        const libJewishDate = toJewishDate(currentGregorianDate); // Get the Hebrew date from the library

        // Get the user's Nisan-based month number based on the monthName from the library
        const userMonth = hebrewMonthNameToUserMonthNumber[libJewishDate.monthName];

        // Store the Hebrew date with the user's Nisan-based month number
        currentHebrewDate = {
            year: libJewishDate.year,
            month: userMonth, // Use the mapped user month number
            day: libJewishDate.day,
            monthName: libJewishDate.monthName // Keep the month name for potential display consistency
        };

        renderCalendar();
    })
    .catch(err => {
        console.error("Failed to load jewish-date library:", err);
        // Display an error message to the user
        monthYearDisplay.textContent = "Error loading calendar.";
        prevMonthBtn.disabled = true;
        nextMonthBtn.disabled = true;
        goButton.disabled = true;
        calendarTypeRadios.forEach(radio => radio.disabled = true);
    });

const monthInput = document.getElementById('month-input');
const dayInput = document.getElementById('day-input');
const yearInput = document.getElementById('year-input');
const goButton = document.getElementById('go-button');
const monthYearDisplay = document.getElementById('month-year');
const daysGrid = document.getElementById('days-grid');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const calendarTypeRadios = document.querySelectorAll('input[name="calendarType"]');
const weekdaysDisplay = document.getElementById('weekdays');
const calendarContainer = document.querySelector('.calendar-container'); // Get the main container


let currentGregorianDate; // Will be initialized after library load
let currentHebrewDate;    // Will be initialized after library load (Nisan-based month and library's monthName)
let currentCalendar = 'gregorian'; // 'gregorian' or 'hebrew'

const gregorianMonths = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// 1-indexed Hebrew month names (using standard transliteration or Hebrew) - Nisan based
const hebrewMonths = [
    "", // 0 index is empty for 1-based indexing
    "ניסן", "אייר", "סיון", "תמוז", "אב", "אלול",
    "תשרי", "חשון", "כסלו", "טבת", "שבט",
    "אדר", // Index 12 for Adar/Adar I
    "אדר ב׳" // Index 13 for Adar II (only in leap years)
];

// Mapping from Hebrew month name (string from library) to user's Nisan-based month number (1-13)
const hebrewMonthNameToUserMonthNumber = {
    "Nisan": 1, "Iyyar": 2, "Sivan": 3, "Tammuz": 4, "Av": 5, "Elul": 6,
    "Tishri": 7, "Cheshvan": 8, "Kislev": 9, "Tevet": 10, "Shevat": 11,
    "Adar": 12, // Both Adar and Adar I from library map to user month 12
    "Adar I": 12,
    "AdarII": 13 // Adar II maps to user month 13
};


const gregorianWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hebrewWeekdays = ["יום א'", "יום ב'", "יום ג'", "יום ד'", "יום ה'", "יום ו'", "שבת"];

// Function to convert number to Hebrew numeral for days 1-31
function numberToHebrewNumeral(num) {
    if (num < 1 || num > 31 || isNaN(num)) {
        return num.toString(); // Return as string for numbers outside the range or invalid
    }

    if (num === 15) return "ט\"ו";
    if (num === 16) return "ט\"ז";

    const units = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
    const tens = ["", "י", "כ", "ל"];

    if (num >= 1 && num <= 9) { // Numbers 1-9
        return units[num];
    } else if (num === 10) { // Number 10
        return tens[1]; // "י"
    } else if (num >= 11 && num <= 19) { // Numbers 11-19 (excluding 15, 16)
         // Already handled 15 and 16 above
        return tens[1] + units[num - 10]; // Combine yud with the unit (e.g., יא, יב)
    } else if (num >= 20 && num <= 29) { // Numbers 20-29
        return tens[2] + units[num - 20]; // Combine chaf with the unit (e.g., כא, כב)
    } else if (num === 30) { // Number 30
        return tens[3]; // "ל"
    } else if (num === 31) { // Number 31
         return tens[3] + units[num - 30]; // Combine lamed with the unit (לא)
    }
    return num.toString(); // Fallback
}

function renderCalendar() {
    const monthTypes = {
    /*  1–6  : spring–summer months  */
     1: JewishMonth.Nisan,
     2: JewishMonth.Iyyar,
     3: JewishMonth.Sivan,
     4: JewishMonth.Tammuz,
     5: JewishMonth.Av,
     6: JewishMonth.Elul,
  
    /*  7–12 : autumn–winter months  */
     7: JewishMonth.Tishri,
     8: JewishMonth.Cheshvan,
     9: JewishMonth.Kislev,
    10: JewishMonth.Tevet,
    11: JewishMonth.Shevat,
    12: JewishMonth.Adar,
  
    /*  13   : only used in leap-years (אדר ב)  */
    13: JewishMonth.AdarII
  };
    if (!toJewishDate) { // Check if library functions are loaded
        // Library not loaded yet, do nothing or maintain loading state
        return;
    }

    daysGrid.innerHTML = ''; // Clear previous days
    weekdaysDisplay.innerHTML = ''; // Clear previous weekdays

    const year = (currentCalendar === 'gregorian') ? currentGregorianDate.getFullYear() : currentHebrewDate.year;
    // For Hebrew, use the user's month number when calling library functions
    const userMonth = (currentCalendar === 'hebrew') ? currentHebrewDate.month : null;
    const month = (currentCalendar === 'gregorian') ? currentGregorianDate.getMonth() : userMonth -1; // 0-indexed user month for some logic


    const isLeapHebrewYear = (currentCalendar === 'hebrew') ? isLeapYear(year) : false;
     // Use the user's month number when calculating days in month with the library
    const daysInTheMonth = (currentCalendar === 'hebrew') ? calcDaysInMonth(year, currentHebrewDate.month) : new Date(year, month + 1, 0).getDate();


    let firstDayOfWeek; // 0 for Sunday, 6 for Saturday

    if (currentCalendar === 'gregorian') {
        calendarContainer.classList.remove('hebrew');
        const firstDayOfMonth = new Date(year, month, 1);
        firstDayOfWeek = firstDayOfMonth.getDay();

         monthYearDisplay.textContent = `${gregorianMonths[month]} ${year}`;
         gregorianWeekdays.forEach(day => {
             const div = document.createElement('div');
             div.textContent = day;
             weekdaysDisplay.appendChild(div);
         });


    } else { // Hebrew Calendar
        calendarContainer.classList.add('hebrew');
        // Need to find the Gregorian date corresponding to the 1st of the Hebrew month to get the weekday
         // Use the user's month number when getting the Gregorian date for the 1st of the month
        const firstDayOfHebrewMonthGregorian = toGregorianDate({ year: year, monthName: monthTypes[userMonth], day: 1 });
        firstDayOfWeek = firstDayOfHebrewMonthGregorian.getDay(); // Day of week for the 1st of the Hebrew month (0=Sun, 6=Sat in Gregorian week)


        // Display Hebrew month name based on user's month and leap year status
        let displayedMonthName;
        if (userMonth === 12 && isLeapHebrewYear) {
            displayedMonthName = "אדר א׳";
        } else {
            displayedMonthName = hebrewMonths[userMonth];
        }
        monthYearDisplay.textContent = `${displayedMonthName} ${year}`;


         hebrewWeekdays.forEach(day => {
             const div = document.createElement('div');
             div.textContent = day;
             weekdaysDisplay.appendChild(div);
         });
    }

    // Populate days grid
    const totalCells = 42; // 6 weeks * 7 days
    const daysFromPrevMonth = firstDayOfWeek; // Number of days from the previous month to show for padding
    const daysFromNextMonth = totalCells - daysFromPrevMonth - daysInTheMonth; // Number of days from the next month

    // Add padding days from the previous month
    let prevMonthGregorianLastDay = (currentCalendar === 'gregorian') ? new Date(year, month, 0).getDate() : null;

    // Get the previous month in the user's numbering system
    let prevMonthUser = currentHebrewDate.month === 1 ? 13 : currentHebrewDate.month - 1; // User month numbering
    let prevYearJewish = currentHebrewDate.month === 1 ? year - 1 : year;
     // Use the previous user month number for calculation with the library
    const daysInPrevMonthFull = (currentCalendar === 'hebrew') ? calcDaysInMonth(prevYearJewish, prevMonthUser) : prevMonthGregorianLastDay;


    for (let i = 0; i < daysFromPrevMonth; i++) {
        const day = document.createElement('div');
        day.classList.add('day', 'other-month');
        const dayNumber = daysInPrevMonthFull - (daysFromPrevMonth - i) + 1;
        day.textContent = (currentCalendar === 'gregorian') ? dayNumber : numberToHebrewNumeral(dayNumber);
        daysGrid.appendChild(day);
    }


    // Add days of the current month
    for (let i = 1; i <= daysInTheMonth; i++) {
        const day = document.createElement('div');
        day.classList.add('day');
        day.textContent = (currentCalendar === 'gregorian') ? i : numberToHebrewNumeral(i);

        // Highlight today
        const today = new Date();
        if (currentCalendar === 'gregorian') {
            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                day.classList.add('today');
            }
        } else { // Hebrew Calendar
             const todayJewish = toJewishDate(today); // Get Hebrew date from library
             // Get the user's month number for today based on monthName
             const todayJewishUserMonth = hebrewMonthNameToUserMonthNumber[todayJewish.monthName];
             if (i === todayJewish.day && currentHebrewDate.month === todayJewishUserMonth && year === todayJewish.year) {
                 day.classList.add('today');
             }
        }

        // Highlight selected date from inputs (input is in user's system)
        if (currentCalendar === 'gregorian') {
            if (parseInt(dayInput.value) === i && parseInt(monthInput.value) - 1 === month && parseInt(yearInput.value) === year) {
                 day.classList.add('selected');
            }
        } else { // Hebrew Calendar
             let inputMonthJewish = parseInt(monthInput.value); // User's month
             let currentMonthJewish = currentHebrewDate.month; // User month
             let inputYearJewish = parseInt(yearInput.value);
             let currentYearJewish = year;

            // Input month is already in user's system (1-13). No adjustment needed here for comparison.

             if (parseInt(dayInput.value) === i && inputMonthJewish === currentMonthJewish && inputYearJewish === currentYearJewish) {
                 day.classList.add('selected');
            }
        }

        day.addEventListener('click', () => {
            // Remove existing selected class
            const selectedDay = daysGrid.querySelector('.day.selected');
            if (selectedDay) {
                selectedDay.classList.remove('selected');
            }
            day.classList.add('selected');

            // Update input fields based on current calendar
            if (currentCalendar === 'gregorian') {
                const clickedGregorianDate = new Date(year, month, i);
                monthInput.value = clickedGregorianDate.getMonth() + 1;
                dayInput.value = clickedGregorianDate.getDate();
                yearInput.value = clickedGregorianDate.getFullYear();
            } else { // Hebrew Calendar
                 // Use the current displayed Hebrew month and year, and the clicked day
                monthInput.value = currentHebrewDate.month; // User's month number
                dayInput.value = i; // The clicked day number
                yearInput.value = currentHebrewDate.year; // The year of the displayed calendar

                // Update currentHebrewDate to reflect the selected day in the current month and year
                currentHebrewDate.day = i;
                 // The month and year of currentHebrewDate are already correct for the displayed month/year
            }
            handleInputDate(); 
        });

        daysGrid.appendChild(day);
    }

    // Add padding days from the next month
     for (let i = 1; i <= daysFromNextMonth; i++) {
        const day = document.createElement('div');
        day.classList.add('day', 'other-month');
        day.textContent = (currentCalendar === 'gregorian') ? i : numberToHebrewNumeral(i); // Display next month days as Hebrew numerals
        daysGrid.appendChild(day);
    }
}

// Event listeners for navigation buttons
prevMonthBtn.addEventListener('click', () => {
    if (!toJewishDate) return; // Prevent navigation if library not loaded

    if (currentCalendar === 'gregorian') {
        currentGregorianDate.setMonth(currentGregorianDate.getMonth() - 1);
    } else {
        // Navigate Hebrew months using user's 1-13 system
        let currentMonthUser = currentHebrewDate.month;
        let currentYearJewish = currentHebrewDate.year;

        if (currentMonthUser === 1) { // If Nisan (1), go to Elul (12) of previous year
            currentHebrewDate = { year: currentYearJewish - 1, month: 12, day: currentHebrewDate.day };
        } else if (currentMonthUser === 13) { // If Adar II (13), go to Adar I (12)
             currentHebrewDate = { year: currentYearJewish, month: 12, day: currentHebrewDate.day };
        }
        else {
            currentHebrewDate = { year: currentYearJewish, month: currentMonthUser - 1, day: currentHebrewDate.day };
        }
         // Adjust day if necessary (e.g., moving from a 30-day month to a 29-day month)
        // Use the new user month number for calculation with the library
        const daysInMonth = calcDaysInMonth(currentHebrewDate.year, currentHebrewDate.month);
        if (currentHebrewDate.day > daysInMonth) {
            currentHebrewDate.day = daysInMonth;
        }
    }
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    if (!toJewishDate) return; // Prevent navigation if library not loaded

    if (currentCalendar === 'gregorian') {
        currentGregorianDate.setMonth(currentGregorianDate.getMonth() + 1);
    } else {
        // Navigate Hebrew months using user's 1-13 system
         let currentMonthUser = currentHebrewDate.month;
        let currentYearJewish = currentHebrewDate.year;
        const isLeapYearCurrent = isLeapYear(currentYearJewish);

        if (currentMonthUser === 12 && isLeapYearCurrent) { // If Adar I (12) in a leap year, go to Adar II (13)
             currentHebrewDate = { year: currentYearJewish, month: 13, day: currentHebrewDate.day };
        } else if (currentMonthUser === 12 && !isLeapYearCurrent) { // If Adar (12) in a non-leap year, go to Nisan (1) of next year
             currentHebrewDate = { year: currentYearJewish + 1, month: 1, day: currentHebrewDate.day };
        } else if (currentMonthUser === 13) { // If Adar II (13), go to Nisan (1) of next year
             currentHebrewDate = { year: currentYearJewish + 1, month: 1, day: currentHebrewDate.day };
        }
        else {
            currentHebrewDate = { year: currentYearJewish, month: currentMonthUser + 1, day: currentHebrewDate.day };
        }

        // Adjust day if necessary
        // Use the new user month number for calculation with the library
        const daysInNextMonth = calcDaysInMonth(currentHebrewDate.year, currentHebrewDate.month);
         if (currentHebrewDate.day > daysInNextMonth) {
            currentHebrewDate.day = daysInNextMonth;
        }

    } 
    renderCalendar();
});

// Event listener for the Go button
goButton.addEventListener('click', () => {
    handleInputDate();
});

// Event listeners for calendar type selection
calendarTypeRadios.forEach(radio => {
    radio.addEventListener('change', (event) => {
        currentCalendar = event.target.value;
        // Clear input fields when switching calendar types
        monthInput.value = '';
        dayInput.value = '';
        yearInput.value = '';

        // Add/remove hebrew class for RTL
        if (currentCalendar === 'hebrew') {
            calendarContainer.classList.add('hebrew');
        } else {
            calendarContainer.classList.remove('hebrew');
        }

        // Render the calendar for the current date in the new calendar system
        if (currentCalendar === 'gregorian') {
             currentGregorianDate = new Date(); // Reset to today's Gregorian date
             // Update Hebrew date based on today's Gregorian date
             if (toJewishDate) { // Ensure library is loaded
                const libJewishDate = toJewishDate(currentGregorianDate);
                const userMonth = hebrewMonthNameToUserMonthNumber[libJewishDate.monthName];
                 currentHebrewDate = {
                     year: libJewishDate.year,
                     month: userMonth,
                     day: libJewishDate.day,
                     monthName: libJewishDate.monthName
                 };
             }
        } else { // Switching to Hebrew
             currentGregorianDate = new Date(); // Get today's Gregorian date
             if (toJewishDate) { // Ensure library is loaded
                 const libJewishDate = toJewishDate(currentGregorianDate);
                const userMonth = hebrewMonthNameToUserMonthNumber[libJewishDate.monthName];
                 currentHebrewDate = {
                     year: libJewishDate.year,
                     month: userMonth,
                     day: libJewishDate.day,
                     monthName: libJewishDate.monthName
                 };
             }
        }
        renderCalendar();
    });
});


/* ------------------------------------------------------------------
   COMPLETE replacement for the calendar’s handleInputDate() function
   ------------------------------------------------------------------ */

   function handleInputDate() {
    const monthTypes = {
        /*  1–6  : spring–summer months  */
         1: JewishMonth.Nisan,
         2: JewishMonth.Iyyar,
         3: JewishMonth.Sivan,
         4: JewishMonth.Tammuz,
         5: JewishMonth.Av,
         6: JewishMonth.Elul,
      
        /*  7–12 : autumn–winter months  */
         7: JewishMonth.Tishri,
         8: JewishMonth.Cheshvan,
         9: JewishMonth.Kislev,
        10: JewishMonth.Tevet,
        11: JewishMonth.Shevat,
        12: JewishMonth.Adar,
      
        /*  13   : only used in leap-years (אדר ב)  */
        13: JewishMonth.AdarII
      };
    if (!toJewishDate) {        // dynamic import not finished yet
      alert("Calendar library not loaded yet. Please try again.");
      return;
    }
  
    const m = parseInt(monthInput.value, 10);   // user month (1-13 or 1-12)
    const d = parseInt(dayInput.value,   10);
    const y = parseInt(yearInput.value,  10);
  
    if (Number.isNaN(m) || Number.isNaN(d) || Number.isNaN(y)) {
      alert("Please enter numbers for month, day, and year.");
      return;
    }
  
    let gDateSelected;   // ← will become a native JS Date @ 00:00 local
    let ok = false;      // tracks success so we know when to broadcast
  
    /* ----------------------------------------------------------------
       GREGORIAN input
       ---------------------------------------------------------------- */
    if (currentCalendar === "gregorian") {
      // JS months are 0-based
      const test = new Date(y, m - 1, d);
  
      if (test.getFullYear() === y &&
          test.getMonth()      === m - 1 &&
          test.getDate()       === d) {
  
        currentGregorianDate = test;
  
        // keep the Hebrew mirror date up to date
        const libJew = toJewishDate(test);
        currentHebrewDate = {
          year : libJew.year,
          month: hebrewMonthNameToUserMonthNumber[libJew.monthName],
          day  : libJew.day,
          monthName: libJew.monthName
        };
  
        gDateSelected = test;
        ok = true;
  
      } else {
        alert("That Gregorian date doesn’t exist.");
      }
  
    /* ----------------------------------------------------------------
       HEBREW input
       ---------------------------------------------------------------- */
    } else {
  
      try {
        // quick sanity checks
        if (m < 1 || m > 13)               throw new Error("Month outside 1-13.");
        if (m === 13 && !isLeapYear(y))    throw new Error("Month 13 only in a leap year.");
  
        // jewish-date will throw if the day/month combo is impossible
        gDateSelected = toGregorianDate({ year: y, monthName: monthTypes[m], day: d });
  
        currentHebrewDate = {
          year : y,
          month: m,
          day  : d,
          monthName: hebrewMonths[m]
        };
  
        currentGregorianDate = gDateSelected;
        ok = true;
  
      } catch (err) {
        alert("That Hebrew date doesn’t exist.");
        console.error(err);
      }
    }
  
    /* ----------------------------------------------------------------
       Calendar UI refresh  +  🔔 NOTIFY THE CLOCK 🔔
       ---------------------------------------------------------------- */
    if (ok) {
      renderCalendar();                                  // redraw picker
  
      // make sure the time-of-day stays unchanged (midnight local)
      const midnightLocal = new Date(gDateSelected.setHours(0, 0, 0, 0));
  
      window.dispatchEvent(
        new CustomEvent("calendarDateSelected", { detail: { gDate: midnightLocal } })
      );
    }
  }
  

