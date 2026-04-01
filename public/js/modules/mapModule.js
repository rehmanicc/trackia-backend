let map;
let markers = {};

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

    const lat = pos.latitude || pos.lat;
    const lng = pos.longitude || pos.lon;

    if (!lat || !lng) return;

    const status = device?.status || "offline";

    const icon = status === "online"
        ? icons.moving
        : icons.offline;

    const speed = Math.round((pos.speed || 0) * 1.852);

    if (!markers[id]) {
        markers[id] = L.marker([lat, lng], { icon }).addTo(map);
    } else {
        markers[id].setLatLng([lat, lng]);
        markers[id].setIcon(icon);
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