let io;
const jwt = require("jsonwebtoken");

module.exports = {
  init: (server) => {
    io = require("socket.io")(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      },

      transports: ["websocket"],
      upgrade: false,              // 🔥 ADD THIS

      pingTimeout: 60000,          // 🔥 REDUCE (more stable)
      pingInterval: 25000          // keep same
    });

    // 🔐 AUTH
    io.use((socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.split(" ")[1];

        if (!token) {
          console.log("❌ No token");
          return next(new Error("No token"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;

        next();
      } catch (err) {
        console.log("❌ Socket auth error:", err.message);
        next(new Error("Authentication error"));
      }
    });

    // 🔌 CONNECTION
    io.on("connection", (socket) => {
      const user = socket.user;

      if (!user) {
        console.log("❌ No user on connection");
        return;
      }

      const adminId =
        user.role === "owner"
          ? "owners"
          : String(user.adminId || user.id);
      if (user.role === "owner") {
        socket.join("company_owners");
      }

      socket.join(`company_${adminId}`);
      socket.join(`user_${user.id}`);

      console.log("✅ Connected:", user.id);

      socket.on("disconnect", (reason) => {
        console.log("🔌 Disconnected:", user.id, reason);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      console.log("⚠️ Socket not ready yet");
      return null;
    }
    return io;
  }
};