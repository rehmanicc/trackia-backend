require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
const Position = require("./models/Position");
const PositionArchive = require("./models/PositionsArchive");
const Trip = require("./models/Trip");
const deviceRoutes = require("./routes/device");
const { getPendingCalls, clearCalls } = require("./services/callService");
const Geofence = require("./models/Geofence");
const GeofenceEvent = require("./models/GeofenceEvent");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");

const Alert = require("./models/Alert");
const server = http.createServer(app);
const jwt = require("jsonwebtoken");
const Device = require("./models/Device");
const { startPolling } = require("./services/traccarPolling");

require("./services/notification/firebase");

const socket = require("./socket");
const io = socket.init(server);


app.use(cors({
  origin: [
    "http://127.0.0.1:8080",
    "http://localhost:8080"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.get("/api/call/pending", (req, res) => {
  res.json(getPendingCalls());
});
app.post("/api/call/clear", (req, res) => {
  clearCalls();
  res.json({ success: true });
});

// ======================
// MONGODB CONNECTION
// ======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    console.log("Connected DB:", mongoose.connection.name);
  })
  .catch(err => console.log(err));

// ======================
// MIDDLEWARE
// ======================
app.use((req, res, next) => {
  console.log("🌐 Incoming:", req.method, req.url);
  next();
});
// ======================
// TEST ROUTE
// ======================
app.get("/", (req, res) => {
  res.send("Trackia Backend Running");
});
app.get("/api/test", (req, res) => {
  res.json({ message: "API working" });
});
// ======================
// ROUTES
// ======================
const authRoutes = require("./routes/auth");
const traccarRoutes = require("./routes/traccar");
const geofenceRoutes = require("./routes/geofence");
const tripRoutes = require("./routes/trips");
const analyticsRoutes = require("./routes/analyticsRoutes");
const alertRoutes = require("./routes/alertRoutes");
const userRoutes = require("./routes/user");
const alertRuleRoutes = require("./routes/alertRuleRoutes");


app.use(express.urlencoded({ extended: true }));
console.log("alertRuleRoutes:", typeof alertRuleRoutes);
app.use("/api/alert-rules", alertRuleRoutes);
console.log("authRoutes:", typeof authRoutes);
app.use("/api/auth", authRoutes);
console.log("geofenceRoutes:", typeof geofenceRoutes);
app.use("/api/geofence", geofenceRoutes);
console.log("tripRoutes:", typeof tripRoutes);
app.use("/api/trips", tripRoutes);
console.log("traccarRoutes:", typeof traccarRoutes);
app.use("/api/traccar", traccarRoutes);
console.log("analyticsRoutes:", typeof analyticsRoutes);
app.use("/api/analytics", analyticsRoutes);
console.log("deviceRoutes type:", typeof deviceRoutes);
console.log("deviceRoutes value:", deviceRoutes);
app.use("/api/devices", deviceRoutes);
console.log("alertRoutes:", typeof alertRoutes);
app.use("/api/alerts", alertRoutes);
console.log("userRoutes:", typeof userRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit", require("./routes/auditRoutes"));
// ======================
// DB CHECK ROUTE
// ======================
app.get("/check-db", async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();

    const data = await mongoose.connection.db
      .collection("positions")
      .find()
      .limit(5)
      .toArray();

    res.json({
      db: mongoose.connection.name,
      collections,
      data
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});

// ======================
// SOCKET CONNECTION
// ======================
io.on("connection", async (socket) => {

  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      console.log("❌ No token");
      return socket.disconnect();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.user = decoded;

    // ✅ Assign room
    if (decoded.role === "owner") {
      socket.join("owner");
    }

    if (decoded.role === "admin") {
      socket.join(`company_${decoded.adminId}`);
    }

    if (decoded.role === "user") {
      socket.join(`user_${decoded.id}`);
    }
    socket.join(String(decoded.id));
    console.log("✅ User connected:", decoded.id);

  } catch (err) {
    console.log("❌ Invalid token");
    socket.disconnect();
  }

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

});
// ======================
// SERVER START
// ======================
const PORT = process.env.PORT || 5000;
const User = require("./models/User");
app.delete("/api/reset", async (req, res) => {
  try {
    const secret = req.headers["x-reset-key"]?.trim();

    console.log("HEADER:", secret);
    console.log("ENV:", process.env.RESET_SECRET);

    if (!secret || secret !== process.env.RESET_SECRET) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await User.deleteMany({});
    await Device.deleteMany({});
    await Position.deleteMany({});
    await PositionArchive.deleteMany({});
    await Trip.deleteMany({});
    await Alert.deleteMany({});
    await Geofence.deleteMany({});
    await GeofenceEvent.deleteMany({});


    return res.json({ message: "Database reset successful" });

  } catch (err) {
    console.error("RESET ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", err);

  res.status(500).json({
    error: err.message || "Internal Server Error"
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // 🚀 START AUTO POLLING
  startPolling();
});
setInterval(() => {
  console.log("🔥 Server alive");
}, 1000 * 60 * 5);

