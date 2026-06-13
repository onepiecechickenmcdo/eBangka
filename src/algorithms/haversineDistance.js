/**
 * Haversine Formula - Calculate great-circle distance between two coordinates
 *
 * Why Haversine?
 * - Earth is a sphere, not a flat plane
 * - Haversine accounts for spherical geometry and gives accurate distances
 * - Better than simple Euclidean distance for lat/lng coordinates
 *
 * Algorithm:
 * 1. Convert latitude & longitude to radians
 * 2. Calculate differences in coordinates
 * 3. Apply haversine formula to get central angle
 * 4. Multiply by Earth's radius (6371 km) to get distance
 *
 * Time Complexity: O(1) - constant time calculation per distance
 */

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two geographic coordinates using Haversine formula
 *
 * @param {number} lat1 - User's latitude
 * @param {number} lon1 - User's longitude
 * @param {number} lat2 - Station's latitude
 * @param {number} lon2 - Station's longitude
 * @returns {number} Distance in kilometers
 *
 * Example:
 * const distance = calculateDistance(14.5797, 121.0576, 14.5831, 121.0643);
 * console.log(distance); // Distance to nearest station
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Convert all coordinates to radians
  const radLat1 = toRadians(lat1);
  const radLon1 = toRadians(lon1);
  const radLat2 = toRadians(lat2);
  const radLon2 = toRadians(lon2);

  // Calculate differences
  const deltaLat = radLat2 - radLat1;
  const deltaLon = radLon2 - radLon1;

  // Haversine formula
  // a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  // c = 2 * atan2(√a, √(1−a))
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Distance = R * c (where R is Earth's radius)
  const distance = EARTH_RADIUS_KM * c;

  return distance;
}

/**
 * Find the nearest ferry station to user's location
 *
 * Algorithm: Linear scan through all stations
 * - Time Complexity: O(n) where n is number of stations
 * - Space Complexity: O(1) - only tracking minimum distance
 * - For 13 stations, this is very fast (< 1ms)
 *
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 * @param {Object} stationsData - Stations object from schedules.json
 * @returns {Object} Nearest station with distance
 *
 * Returns format:
 * {
 *   station: "Guadalupe",
 *   distance: 1.23,
 *   latitude: 14.5671,
 *   longitude: 121.0453,
 *   address: "Guadalupe, Makati City"
 * }
 */
function findNearestStation(userLat, userLon, stationsData) {
  let nearestStation = null;
  let minDistance = Infinity;

  // Loop through all stations - O(n) operation
  for (const [stationName, stationInfo] of Object.entries(stationsData)) {
    // Skip if station doesn't have coordinates
    if (!stationInfo.latitude || !stationInfo.longitude) {
      continue;
    }

    // Calculate distance to this station
    const distance = calculateDistance(
      userLat,
      userLon,
      stationInfo.latitude,
      stationInfo.longitude,
    );

    // Update minimum if this station is closer
    if (distance < minDistance) {
      minDistance = distance;
      nearestStation = {
        station: stationName,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        latitude: stationInfo.latitude,
        longitude: stationInfo.longitude,
        address: stationInfo.address,
        city: stationInfo.city,
      };
    }
  }

  return nearestStation;
}

module.exports = {
  calculateDistance,
  findNearestStation,
};
