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
function getOrCreateUser(userId) {
  const db = loadDb();
  
  // 1. Check if userId already has a username
  for (const [uname, uid] of Object.entries(db.users)) {
    if (uid === userId) {
      return uname;
    }
  }
  
  // 2. Generate a new unique username
  let generatedUsername;
  let attempts = 0;
  do {
    const randomSuffix = Math.floor(Math.random() * 9000 + 1000); // 4-digit random number
    generatedUsername = `Commuter_${randomSuffix}`;
    attempts++;
  } while (db.users.hasOwnProperty(generatedUsername) && attempts < 100);
  
  // 3. Save new user association
  db.users[generatedUsername] = userId;
  saveDb(db);
  
  return generatedUsername;
}

// Claim / change username
function claimUsername(userId, newUsername) {
  const db = loadDb();
  const cleanedName = newUsername.trim().substring(0, 15);
  
  if (!cleanedName || cleanedName.toLowerCase() === "system alert" || cleanedName.toLowerCase() === "system") {
    return { success: false, error: "Invalid username." };
  }
  
  // Check if username is already taken by a different user
  const existingOwner = db.users[cleanedName];
  if (existingOwner && existingOwner !== userId) {
    return { success: false, error: "Username already taken." };
  }
  
  // Delete any old usernames owned by this userId
  for (const [uname, uid] of Object.entries(db.users)) {
    if (uid === userId) {
      delete db.users[uname];
    }
  }
  
  // Assign new username
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
