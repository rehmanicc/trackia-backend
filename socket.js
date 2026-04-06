let io;

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
    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  }
};