require("dotenv").config();
const Position = require("./models/Position");
const PositionArchive = require("./models/PositionsArchive");
const Trip = require("./models/Trip");
console.log("MONGO_URI:", process.env.MONGO_URI);

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");

const app = express();
const server = http.createServer(app);
const jwt = require("jsonwebtoken");
const Device = require("./models/Device");

// ✅ SOCKET INIT
const socket = require("./socket");
const io = socket.init(server);

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
app.use(cors({
  origin: "*"
}));

app.use(express.json());
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

app.use("/api/auth", authRoutes);
app.use("/api/geofence", geofenceRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/traccar", traccarRoutes);
app.use(express.static("public"));
pp.use("/api/analytics", analyticsRoutes);
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
