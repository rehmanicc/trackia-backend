require("dotenv").config();
const Position = require("./models/Position");
const PositionArchive = require("./models/PositionsArchive");
const Trip = require("./models/Trip");
console.log("MONGO_URI:", process.env.MONGO_URI);
const deviceRoutes = require("./routes/device");

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const path = require("path");

const app = express();
const server = http.createServer(app);
const jwt = require("jsonwebtoken");
const Device = require("./models/Device");

// ✅ SOCKET INIT
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
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
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

app.use("/api/auth", authRoutes);
app.use("/api/geofence", geofenceRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/traccar", traccarRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/devices", deviceRoutes); 
app.use("/api/alerts", alertRoutes);
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
      socket.join(`company_${decoded.companyId}`);
    }

    if (decoded.role === "user") {
      socket.join(`user_${decoded.id}`);
    }

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
    await User.deleteMany({});
    await Device.deleteMany({});
    await Position.deleteMany({});          // ✅ ADD
    await PositionArchive.deleteMany({});   // ✅ ADD
    await Trip.deleteMany({});
    res.json({ message: "Database reset successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
setInterval(() => {
  console.log("🔥 Server alive");
}, 1000 * 60 * 5);

const Alert = require("./models/Alert");

app.get("/test-alert", async (req, res) => {

  const alert = await Alert.create({
    deviceId: "123",
    type: "ENGINE_ON",
    message: "Test alert working"
  });

  res.json(alert);
});