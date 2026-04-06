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
function isValidLatLng(lat, lng) {
    return (
        typeof lat === "number" &&
        typeof lng === "number" &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180
    );
}
export function parseLatLng(pos) {
    const lat = Number(pos.latitude ?? pos.lat);
    const lng = Number(pos.longitude ?? pos.lon);

    if (isNaN(lat) || isNaN(lng)) {
        console.warn("⚠️ Invalid coordinates:", pos);
        return null;
    }

    return { lat, lng };
}
function smoothMove(marker, target, duration = 1000) {

    if (!marker || !target) return;

    const start = marker.getLatLng();

    if (
        !start ||
        isNaN(start.lat) || isNaN(start.lng) ||
        isNaN(target.lat) || isNaN(target.lng)
    ) {
        console.warn("⚠️ Invalid animation → fallback");
        marker.setLatLng([target.lat, target.lng]);
        return;
    }

    const startTime = performance.now();

    function animate(time) {
        const t = Math.min((time - startTime) / duration, 1);

        const lat = start.lat + (target.lat - start.lat) * t;
        const lng = start.lng + (target.lng - start.lng) * t;

        // 🔥 FINAL GUARD (MOST IMPORTANT)
        if (isNaN(lat) || isNaN(lng)) {
            console.warn("❌ Animation NaN → stop");
            return;
        }

        marker.setLatLng([lat, lng]);

        if (t < 1) {
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

    const coords = parseLatLng(pos);
    if (!coords) return;

    const { lat, lng } = coords;

    const status = device?.status || "offline";

    const icon = status === "online"
        ? icons.moving
        : icons.offline;

    const speed = toKmh(pos.speed);
    if (!markers[id]) {

        markers[id] = L.marker([lat, lng], { icon }).addTo(map);

    } else {

        const marker = markers[id];

        const prev = marker.getLatLng();

        // 🔥 FULL VALIDATION (THIS IS THE KEY FIX)
        if (
            !prev ||
            isNaN(prev.lat) || isNaN(prev.lng) ||
            isNaN(lat) || isNaN(lng)
        ) {
            console.warn("⚠️ Invalid prev/new position → direct set");
            marker.setLatLng([lat, lng]);
            return;
        }

        const distance = map.distance(prev, [lat, lng]);

        if (distance > 500) {
            marker.setLatLng([lat, lng]);
            return;
        }

        const now = Date.now();
        const last = marker._lastUpdate || now;
        const duration = Math.min(now - last, 3000);
        marker._lastUpdate = now;

        // 🔥 SAFE ANGLE CALCULATION
        const angle = Math.atan2(
            lng - prev.lng,
            lat - prev.lat
        ) * (180 / Math.PI);

        if (!isNaN(angle)) {
            marker.setRotationAngle(angle);
        }

        // 🔥 SAFE ANIMATION CALL
        smoothMove(marker, {
            lat: lat,
            lng: lng
        }, duration);
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
let tripLayer = null;

export function drawTrip(positions) {
    if (!map || !positions || positions.length === 0) return;

    // 🔥 Clean previous trip
    if (tripLayer) {
        map.removeLayer(tripLayer);
    }

    const validPoints = positions
        .map(p => {
            const coords = parseLatLng(p);
            return coords ? [coords.lat, coords.lng] : null;
        })
        .filter(p => p !== null);

    if (validPoints.length === 0) {
        console.warn("⚠️ No valid trip points");
        return;
    }

    // 🔵 Polyline
    const polyline = L.polyline(validPoints, {
        color: "blue",
        weight: 4
    });

    // 🟢 Start Marker
    const startMarker = L.marker(validPoints[0], {
        icon: L.icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        })
    }).bindPopup("Start");

    // 🔴 End Marker
    const endMarker = L.marker(validPoints[validPoints.length - 1], {
        icon: L.icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        })
    }).bindPopup("End");

    // 📦 Group
    tripLayer = L.layerGroup([polyline, startMarker, endMarker]).addTo(map);

    // 🔍 Fit bounds
    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
}
export function getMap() {
    return map;
}
export { icons };

export function getMarkers() {
    return markers;
}
export function toKmh(speed) {
    return Math.round((speed || 0) * 1.852);
}