/**
 * DECREASE & CONQUER (Binary Search)
 * ----------------------------------
 * On a sorted array of departure times (minutes from midnight),
 * find the smallest value that is >= currentTime.
 *
 * This is the classic "lower bound" problem:
 *   index = first i where schedule[i] >= currentTime
 *
 * If no such index exists, there is no more ferry today.
 */

/**
 * Find index of the next ferry departure (lower bound).
 *
 * @param {number[]} sortedSchedule - ascending minutes from midnight
 * @param {number} currentMinutes
 * @returns {number} index of next ferry, or -1 if none remain today
 */
function findNextFerryIndex(sortedSchedule, currentMinutes) {
  if (sortedSchedule.length === 0) return -1;

  let left = 0;
  let right = sortedSchedule.length - 1;
  let result = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (sortedSchedule[mid] >= currentMinutes) {
      result = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return result;
}

module.exports = { findNextFerryIndex };
