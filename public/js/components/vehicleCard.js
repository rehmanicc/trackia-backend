import { hasPermission } from "./permissions.js";
export function createVehicleCardElement({ pos, device, isAnalytics, statusClass }) {

    const speed = pos.speedKmh || 0;
    const minutesAgo = Math.floor((Date.now() - new Date(pos.deviceTime)) / 60000);
    const deviceData = window.allowedDevices?.[pos.deviceId];

    // 🔥 FINAL ENGINE PERMISSION LOGIC
    const canUseEngine =
        window.userRole === "owner" ||
        window.userRole === "admin" ||
        (
            deviceData?.engineControlEnabled &&
            hasPermission("ENGINE_CONTROL")
        );

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
    let engineButtons = [];

    if (canUseEngine) {

        const offBtn = document.createElement("button");
        offBtn.className = "btn-action btn-danger";
        offBtn.innerText = "🔴 Off";
        offBtn.onclick = (e) => {
            e.stopPropagation();
            if (!confirm("Are you sure you want to turn OFF the engine?")) return;
            sendCommand(pos.deviceId, "engineStop");
        };

        const onBtn = document.createElement("button");
        onBtn.className = "btn-action btn-success";
        onBtn.innerText = "🟢 On";
        onBtn.onclick = (e) => {
            e.stopPropagation();
            sendCommand(pos.deviceId, "engineResume");
        };

        engineButtons.push(offBtn, onBtn);
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
    const actionContainer = document.createElement("div");
    actionContainer.style.display = "flex";
    actionContainer.style.gap = "6px";

    actionContainer.appendChild(actionButton);
    // 🔥 Assign Button (FIX)
    const assignBtn = document.createElement("button");
    assignBtn.className = "btn-action";
    assignBtn.innerText = "👤 Assign";

    assignBtn.onclick = (e) => {
        e.stopPropagation();

        // Convert traccarId → Mongo _id
        const fullDevice = window.allDevices?.find(
            d => String(d.traccarId) === String(pos.deviceId)
        );

        if (!fullDevice) {
            alert("Device not found");
            return;
        }

        openAssign(fullDevice._id); // ✅ correct ID
    };

    actionContainer.appendChild(assignBtn);
    // 🔥 add engine buttons
    engineButtons.forEach(btn => actionContainer.appendChild(btn));

    body.appendChild(actionContainer);

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