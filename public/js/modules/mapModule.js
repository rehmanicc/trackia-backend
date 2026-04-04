let map;
const markers = {};
const icons = {
    moving: L.icon({
        iconUrl: "/icons/carg.png",
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    }),
    idle: L.icon({
        iconUrl: "/icons/caridle.png",
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    }),
    stopped: L.icon({
        iconUrl: "/icons/carr.png",
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    }),
    offline: L.icon({
        iconUrl: "/icons/cargrey.png",
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    })
};
function smoothMove(marker, newLatLng, duration = 1000) {

    if (marker._animFrame) {
        cancelAnimationFrame(marker._animFrame);
    }
    const start = marker.getLatLng();
    const end = L.latLng(newLatLng);

    let startTime = null;

    function animate(time) {
        if (!startTime) startTime = time;

        const progress = Math.min((time - startTime) / duration, 1);

        const lat = start.lat + (end.lat - start.lat) * progress;
        const lng = start.lng + (end.lng - start.lng) * progress;

        marker.setLatLng([lat, lng]);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}
export function initMap() {

    map = L.map("map", {
        rotate: true,
        touchRotate: true,
        bearing: 0
    }).setView([31.2698, 72.3181], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
    }).addTo(map);

    return map;
}

export function updateMarker(id, pos, device) {

    const lat = Number(pos.latitude ?? pos.lat);
    const lng = Number(pos.longitude ?? pos.lon);

    // 🔥 FINAL PROTECTION
    if (isNaN(lat) || isNaN(lng)) {
        console.warn("🚫 Skipping invalid marker:", pos);
        return;
    }

    const status = device?.status || "offline";

    const icon = status === "online"
        ? icons.moving
        : icons.offline;

    const speed = Math.round((pos.speed || 0) * 1.852);

    if (!markers[id]) {

        markers[id] = L.marker([lat, lng], { icon }).addTo(map);

    } else {

        const marker = markers[id];

        const distance = map.distance(marker.getLatLng(), [lat, lng]);

        if (distance > 500) {
            marker.setLatLng([lat, lng]);
        } else {

            const now = Date.now();
            const last = marker._lastUpdate || now;

            const duration = Math.min(now - last, 3000);

            marker._lastUpdate = now;

            const prev = marker.getLatLng();

            const angle = Math.atan2(
                lng - prev.lng,
                lat - prev.lat
            ) * (180 / Math.PI);

            marker.setRotationAngle(angle);

            // 🔥 EXTRA SAFETY FOR ANIMATION
            if (!isNaN(lat) && !isNaN(lng)) {
                smoothMove(marker, [lat, lng], duration);
            }
        }

        marker.setIcon(icon);
    }

    if (!markers[id]._tooltip) {
        markers[id].bindTooltip(`${speed} km/h`, {
            permanent: true,
            direction: "top",
            offset: [0, -20],
            className: "speed-label"
        });
    } else {
        markers[id].setTooltipContent(`${speed} km/h`);
    }
}

export function getMap() {
    return map;
}
export { icons };

export function getMarkers() {
    return markers;
}