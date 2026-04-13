export function createVehicleCardElement({ pos, device, isAnalytics, statusClass }) {

    const speed = pos.speedKmh || 0;
    const minutesAgo = Math.floor((Date.now() - new Date(pos.deviceTime)) / 60000);

    // ✅ ACTION BUTTON (MOVE HERE)
    let actionButton;

    if (isAnalytics) {
        actionButton = document.createElement("button");
        actionButton.className = "btn-action btn-analytics";
        actionButton.innerText = "📊 Trip Details";
        actionButton.onclick = (e) => {
            e.stopPropagation();
            selectDeviceForAnalytics(pos.deviceId);
        };
    } else {
        actionButton = document.createElement("button");
        actionButton.className = "btn-action btn-playback";
        actionButton.innerText = "▶ Playback";
        actionButton.onclick = (e) => {
            e.stopPropagation();
            openPlaybackModal(pos.deviceId);
        };
    }

    // 🔹 ROOT
    const root = document.createElement("div");

    // HEADER
    const header = document.createElement("div");
    header.className = "vehicle-header";

    const name = document.createElement("div");
    name.className = "vehicle-name";
    name.innerText = "🚗 " + (device.name || "Vehicle " + pos.deviceId);

    const status = document.createElement("div");
    status.className = "status-badge " + statusClass;
    status.innerText = device.status || "offline";

    header.appendChild(name);
    header.appendChild(status);

    // BODY
    const body = document.createElement("div");
    body.className = "vehicle-body";

    const left = document.createElement("div");

    const speedEl = document.createElement("div");
    speedEl.innerHTML = `Speed: <b>${speed} km/h</b>`;

    const timeEl = document.createElement("div");
    timeEl.innerText = `Last update: ${minutesAgo} min ago`;

    left.appendChild(speedEl);
    left.appendChild(timeEl);

    body.appendChild(left);

    // ACTION
    body.appendChild(actionButton);

    // ROOT
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