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
  let iteration = 1;

  console.log(`\n--- Binary Search for Time: ${currentMinutes} mins ---`);
  console.log(`Schedule: [${sortedSchedule.join(", ")}]`);

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    console.log(`[Iter ${iteration++}] range: [${left}..${right}], mid index: ${mid}, value: ${sortedSchedule[mid]}`);

    if (sortedSchedule[mid] >= currentMinutes) {
      result = mid;
      right = mid - 1;
      console.log(`  -> ${sortedSchedule[mid]} >= ${currentMinutes}: Candidate found (idx: ${result}). Shrinking right: bounds [${left}..${right}]`);
    } else {
      left = mid + 1;
      console.log(`  -> ${sortedSchedule[mid]} < ${currentMinutes}: Target is larger. Shrinking left: bounds [${left}..${right}]`);
    }
  }

  console.log(`Result: Next departure index is ${result} (${result !== -1 ? sortedSchedule[result] + " mins" : "No more trips today"})`);
  console.log(`----------------------------------------------------\n`);

  return result;
}

module.exports = { findNextFerryIndex };
