require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const path = require("path");

const app = express();

const server = http.createServer(app);

const socket = require("./socket");

const io = socket.init(server);

app.set("io", io);

// ======================
// BASIC CONFIG
// ======================

server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

// ======================
// MIDDLEWARE
// ======================

app.use(cors({
  origin: [
    "http://127.0.0.1:8080",
    "http://localhost:8080"
  ],
  credentials: true
}));

app.use(express.json());

app.use(express.urlencoded({
  extended: true
}));

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// ======================
// SERVICES
// ======================

require("./services/notification/firebase");

require("./services/positionWorker");

// ======================
// DATABASE
// ======================

mongoose.connect(process.env.MONGO_URI)
  .then(() => {

    console.log("✅ MongoDB Connected");

    console.log(
      "📦 Database:",
      mongoose.connection.name
    );

  })
  .catch((err) => {

    console.log(
      "❌ MongoDB Error:",
      err.message
    );
  });

// ======================
// ROUTES IMPORT
// ======================

const authRoutes = require("./routes/auth");

const traccarRoutes = require("./routes/traccar");

const geofenceRoutes = require("./routes/geofence");

const tripRoutes = require("./routes/trips");

const analyticsRoutes = require("./routes/analyticsRoutes");

const alertRoutes = require("./routes/alertRoutes");

const userRoutes = require("./routes/user");

const dashboardRoutes = require("./routes/dashboardRoutes");

const deviceRoutes = require("./routes/device");

const auditRoutes = require("./routes/auditRoutes");

const fcmRoutes = require("./routes/fcmRoutes");

// ======================
// TEST ROUTES
// ======================

app.get("/", (req, res) => {
  res.send("Trackia Backend Running");
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API Working"
  });
});

// ======================
// CALL ROUTES
// ======================

const {
  getPendingCalls,
  clearCalls
} = require("./services/callService");

app.get("/api/call/pending", (req, res) => {
  res.json(getPendingCalls());
});

app.post("/api/call/clear", (req, res) => {

  clearCalls();

  res.json({
    success: true
  });
});

// ======================
// API ROUTES
// ======================

app.use("/api/auth", authRoutes);

app.use("/api/geofence", geofenceRoutes);

app.use("/api/traccar", traccarRoutes);

app.use("/api/trips", tripRoutes);

app.use("/api/analytics", analyticsRoutes);

app.use("/api/devices", deviceRoutes);

app.use("/api/alerts", alertRoutes);

app.use("/api/users", userRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/audit", auditRoutes);

app.use("/api/fcm", fcmRoutes);

// ======================
// RESET ROUTE
// ======================

const User = require("./models/User");

const Device = require("./models/Device");

const Position = require("./models/Position");

const PositionArchive = require("./models/PositionsArchive");

const Trip = require("./models/Trip");

const Alert = require("./models/Alert");

const Geofence = require("./models/Geofence");

const GeofenceEvent = require("./models/GeofenceEvent");

app.delete("/api/reset", async (req, res) => {

  try {

    const secret =
      req.headers["x-reset-key"]?.trim();

    if (
      !secret ||
      secret !== process.env.RESET_SECRET
    ) {
      return res.status(403).json({
        message: "Unauthorized"
      });
    }

    await User.deleteMany({});

    await Device.deleteMany({});

    await Position.deleteMany({});

    await PositionArchive.deleteMany({});

    await Trip.deleteMany({});

    await Alert.deleteMany({});

    await Geofence.deleteMany({});

    await GeofenceEvent.deleteMany({});

    return res.json({
      success: true,
      message: "Database reset successful"
    });

  } catch (err) {

    console.error(
      "❌ RESET ERROR:",
      err
    );

    return res.status(500).json({
      error: err.message
    });
  }
});

// ======================
// GLOBAL ERROR HANDLER
// ======================

app.use((err, req, res, next) => {

  console.error(
    "🔥 GLOBAL ERROR:",
    err
  );

  res.status(500).json({
    error:
      err.message ||
      "Internal Server Error"
  });
});

// ======================
// SERVER START
// ======================

const PORT =
  process.env.PORT || 5000;

const {
  startPolling
} = require("./services/traccarPolling");

server.listen(PORT, () => {

  console.log(
    `🚀 Server running on port ${PORT}`
  );

  startPolling();
});

// ======================
// KEEP ALIVE LOG
// ======================

setInterval(() => {

  console.log("🔥 Server alive");

}, 1000 * 60 * 5);