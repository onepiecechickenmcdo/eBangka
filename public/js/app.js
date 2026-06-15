/**
 * eBangka - Frontend Controller
 * State management, dynamic timeline rendering, real-time countdown, and Time Machine simulation.
 */

// Global App State
const socket = io(); // Initialize Socket.io connection

const state = {
  stations: [],
  routeOrder: [],
  operationalInfo: {},
  selectedStation: null,
  simulatedTime: "08:00",
  timeMachineActive: false,
  favorites: [],
  tickerInterval: null,
  etaTimelineInterval: null,
  refreshTimelineInterval: null
};

// DOM Cache
const dom = {
  serviceStatusPill: document.getElementById("service-status-pill"),
  serviceStatusText: document.getElementById("service-status-text"),
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
  startTimelineEtaTicker();
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

  // Displays current local username placeholder until server confirms
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
  window.addEventListener("resize", updateRouteLine);

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
    state.routeOrder = data.route_order || [];

    // Fetch ETA details for each station in fixed route order
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
            minutes_from_now: nextData.minutes_from_now ?? null,
            message: nextData.message || null
          };
        } catch {
          return { ...st, next_ferry_time: null, minutes_from_now: null, message: "Off-service" };
        }
      })
    );

    state.stations = stationsWithNext;
    renderTimeline();
  } catch (err) {
    console.error("Failed to load stations timeline:", err);
    dom.stationsTimeline.innerHTML = `<div class="timeline-skeleton" style="color:#ef4444;">Error connection to server.</div>`;
  }
}

// ==========================================================================
// Render Timeline
// ==========================================================================

function formatDurationMinutes(totalMinutes) {
  if (totalMinutes <= 0) return "0 minutes";
  if (totalMinutes <= 59) {
    return totalMinutes === 1 ? "1 minute" : `${totalMinutes} minutes`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const hourPart = hours === 1 ? "1 hour" : `${hours} hours`;

  if (mins === 0) return hourPart;
  const minPart = mins === 1 ? "1 min" : `${mins} min`;
  return `${hourPart} and ${minPart}`;
}

function formatCompactDuration(totalMinutes) {
  if (totalMinutes <= 60) {
    return formatDurationMinutes(totalMinutes);
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatArrivalEta(minutesFromNow, message, nextFerryTime) {
  if (nextFerryTime && minutesFromNow != null) {
    if (minutesFromNow <= 0) {
      return "The ferry is arriving now";
    }
    return `The ferry arrives in ${formatDurationMinutes(minutesFromNow)}`;
  }
  if (message) return message;
  return "No remaining departures";
}

function renderTimeline() {
  const orderedStations = state.stations.length > 0
    ? state.stations
    : [];

  renderTimelineHTML(orderedStations);
  updateRouteLine();
}

function renderTimelineHTML(stations) {
  if (stations.length === 0) {
    dom.stationsTimeline.innerHTML = `<div class="timeline-skeleton">No stations available.</div>`;
    updateRouteLine();
    return;
  }

  dom.stationsTimeline.innerHTML = "";

  stations.forEach(st => {
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.dataset.stationName = st.name;
    if (state.selectedStation && state.selectedStation.station === st.name) {
      item.classList.add("active");
    }

    const etaText = formatArrivalEta(st.minutes_from_now, st.message, st.next_ferry_time);
    const hasEta = Boolean(st.next_ferry_time && st.minutes_from_now != null);

    item.innerHTML = `
      <div class="node-dot"></div>
      <div class="timeline-content">
        <div class="station-title-row">
          <span class="station-name">${st.name}</span>
        </div>
        <div class="station-desc-row">
          <span class="station-city">${st.city}</span>
          <span class="station-eta ${hasEta ? '' : 'no-more'}" data-next-time="${st.next_ferry_time || ''}">${etaText}</span>
        </div>
      </div>
    `;

    item.addEventListener("click", () => selectStation(st.name));
    dom.stationsTimeline.appendChild(item);
  });
  updateRouteLine();
}

function startTimelineEtaTicker() {
  if (state.etaTimelineInterval) clearInterval(state.etaTimelineInterval);

  state.etaTimelineInterval = setInterval(() => {
    if (state.timeMachineActive) return;

    state.stations.forEach(st => {
      if (!st.next_ferry_time) return;
      const remaining = computeMinutesUntil(st.next_ferry_time);
      st.minutes_from_now = remaining;
    });

    dom.stationsTimeline.querySelectorAll(".timeline-item").forEach(item => {
      const name = item.dataset.stationName;
      const station = state.stations.find(s => s.name === name);
      if (!station) return;

      const etaEl = item.querySelector(".station-eta");
      if (!etaEl) return;

      const etaText = formatArrivalEta(
        station.minutes_from_now,
        station.message,
        station.next_ferry_time
      );
      etaEl.textContent = etaText;
      etaEl.classList.toggle("no-more", !(station.next_ferry_time && station.minutes_from_now != null));
    });
  }, 30000);
}

function computeMinutesUntil(time24) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = parseTimeStringToMinutes(time24);
  return targetMinutes - currentMinutes;
}

function updateRouteLine() {
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

    // Join chat room for selected station
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
    }, 50); // Short delay for DOM update to complete

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
  const targetTimeStr = nextFerryData.next_ferry_time;
  const targetMinutes = parseTimeStringToMinutes(targetTimeStr);

  if (state.timeMachineActive) {
    const diffMinutes = nextFerryData.minutes_from_now;
    if (diffMinutes < 0) {
      timerEl.textContent = "Departed";
      descEl.textContent = "The ferry has departed";
    } else {
      timerEl.textContent = formatCompactDuration(diffMinutes);
      descEl.textContent = `${formatArrivalEta(diffMinutes, null, targetTimeStr)} (simulated)`;
    }
    return;
  }

  const updateTimer = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentSeconds = now.getSeconds();

    const totalRemainingSeconds = (targetMinutes - currentMinutes) * 60 - currentSeconds;

    if (totalRemainingSeconds <= 0) {
      clearInterval(state.tickerInterval);
      timerEl.textContent = "00m 00s";
      descEl.textContent = "The ferry is arriving now";

      setTimeout(() => {
        refreshActiveStationData();
        fetchStations();
      }, 3000);
      return;
    }

    const totalMins = Math.floor(totalRemainingSeconds / 60);

    timerEl.textContent = formatCompactDuration(totalMins);
    descEl.textContent = formatArrivalEta(totalMins, null, targetTimeStr);
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
// Community Chat Logic
// ==========================================================================

if (socket) {
  // Load room chat history
  socket.on('loadHistory', (history) => {
    if (!dom.chatMessages) return;
    dom.chatMessages.innerHTML = '';
    history.forEach(appendMessageToUI);
  });

  // Listen for real-time messages
  socket.on('chatMessage', (msg) => {
    const activeStation = dom.detailStationName ? dom.detailStationName.textContent.trim() : null;
    if (activeStation && msg.stationId === activeStation) {
      appendMessageToUI(msg);
    }
  });

  // Resolve user identity on connection
  socket.on('identityResolved', ({ username }) => {
    localStorage.setItem("ebangka_username", username);
    if (dom.usernameDisplay) {
      dom.usernameDisplay.textContent = username;
    }
  });

  // Handle response of nickname changes
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

// Append message row to chat UI
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
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight; // Scroll to bottom
}

// Chat input event listeners
if (dom.chatSendBtn) dom.chatSendBtn.addEventListener("click", dispatchSocketMessage);
if (dom.chatInput) {
  dom.chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") dispatchSocketMessage();
  });
}

// Send chat message to server
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

  dom.chatInput.value = "";
}
