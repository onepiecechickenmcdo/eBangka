const ferryService = require("../services/ferryService");
const db = require("./db");

<<<<<<< HEAD
const RAIN_WEATHER_ALERTS = [
  "Weather advisory: Active rain detected. Expect wet boarding docks. Please tread carefully.",
  "Weather advisory: Rain showers expected. Boarding gates might be slippery. Stay safe.",
  "Weather advisory: Heavy rain showers observed. Expect minor boarding delays."
];

const STORM_WEATHER_ALERTS = [
  "Weather advisory: Thunderstorm / severe weather warning. Boat speeds may be reduced for safety.",
  "Weather advisory: Storm warning in the area. Ferry services may experience temporary boarding holds.",
  "Weather advisory: Severe weather coming. Please keep lifevests fully secured at all times."
];

function getFormattedTimestamp() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  return `${timeStr} | ${month}-${day}-${year}`;
}

let cachedWeather = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

async function getOrFetchWeather() {
  const now = Date.now();
  if (cachedWeather && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedWeather;
  }
  
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=14.5995&longitude=120.9842&hourly=weather_code,precipitation,rain&forecast_hours=6';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API returned status ${res.status}`);
    const data = await res.json();
    cachedWeather = data;
    lastFetchTime = now;
    return cachedWeather;
  } catch (err) {
    console.error("Error fetching weather from Open-Meteo:", err);
    return cachedWeather; // Return stale cache if error
  }
}

function evaluateWeather(weatherData) {
  if (!weatherData || !weatherData.hourly) {
    return { activeOrComing: false, type: null };
  }
  
  const hourly = weatherData.hourly;
  const hoursToCheck = Math.min(hourly.time.length, 4); // Check current hour + next 3 hours
  
  const stormCodes = [95, 96, 99];
  const rainCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
  
  let rainComing = false;
  let stormComing = false;
  
  for (let i = 0; i < hoursToCheck; i++) {
    const code = hourly.weather_code[i];
    const precip = hourly.precipitation[i] || 0;
    const rain = hourly.rain[i] || 0;
    
    if (stormCodes.includes(code)) {
      stormComing = true;
    } else if (rainCodes.includes(code) || precip > 0 || rain > 0) {
      rainComing = true;
    }
  }
  
  if (stormComing) {
    return { activeOrComing: true, type: 'storm' };
  } else if (rainComing) {
    return { activeOrComing: true, type: 'rain' };
  }
  
  return { activeOrComing: false, type: null };
}

=======
const SYSTEM_ALERTS = [
  "Ferry arriving in 5 minutes.",
  "High passenger volume detected. Expect boarding delays of 10-15 minutes.",
  "Weather advisory: Mild river currents today. Standard speeds observed.",
  "Weather advisory: Active rain detected. Expect wet boarding docks. Please tread carefully.",
  "Notice: High queue size at terminal. Priority boarding active for seniors and PWDs.",
  "Service Advisory: Schedule running smoothly. Boat departures are fully operational.",
  "Notice: Please keep your lifevests secured for the duration of the trip."
];

>>>>>>> 1da9b672766b84b1e19438b2e443e2dcec4b7f2f
function handleStationChat(io) {
  // Start the background system alerts generator
  startSystemAlerts(io);

  io.on('connection', (socket) => {
    let currentRoom = null;
    socket.userId = null;
    socket.username = null;

    // 1. Resolve user identity on connection
    socket.on('authenticate', (userId) => {
      if (!userId) return;
      socket.userId = userId;
      
      // Get or assign unique username in database
      const username = db.getOrCreateUser(userId);
      socket.username = username;
      
      // Send resolved identity back to user
      socket.emit('identityResolved', { username });
    });

    // 2. Handle Username Change request
    socket.on('changeUsername', ({ userId, newUsername }) => {
      if (!userId || !newUsername) return;
      
      const result = db.claimUsername(userId, newUsername);
      if (result.success) {
        socket.username = result.username;
        socket.emit('usernameChanged', { success: true, username: result.username });
      } else {
        socket.emit('usernameChanged', { success: false, error: result.error });
      }
    });

    // 3. Handle user joining a specific station channel
    socket.on('joinStationChat', (stationId) => {
      if (currentRoom) {
        socket.leave(currentRoom);
      }
      
      currentRoom = stationId;
      socket.join(currentRoom);

      // Load existing message history from JSON DB
      let history = db.getStationHistory(currentRoom);
      
<<<<<<< HEAD
=======
      // If history is empty, seed a welcome message so it is not blank
      if (history.length === 0) {
        const welcomeMsg = {
          username: "SYSTEM ALERT",
          text: `Welcome to the ${currentRoom} Community Board. Post updates or questions about ferry status here. Standard safety guidelines apply.`,
          stationId: currentRoom,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: true
        };
        history = db.addMessage(currentRoom, welcomeMsg);
      }
      
>>>>>>> 1da9b672766b84b1e19438b2e443e2dcec4b7f2f
      socket.emit('loadHistory', history);
    });

    // 4. Handle incoming real-time messages from commuters
    socket.on('sendMessage', (msg) => {
      if (!currentRoom || msg.stationId !== currentRoom) return;

      // Use the authenticated username from socket session for security
      const displayName = socket.username || "Anonymous";

      const structuredMessage = {
        username: displayName,
        text: msg.text,
        stationId: currentRoom,
<<<<<<< HEAD
        timestamp: getFormattedTimestamp(),
=======
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
>>>>>>> 1da9b672766b84b1e19438b2e443e2dcec4b7f2f
        isSystem: false
      };

      // Save to persistent database
      db.addMessage(currentRoom, structuredMessage);

      // Broadcast to everyone currently in this station's chat room
      io.to(currentRoom).emit('chatMessage', structuredMessage);
    });

    socket.on('disconnect', () => {
      if (currentRoom) socket.leave(currentRoom);
    });
  });
}

<<<<<<< HEAD
// Emits weather system alerts to all stations if rain/storm is active/coming
async function checkAndBroadcastWeatherAlert(io) {
  try {
    const weatherData = await getOrFetchWeather();
    const status = evaluateWeather(weatherData);
    
    // Only proceed if rain or storm is active/coming
    if (!status.activeOrComing) {
      return;
    }
    
    const stations = ferryService.listStations();
    if (!stations || stations.length === 0) return;
    
    // Select weather-appropriate message array
    const alertTextArray = status.type === 'storm' ? STORM_WEATHER_ALERTS : RAIN_WEATHER_ALERTS;
    const alertText = alertTextArray[Math.floor(Math.random() * alertTextArray.length)];
    
    // Broadcast the weather alert to all stations
    for (const station of stations) {
      const stationName = station.name;
      const structuredMessage = {
        username: "SYSTEM ALERT",
        text: alertText,
        stationId: stationName,
        timestamp: getFormattedTimestamp(),
=======
// Emits system alerts periodically to random stations to simulate real activity
function startSystemAlerts(io) {
  setInterval(() => {
    try {
      const stations = ferryService.listStations();
      if (!stations || stations.length === 0) return;
      
      // Pick a random station
      const randomStation = stations[Math.floor(Math.random() * stations.length)].name;
      
      // Pick a random system alert text
      const alertText = SYSTEM_ALERTS[Math.floor(Math.random() * SYSTEM_ALERTS.length)];
      
      const structuredMessage = {
        username: "SYSTEM ALERT",
        text: alertText,
        stationId: randomStation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
>>>>>>> 1da9b672766b84b1e19438b2e443e2dcec4b7f2f
        isSystem: true
      };
      
      // Add to persistent database
<<<<<<< HEAD
      db.addMessage(stationName, structuredMessage);
      
      // Broadcast to that station's room
      io.to(stationName).emit('chatMessage', structuredMessage);
    }
  } catch (err) {
    console.error("Error checking/broadcasting weather alert:", err);
  }
}

// Emits system alerts periodically to all stations based on real weather reports
function startSystemAlerts(io) {
  // Check and potentially emit immediately on startup
  checkAndBroadcastWeatherAlert(io);
  
  // Cycle every hour (1 hr = 3,600,000 ms)
  setInterval(() => {
    checkAndBroadcastWeatherAlert(io);
  }, 3600000);
=======
      db.addMessage(randomStation, structuredMessage);
      
      // Broadcast to that station's room
      io.to(randomStation).emit('chatMessage', structuredMessage);
      
    } catch (err) {
      console.error("Error generating background system alert:", err);
    }
  }, 45000); // Emits an alert every 45 seconds
>>>>>>> 1da9b672766b84b1e19438b2e443e2dcec4b7f2f
}

module.exports = handleStationChat;