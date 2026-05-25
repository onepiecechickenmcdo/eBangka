const express = require("express");
const ferryService = require("../services/ferryService");

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
        error: 'Invalid time query. Use 24-hour format, e.g. ?time=17:30',
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

module.exports = router;
