let socket = null;
export function initSocket(token) {

    if (socket) {
        return socket; // ✅ PREVENT DUPLICATE CONNECTIONS
    }

    socket = io("https://trackia-backend.onrender.com", {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 20000,
        auth: { token }
    });

    socket.on("connect", () => {
        console.log("✅ Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
        console.warn("⚠️ Socket disconnected:", reason);
    });

    socket.on("reconnect", () => {
        console.log("🔄 Reconnected");

        fetch("/api/traccar/positions")
            .then(res => res.json())
            .then(data => {
                console.log("♻️ Reload after reconnect");
            });
    });

    return socket;
}
export function onPositions(cb) {

    if (!socket) {
        console.error("❌ Socket not initialized");
        return;
    }
    socket.on("positions", cb);
}

export function onGeofence(cb) {
    if (!socket) {
        console.error("❌ Socket not initialized");
        return;
    }
    socket.on("geofenceEvent", cb);
}

export function onAlert(cb) {
    if (!socket) {
        console.error("❌ Socket not initialized");
        return;
    }
    socket.on("alert", cb);
}

export function getSocket() {
    return socket;
}