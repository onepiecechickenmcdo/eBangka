# eBangka

Web-based **Pasig River Ferry** schedule tracker. Uses static MMDA-style schedule data (no GPS). Computes the next departure and waiting time with **Transform & Conquer** and **Decrease & Conquer (binary search)**.

## Quick start

```bash
cd eBangka
npm install
npm start
```

Server: `http://localhost:3000`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/info` | Service hours, fare, operating days |
| GET | `/stations` | All 13 stations with addresses |
| GET | `/schedule/:station` | Raw schedule + sorted minutes |
| GET | `/next-ferry/:station` | Next ferry and waiting time |
| GET | `/next-ferry/:station?time=17:30` | Same, but pretend current time is 17:30 |

### Example responses

**Next ferry available**

```json
{
  "station": "Guadalupe",
  "next_ferry_time": "17:30",
  "minutes_from_now": 12
}
```

**No more trips today**

```json
{
  "station": "Guadalupe",
  "message": "No more trips today"
}
```

## Algorithm pipeline (DA&A)

### 1. Transform & Conquer (`src/algorithms/timeTransform.js`)

- Input: `"5:30 PM"`, `"7:00 AM"`, or `"17:30"`
- Output: integer minutes from midnight (e.g. `1050`)
- Each station’s departures are converted and **sorted** once at startup

### 2. Decrease & Conquer (`src/algorithms/binarySearch.js`)

- Input: sorted `scheduleMinutes[]`, `currentMinutes`
- Binary search for the **smallest** departure time `>= currentMinutes` (lower bound)
- Time complexity: **O(log n)** per query vs **O(n)** linear scan

### 3. Computation (`src/services/ferryService.js`)

```
waiting_time = next_ferry_minutes - current_minutes
```

If binary search returns no valid index → `"No more trips today"`.

## Project layout

```
eBangka/
├── data/schedules.json      # Raw schedule per station
├── src/
│   ├── algorithms/
│   │   ├── timeTransform.js # Transform & Conquer
│   │   └── binarySearch.js  # Decrease & Conquer
│   ├── services/ferryService.js
│   ├── routes/api.js
│   └── server.js
└── package.json
```

## Data

Schedules in `data/schedules.json` are based on published MMDA / PRFS weekday timetables (representative offsets per station). Edit that file to add stations or change times.
