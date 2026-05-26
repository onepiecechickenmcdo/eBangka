const express = require("express");
const path = require("path");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

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
    },
  });
});

app.use(apiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`eBangka server running at http://localhost:${PORT}`);
});
