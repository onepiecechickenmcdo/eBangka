const express = require("express");
const path = require("path");
const http = require("http"); // Required to bridge Express and Socket.io
const { Server } = require("socket.io"); // Pull the Socket.io Server engine
const apiRoutes = require("./routes/api");
const handleStationChat = require("./communitychat/stationchat");

const app = express();
const PORT = process.env.PORT || 3000;

// Create the standard HTTP server wrapping our Express instance
const server = http.createServer(app);

// Initialize Socket.io and attach it to the server instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (_req, res) => {
  res.json({
    name: "eBangka API",
    description: "Pasig River Ferry schedule tracking (static MMDA data)",
    endpoints: {
      info: "GET /info",
      stations: "GET /stations",
      schedule: "GET /schedule/:station",
      nextFerry: "GET /next-ferry/:station (?time=HH:MM optional)",
      nearestStation: "GET /nearest-station?lat=LATITUDE&lng=LONGITUDE",
    },
  });
});

app.use(apiRoutes);

// Boot up your real-time community chat event hub!
handleStationChat(io);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// CRITICAL: Change app.listen to server.listen so WebSockets actually work!
server.listen(PORT, () => {
  console.log(`eBangka server running at http://localhost:${PORT}`);
});