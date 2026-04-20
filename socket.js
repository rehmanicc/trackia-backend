let io;
const jwt = require("jsonwebtoken");

module.exports = {
  init: (server) => {
    io = require("socket.io")(server, {
      cors: {
        origin: [
          "http://127.0.0.1:8080",
          "http://localhost:8080"
        ],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ["websocket"]
    });

    // ✅ AUTH + ROOM JOIN
    io.use((socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.split(" ")[1];

        if (!token) return next(new Error("No token"));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;

        next();
      } catch (err) {
        console.log("❌ Socket auth error:", err.message);
        next(new Error("Authentication error"));
      }
    });

    // ✅ CONNECTION HANDLER
    io.on("connection", (socket) => {
      const user = socket.user;

      if (!user) return;

      const adminId = String(user.adminId || user.id);

      // 🔥 JOIN ROOMS
      socket.join(`company_${adminId}`);
      socket.join(`user_${user.id}`);

      console.log(
        "👤 Connected:",
        `company_${adminId}`,
        `user_${user.id}`
      );

      socket.on("disconnect", () => {
        console.log("🔌 Disconnected:", user.id);
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
