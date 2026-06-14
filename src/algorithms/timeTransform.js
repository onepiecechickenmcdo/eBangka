/**
 * TRANSFORM & CONQUER
 * -------------------
 * Convert human-readable time strings into a unified numeric form
 * (minutes from midnight), then sort each station's schedule.
 *
 * Examples:
 *   "5:30 PM"  -> 1050
 *   "17:30"    -> 1050
 *   "7:00 AM"  -> 420
 */

const TWELVE_HOUR = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
const TWENTY_FOUR_HOUR = /^(\d{1,2}):(\d{2})$/;

/**
 * Parse a single time string into minutes from midnight (0–1439).
 * @param {string} timeStr
 * @returns {number}
 */
function timeStringToMinutes(timeStr) {
  const trimmed = timeStr.trim();

  const twelve = trimmed.match(TWELVE_HOUR);
  if (twelve) {
    let hours = parseInt(twelve[1], 10);
    const minutes = parseInt(twelve[2], 10);
    const period = twelve[3].toUpperCase();

    if (period === "AM") {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }

    return hours * 60 + minutes;
  }

  const twentyFour = trimmed.match(TWENTY_FOUR_HOUR);
  if (twentyFour) {
    const hours = parseInt(twentyFour[1], 10);
    const minutes = parseInt(twentyFour[2], 10);
    return hours * 60 + minutes;
  }

  throw new Error(`Invalid time format: "${timeStr}"`);
}

/**
 * Convert minutes from midnight back to "HH:MM" (24-hour) for API output.
 * @param {number} minutes
 * @returns {string}
 */
function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Get current local time as minutes from midnight.
 * @param {Date} [date]
 * @returns {number}
 */
function getCurrentMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Parse optional "HH:MM" override (for testing/demo).
 * @param {string} time24
 * @returns {number}
 */
function parse24HourTime(time24) {
  return timeStringToMinutes(time24);
}

/**
 * TRANSFORM: Convert an array of time strings -> sorted minutes array.
 * @param {string[]} departureStrings
 * @returns {number[]} sorted ascending
 */
function transformSchedule(departureStrings) {
  const minutes = departureStrings.map(timeStringToMinutes);
  minutes.sort((a, b) => a - b);
  return minutes;
}

module.exports = {
  timeStringToMinutes,
  minutesToTimeString,
  getCurrentMinutes,
  parse24HourTime,
  transformSchedule,
};
