/**
 * eBangka - Frontend Controller
 * State management, dynamic timeline rendering, real-time countdown, and Time Machine simulation.
 */

// Global App State
const socket = io(); // CHAT FIX: Safely instantiate the Socket engine link immediately

const state = {
  stations: [],
  operationalInfo: {},
  selectedStation: null,
  simulatedTime: "08:00",
  timeMachineActive: false,
  favorites: [],
  tickerInterval: null,
  refreshTimelineInterval: null
};

// DOM Cache
const dom = {
  serviceStatusPill: document.getElementById("service-status-pill"),
  serviceStatusText: document.getElementById("service-status-text"),
  stationSearch: document.getElementById("station-search"),
  directionTabs: document.querySelectorAll(".dir-tab"),
  favoritesSection: document.getElementById("favorites-section"),
  favoritesList: document.getElementById("favorites-list"),
  stationsTimeline: document.getElementById("stations-timeline"),
  activeStationPanel: document.getElementById("active-station-panel"),
  stationPlaceholderPanel: document.getElementById("station-placeholder-panel"),
  
  // Location Feature
  findNearestBtn: document.getElementById("find-nearest-btn"),
  locationResult: document.getElementById("location-result"),
  
  // Details pane
  detailStationCity: document.getElementById("detail-station-city"),
  detailStationName: document.getElementById("detail-station-name"),
  detailStationAddress: document.getElementById("detail-station-address"),
  favoriteToggleBtn: document.getElementById("favorite-toggle-btn"),
  
  // Countdown
  countdownTimerDisplay: document.getElementById("countdown-timer-display"),
  countdownSecondaryInfo: document.getElementById("countdown-secondary-info"),
  
  // Time Machine
  timeMachineToggle: document.getElementById("time-machine-toggle"),
  timeMachineControls: document.getElementById("time-machine-controls"),
  timeMachinePicker: document.getElementById("time-machine-picker"),
  useCurrentTimeBtn: document.getElementById("use-current-time-btn"),
  
  // Schedule Grid
  scheduleGrid: document.getElementById("schedule-timeline-grid"),

  // YouTube Live Style Chat Elements
  chatStationSubtitle: document.getElementById("chat-station-subtitle"),
  chatMessages: document.getElementById("chat-messages"),
  chatInput: document.getElementById("chat-input"),
  chatSendBtn: document.getElementById("chat-send-btn"),
  usernamePickerBtn: document.getElementById("username-picker-btn"),
  usernameDisplay: document.getElementById("username-display")
};

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  loadFavorites();
  initTimePicker();
  const userId = initUsername();
  if (socket && userId) {
    socket.emit('authenticate', userId);
  }
  setupEventListeners();
  
  // Fetch initial configuration
  await fetchOperationalInfo();
  await fetchStations();
  
  // Poll timeline info every 60s to refresh next-boat status
  state.refreshTimelineInterval = setInterval(fetchStations, 60000);
});

// ==========================================================================
// Chat Username Identity System
// ==========================================================================
function initUsername() {
  let userId = localStorage.getItem("ebangka_userId");
  if (!userId) {
    userId = "uid_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("ebangka_userId", userId);
  }
  
  // Display current local username placeholder until server confirms
  let username = localStorage.getItem("ebangka_username") || "Commuter";
  if (dom.usernameDisplay) {
    dom.usernameDisplay.textContent = username;
  }
  
  return userId;
}

function promptChangeUsername() {
  const current = localStorage.getItem("ebangka_username") || "";
  const nextUsername = prompt("Enter your new display name (max 15 characters):", current);
  if (nextUsername !== null) {
    const cleaned = nextUsername.trim().substring(0, 15);
    if (cleaned && cleaned !== current) {
      const userId = localStorage.getItem("ebangka_userId");
      if (socket && userId) {
        socket.emit('changeUsername', { userId, newUsername: cleaned });
      }
    }
  }
}

// ==========================================================================
// Local Storage Favorites
// ==========================================================================
function loadFavorites() {
  try {
    const raw = localStorage.getItem("ebangka_favorites");
    state.favorites = raw ? JSON.parse(raw) : [];
    renderFavorites();
  } catch (err) {
    console.error("Failed to load favorites:", err);
    state.favorites = [];
  }
}

function toggleFavorite(stationName) {
  const index = state.favorites.indexOf(stationName);
  if (index === -1) {
    state.favorites.push(stationName);
  } else {
    state.favorites.splice(index, 1);
  }
  
  localStorage.setItem("ebangka_favorites", JSON.stringify(state.favorites));
  renderFavorites();
  updateFavoriteButtonState();
}

function renderFavorites() {
  if (state.favorites.length === 0) {
    dom.favoritesSection.classList.add("hidden");
    return;
  }
  
  dom.favoritesSection.classList.remove("hidden");
  dom.favoritesList.innerHTML = "";
  
  state.favorites.forEach(name => {
    const pill = document.createElement("button");
    pill.className = "favorite-pill";
    pill.innerHTML = `
      <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      <span>${name}</span>
    `;
    pill.addEventListener("click", () => selectStation(name));
    dom.favoritesList.appendChild(pill);
  });
}

function updateFavoriteButtonState() {
  if (!state.selectedStation) return;
  
  const isFav = state.favorites.includes(state.selectedStation.station);
  if (isFav) {
    dom.favoriteToggleBtn.classList.add("starred");
  } else {
    dom.favoriteToggleBtn.classList.remove("starred");
  }
}

// ==========================================================================
// Time Machine Setup
// ==========================================================================
function initTimePicker() {
  const now = new Date();
  const HH = String(now.getHours()).padStart(2, "0");
  const MM = String(now.getMinutes()).padStart(2, "0");
  state.simulatedTime = `${HH}:${MM}`;
  dom.timeMachinePicker.value = state.simulatedTime;
}

// ==========================================================================
// Event Handlers
// ==========================================================================
function setupEventListeners() {
  // Search and tabs filter
  dom.stationSearch.addEventListener("input", filterAndRenderTimeline);
  
  dom.directionTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      dom.directionTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      filterAndRenderTimeline();
    });
  });
  
  // Location-based nearest station button
  dom.findNearestBtn.addEventListener("click", findNearestStation);
  
  // Star icon click
  dom.favoriteToggleBtn.addEventListener("click", () => {
    if (state.selectedStation) {
      toggleFavorite(state.selectedStation.station);
    }
  });
  
  // Time Machine toggle
  dom.timeMachineToggle.addEventListener("change", (e) => {
    state.timeMachineActive = e.target.checked;
    
    if (state.timeMachineActive) {
      dom.timeMachineControls.classList.remove("disabled");
      dom.useCurrentTimeBtn.removeAttribute("disabled");
      dom.timeMachinePicker.removeAttribute("disabled");
      document.querySelector(".time-machine-container").classList.add("active");
    } else {
      dom.timeMachineControls.classList.add("disabled");
      dom.useCurrentTimeBtn.setAttribute("disabled", "true");
      dom.timeMachinePicker.setAttribute("disabled", "true");
      document.querySelector(".time-machine-container").classList.remove("active");
      
      // Update simulated time to match reality on switch-off
      initTimePicker();
    }
    
    // Refresh station stats
    if (state.selectedStation) {
      refreshActiveStationData();
    }
    fetchStations(); // Update timeline counts
  });
  
  // Simulated Time Picker changes
  dom.timeMachinePicker.addEventListener("change", (e) => {
    state.simulatedTime = e.target.value;
    if (state.selectedStation) {
      refreshActiveStationData();
    }
    fetchStations();
  });
  
  // Reset time button
  dom.useCurrentTimeBtn.addEventListener("click", () => {
    initTimePicker();
    state.simulatedTime = dom.timeMachinePicker.value;
    if (state.selectedStation) {
      refreshActiveStationData();
    }
    fetchStations();
  });

  // Username Picker Click
  if (dom.usernamePickerBtn) {
    dom.usernamePickerBtn.addEventListener("click", promptChangeUsername);
  }
}

// ==========================================================================
// API Operations
// ==========================================================================
async function fetchOperationalInfo() {
  try {
    const res = await fetch("/info");
    const info = await res.json();
    state.operationalInfo = info.operational || {};
    updateServiceStatusPill();
  } catch (err) {
    console.error("Failed to load service hours info:", err);
  }
}

function updateServiceStatusPill() {
  const isSunday = new Date().getDay() === 0;
  
  if (isSunday) {
    dom.serviceStatusPill.className = "status-pill status-closed";
    dom.serviceStatusText.textContent = "Service Closed (Sunday)";
    return;
  }
  
  // Check operating hours
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = state.operationalInfo.service_hours?.start_minutes ?? 420;
  const end = state.operationalInfo.service_hours?.end_minutes ?? 1110;
  
  if (currentMinutes < start) {
    dom.serviceStatusPill.className = "status-pill status-closed";
    dom.serviceStatusText.textContent = `Opens at ${state.operationalInfo.service_hours?.start || "7:00 AM"}`;
  } else if (currentMinutes > end) {
    dom.serviceStatusPill.className = "status-pill status-closed";
    dom.serviceStatusText.textContent = `Closed • Ended at ${state.operationalInfo.service_hours?.end || "6:30 PM"}`;
  } else {
    dom.serviceStatusPill.className = "status-pill status-open";
    dom.serviceStatusText.textContent = "Service Active";
  }
}

async function fetchStations() {
  try {
    const res = await fetch("/stations");
    const data = await res.json();
    
    // Fetch count details for each station in parallel
    const stationsWithNext = await Promise.all(
      data.stations.map(async (st) => {
        let url = `/next-ferry/${encodeURIComponent(st.name)}`;
        if (state.timeMachineActive) {
          url += `?time=${state.simulatedTime}`;
        }
        
        try {
          const nextRes = await fetch(url);
          const nextData = await nextRes.json();
          return {
            ...st,
            next_ferry_time: nextData.next_ferry_time || null,
            message: nextData.message || null
          };
        } catch {
          return { ...st, next_ferry_time: null, message: "Off-service" };
        }
      })
    );
    
    state.stations = stationsWithNext;
    filterAndRenderTimeline();
  } catch (err) {
    console.error("Failed to load stations timeline:", err);
    dom.stationsTimeline.innerHTML = `<div class="timeline-skeleton" style="color:#ef4444;">Error connection to server.</div>`;
  }
}

// ==========================================================================
// Render Timeline Map
// ==========================================================================
function filterAndRenderTimeline() {
  const query = dom.stationSearch.value.toLowerCase().trim();
  const activeTab = document.querySelector(".dir-tab.active");
  const selectedDir = activeTab ? activeTab.getAttribute("data-dir") : "all";
  
  const filtered = state.stations.filter(st => {
    // Keyword match
    const nameMatch = st.name.toLowerCase().includes(query);
    const cityMatch = st.city.toLowerCase().includes(query);
    const addressMatch = st.address.toLowerCase().includes(query);
    const queryMatch = nameMatch || cityMatch || addressMatch;
    
    // Direction match
    const dirMatch = selectedDir === "all" || st.direction === selectedDir;
    
    return queryMatch && dirMatch;
  });
  
  renderTimelineHTML(filtered);
}

function renderTimelineHTML(filteredStations) {
  if (filteredStations.length === 0) {
    dom.stationsTimeline.innerHTML = `<div class="timeline-skeleton">No matching stations found.</div>`;
    return;
  }
  
  dom.stationsTimeline.innerHTML = "";
  
  filteredStations.forEach(st => {
    const item = document.createElement("div");
    item.className = "timeline-item";
    if (state.selectedStation && state.selectedStation.station === st.name) {
      item.classList.add("active");
    }
    
    // Status text
    let statusTextStr = "No remaining departures";
    if (st.next_ferry_time) {
      statusTextStr = `Next trip: ${format12h(st.next_ferry_time)}`;
    } else if (st.message) {
      statusTextStr = st.message;
    }
    
    item.innerHTML = `
      <div class="node-dot"></div>
      <div class="timeline-content">
        <div class="station-title-row">
          <span class="station-name">${st.name}</span>
          <span class="station-direction-badge dir-${st.direction}">${st.direction}</span>
        </div>
        <div class="station-desc-row">
          <span class="station-city">${st.city}</span>
          <span class="station-next-mini ${!st.next_ferry_time ? 'no-more' : ''}">${statusTextStr}</span>
        </div>
      </div>
    `;
    
    item.addEventListener("click", () => selectStation(st.name));
    dom.stationsTimeline.appendChild(item);
  });
}

// ==========================================================================
// Select Station
// ==========================================================================
async function selectStation(stationName) {
  // Update class highlighting in timeline elements immediately
  const items = dom.stationsTimeline.querySelectorAll(".timeline-item");
  const timelineStations = Array.from(items);
  
  timelineStations.forEach(el => {
    const elName = el.querySelector(".station-name").textContent;
    if (elName === stationName) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });

  // Pull schedule
  try {
    const scheduleRes = await fetch(`/schedule/${encodeURIComponent(stationName)}`);
    if (!scheduleRes.ok) throw new Error("Station schedule loading failed.");
    const scheduleData = await scheduleRes.json();
    
    state.selectedStation = scheduleData;
    
    dom.stationPlaceholderPanel.classList.add("hidden");
    dom.activeStationPanel.classList.remove("hidden");
    
// Populate header info
    dom.detailStationName.textContent = scheduleData.station;
    dom.detailStationCity.textContent = scheduleData.city;
    dom.detailStationAddress.textContent = scheduleData.address;
    
    // CHAT ENGINE SYNC: Directly extract structural string out of rendering layout
    setTimeout(() => {
        const liveStationName = dom.detailStationName ? dom.detailStationName.textContent.trim() : null;
        if (liveStationName) {
            if (dom.chatStationSubtitle) {
                dom.chatStationSubtitle.textContent = `Live @ ${liveStationName}`;
            }
            if (socket) {
                socket.emit('joinStationChat', liveStationName);
            }
        }
    }, 50); // Small 50ms delay to make absolute sure her DOM paint cycle completes first!
    
    updateFavoriteButtonState();
    await refreshActiveStationData();
    
  } catch (err) {
    console.error("Select station failed:", err);
  }
}

// ==========================================================================
// Load Active Countdown & Schedule Matrix
// ==========================================================================
async function refreshActiveStationData() {
  if (!state.selectedStation) return;
  
  clearInterval(state.tickerInterval);
  
  const stationName = state.selectedStation.station;
  let nextFerryUrl = `/next-ferry/${encodeURIComponent(stationName)}`;
  if (state.timeMachineActive) {
    nextFerryUrl += `?time=${state.simulatedTime}`;
  }
  
  try {
    const nextRes = await fetch(nextFerryUrl);
    const nextData = await nextRes.json();
    
    renderScheduleGrid(nextData.next_ferry_time);
    startCountdown(nextData);
    
  } catch (err) {
    console.error("Refresh active station prediction failed:", err);
  }
}

function renderScheduleGrid(nextFerryTime) {
  const departures = state.selectedStation.departures || [];
  const scheduleMinutes = state.selectedStation.schedule_minutes || [];
  
  dom.scheduleGrid.innerHTML = "";
  
  // Resolve current time limit to determine past vs future
  let borderMinutes;
  if (state.timeMachineActive) {
    borderMinutes = parseTimeStringToMinutes(state.simulatedTime);
  } else {
    const d = new Date();
    borderMinutes = d.getHours() * 60 + d.getMinutes();
  }
  
  departures.forEach((timeStr, idx) => {
    const minutesVal = scheduleMinutes[idx];
    const slot = document.createElement("div");
    slot.className = "schedule-slot";
    slot.textContent = format12h(timeStr);
    
    const isNext = nextFerryTime && parseTimeStringToMinutes(nextFerryTime) === minutesVal;
    
    if (minutesVal < borderMinutes) {
      slot.classList.add("slot-past");
    } else if (isNext) {
      slot.classList.add("slot-next");
    } else {
      slot.classList.add("slot-future");
    }
    
    dom.scheduleGrid.appendChild(slot);
  });
}

// ==========================================================================
// Ticking Countdown Implementation
// ==========================================================================
function startCountdown(nextFerryData) {
  if (state.tickerInterval) clearInterval(state.tickerInterval);
  
  const timerEl = dom.countdownTimerDisplay;
  const descEl = dom.countdownSecondaryInfo;
  
  if (!nextFerryData.next_ferry_time) {
    timerEl.textContent = "--:--";
    timerEl.style.fontSize = "2.2rem";
    descEl.textContent = nextFerryData.message || "Ferry departures completed for today.";
    return;
  }
  
  timerEl.style.fontSize = "3rem";
  const targetTimeStr = nextFerryData.next_ferry_time; // HH:MM in 24h
  const targetMinutes = parseTimeStringToMinutes(targetTimeStr);
  
  // If time machine is enabled, don't tick down seconds; it's a frozen simulated point
  if (state.timeMachineActive) {
    const diffMinutes = nextFerryData.minutes_from_now;
    if (diffMinutes < 0) {
      timerEl.textContent = "Departed";
      descEl.textContent = `Scheduled at ${format12h(targetTimeStr)}`;
    } else {
      timerEl.textContent = `${diffMinutes}m`;
      descEl.textContent = `Scheduled departure at ${format12h(targetTimeStr)} (${diffMinutes} mins remaining from simulated time)`;
    }
    return;
  }
  
  // Live Ticker logic
  const updateTimer = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentSeconds = now.getSeconds();
    
    const totalRemainingSeconds = (targetMinutes - currentMinutes) * 60 - currentSeconds;
    
    if (totalRemainingSeconds <= 0) {
      clearInterval(state.tickerInterval);
      timerEl.textContent = "00m 00s";
      descEl.textContent = "Ferry is boarding / departed. Refreshing schedule...";
      
      // Auto refresh next boat after 2 seconds
      setTimeout(() => {
        refreshActiveStationData();
        fetchStations();
      }, 3000);
      return;
    }
    
    const mins = Math.floor(totalRemainingSeconds / 60);
    const secs = totalRemainingSeconds % 60;
    
    timerEl.textContent = `${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
    descEl.textContent = `Next ferry departure scheduled at ${format12h(targetTimeStr)}`;
  };
  
  // Initial draw and run ticker
  updateTimer();
  state.tickerInterval = setInterval(updateTimer, 1000);
}

// ==========================================================================
// Time Parsing & Formatting Utility Helpers
// ==========================================================================
function parseTimeStringToMinutes(timeStr) {
  // Supports HH:MM 24h or HH:MM AM/PM
  const trimmed = timeStr.trim();
  const twelve = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelve) {
    let hours = parseInt(twelve[1], 10);
    const minutes = parseInt(twelve[2], 10);
    const period = twelve[3].toUpperCase();
    if (period === "AM" && hours === 12) hours = 0;
    else if (period === "PM" && hours !== 12) hours += 12;
    return hours * 60 + minutes;
  }
  
  const twentyFour = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const hours = parseInt(twentyFour[1], 10);
    const minutes = parseInt(twentyFour[2], 10);
    return hours * 60 + minutes;
  }
  
  return 0;
}

function format12h(time24) {
  // HH:MM -> HH:MM AM/PM
  const match = time24.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time24; // Return as-is if already in 12h or other form
  
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? "PM" : "AM";
  
  h = h % 12;
  h = h ? h : 12; // if h is 0, make it 12
  
  return `${h}:${m} ${ampm}`;
}

// ==========================================================================
// Location-Based Feature: Find Nearest Ferry Station
// ==========================================================================

/**
 * Request user's geolocation and find the nearest ferry station
 * Uses browser Geolocation API (requests user permission)
 * Calls backend /nearest-station endpoint with user coordinates
 * 
 * Algorithm Flow:
 * 1. Request user permission via navigator.geolocation.getCurrentPosition
 * 2. Send lat/lng to backend /nearest-station?lat=X&lng=Y
 * 3. Backend uses Haversine formula to find nearest station (O(n) = 13 stations)
 * 4. Display result with distance and navigation link
 */
async function findNearestStation() {
  // Show loading state
  dom.findNearestBtn.disabled = true;
  dom.findNearestBtn.innerHTML = '<span>📍 Getting location...</span>';
  dom.locationResult.classList.add("hidden");

  // Request user's current location
  // This triggers browser permission prompt
  if (!navigator.geolocation) {
    showLocationError("Geolocation not supported by this browser");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => handleLocationSuccess(position),
    (error) => handleLocationError(error)
  );
}

/**
 * Handle successful geolocation retrieval
 * @param {GeolocationPosition} position - Contains coords with latitude and longitude
 */
async function handleLocationSuccess(position) {
  const { latitude, longitude } = position.coords;
  
  try {
    // Call backend endpoint to find nearest station using Haversine
    const url = `/nearest-station?lat=${latitude}&lng=${longitude}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error("Failed to find nearest station");
    }
    
    const nearestStationData = await response.json();
    displayNearestStationResult(nearestStationData, latitude, longitude);
    
  } catch (err) {
    showLocationError(`Error finding nearest station: ${err.message}`);
  } finally {
    // Reset button state
    dom.findNearestBtn.disabled = false;
    dom.findNearestBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><path d="M12 1v6m0 6v6"></path><path d="M4.22 4.22l4.24 4.24m0 5.08l-4.24 4.24"></path><path d="M19.78 4.22l-4.24 4.24m0 5.08l4.24 4.24"></path></svg><span>My Location</span>';
  }
}

/**
 * Handle geolocation errors (permission denied, location unavailable, etc.)
 * @param {GeolocationPositionError} error
 */
function handleLocationError(error) {
  let errorMsg = "Unable to get your location";
  
  switch (error.code) {
    case error.PERMISSION_DENIED:
      errorMsg = "Location permission denied. Enable location access in browser settings.";
      break;
    case error.POSITION_UNAVAILABLE:
      errorMsg = "Location information is not available.";
      break;
    case error.TIMEOUT:
      errorMsg = "Location request timed out.";
      break;
  }
  
  showLocationError(errorMsg);
}

/**
 * Display nearest station result with embedded map and navigation options
 * @param {Object} stationData - Contains station, distance, latitude, longitude, address
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 */
function displayNearestStationResult(stationData, userLat, userLon) {
  const { station, distance, latitude: stationLat, longitude: stationLon, address, city } = stationData;
  
  // Format distance: show in km with 2 decimal places
  const distanceStr = distance < 1 
    ? `${Math.round(distance * 1000)} meters` 
    : `${distance.toFixed(2)} km`;
  
  // Generate unique map ID for this result
  const mapId = `map-${Date.now()}`;
  
  dom.locationResult.innerHTML = `
    <div class="location-card">
      <div class="location-status">
        <svg class="location-check" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
          <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="status-text">Nearest Station Found</span>
      </div>
      <div class="nearest-station-info">
        <h4 class="station-name">${station}</h4>
        <p class="station-meta">${city} • ${distanceStr} away</p>
        <p class="station-address">📍 ${address}</p>
      </div>
      
      <!-- Embedded Map -->
      <div id="${mapId}" class="location-map"></div>
      
      <!-- Distance and Direction Info -->
      <div class="location-map-info">
        <div class="distance-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 8v8M8 12h8"></path>
          </svg>
          <span>${distanceStr}</span>
        </div>
        <p class="direction-hint">📍 Station location shown on map above</p>
      </div>
      
      <div class="location-actions">
        <button class="btn btn-navigate" onclick="openLocationInMaps(${stationLat}, ${stationLon})">
          🗺️ Open in Maps App
        </button>
        <button class="btn btn-select" onclick="selectStation('${station}')">
          View Schedule
        </button>
      </div>
    </div>
  `;
  
  dom.locationResult.classList.remove("hidden");
  
  // Initialize map after DOM is rendered
  setTimeout(() => {
    initializeMap(mapId, userLat, userLon, stationLat, stationLon, station);
  }, 100);
}

/**
 * Initialize embedded map using Leaflet
 * Shows user location and nearest station on interactive map
 */
function initializeMap(mapId, userLat, userLon, stationLat, stationLon, stationName) {
  try {
    // Create map centered between user and station
    const centerLat = (userLat + stationLat) / 2;
    const centerLon = (userLon + stationLon) / 2;
    
    const map = L.map(mapId).setView([centerLat, centerLon], 15);
    
    // Add OpenStreetMap tiles (free, no API key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);
    
    // Add user location marker (blue)
    L.circleMarker([userLat, userLon], {
      radius: 8,
      fillColor: '#06b6d4',
      color: '#0c1524',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map)
      .bindPopup('📍 Your Location', { autoClose: false });
    
    // Add station marker (green)
    L.marker([stationLat, stationLon], {
      icon: L.icon({
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxMGI5ODEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTBjMCA3LTkgMTMtOSAxM3MtOSAtNi05IC0xM2E5IDkgMCAwIDEgMTggMHoiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSIzIj48L2NpcmNsZT48L3N2Zz4=',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      })
    }).addTo(map)
      .bindPopup(`🚤 ${stationName} Station`, { autoClose: false })
      .openPopup();
    
    // Draw line between user and station
    L.polyline([
      [userLat, userLon],
      [stationLat, stationLon]
    ], {
      color: '#06b6d4',
      weight: 2,
      opacity: 0.5,
      dashArray: '5, 5'
    }).addTo(map);
    
    // Fit map to show both points
    const bounds = L.latLngBounds([
      [userLat, userLon],
      [stationLat, stationLon]
    ]);
    map.fitBounds(bounds, { padding: [50, 50] });
    
  } catch (err) {
    console.error('Error initializing map:', err);
    document.getElementById(mapId).innerHTML = '<p style="color: #ef4444; padding: 20px; text-align: center;">Map could not be loaded</p>';
  }
}

/**
 * Open location in native Maps app or Google Maps
 * Works on mobile and desktop
 */
function openLocationInMaps(lat, lng) {
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(mapsUrl, '_blank');
}

/**
 * Show location error message to user
 * @param {string} message - Error message to display
 */
function showLocationError(message) {
  dom.locationResult.innerHTML = `
    <div class="location-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p>${message}</p>
    </div>
  `;
  
  dom.locationResult.classList.remove("hidden");
  
  // Reset button state
  dom.findNearestBtn.disabled = false;
  dom.findNearestBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><path d="M12 1v6m0 6v6"></path><path d="M4.22 4.22l4.24 4.24m0 5.08l-4.24 4.24"></path><path d="M19.78 4.22l-4.24 4.24m0 5.08l4.24 4.24"></path></svg><span>My Location</span>';
}
// ==========================================================================
// Twitch/YouTube Style Sidebar Chat Event Core Logic
// ==========================================================================

if (socket) {
  // 1. Clear out old room bubbles and dump fresh history log
  socket.on('loadHistory', (history) => {
    if (!dom.chatMessages) return;
    dom.chatMessages.innerHTML = ''; 
    history.forEach(appendMessageToUI);
  });

  // 2. Hear real-time broadcasts from other commuting profiles
  socket.on('chatMessage', (msg) => {
    const activeStation = dom.detailStationName ? dom.detailStationName.textContent.trim() : null;
    if (activeStation && msg.stationId === activeStation) {
      appendMessageToUI(msg);
    }
  });

  // 3. Resolve user identity on connection
  socket.on('identityResolved', ({ username }) => {
    localStorage.setItem("ebangka_username", username);
    if (dom.usernameDisplay) {
      dom.usernameDisplay.textContent = username;
    }
  });

  // 4. Handle response of nickname claims
  socket.on('usernameChanged', (result) => {
    if (result.success) {
      localStorage.setItem("ebangka_username", result.username);
      if (dom.usernameDisplay) {
        dom.usernameDisplay.textContent = result.username;
      }
    } else {
      alert("Error: " + (result.error || "Could not change username."));
    }
  });
}

// 3. Helper to format a message row inside the YouTube layout container
function appendMessageToUI(msg) {
  if (!dom.chatMessages) return;
  
  const msgRow = document.createElement("div");
  msgRow.className = "chat-message-row";
  if (msg.isSystem || msg.username === "SYSTEM" || msg.username === "SYSTEM ALERT") {
    msgRow.classList.add("system-alert");
  }
  msgRow.innerHTML = `
    <span class="chat-time">[${msg.timestamp || 'Live'}]</span>
    <strong class="chat-user">${msg.username}:</strong> 
    <span class="chat-body-text">${msg.text}</span>
  `;
  
  dom.chatMessages.appendChild(msgRow);
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight; // Fast-scroll to latest text bubble
}

// 4. Input Listener Dispatches
if (dom.chatSendBtn) dom.chatSendBtn.addEventListener("click", dispatchSocketMessage);
if (dom.chatInput) {
  dom.chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") dispatchSocketMessage();
  });
}

// 5. Gather input payload values and dispatch up via the gateway engine
function dispatchSocketMessage() {
  const activeStation = dom.detailStationName ? dom.detailStationName.textContent.trim() : null;
  if (!activeStation || !dom.chatInput || !dom.chatInput.value.trim()) return;

  if (socket) {
    const savedUsername = localStorage.getItem("ebangka_username") || "Commuter";
    socket.emit('sendMessage', {
      username: savedUsername,
      text: dom.chatInput.value.trim(),
      stationId: activeStation
    });
  }

  dom.chatInput.value = ""; // Zero-out the placeholder box field instantly
}