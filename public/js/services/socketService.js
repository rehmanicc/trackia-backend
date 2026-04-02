let socket = null;
export function initSocket(token) {

    if (socket) {
        return socket; // ✅ PREVENT DUPLICATE CONNECTIONS
    }

    socket = io("https://trackia-backend.onrender.com", {
        transports: ["polling", "websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
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