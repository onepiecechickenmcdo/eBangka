const ferryService = require("../services/ferryService");
const db = require("./db");

const SYSTEM_ALERTS = [
  "Ferry arriving in 5 minutes.",
  "High passenger volume detected. Expect boarding delays of 10-15 minutes.",
  "Weather advisory: Mild river currents today. Standard speeds observed.",
  "Weather advisory: Active rain detected. Expect wet boarding docks. Please tread carefully.",
  "Notice: High queue size at terminal. Priority boarding active for seniors and PWDs.",
  "Service Advisory: Schedule running smoothly. Boat departures are fully operational.",
  "Notice: Please keep your lifevests secured for the duration of the trip."
];

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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
        isSystem: true
      };
      
      // Add to persistent database
      db.addMessage(randomStation, structuredMessage);
      
      // Broadcast to that station's room
      io.to(randomStation).emit('chatMessage', structuredMessage);
      
    } catch (err) {
      console.error("Error generating background system alert:", err);
    }
  }, 45000); // Emits an alert every 45 seconds
}

module.exports = handleStationChat;