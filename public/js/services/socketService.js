let socket = null;

// 🔥 INIT SOCKET (Singleton + Token Refresh)
export function initSocket(token) {

    // ✅ If already exists, update token & reconnect safely
    if (socket) {
        socket.auth = { token };
        if (!socket.connected) {
            socket.connect();
        }
        return socket;
    }

    socket = io("https://trackia-backend.onrender.com", {
        transports: ["websocket"], // 🔥 optimized (no polling)
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000, // 🔥 backoff strategy
        timeout: 20000,
        auth: { token }
    });

    // ===============================
    // CONNECTION EVENTS
    // ===============================

    socket.on("connect", () => {
        console.log("✅ Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
        console.warn("⚠️ Socket disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
        console.error("❌ Connection error:", err.message);
    });

    socket.on("reconnect", async () => {
        console.log("🔄 Reconnected");

        try {
            // 🔥 reload latest positions after reconnect
            const res = await fetch("https://trackia-backend.onrender.com/api/traccar/positions");
            const data = await res.json();

            console.log("♻️ Reload after reconnect");

            // Optional: emit or handle manually if needed
            socket.emit("positionsReloaded", data);

        } catch (err) {
            console.error("❌ Reconnect reload failed:", err);
        }
    });

    return socket;
}

// ===============================
// SAFE EVENT BINDING (NO DUPLICATES)
// ===============================

export function onPositions(cb) {
    if (!socket) {
        console.error("❌ Socket not initialized");
        return;
    }

    socket.off("positions"); // 🔥 prevent duplicate listeners
    socket.on("positions", cb);
}

export function onGeofence(cb) {
    if (!socket) {
        console.error("❌ Socket not initialized");
        return;
    }

    socket.off("geofenceEvent");
    socket.on("geofenceEvent", cb);
}

export function onAlert(cb) {
    if (!socket) {
        console.error("❌ Socket not initialized");
        return;
    }

    socket.off("alert");
    socket.on("alert", cb);
}

// ===============================
// SOCKET ACCESS
// ===============================

export function getSocket() {
    return socket;
}

// ===============================
// CONNECTION STATUS (OPTIONAL)
// ===============================

export function isSocketConnected() {
    return socket?.connected || false;
}