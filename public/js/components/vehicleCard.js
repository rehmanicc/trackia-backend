import { hasPermission } from "./permissions.js";
import { appState } from "../state/appState.js";

export function createVehicleCardElement({ pos, device, statusClass }) {

    const speed = pos?.speedKmh || 0;

    const minutesAgo = pos?.deviceTime
        ? Math.floor((Date.now() - new Date(pos.deviceTime)) / 60000)
        : "N/A";

    // 🔹 ROOT
    const root = document.createElement("div");

    // 🔹 HEADER

    const header = document.createElement("div");
    header.className = "vehicle-header";

    const name = document.createElement("div");
    name.innerText = "🚗 " + (device.name || "Vehicle");

    const status = document.createElement("div");
    status.className = "status-badge " + statusClass;
    status.innerText = device.status || "offline";
    const actionRow = document.createElement("div");
    actionRow.className = "vehicle-actions";

    const playbackBtn = document.createElement("button");
    playbackBtn.innerText = "▶ Playback";
    playbackBtn.className = "status-badge playback-badge";
    playbackBtn.onclick = (e) => {
        e.stopPropagation();
        if (!pos) return alert("No data");
        openPlaybackModal(pos.deviceId);
    };

    const tripBtn = document.createElement("button");
    tripBtn.innerText = "📊 Trip";
    tripBtn.className = "status-badge trip-badge";
    tripBtn.onclick = (e) => {
        e.stopPropagation();
        if (!pos) return alert("No data");
        selectDeviceForAnalytics(pos.deviceId);
    };

    actionRow.appendChild(playbackBtn);
    actionRow.appendChild(tripBtn);
    header.appendChild(name);
    header.appendChild(status);
    header.appendChild(actionRow);

    // 🔹 BODY
    const body = document.createElement("div");
    body.className = "vehicle-body";


    // 🔹 INFO
    const speedEl = document.createElement("div");
    speedEl.innerHTML = `Speed: <b>${speed} km/h</b>`;

    const timeEl = document.createElement("div");
    timeEl.innerText = `Last update: ${minutesAgo} min ago`;

    body.appendChild(speedEl);
    body.appendChild(timeEl);

    // 🔥 ACTION ROW (ONLY THIS)
    root.appendChild(header);
    root.appendChild(body);

    return {
        root,
        refs: {
            speedEl,
            timeEl,
            statusEl: status
        }
    };
}