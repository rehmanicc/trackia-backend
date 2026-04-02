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

    socket.on("disconnect", () => {
        console.warn("⚠️ Socket disconnected");
    });

    return socket;
}
socket.on("reconnect", () => {
    console.log("🔄 Reconnected");

    // reload latest positions after reconnect
    fetch("/api/traccar/positions")
        .then(res => res.json())
        .then(data => {
            console.log("♻️ Reload after reconnect");
        });
});

export function onPositions(cb) {
    socket?.on("positions", cb);
}

export function onGeofence(cb) {
    socket?.on("geofenceEvent", cb);
}

export function onAlert(cb) {
    socket?.on("alert", cb);
}

export function getSocket() {
    return socket;
}