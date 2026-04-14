import { hasPermission } from "./permissions.js";
import { appState } from "../state/appState.js";

export function createVehicleCardElement({ pos, device, isAnalytics, statusClass }) {
    const speed = pos.speedKmh || 0;
    const minutesAgo = Math.floor((Date.now() - new Date(pos.deviceTime)) / 60000);
    const deviceData = window.allowedDevices?.[pos.deviceId];

    // 🔥 FINAL ENGINE PERMISSION LOGIC
    const canUseEngine =
        appState.userRole === "owner" ||
        appState.userRole === "admin" ||
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

        let engineState = pos?.engineOn; // ✅ initialize properly
        const isAdmin = appState.userRole === "admin" || appState.userRole === "owner";
        const btn = document.createElement("button");
        btn.className = "btn-action";

        function updateButton() {

            if (engineState === true) {
                btn.classList.add("btn-success");
                btn.classList.remove("btn-danger");
                btn.innerText = "🟢 ON";
                btn.title = "Press to turn OFF engine";
            } else {
                btn.classList.add("btn-danger");
                btn.classList.remove("btn-success");
                btn.innerText = "🔴 OFF";
                btn.title = isAdmin
                    ? "Press to turn ON engine"
                    : "Engine disabled by admin";
            }
        }

        updateButton();

        btn.onclick = async (e) => {
            e.stopPropagation();

            // 🔐 USER RESTRICTION
            if (engineState !== true && device.engineLockedByAdmin && !isAdmin) {
                alert("Engine is locked by admin. You cannot turn it ON.");
                return;
            }

            const command = engineState === true ? "engineStop" : "engineResume";

            if (command === "engineStop") {
                if (!confirm("Are you sure you want to turn OFF the engine?")) return;
            }

            btn.disabled = true;

            try {
                await sendCommand(pos.deviceId, command);

                alert(`${command === "engineStop" ? "OFF" : "ON"} command sent`);
            } catch (err) {
                console.error(err);
                alert("Command failed");
            } finally {
                btn.disabled = false;
            }
        };

        engineButtons.push(btn);
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