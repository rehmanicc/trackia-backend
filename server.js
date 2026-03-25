require("dotenv").config();
console.log("MONGO_URI:", process.env.MONGO_URI);

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");

const app = express();
const server = http.createServer(app);

// ✅ SOCKET INIT
const socket = require("./socket");
const io = socket.init(server);
const axios = require("axios");

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

    io.emit("positions", response.data);

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
app.use(express.static("public"));

// ======================
// TEST ROUTE
// ======================
app.get("/", (req, res) => {
  res.send("Trackia Backend Running");
});

// ======================
// ROUTES
// ======================
const authRoutes = require("./routes/auth");
const traccarRoutes = require("./routes/traccar");
const geofenceRoutes = require("./routes/geofence");
const tripRoutes = require("./routes/trips");

app.use("/api/auth", authRoutes);
app.use("/api/traccar", traccarRoutes);
app.use("/api/geofence", geofenceRoutes);
app.use("/api/trips", tripRoutes);

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
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// ======================
// SERVER START
// ======================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});