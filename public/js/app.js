/**
 * eBangka - Frontend Controller
 * State management, dynamic timeline rendering, real-time countdown, and Time Machine simulation.
 */

// Global App State
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
  scheduleGrid: document.getElementById("schedule-timeline-grid")
};

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  loadFavorites();
  initTimePicker();
  setupEventListeners();
  
  // Fetch initial configuration
  await fetchOperationalInfo();
  await fetchStations();
  
  // Poll timeline info every 60s to refresh next-boat status
  state.refreshTimelineInterval = setInterval(fetchStations, 60000);
});

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
