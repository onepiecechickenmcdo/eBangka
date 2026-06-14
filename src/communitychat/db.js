const fs = require("fs");
const path = require("path");

const DB_DIR = path.join(__dirname, "../../data");
const DB_FILE = path.join(DB_DIR, "chat_history.json");

// Ensure data directory and file exist
function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ messages: {}, users: {} }), "utf8");
  } else {
    // Migration check: if the file was using the old flat history format
    try {
      const content = fs.readFileSync(DB_FILE, "utf8");
      const parsed = JSON.parse(content);
      if (parsed && !parsed.hasOwnProperty("messages")) {
        // Old format detected. Migrate it.
        const migrated = {
          messages: parsed,
          users: {}
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(migrated, null, 2), "utf8");
      }
    } catch (err) {
      console.error("Migration error:", err);
    }
  }
}

// Load database
function loadDb() {
  try {
    initDb();
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data) || { messages: {}, users: {} };
  } catch (err) {
    console.error("Error reading chat database:", err);
    return { messages: {}, users: {} };
  }
}

// Save database
function saveDb(dbData) {
  try {
    initDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing to chat database:", err);
  }
}

// Get history for a specific station
function getStationHistory(stationId) {
  const db = loadDb();
  return db.messages[stationId] || [];
}

// Add a message to a station's history (caps at 50 messages)
function addMessage(stationId, message) {
  const db = loadDb();
  if (!db.messages[stationId]) {
    db.messages[stationId] = [];
  }
  
  db.messages[stationId].push(message);
  
  // Cap at 50 messages per station
  if (db.messages[stationId].length > 50) {
    db.messages[stationId].shift();
  }
  
  saveDb(db);
  return db.messages[stationId];
}

// Get or create a unique username for a userId
function normalizeUsername(username) {
  return username.trim().toLowerCase().replace(/\s+/g, " ");
}

function getOrCreateUser(userId) {
  const db = loadDb();
  
  for (const [uname, uid] of Object.entries(db.users)) {
    if (uid === userId) {
      return uname;
    }
  }
  
  let generatedUsername;
  let attempts = 0;
  do {
    const randomSuffix = Math.floor(Math.random() * 9000 + 1000);
    generatedUsername = `Commuter_${randomSuffix}`;
    attempts++;
  } while (Object.keys(db.users).some((name) => normalizeUsername(name) === normalizeUsername(generatedUsername)) && attempts < 100);
  
  db.users[generatedUsername] = userId;
  saveDb(db);
  
  return generatedUsername;
}

// Claim / change username
function claimUsername(userId, newUsername) {
  const db = loadDb();
  const cleanedName = newUsername.trim().substring(0, 15);
  const normalizedName = normalizeUsername(cleanedName);
  
  if (!cleanedName || normalizedName === "system alert" || normalizedName === "system") {
    return { success: false, error: "Invalid username." };
  }
  
  for (const [uname, uid] of Object.entries(db.users)) {
    if (normalizeUsername(uname) === normalizedName && uid !== userId) {
      return { success: false, error: "Username already taken." };
    }
  }
  
  for (const [uname, uid] of Object.entries(db.users)) {
    if (uid === userId) {
      delete db.users[uname];
    }
  }
  
  db.users[cleanedName] = userId;
  saveDb(db);
  
  return { success: true, username: cleanedName };
}

module.exports = {
  getStationHistory,
  addMessage,
  getOrCreateUser,
  claimUsername
};
