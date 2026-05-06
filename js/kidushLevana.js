// ============================================================================
// kidushLevana.js - Kiddush Levana display state
//
// Uses the average month length (29d 12h 793 chalakim) and a fixed reference
// molad. Every cycle is treated as exactly that length, so day-count and
// halfway-through-month are pure arithmetic.
//
// Reference: Molad of Tishrei 5786 — Mon Sep 22, 2025, 12:10 PM IDT (UTC+3)
// + 7 chalakim (≈ 23.333 sec) → 09:10:23.333 UTC.
// ============================================================================

// 1 chelek = 1/1080 hour = 3600/1080 sec = 10/3 sec
const CHELEK_MS = 10000 / 3;

// Average month: 29.5 days + 793 chalakim
export const MONTH_MS = 29.5 * 86400000 + 793 * CHELEK_MS;

// Tishrei 5786 reference molad in absolute UTC ms
export const MOLAD_REFERENCE_MS = Date.UTC(2025, 8, 22, 9, 10, 23, 333);

// Boundaries
const HOURS_11_DAYS_MS      = 11 * 86400000;   // count-up → countdown switch
const PAST_HALFWAY_GRACE_MS = 2  * 86400000;   // hide after 2 days past halfway

// Colors apply only to the number portion
const COLOR_GREEN  = '#5dd05d';
const COLOR_YELLOW = '#ffcc33';
const COLOR_RED    = '#ff5050';

const PREFIX_EMOJI = '🌙📖';

// Hebrew gematria for day counts 0..11.
// 0 → '' so we render just the time prefix-free during the first 24 hours.
// Single-letter days take a geresh ׳ (U+05F3); 11 takes gershayim ״ (U+05F4).
const HEBREW_DAY_LETTERS = [
  '',     // 0
  'א׳',   // 1
  'ב׳',   // 2
  'ג׳',   // 3
  'ד׳',   // 4
  'ה׳',   // 5
  'ו׳',   // 6
  'ז׳',   // 7
  'ח׳',   // 8
  'ט׳',   // 9
  'י׳',   // 10
  'י״א',  // 11
];

const pad2 = (n) => String(n).padStart(2, '0');

function dayLabel(d) {
  if (d <= 0 || d >= HEBREW_DAY_LETTERS.length) return '';
  return `${HEBREW_DAY_LETTERS[d]} ימים`;
}

/** Split a positive ms duration into whole days + h:m:s residual. */
function decompose(ms) {
  const days = Math.floor(ms / 86400000);
  const r = ms - days * 86400000;
  const h = Math.floor(r / 3600000);
  const m = Math.floor((r % 3600000) / 60000);
  const s = Math.floor((r % 60000) / 1000);
  return { days, h, m, s };
}

/** Find the molad of the lunar month containing `dateMs`. */
function lastMoladAtOrBefore(dateMs) {
  const monthsSince = Math.floor((dateMs - MOLAD_REFERENCE_MS) / MONTH_MS);
  return MOLAD_REFERENCE_MS + monthsSince * MONTH_MS;
}

/**
 * Return the kiddush levana display state for the given Date, or null when
 * the window is closed (more than 2 days past halfway).
 *
 * Returned shape: { hebrew, number, emoji, color }
 *  - hebrew: day-count label (empty for the first 24h)
 *  - number: H:MM:SS, possibly with a leading '-' for past-halfway
 *  - emoji:  decorative prefix (🌙📖)
 *  - color:  applied only to the number portion (green pre-11d, red after)
 *
 * Three-zone layout (rendered by main.js into kl-hebrew / kl-number / kl-emoji
 * spans): hebrew on the left, number in the middle, emoji on the right.
 */
export function getKidushLevanaState(date) {
  const ms = date.getTime();
  const lastMolad = lastMoladAtOrBefore(ms);
  const halfway   = lastMolad + MONTH_MS / 2;
  const elapsed   = ms - lastMolad;

  // Past halfway + 2-day grace: window closed
  if (ms >= halfway + PAST_HALFWAY_GRACE_MS) return null;

  // Past halfway, in 2-day grace: red, negative counter (no day breakdown —
  // total hours grow past 24, more legible as "-25:00:00" than "-1d 1:00:00").
  if (ms >= halfway) {
    const past = ms - halfway;
    const totalH = Math.floor(past / 3600000);
    const m = Math.floor((past % 3600000) / 60000);
    const s = Math.floor((past % 60000) / 1000);
    return {
      hebrew: '',
      number: `-${totalH}:${pad2(m)}:${pad2(s)}`,
      emoji:  PREFIX_EMOJI,
      color:  COLOR_RED,
    };
  }

  // 11 days → halfway: yellow warning countdown. Total hours only — no day
  // breakdown — so the deadline reads as a single tightening clock.
  if (elapsed >= HOURS_11_DAYS_MS) {
    const remaining = halfway - ms;
    const totalH = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return {
      hebrew: '',
      number: `${totalH}:${pad2(m)}:${pad2(s)}`,
      emoji:  PREFIX_EMOJI,
      color:  COLOR_YELLOW,
    };
  }

  // 0 → 11 days: green count UP from molad. Day count rolls forward every 24h.
  const { days, h, m, s } = decompose(elapsed);
  return {
    hebrew: dayLabel(days),
    number: `${h}:${pad2(m)}:${pad2(s)}`,
    emoji:  PREFIX_EMOJI,
    color:  COLOR_GREEN,
  };
}
