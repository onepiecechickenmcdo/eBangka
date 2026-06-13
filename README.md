# eBangka

Web-based **Pasig River Ferry** schedule tracker with **location-based guidance**. Uses static MMDA-style schedule data (no GPS). Computes the next departure and waiting time with **Transform & Conquer** and **Decrease & Conquer (binary search)**. Automatically detects the nearest ferry station based on user location.

## Features

✅ Real-time ferry schedule tracking  
✅ Next ferry countdown with live updates  
✅ **Location-based nearest station detection** (NEW)  
✅ Interactive time machine for hypothetical queries  
✅ Favorite stations for quick access  
✅ Mobile-responsive design  
✅ Zero-dependency backend (Node.js + Express only)

## Quick start

```bash
cd eBangka
npm install
npm start
```

Server: `http://localhost:3000`

## API

| Method | Path                              | Description                                 |
| ------ | --------------------------------- | ------------------------------------------- |
| GET    | `/info`                           | Service hours, fare, operating days         |
| GET    | `/stations`                       | All 13 stations with addresses              |
| GET    | `/schedule/:station`              | Raw schedule + sorted minutes               |
| GET    | `/next-ferry/:station`            | Next ferry and waiting time                 |
| GET    | `/next-ferry/:station?time=17:30` | Same, but pretend current time is 17:30     |
| GET    | `/nearest-station?lat=X&lng=Y`    | Find nearest station to user location (NEW) |

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

**Nearest station (NEW)**

```json
{
  "station": "Guadalupe",
  "distance": 1.23,
  "latitude": 14.5671,
  "longitude": 121.0453,
  "address": "Guadalupe, Makati City",
  "city": "Makati City"
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

### 3. Haversine Distance (`src/algorithms/haversineDistance.js`) - NEW

- **Purpose**: Find nearest ferry station using user's location
- **Algorithm**: Haversine formula calculates great-circle distance on Earth's surface
- **Time Complexity**: **O(n)** where n=13 stations (~1-2ms per query)
- **Accuracy**: Accounts for Earth's spherical geometry (vs Euclidean distance)

**Example**:

```
User Location: (14.5720, 121.0563)
Nearby Stations:
  - Guadalupe (14.5671, 121.0453) → 1.17 km ✓ NEAREST
  - Valenzuela (14.5619, 121.0385) → 2.05 km
  - Hulo (14.5567, 121.0317) → 2.95 km
```

### 4. Computation (`src/services/ferryService.js`)

```
waiting_time = next_ferry_minutes - current_minutes
```

If binary search returns no valid index → `"No more trips today"`.

## Project layout

```
eBangka/
├── data/
│   └── schedules.json              # Raw schedule per station + coordinates
├── src/
│   ├── algorithms/
│   │   ├── timeTransform.js        # Transform & Conquer
│   │   ├── binarySearch.js         # Decrease & Conquer
│   │   └── haversineDistance.js    # Haversine (nearest station)
│   ├── services/
│   │   └── ferryService.js
│   ├── routes/
│   │   └── api.js                  # Includes /nearest-station endpoint
│   └── server.js
├── public/
│   ├── index.html                  # Includes location button
│   ├── js/app.js                   # Geolocation integration
│   └── css/style.css               # Location UI styles
└── package.json
```

## Location-Based Feature

### How It Works

1. User clicks **"My Location"** button in sidebar
2. Browser requests location permission (Geolocation API)
3. Frontend sends coordinates to backend `/nearest-station` endpoint
4. Backend calculates distances using **Haversine formula**
5. Backend returns nearest station with distance
6. Frontend displays result with **embedded interactive map** and options to navigate or view schedule

### Embedded Map

The app now includes an **interactive embedded map** (powered by **Leaflet.js** + **OpenStreetMap**) that displays:

- 🔵 **User location** (blue circle marker)
- 🟢 **Nearest ferry station** (green pin marker)
- 📍 **Distance line** (dashed cyan line showing path)
- 🗺️ **Pan & zoom** controls for exploring the area
- 📱 **Mobile-optimized** - works on iOS Safari, Chrome Mobile, Firefox Mobile

**No API key required** - uses free OpenStreetMap tiles for complete offline compatibility.

### Why Haversine?

Earth is a sphere, not a flat plane. Haversine formula:

- ✅ Accounts for spherical geometry
- ✅ Accurate for all distances
- ✅ Fast: O(1) per distance calculation
- ❌ Euclidean distance would give ~3-5% error

### Supported Browsers

- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)
- ✅ Safari 13.1+ (requires HTTPS in production)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile, Firefox Mobile)

## Data

Schedules in `data/schedules.json` are based on published MMDA / PRFS weekday timetables (representative offsets per station). Each station now includes **latitude and longitude** for location-based features.

### All 13 Stations

| Station      | City             | Lat     | Lon      |
| ------------ | ---------------- | ------- | -------- |
| Pinagbuhatan | Pasig City       | 14.5797 | 121.0576 |
| San Joaquin  | Pasig City       | 14.5831 | 121.0643 |
| Maybunga     | Pasig City       | 14.5876 | 121.0711 |
| Kalawaan     | Pasig City       | 14.5921 | 121.0779 |
| Guadalupe    | Makati City      | 14.5671 | 121.0453 |
| Valenzuela   | Makati City      | 14.5619 | 121.0385 |
| Hulo         | Mandaluyong City | 14.5567 | 121.0317 |
| Lambingan    | Manila City      | 14.5521 | 121.0249 |
| Sta. Ana     | Manila City      | 14.5475 | 121.0181 |
| PUP          | Manila City      | 14.5429 | 121.0113 |
| Lawton       | Manila City      | 14.5383 | 121.0045 |
| Escolta      | Manila City      | 14.5337 | 120.9977 |
| Quinta       | Manila City      | 14.5291 | 120.9909 |

## Documentation

- **[LOCATION_FEATURE.md](LOCATION_FEATURE.md)** - Complete guide to the location feature, algorithm explanation, and testing
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick reference for developers, code walkthrough, and troubleshooting
