require("dotenv").config();
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
const axios = require("axios");

async function getAllowedDeviceIds(user) {

  if (user.role === "owner") {
    const devices = await Device.find();
    return devices.map(d => d.traccarId);
  }

  if (user.role === "admin") {
    const devices = await Device.find({ companyId: user.companyId });
    return devices.map(d => d.traccarId);
  }

  if (user.role === "user") {
    const devices = await Device.find({ assignedTo: user.id });
    return devices.map(d => d.traccarId);
  }

  return [];
}
async function broadcastPositionsByRooms(allPositions) {

  // 🔹 1. OWNER → gets all
  io.to("owner").emit("positions", allPositions);

  // 🔹 2. ADMIN (by company)
  const companies = {};

  allPositions.forEach(pos => {
    const device = pos.deviceId;

    // Group later
    if (!companies[device]) companies[device] = [];
    companies[device].push(pos);
  });

  // Get all devices from DB
  const devices = await Device.find();

  devices.forEach(device => {

    const posList = allPositions.filter(p => p.deviceId === device.traccarId);

    if (posList.length === 0) return;

    // Admin room
    io.to(`company_${device.companyId}`).emit("positions", posList);

    // User room
    if (device.assignedTo) {
      io.to(`user_${device.assignedTo}`).emit("positions", posList);
    }

  });

}
setInterval(async () => {
  try {
    const response = await axios.get(
      `${process.env.TRACCAR_URL}/api/positions`,
      {
        auth: {
          username: process.env.TRACCAR_EMAIL,
          password: process.env.TRACCAR_PASSWORD,
        },
      }
    );

    broadcastPositionsByRooms(response.data);

    console.log("📡 Positions emitted:", response.data.length);

  } catch (err) {
    console.log("Polling error:", err.message);
  }
}, 5000); // every 5 seconds
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

app.use("/api/auth", authRoutes);
app.use("/api/geofence", geofenceRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/traccar", traccarRoutes);
app.use(express.static("public"));
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

    res.json({ message: "Database reset successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
