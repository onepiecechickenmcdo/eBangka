// Local in-memory message database (Wipes on server restart)
const chatHistory = {}; 

function handleStationChat(io) {
  io.on('connection', (socket) => {
    let currentRoom = null;

    // 1. Handle user joining a specific station channel
    socket.on('joinStationChat', (stationId) => {
      if (currentRoom) {
        socket.leave(currentRoom);
      }
      
      currentRoom = stationId;
      socket.join(currentRoom);

      // Send existing message history for this specific station back to the client
      if (!chatHistory[currentRoom]) {
        chatHistory[currentRoom] = [];
      }
      socket.emit('loadHistory', chatHistory[currentRoom]);
    });

    // 2. Handle incoming real-time messages from commuters
    socket.on('sendMessage', (msg) => {
      if (!currentRoom || msg.stationId !== currentRoom) return;

      const structuredMessage = {
        username: msg.username || "Anonymous",
        text: msg.text,
        stationId: currentRoom,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      // Push to our local arrays (Caps history at 50 messages per room)
      chatHistory[currentRoom].push(structuredMessage);
      if (chatHistory[currentRoom].length > 50) {
        chatHistory[currentRoom].shift();
      }

      // Broadcast out to everyone currently sitting in this station's chat room
      io.to(currentRoom).emit('chatMessage', structuredMessage);
    });

    socket.on('disconnect', () => {
      if (currentRoom) socket.leave(currentRoom);
    });
  });
}

// Export the function directly to prevent TypeError crashes
module.exports = handleStationChat;