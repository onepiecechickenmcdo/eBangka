const path = require("path");
const fs = require("fs");
const {
  transformSchedule,
  minutesToTimeString,
  getCurrentMinutes,
  parse24HourTime,
} = require("../algorithms/timeTransform");
const { findNextFerryIndex } = require("../algorithms/binarySearch");
const { ROUTE_ORDER } = require("../constants/routeOrder");

const DATA_PATH = path.join(__dirname, "../../data/schedules.json");

/** @type {Record<string, object>} */
let stations = {};
/** @type {object} */
let operational = {};

function normalizeLookupKey(name) {
  return name.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function loadSchedules() {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  operational = raw.operational || {};
  stations = {};

  for (const name of ROUTE_ORDER) {
    const info = raw.stations[name];
    if (!info) continue;

    stations[name] = {
      city: info.city,
      address: info.address,
      latitude: info.latitude,
      longitude: info.longitude,
      departures: info.departures,
      scheduleMinutes: transformSchedule(info.departures),
      routeIndex: ROUTE_ORDER.indexOf(name),
    };
  }
}

loadSchedules();

function normalizeStationKey(name) {
  const lookup = normalizeLookupKey(name);
  return Object.keys(stations).find(
    (key) => normalizeLookupKey(key) === lookup
  );
}

function getOperationalInfo() {
  return operational;
}

function getRouteOrder() {
  return [...ROUTE_ORDER];
}

function listStations() {
  return ROUTE_ORDER.filter((name) => stations[name]).map((name) => ({
    name,
    city: stations[name].city,
    address: stations[name].address,
    route_index: stations[name].routeIndex,
  }));
}

function getStationSchedule(stationName) {
  const key = normalizeStationKey(stationName);
  if (!key) return null;

  const station = stations[key];
  return {
    station: key,
    city: station.city,
    address: station.address,
    route_index: station.routeIndex,
    departures: station.departures,
    schedule_minutes: station.scheduleMinutes,
    schedule_24h: station.scheduleMinutes.map(minutesToTimeString),
  };
}

function isServiceOpen(date = new Date()) {
  const day = date.getDay();
  if (day === 0) {
    return { open: false, message: "No service on Sundays" };
  }

  const minutes = getCurrentMinutes(date);
  const start = operational.service_hours?.start_minutes ?? 420;
  const end = operational.service_hours?.end_minutes ?? 1110;

  if (minutes < start) {
    return {
      open: false,
      message: `Service opens at ${operational.service_hours?.start || "7:00 AM"}`,
    };
  }

  if (minutes > end) {
    return {
      open: false,
      message: `Service ended at ${operational.service_hours?.end || "6:30 PM"}`,
    };
  }

  return { open: true };
}

/**
 * Core pipeline: resolve current time -> binary search -> waiting time.
 * @param {string} stationName
 * @param {{ overrideMinutes?: number, date?: Date }} [options]
 */
function getNextFerry(stationName, options = {}) {
  const key = normalizeStationKey(stationName);
  if (!key) return { error: "Station not found", status: 404 };

  const now = options.date || new Date();
  const skipServiceHours = options.overrideMinutes !== undefined;

  if (!skipServiceHours) {
    const serviceStatus = isServiceOpen(now);
    if (!serviceStatus.open) {
      return {
        station: key,
        message: serviceStatus.message,
      };
    }
  }

  const schedule = stations[key].scheduleMinutes;
  const currentMinutes =
    options.overrideMinutes !== undefined
      ? options.overrideMinutes
      : getCurrentMinutes(now);

  const index = findNextFerryIndex(schedule, currentMinutes);

  if (index === -1) {
    return {
      station: key,
      message: "No more trips today",
    };
  }

  const nextMinutes = schedule[index];
  const waitingMinutes = nextMinutes - currentMinutes;

  return {
    station: key,
    next_ferry_time: minutesToTimeString(nextMinutes),
    minutes_from_now: waitingMinutes,
  };
}

function resolveCurrentMinutes(timeQuery) {
  if (!timeQuery) return undefined;
  return parse24HourTime(timeQuery);
}

module.exports = {
  listStations,
  getStationSchedule,
  getNextFerry,
  getOperationalInfo,
  getRouteOrder,
  resolveCurrentMinutes,
  loadSchedules,
  getAllStations: () => stations,
};
