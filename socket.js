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

      // =====================
      // TRANSPORTS
      // =====================

      transports: [
        "websocket"
      ],

      // =====================
      // CONNECTION STABILITY
      // =====================

      pingTimeout: 60000,

      pingInterval: 25000,

      upgradeTimeout: 30000,

      allowEIO3: true
    });

    // =====================
    // ENGINE ERRORS
    // =====================

    io.engine.on(
      "connection_error",
      (err) => {

        console.log(
          "❌ ENGINE CONNECTION ERROR:",
          err?.message
        );
      }
    );

    // =====================
    // SOCKET AUTH
    // =====================

    io.use((socket, next) => {

      try {

        const token =
          socket.handshake.auth?.token ||

          socket.handshake.headers
            ?.authorization
            ?.split(" ")[1];

        if (!token) {

          console.log(
            "❌ No socket token"
          );

          return next(
            new Error("No token")
          );
        }

        const decoded =
          jwt.verify(
            token,
            process.env.JWT_SECRET
          );

        socket.user = decoded;

        next();

      } catch (err) {

        console.log(
          "❌ Socket auth error:",
          err.message
        );

        next(
          new Error(
            "Authentication error"
          )
        );
      }
    });

    // =====================
    // CONNECTION
    // =====================

    io.on("connection", (socket) => {

      const user = socket.user;

      if (!user) {

        console.log(
          "❌ No user on connection"
        );

        socket.disconnect();

        return;
      }

      // =====================
      // COMPANY ROOMS
      // =====================

      const adminId =

        user.role === "owner"

          ? "owners"

          : String(
              user.adminId ||
              user.id
            );

      // =====================
      // OWNER ROOM
      // =====================

      if (
        user.role === "owner"
      ) {

        socket.join(
          "company_owners"
        );
      }

      // =====================
      // COMPANY ROOM
      // =====================

      socket.join(
        `company_${adminId}`
      );

      // =====================
      // USER ROOM
      // =====================

      socket.join(
        `user_${user.id}`
      );

      console.log(
        "✅ SOCKET CONNECTED:",
        user.id
      );

      // =====================
      // SOCKET ERRORS
      // =====================

      socket.on(
        "error",
        (err) => {

          console.log(
            "❌ SOCKET ERROR:",
            err?.message
          );
        }
      );

      // =====================
      // DISCONNECT
      // =====================

      socket.on(
        "disconnect",
        (reason) => {

          console.log(
            "🔌 SOCKET DISCONNECTED:",
            user.id,
            reason
          );
        }
      );
    });

    return io;
  },

  // =====================
  // GET IO
  // =====================

  getIO: () => {

    if (!io) {

      console.log(
        "⚠️ Socket not ready yet"
      );

      return null;
    }

    return io;
  }
};