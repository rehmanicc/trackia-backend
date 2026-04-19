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
        timeout: 10000,
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

        if (reason === "io server disconnect") {
            // 🔥 force reconnect
            socket.connect();
        }
    });

    socket.on("connect_error", (err) => {
        console.error("❌ Connection error:", err.message);
    });

    socket.on("reconnect", async () => {
        console.log("🔄 Reconnected");

        // 🔥 small delay for stability
        setTimeout(async () => {

            try {
                const token = localStorage.getItem("token");

                const res = await fetch("https://trackia-backend.onrender.com/api/traccar/positions", {
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                });

                if (!res.ok) {
                    console.error("❌ Reconnect API failed:", res.status);
                    return;
                }

                const data = await res.json();

                console.log("♻️ Reload after reconnect");

                socket.emit("positions", data);

            } catch (err) {
                console.error("❌ Reconnect reload failed:", err);
            }

        }, 1000);
    });
    setInterval(() => {
        if (!socket.connected) {
            console.warn("⚠️ Socket not connected, retrying...");
            socket.connect();
        }
    }, 15000);
    socket.on("reconnect_attempt", (attempt) => {
        console.log("🔄 Reconnect attempt:", attempt);
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