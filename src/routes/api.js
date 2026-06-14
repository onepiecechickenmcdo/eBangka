const express = require("express");
const ferryService = require("../services/ferryService");
const { findNearestStation } = require("../algorithms/haversineDistance");

const router = express.Router();

router.get("/info", (_req, res) => {
  res.json({
    service: "Pasig River Ferry Service",
    operational: ferryService.getOperationalInfo(),
    station_count: ferryService.listStations().length,
  });
});

router.get("/stations", (_req, res) => {
  res.json({
    operational: ferryService.getOperationalInfo(),
    stations: ferryService.listStations(),
  });
});

router.get("/schedule/:station", (req, res) => {
  const data = ferryService.getStationSchedule(req.params.station);
  if (!data) {
    return res.status(404).json({ error: "Station not found" });
  }
  res.json(data);
});

router.get("/next-ferry/:station", (req, res) => {
  let overrideMinutes;
  if (req.query.time) {
    try {
      overrideMinutes = ferryService.resolveCurrentMinutes(req.query.time);
    } catch (err) {
      return res.status(400).json({
        error: "Invalid time query. Use 24-hour format, e.g. ?time=17:30",
      });
    }
  }

  const result = ferryService.getNextFerry(req.params.station, {
    overrideMinutes,
  });

  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  res.json(result);
});

/**
 * GET /nearest-station?lat=LATITUDE&lng=LONGITUDE
 *
 * Finds the nearest ferry station to the user's location
 * Uses Haversine formula to calculate great-circle distance
 *
 * Query Parameters:
 *   - lat (required): User's latitude (-90 to 90)
 *   - lng (required): User's longitude (-180 to 180)
 *
 * Response:
 * {
 *   "station": "Guadalupe",
 *   "distance": 1.23,
 *   "latitude": 14.5671,
 *   "longitude": 121.0453,
 *   "address": "Guadalupe, Makati City",
 *   "city": "Makati City"
 * }
 *
 * Error cases:
 *   - Missing lat or lng parameters
 *   - Invalid coordinate values
 *   - No stations found in database
 */
router.get("/nearest-station", (req, res) => {
  // Extract latitude and longitude from query parameters
  const { lat, lng } = req.query;

  // Validate that both parameters are provided
  if (!lat || !lng) {
    return res.status(400).json({
      error: "Missing parameters. Required: lat and lng",
      example: "/nearest-station?lat=14.5797&lng=121.0576",
    });
  }

  // Parse and validate coordinates
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({
      error: "Invalid coordinates. lat and lng must be numbers",
    });
  }

  // Validate latitude range: -90 to 90
  if (latitude < -90 || latitude > 90) {
    return res.status(400).json({
      error: "Invalid latitude. Must be between -90 and 90",
    });
  }

  // Validate longitude range: -180 to 180
  if (longitude < -180 || longitude > 180) {
    return res.status(400).json({
      error: "Invalid longitude. Must be between -180 and 180",
    });
  }

  try {
    // Get all stations from the ferry service
    const stations = ferryService.getAllStations();

    // Find the nearest station using Haversine formula
    // Algorithm: O(n) - loops through all stations once
    const nearestStation = findNearestStation(latitude, longitude, stations);

    // Check if any station was found
    if (!nearestStation) {
      return res.status(500).json({
        error: "No stations with coordinates found",
      });
    }

    const nextFerry = ferryService.getNextFerry(nearestStation.station);

    // Return the nearest station result with the station's current service status.
    res.json({
      ...nearestStation,
      status: nextFerry.next_ferry_time
        ? `Next ferry at ${nextFerry.next_ferry_time}`
        : nextFerry.message || "Status unavailable",
      next_ferry_time: nextFerry.next_ferry_time || null,
      minutes_from_now: nextFerry.minutes_from_now ?? null,
    });
  } catch (error) {
    console.error("Error finding nearest station:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;
