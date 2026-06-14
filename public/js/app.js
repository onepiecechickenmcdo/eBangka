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
  usernameDisplay: document.getElementById("username-display"),
  usernameForm: document.getElementById("username-form"),
  usernameInput: document.getElementById("username-input"),
  usernameErrorMessage: document.getElementById("username-error-message"),
  usernameCancelButtons: document.querySelectorAll(".username-cancel-btn")
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
  
  window.addEventListener("resize", updateRouteLineForActiveTab);

  if (dom.findNearestBtn) {
    dom.findNearestBtn.addEventListener("click", findNearestStation);
  }

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

  if (dom.usernamePickerBtn) {
    dom.usernamePickerBtn.addEventListener("click", toggleUsernameForm);
  }

  if (dom.usernameForm) {
    dom.usernameForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleUsernameChange();
    });
  }

  if (dom.usernameCancelButtons?.length) {
    dom.usernameCancelButtons.forEach((btn) => {
      btn.addEventListener("click", closeUsernameForm);
    });
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
    dom.serviceStatusText.textContent = `Closed - Ended at ${state.operationalInfo.service_hours?.end || "6:30 PM"}`;
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
// Render Timeline
// ==========================================================================

function filterAndRenderTimeline() {
  const query = dom.stationSearch.value.toLowerCase().trim();
  
  const filtered = state.stations.filter(st => {
    const nameMatch = st.name.toLowerCase().includes(query);
    const cityMatch = st.city.toLowerCase().includes(query);
    const addressMatch = st.address.toLowerCase().includes(query);
    return nameMatch || cityMatch || addressMatch;
  });
  
  renderTimelineHTML(filtered);
  updateRouteLineForActiveTab();
}

function renderTimelineHTML(filteredStations) {
  if (filteredStations.length === 0) {
    dom.stationsTimeline.innerHTML = `<div class="timeline-skeleton">No matching stations found.</div>`;
    updateRouteLineForActiveTab();
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
  updateRouteLineForActiveTab();
}

function updateRouteLineForActiveTab() {
  const routeLines = document.querySelectorAll(".route-river-line");
  const activeLine = document.querySelector('.route-river-line[data-dir="all"]');

  routeLines.forEach(line => {
    line.classList.toggle("active", line === activeLine);
    if (line !== activeLine) {
      line.style.height = "0px";
      line.style.top = "0px";
    }
  });

  if (!activeLine) return;

  const measureLine = () => {
    const routeContainer = dom.stationsTimeline.closest(".route-container");
    if (!routeContainer) return;

    const items = dom.stationsTimeline.querySelectorAll(".timeline-item");
    if (items.length === 0) {
      activeLine.style.top = "0px";
      activeLine.style.height = "0px";
      return;
    }

    const firstDot = items[0].querySelector(".node-dot");
    const lastDot = items[items.length - 1].querySelector(".node-dot");
    if (!firstDot || !lastDot) {
      activeLine.style.top = "0px";
      activeLine.style.height = "0px";
      return;
    }

    const containerRect = routeContainer.getBoundingClientRect();
    const firstRect = firstDot.getBoundingClientRect();
    const lastRect = lastDot.getBoundingClientRect();

    const firstCenter = firstRect.top + firstRect.height / 2;
    const lastCenter = lastRect.top + lastRect.height / 2;
    const topOffset = Math.max(firstCenter - containerRect.top, 0);
    const rawHeight = lastCenter - firstCenter;
    const heightValue = Math.max(rawHeight, 0);

    activeLine.style.top = `${topOffset}px`;
    activeLine.style.height = `${heightValue}px`;
  };

  window.requestAnimationFrame(measureLine);
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
  dom.findNearestBtn.innerHTML = '<span>Getting location...</span>';
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
    dom.findNearestBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><path d="M12 1v6m0 6v6"></path><path d="M4.22 4.22l4.24 4.24m0 5.08l-4.24 4.24"></path><path d="M19.78 4.22l-4.24 4.24m0 5.08l4.24 4.24"></path></svg><span>Find Nearest Station</span>';
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
 * Display nearest station result with external navigation options.
 * @param {Object} stationData - Contains station, distance, latitude, longitude, address, and status
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 */
function displayNearestStationResult(stationData, userLat, userLon) {
  const {
    station,
    distance,
    latitude: stationLat,
    longitude: stationLon,
    address,
    city,
    status,
  } = stationData;

  const distanceStr = formatDistance(distance);
  const navigationLinks = buildNavigationLinks(userLat, userLon, stationLat, stationLon);
  const primaryLink = getPrimaryNavigationLink(navigationLinks);

  dom.locationResult.innerHTML = `
    <div class="location-card nearest-station-card">
      <div class="location-status">
        <svg class="location-check" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
          <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="status-text">Nearest Ferry Station</span>
      </div>

      <div class="nearest-station-info">
        <h4 class="station-name">${station}</h4>
        <p class="station-meta">${city} - ${distanceStr} away</p>
        <p class="station-address">${address}</p>
      </div>

      <div class="nearest-station-details" aria-label="Nearest station details">
        <div class="nearest-detail">
          <span class="nearest-detail-label">Station status</span>
          <strong>${status || "Status unavailable"}</strong>
        </div>
      </div>

      <div class="location-actions">
        <a class="btn btn-navigate" href="${primaryLink.href}" target="_blank" rel="noopener noreferrer">
          Get Directions
        </a>
        <button class="btn btn-select" type="button" data-station-name="${station}">
          View Schedule
        </button>
      </div>
    </div>
  `;

  const selectButton = dom.locationResult.querySelector("[data-station-name]");
  if (selectButton) {
    selectButton.addEventListener("click", () => selectStation(station));
  }

  dom.locationResult.classList.remove("hidden");
}

function formatDistance(distanceKm) {
  return distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} meters`
    : `${distanceKm.toFixed(2)} km`;
}

function buildNavigationLinks(userLat, userLon, stationLat, stationLon) {
  const origin = `${userLat},${userLon}`;
  const destination = `${stationLat},${stationLon}`;

  return {
    google: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking`,
    waze: `https://waze.com/ul?ll=${encodeURIComponent(destination)}&navigate=yes`,
    apple: `https://maps.apple.com/?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&dirflg=w`,
  };
}

function getPrimaryNavigationLink(navigationLinks) {
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return {
    label: isiOS ? "Apple Maps" : "Google Maps",
    href: isiOS ? navigationLinks.apple : navigationLinks.google,
  };
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
        <path d="M12 8v5" stroke-linecap="round"></path>
        <circle cx="12" cy="17.5" r="1" fill="currentColor"></circle>
      </svg>
      <p>${message}</p>
    </div>
  `;
  
  dom.locationResult.classList.remove("hidden");
  
  // Reset button state
  dom.findNearestBtn.disabled = false;
  dom.findNearestBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><path d="M12 1v6m0 6v6"></path><path d="M4.22 4.22l4.24 4.24m0 5.08l-4.24 4.24"></path><path d="M19.78 4.22l-4.24 4.24m0 5.08l4.24 4.24"></path></svg><span>Find Nearest Station</span>';
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
      closeUsernameForm();
    } else {
      setUsernameError(result.error || "Could not change username.");
      dom.usernameInput.focus();
    }
  });
}

function setUsernameError(message) {
  if (!dom.usernameErrorMessage || !dom.usernameInput) return;
  if (!message) {
    dom.usernameErrorMessage.textContent = "";
    dom.usernameErrorMessage.classList.add("hidden");
    dom.usernameInput.classList.remove("invalid");
    return;
  }

  dom.usernameErrorMessage.textContent = message;
  dom.usernameErrorMessage.classList.remove("hidden");
  dom.usernameInput.classList.add("invalid");
}

function toggleUsernameForm() {
  if (!dom.usernameForm || !dom.usernameInput) return;
  const isHidden = dom.usernameForm.classList.contains("hidden");
  if (isHidden) {
    const current = localStorage.getItem("ebangka_username") || "";
    dom.usernameInput.value = current;
    setUsernameError("");
    dom.usernameForm.classList.remove("hidden");
    dom.usernameInput.focus();
  } else {
    closeUsernameForm();
  }
}

function closeUsernameForm() {
  if (!dom.usernameForm) return;
  dom.usernameForm.classList.add("hidden");
  setUsernameError("");
}

function handleUsernameChange() {
  if (!dom.usernameInput) return;
  const nextUsername = dom.usernameInput.value.trim().substring(0, 15);
  const current = localStorage.getItem("ebangka_username") || "";
  if (!nextUsername || nextUsername === current) {
    closeUsernameForm();
    return;
  }

  const userId = localStorage.getItem("ebangka_userId");
  if (!socket || !userId) {
    setUsernameError("Unable to change username right now. Please refresh the page.");
    return;
  }

  setUsernameError("");
  socket.emit('changeUsername', { userId, newUsername: nextUsername });
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
