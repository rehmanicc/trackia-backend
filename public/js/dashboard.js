window.setActiveMenu = function (element) {
    if (!element) return;
    document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("active"));
    element.classList.add("active");
}

let allowedDevices = {};
let lastPositions = {};
let activeCard = null;
let geofenceLayers = {};
let geofences = [];
let drawnItems;
let map;
let cachedUsers = [];
let routeLine = null;
let drawControl;
let collapsedDevices = Object.create(null);
let selectedGeofenceId = null;
const lastRenderedData = new Map();
const vehicleCardMap = new Map();
const vehicleRefsMap = new Map();
// ===============================
// PERMISSION GROUPS (v2.4)
// ===============================

const PERMISSION_GROUPS = {
    DEVICES: {
        label: "🚗 Devices",
        permissions: [
            "VIEW_DEVICE",
            "EDIT_DEVICE",
            "SEND_COMMAND",
            "ENGINE_CONTROL"
        ]
    },
    GEOFENCE: {
        label: "📍 Geofencing",
        permissions: [
            "GEOFENCE_VIEW",
            "GEOFENCE_CREATE",
            "GEOFENCE_EDIT",
            "GEOFENCE_DELETE"
        ]
    },
    SYSTEM: {
        label: "⚙️ System",
        permissions: [
            "EDIT_SPEED",
            "EDIT_FUEL",
            "RENEW_DEVICE"
        ]
    }
};

// ===============================
// HUMAN READABLE LABELS
// ===============================
const PERMISSION_LABELS = {
    VIEW_DEVICE: "View Devices",
    EDIT_DEVICE: "Edit Devices",
    SEND_COMMAND: "Send Commands",
    RENEW_DEVICE: "Renew Devices",
    ENGINE_CONTROL: "Engine Control (ON/OFF)",

    EDIT_SPEED: "Edit Speed Limit",
    EDIT_FUEL: "Edit Fuel Settings",

    GEOFENCE_VIEW: "View Geofences",
    GEOFENCE_CREATE: "Create Geofence",
    GEOFENCE_EDIT: "Edit Geofence",
    GEOFENCE_DELETE: "Delete Geofence"
};
const DOM = {
    vehicleList: document.getElementById("vehicleList"),
    countMoving: document.getElementById("countMoving"),
    countIdle: document.getElementById("countIdle"),
    countStopped: document.getElementById("countStopped"),
    countOffline: document.getElementById("countOffline")
};
import {
    initSocket,
    onPositions,
    onGeofence
} from "./services/socketService.js";
import { getState, setState } from "./state/uiState.js";
import { createVehicleCardElement } from "./components/vehicleCard.js";
import { apiRequest } from "./services/apiService.js";
import { hasPermission } from "./components/permissions.js";
import { subscribe } from "./state/uiState.js";
import {
    parseLatLng,
    toKmh,
    initMap,
    updateMarker,
    getMap,
    getMarkers,
    icons
} from "./modules/mapModule.js";
import {
    initAlertModule,
    loadInitialAlerts
} from "./modules/alertModule.js";
import {
    initPlayback,
    startPlayback,
    togglePlayback
} from "./modules/playbackModule.js";
const $ = (id) => document.getElementById(id);
const headerTitle = document.querySelector(".header h2");

subscribe((state, prevState) => {

    // 🔥 Only re-render when UI state changes
    if (
        state.activePanel !== prevState.activePanel ||
        state.selectedVehicleId !== prevState.selectedVehicleId
    ) {
        scheduleVehicleListRender();
    }
});
let renderScheduled = false;
function scheduleVehicleListRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
        const positionsArray = Object.values(lastPositions);
        updateVehicleList(positionsArray);
        renderScheduled = false;
    });
}

function createButton({ text, className = "", onClick = "", title = "" }) {
    return `
        <button 
            class="${className}" 
            onclick="${onClick}"
            title="${title}">
            ${text}
        </button>
    `;
}
async function safeApi(call, fallback = null) {
    try {
        return await call();
    } catch (err) {
        console.error("API Error:", err);
        alert("Something went wrong. Please try again.");
        return fallback;
    }
}

window.createUser = async function () {

    const name = document.getElementById("newUserName").value.trim();
    const phone = document.getElementById("newUserPhone").value.trim();
    const password = document.getElementById("newUserPassword").value.trim();
    const role = document.getElementById("newUserRole").value;

    if (!phone.match(/^03\d{9}$/)) {
        alert("Enter valid mobile number (03XXXXXXXXX)");
        return;
    }
    if (!name || !phone || !password) {
        alert("Fill all fields");
        return;
    }

    try {
        const data = await apiRequest("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, phoneNumber: phone, password, role })
        });
        alert(data.message || "User created successfully");

        // clear form
        document.getElementById("newUserName").value = "";
        document.getElementById("newUserPhone").value = "";
        document.getElementById("newUserPassword").value = "";

    } catch (err) {
        console.error(err);

        // ✅ show backend error
        alert(err.message || "Server error");
    }
}
//command function

window.sendCommand = async function (deviceId, type) {
    if (!deviceId || !type) {
        alert("Invalid command");
        return;
    }
    try {
        const data = await apiRequest("/api/traccar/command", {
            method: "POST",
            body: JSON.stringify({ deviceId, type })
        });

        if (!data) return;

        alert("Command sent: " + type);
        console.log("Command response:", data);

    } catch (err) {
        console.error(err);
        alert("Failed to send command");
    }
}

window.selectDeviceForAnalytics = function (deviceId) {

    const id = String(deviceId);
    setState({
        selectedVehicleId: id,
        activePanel: "analytics" // 🔥 CRITICAL
    });

    switchPanel("analytics");

    document.getElementById("analyticsModal").style.display = "flex";

    if (window.loadAnalytics) {
        window.loadAnalytics(`deviceId=${id}`);
    }
};

window.closeAnalyticsModal = function () {
    document.getElementById("analyticsModal").style.display = "none";
}

window.openPlaybackModal = function (deviceId) {
    setState({ selectedVehicleId: deviceId });

    const modal = document.getElementById("playbackModal");
    const dateInput = document.getElementById("playbackDatePicker");

    // Default today
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;

    modal.style.display = "flex";
}

window.closePlaybackModal = function () {
    document.getElementById("playbackModal").style.display = "none";
}

window.confirmPlayback = function () {
    const date = document.getElementById("playbackDatePicker").value;

    if (!date) {
        alert("Please select a date");
        return;
    }

    // 🔥 Inject into existing system
    let deviceInput = document.getElementById("playbackDeviceId");
    let dateInput = document.getElementById("playbackDate");

    if (!deviceInput) {
        deviceInput = document.createElement("input");
        deviceInput.id = "playbackDeviceId";
        deviceInput.type = "hidden";
        document.body.appendChild(deviceInput);
    }

    if (!dateInput) {
        dateInput = document.createElement("input");
        dateInput.id = "playbackDate";
        dateInput.type = "hidden";
        document.body.appendChild(dateInput);
    }

    deviceInput.value = getState().selectedVehicleId;
    dateInput.value = date;

    closePlaybackModal();

    startPlayback(getState().selectedVehicleId, date);
}
async function fetchAllowedDevices() {
    try {
        const devices = await safeApi(() => apiRequest("/api/devices"), []);
        allowedDevices = {};
        devices.forEach(device => {
            allowedDevices[String(device.traccarId)] = device;
        });

    } catch (err) {
        console.error("❌ Error fetching devices:", err);
    }
    window.allowedDevices = allowedDevices;
}

window.openGeofence = function () {
    setState({ activePanel: "geofence", mode: "geofence" });
    headerTitle.innerText = "Geofencing";

    // 🔥 Prevent duplicate controls
    if (!map._drawControlAdded) {
        map.addControl(drawControl);
        map._drawControlAdded = true;
    }
}

function renderGeofenceList() {
    const container = document.getElementById("geofenceList");
    if (!container) return;

    container.innerHTML = "";
    Object.values(allowedDevices).forEach(device => {
        const deviceId = device.traccarId;
        const deviceGeofences = geofences.filter(
            f => String(f.deviceId) === String(deviceId)
        );
        // 🚗 Device header
        const vehicleDiv = document.createElement("div");
        vehicleDiv.className = "geo-device";
        vehicleDiv.innerHTML = `
                <div class="flex-between">
                    <span>🚗 ${device.name || "Vehicle " + deviceId}</span>
                    <button class="add-geo-btn" type="button">+ Add</button>
                </div>
            `;
        vehicleDiv.querySelector(".add-geo-btn").onclick = async (e) => {
            e.stopPropagation();

            await selectVehicle(deviceId);

            openGeofence();
            window.alertUI?.showToast(`Creating geofence for ${device.name}`, "success");
        };
        vehicleDiv.onclick = async () => {
            collapsedDevices[deviceId] = !collapsedDevices[deviceId];

            await selectVehicle(deviceId);
        };

        container.appendChild(vehicleDiv);

        const selectedVehicleId = getState().selectedVehicleId;

        if (String(deviceId) === String(selectedVehicleId)) {
            vehicleDiv.classList.add("active");
        }
        if (collapsedDevices[deviceId] === true) {
            return;
        }
        if (deviceGeofences.length === 0) {
            const empty = document.createElement("div");
            empty.className = "geo-empty";
            empty.innerText = "No geofences";
            container.appendChild(empty);
            return;
        }

        // 🔥 Render geofences
        deviceGeofences.forEach(f => {

            const div = document.createElement("div");
            div.className = "vehicle-card";

            div.innerHTML = `
    <div class="flex-between">
        <span>📍 ${f.name || "Unnamed"}</span>

        <div style="display:flex; gap:6px;">
            <button 
                title="Edit"
                onclick="event.stopPropagation(); editGeofenceName('${f._id}')">
                ✏️
            </button>

            <button 
                title="Delete"
                onclick="event.stopPropagation(); deleteGeofence('${f._id}')">
                🗑
            </button>
        </div>
    </div>
`;

            div.onclick = async () => {
                selectedGeofenceId = f._id;


                Object.values(geofenceLayers).forEach(l => {
                    if (l && typeof l.setStyle === "function") {
                        l.setStyle({ color: "#3388ff" });
                    }
                });

                const layer = geofenceLayers[f._id];


                if (layer && typeof layer.setStyle === "function") {
                    layer.setStyle({
                        color: "orange",
                        weight: 3
                    });

                    if (typeof layer.getBounds === "function") {
                        map.fitBounds(layer.getBounds());
                    }
                }
            };
            container.appendChild(div);
        });
    });
}
window.editGeofenceName = async function (id) {

    const newName = prompt("Enter new name:");
    if (!newName) return;

    await apiRequest(`/api/geofence/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: newName })
    });

    await loadGeofences();
}
window.deleteGeofence = async function (id) {
    if (!confirm("Delete this geofence?")) return;

    await apiRequest(`/api/geofence/${id}`, {
        method: "DELETE"
    });

    window.alertUI?.showToast("Geofence deleted", "success");

    await loadGeofences();
}
async function loadInitialPositions() {
    try {
        const positions = await apiRequest("/api/traccar/positions");

        const tempPositions = [];

        // ✅ FIRST PASS → prepare data (FAST)
        positions.forEach(pos => {

            const id = String(pos.deviceId);
            const coords = parseLatLng(pos);
            if (!coords) return;

            lastPositions[id] = pos;
            tempPositions.push(pos);
        });
        updateVehicleList(tempPositions);
        setTimeout(() => {
            tempPositions.forEach(pos => {
                const id = String(pos.deviceId);
                updateMarker(id, pos, allowedDevices[id]);
            });
        }, 0);

    } catch (err) {
        console.error("❌ Initial load error:", err);
    }
}
async function loadUsersCache() {
    try {
        console.log("⚡ Loading users cache...");
        cachedUsers = await apiRequest("/api/users") || [];
    } catch (err) {
        console.error("❌ Failed to load users", err);
        cachedUsers = [];
    }
}
async function initApp() {
    const token = localStorage.getItem("token");
    initSocket(token);
    initAlertModule();
    await loadInitialAlerts();
    await fetchAllowedDevices();
    await loadGeofences();
    await loadInitialPositions();
    await loadUsersCache();
    // POSITIONS
    let positionBuffer = [];
    let processing = false;

    onPositions((positions) => {
        positionBuffer.push(...positions);

        if (processing) return;

        processing = true;

        setTimeout(() => {
            const batch = positionBuffer;
            positionBuffer = [];

            batch.forEach((pos) => {

                const id = String(pos.deviceId);

                if (!pos) return;

                const coords = parseLatLng(pos);
                if (!coords) return;

                lastPositions[id] = pos;
                updateMarker(id, pos);
            });

            scheduleVehicleListRender();

            processing = false;

        }, 300);
    });
    onGeofence(({ geofenceId, type, deviceId }) => {

        const normalizedType = String(type).toLowerCase();

        console.log("📡 Geofence event:", normalizedType);

        // ✅ Fix visual
        updateGeofenceVisual(geofenceId, normalizedType);

        // ✅ Trigger alert UI (OPTIONAL but recommended)
        if (window.alertUI) {
            const message =
                normalizedType === "enter"
                    ? "Vehicle entered geofence"
                    : "Vehicle exited geofence";

            window.alertUI.showToast(
                message,
                normalizedType === "enter" ? "success" : "error"
            );
        }
    });

    const savedPanel = "live";

    setTimeout(() => {
        switchPanel(savedPanel);
    }, 50);

    const speedSlider = document.getElementById("speedSlider");
    const speedLabel = document.getElementById("speedLabel");
    if (speedSlider && speedLabel) {
        speedSlider.addEventListener("input", function () {
            speedLabel.innerText = this.value + "x";
        });
    }
}
window.initDashboard = initApp;
window.showRoute = async function (deviceIdParam) {

    const deviceId = deviceIdParam || getState().selectedVehicleId;

    console.log("🔥 showRoute deviceId:", deviceId);

    let from = document.getElementById("fromTime").value;
    let to = document.getElementById("toTime").value;

    if (!deviceId) {
        alert("Please select vehicle first");
        return;
    }

    if (!from || !to) {
        alert("Please fill all fields");
        return;
    }

    from = new Date(from).toISOString();
    to = new Date(to).toISOString();

    const data = await apiRequest(`/api/traccar/route?deviceId=${deviceId}&from=${from}&to=${to}`);

    console.log("Route Data:", data);

    if (!data || data.length === 0) {
        document.getElementById("analyticsBox").innerHTML =
            "<p style='color:red'>No trip data found</p>";
        return;
    }

    // continue your existing logic...
};
// LOAD GEOFENCES
async function loadGeofences() {

    try {

        let url = "/api/geofence";

        const selectedVehicleId = getState().selectedVehicleId;

        if (selectedVehicleId) {
            url += `?deviceId=${selectedVehicleId}`;
        }

        const fences = await apiRequest(url);
        if (!fences) return;

        geofences = fences;
        drawnItems.clearLayers();

        fences.forEach(f => {

            const layer = L.geoJSON({ type: "Feature", geometry: f.geometry }, {
                style: {
                    color: "#3388ff",
                    weight: 2,
                    fillOpacity: 0.2
                }
            });

            layer.eachLayer(l => {

                const geofenceId = f._id || f.id;
                geofenceLayers[geofenceId] = l;

                drawnItems.addLayer(l);
            });
        });
    } catch (err) {
        console.error("❌ Error loading geofences:", err);
    }
    renderGeofenceList();
}

function updateGeofenceVisual(geofenceId, type) {

    const layer = geofenceLayers[geofenceId];
    if (!layer) return;

    if (type === "enter") {
        layer.setStyle({
            color: "green",
            fillColor: "green",
            fillOpacity: 0.3
        });
    }

    if (type === "exit") {
        layer.setStyle({
            color: "red",
            fillColor: "red",
            fillOpacity: 0.3
        });
    }

    // 🔥 Optional: reset after few seconds
    setTimeout(() => {
        layer.setStyle({
            color: "#3388ff",
            fillColor: "#3388ff",
            fillOpacity: 0.2
        });
    }, 5000);
}
function updateVehicleList(positions) {

    const container = DOM.vehicleList;
    const search = $("searchInput")?.value?.toLowerCase() || "";
    const statusFilter = document.getElementById("statusFilter")?.value || "all";

    if (!container) return;

    const visibleIds = new Set();

    let counts = {
        moving: 0,
        idle: 0,
        stopped: 0,
        offline: 0
    };

    positions.forEach(pos => {

        const id = String(pos.deviceId);
        const device = allowedDevices[id] || {
            name: "Device " + id,
            status: "offline"
        };

        const status = device.status || "offline";

        counts[status]++;

        // 🔍 FILTERS
        if (statusFilter !== "all" && status !== statusFilter) return;

        const name = (device.name || "").toLowerCase();
        if (search && !name.includes(search) && !id.includes(search)) return;

        visibleIds.add(id);

        let card = vehicleCardMap.get(id);
        const state = getState();
        const isAnalytics = state.activePanel === "analytics";

        // 🔥 Detect panel change (force rebuild)
        const prevPanel = card?.dataset.panel;
        const currentPanel = state.activePanel;

        if (card && prevPanel !== currentPanel) {
            card.remove();
            vehicleCardMap.delete(id);
            vehicleRefsMap.delete(id);
            lastRenderedData.delete(id);
            card = null; // force recreate
        }
        const statusClass = {
            online: "status-online",
            offline: "status-offline",
            unknown: "status-unknown"
        }[status] || "status-unknown";

        if (!card) {
            card = document.createElement("div");
            card.className = "vehicle-card";
            card.dataset.id = id;
            card.dataset.panel = state.activePanel;
            card.onclick = async () => {
                await selectVehicle(id);
            };

            const { root, refs } = createVehicleCardElement({
                pos,
                device,
                isAnalytics,
                statusClass
            });

            card.appendChild(root);

            vehicleCardMap.set(id, card);
            vehicleRefsMap.set(id, refs);

            container.appendChild(card);
        }

        // 🔄 UPDATE ONLY CONTENT
        const prev = lastRenderedData.get(id);

        const newData =
            pos.speedKmh + "|" +
            status + "|" +
            pos.deviceTime + "|" +
            (device.name || "");

        if (prev !== newData) {
            const refs = vehicleRefsMap.get(id);

            if (refs) {
                refs.speedEl.innerHTML = `Speed: <b>${pos.speedKmh || 0} km/h</b>`;

                const minutesAgo = Math.floor((Date.now() - new Date(pos.deviceTime)) / 60000);
                refs.timeEl.innerText = `Last update: ${minutesAgo} min ago`;

                refs.statusEl.innerText = status;
                refs.statusEl.className = "status-badge " + statusClass;
            }

            lastRenderedData.set(id, newData);
        }
    });


    vehicleCardMap.forEach((card, id) => {
        if (!visibleIds.has(id)) {
            card.remove();
            vehicleCardMap.delete(id);
            vehicleRefsMap.delete(id); // ✅ IMPORTANT
            lastRenderedData.delete(id);
        }
    });

    // ✅ UPDATE STATS
    DOM.countMoving.innerText = counts.moving;
    DOM.countIdle.innerText = counts.idle;
    DOM.countStopped.innerText = counts.stopped;
    DOM.countOffline.innerText = counts.offline;

    const selectedVehicleId = getState().selectedVehicleId;
    if (selectedVehicleId) {
        highlightVehicleCard(selectedVehicleId);
    }
}
function highlightVehicleCard(id) {

    if (activeCard) {
        activeCard.classList.remove("active");
    }

    const newCard = document.querySelector(`.vehicle-card[data-id="${id}"]`);

    if (newCard) {
        newCard.classList.add("active");
        newCard.scrollIntoView({ block: "center", behavior: "smooth" });
        activeCard = newCard;
    }
}
function focusOnVehicle(id) {
    const markers = getMarkers();
    const mapInstance = getMap();

    const marker = markers[id];
    if (!marker || !mapInstance) return;

    const latlng = marker.getLatLng();

    mapInstance.setView(latlng, 15, {
        animate: true,
        duration: 0.5
    });

    marker.openPopup?.();
}
function resetUI() {
    // Reset all panels
    document.querySelectorAll(`
    .vehicle-panel,
    #devicePanel,
    #geofencePanel,
    #alertPanel,
    #userPanel,
    #createDevicePanel
`).forEach(p => {
        p.classList.remove("active");
    });

    // Show map by default
    const map = $("map");
    if (map) map.style.display = "block";

    // Hide trip stats
    const tripStats = document.getElementById("tripStatsPanel");
    if (tripStats) tripStats.style.display = "none";

    // Show stats bar (default)
    const statsBar = document.querySelector(".stats-bar");
    if (statsBar) statsBar.style.display = "flex";

    // Reset header
    const header = document.querySelector(".header h2");
    if (header) header.innerText = "";
}
window.switchPanel = function (panel) {

    resetUI();
    closeAssign();

    // ✅ 3. HIDE MAP / SHOW DEFAULT
    const mapEl = $("map");
    const statsBar = document.querySelector(".stats-bar");

    if (mapEl) mapEl.style.display = "block";
    if (statsBar) statsBar.style.display = "flex";

    // ✅ 4. REMOVE ALL ACTIVE PANELS
    document.querySelectorAll(".vehicle-panel, #devicePanel, #geofencePanel, #alertPanel, #userPanel, #createDevicePanel")
        .forEach(el => el.classList.remove("active"));

    // ✅ 5. SWITCH PANEL
    switch (panel) {

        case "live":
            $("vehicleList").closest(".vehicle-panel").classList.add("active");
            if (headerTitle) headerTitle.innerText = "Live Tracking";
            break;

        case "analytics":

            $("vehicleList").closest(".vehicle-panel").classList.add("active");
            if (headerTitle) headerTitle.innerText = "Trip Analytics";
            const tripStats = $("tripStatsPanel");
            if (tripStats) tripStats.style.display = "flex";
            if (statsBar) statsBar.style.display = "flex";
            if (mapEl) mapEl.style.display = "block";
            break;

        case "devices":
            $("devicePanel").classList.add("active");
            headerTitle.innerText = "Devices";
            loadDevices();
            break;

        case "geofence":
            $("geofencePanel").classList.add("active");
            if (headerTitle) headerTitle.innerText = "Geofencing";
            break;

        case "alerts":
            $("alertPanel").classList.add("active");
            headerTitle.innerText = "Alerts";
            loadInitialAlerts();
            break;

        case "users":

            if (!hasPermission("EDIT_DEVICE") && window.userRole !== "owner") {
                alert("Access denied");
                return;
            }

            if (mapEl) mapEl.style.display = "none";
            if (statsBar) statsBar.style.display = "none";

            $("userPanel").classList.add("active");
            headerTitle.innerText = "User Rights";
            loadUserPermissions();
            break;

        case "createDevice":
            $("createDevicePanel").classList.add("active");
            if (headerTitle) headerTitle.innerText = "Create Device";
            break;
    }
    setState({ activePanel: panel });

}
window.closeAssign = function () {
    const modal = document.getElementById("assignModal");
    if (modal) {
        modal.style.display = "none";
    }
}
async function loadDevices() {
    console.log("🚀 loadDevices called");
    const container = document.getElementById("deviceList");

    try {
        const devices = await apiRequest("/api/devices");
        container.innerHTML = `
    <div class="device-header">
        <input type="text" id="deviceSearch" placeholder="Search devices..." oninput="filterDevices()">
    </div>

    <table class="device-table">
        <thead>
            <th>Name</th>
<th>Tra ID</th>
<th>Speed</th>
<th>Assigned Users</th>
<th>Actions</th>                   
        </thead>
        <tbody id="deviceTableBody"></tbody>
    </table>
`;

        const tbody = document.getElementById("deviceTableBody");

        devices.forEach(d => {
            const canManageDevices = hasPermission("EDIT_DEVICE");
            let users = "-";

            if (Array.isArray(d.assignedTo)) {
                users = d.assignedTo.map(u => u.name || "User").join(", ");
            }
            else if (d.assignedTo && typeof d.assignedTo === "object") {
                users = d.assignedTo.name || "User";
            }
            const canEditSpeed = hasPermission("EDIT_SPEED");
            const row = document.createElement("tr");

            row.innerHTML = `
        <td>${d.name}</td>
        <td>${d.traccarId}</td>

        <td>
            <input 
                type="number" 
                value="${d.speedLimit ?? 70}" 
                onchange="updateSpeed('${d._id}', this.value)"
                style="width:70px;"
                ${canEditSpeed ? "" : "disabled"}
            >
        </td>

        <td>${users || "-"}</td>

        <td>
    <div class="action-buttons">

    ${canManageDevices ? createButton({
                text: "👤",
                className: "icon-btn assign",
                onClick: `openAssign('${d._id}')`,
                title: "Assign"
            }) : ""}

    ${canManageDevices && Array.isArray(d.assignedTo) && d.assignedTo.lengthd.assignedTo?.length ? createButton({
                text: "❌",
                className: "icon-btn unassign",
                onClick: `unassignDevice('${d._id}')`,
                title: "Unassign"
            }) : ""}

    ${canManageDevices ? createButton({
                text: "🗑",
                className: "icon-btn delete",
                onClick: `deleteDevice('${d._id}')`,
                title: "Delete"
            }) : ""}

    </div>
</td>
    `;

            tbody.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `
    <p style='color:red'>
        Failed to load devices<br>
        ${err.message || ""}
    </p>
`;
    }
}
window.unassignDevice = async function (deviceId) {
    const userId = document.getElementById("assignUserSelect").value;

    await apiRequest(`/api/devices/${deviceId}/unassign`, {
        method: "POST",
        body: JSON.stringify({ userId })
    });

    alert("Unassigned");
    loadDevices();
}
window.filterDevices = function () {
    const search = document.getElementById("deviceSearch").value.toLowerCase();
    const rows = document.querySelectorAll("#deviceTableBody tr");

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(search) ? "" : "none";
    });
}
window.submitNewDevice = async function () {
    const name = document.getElementById("deviceNameInput").value;
    const uniqueId = document.getElementById("deviceUniqueInput").value;

    if (!name || !uniqueId) {
        alert("Fill all fields");
        return;
    }

    await apiRequest("/api/devices", {
        method: "POST",
        body: JSON.stringify({ name, uniqueId })
    });

    alert("Device added");
    switchPanel("devices");
    loadDevices();
}
window.deleteDevice = async function (id) {
    if (!confirm("Delete this device?")) return;

    await apiRequest(`/api/devices/${id}`, {
        method: "DELETE"
    });

    alert("Deleted");
    loadDevices();
}
let selectedDeviceForAssign = null;

window.openAssign = async function (deviceId) {

    selectedDeviceForAssign = deviceId;

    const adminSelect = document.getElementById("assignAdminSelect");
    const userSelect = document.getElementById("assignUserSelect");

    if (!adminSelect || !userSelect) return;

    // reset
    adminSelect.innerHTML = "<option value=''>-- Select Admin --</option>";
    userSelect.innerHTML = "<option value=''>-- Select User --</option>";

    const device = Object.values(allowedDevices)
        .find(d => d._id === deviceId);
    // 🔥 Pre-fill current selections
    let currentUserId = null;

    if (Array.isArray(device.assignedTo) && device.assignedTo.length) {
        currentUserId = device.assignedTo[0]._id;
    }
    else if (device.assignedTo && typeof device.assignedTo === "object") {
        currentUserId = device.assignedTo._id;
    }

    // Set selected user
    if (currentUserId) {
        setTimeout(() => {
            const userSelect = document.getElementById("assignUserSelect");
            if (userSelect) userSelect.value = currentUserId;
        }, 0);
    }
    if (!device) {
        alert("Device not found");
        return;
    }

    // 🔥 DEBUG (optional)
    console.log("Users:", cachedUsers);

    // =========================
    // 👑 OWNER → BOTH LISTS
    // =========================
    if (window.userRole === "owner") {

        // ✅ Admin list
        cachedUsers
            .filter(u => String(u.role).toLowerCase() === "admin")
            .forEach(u => {
                const opt = document.createElement("option");
                opt.value = u._id;
                opt.textContent = u.name;
                adminSelect.appendChild(opt);
            });

        // ✅ User list
        cachedUsers
            .filter(u => String(u.role).toLowerCase() === "user")
            .forEach(u => {
                const opt = document.createElement("option");
                opt.value = u._id;
                opt.textContent = u.name;
                userSelect.appendChild(opt);
            });
    }

    // =========================
    // 🏢 ADMIN → USERS ONLY
    // =========================
    else if (window.userRole === "admin") {

        // hide admin dropdown
        document.getElementById("adminAssignBlock").style.display = "none";

        cachedUsers
            .filter(u =>
                String(u.role).toLowerCase() === "user" &&
                u.adminId === device.adminId
            )
            .forEach(u => {
                const opt = document.createElement("option");
                opt.value = u._id;
                opt.textContent = u.name;
                userSelect.appendChild(opt);
            });
    }

    else {
        alert("Access denied");
        return;
    }

    document.getElementById("assignModal").style.display = "flex";
};

window.submitAssign = async function () {

    const adminId = document.getElementById("assignAdminSelect")?.value;
    const userId = document.getElementById("assignUserSelect")?.value;

    const device = Object.values(allowedDevices)
        .find(d => d._id === selectedDeviceForAssign);

    let currentUserId = null;

    if (Array.isArray(device?.assignedTo) && device.assignedTo.length) {
        currentUserId = device.assignedTo[0]._id;
    } else if (device?.assignedTo && typeof device.assignedTo === "object") {
        currentUserId = device.assignedTo._id;
    }

    let payload = {};

    // 👑 OWNER
    if (window.userRole === "owner") {

        if (adminId && adminId !== "") {
            payload.adminId = adminId;
        }

        if (userId && userId !== "") {
            payload.userId = userId;
        }

        if (!payload.adminId && !payload.userId) {
            alert("Select admin or user");
            return;
        }
    }

    // 🏢 ADMIN
    else if (window.userRole === "admin") {

        if (!userId || userId === "") {
            alert("Select user");
            return;
        }

        payload.userId = userId;
    }

    try {

        // 🔥 Step 1: Unassign if needed
        if (currentUserId && (payload.userId || payload.adminId)) {

            console.log("🔄 Unassigning:", currentUserId);

            try {
                await apiRequest(`/api/devices/${selectedDeviceForAssign}/unassign`, {
                    method: "POST",
                    body: JSON.stringify({ userId: currentUserId })
                });
            } catch (err) {
                console.warn("Unassign failed (safe ignore):", err.message);
            }
        }

        // 🔥 Step 2: Assign NEW (THIS WAS MISSING)
        console.log("📤 Assign payload:", payload);

        await apiRequest(`/api/devices/${selectedDeviceForAssign}/assign`, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        alert("Assigned successfully");

        closeAssign();
        loadDevices();

    } catch (err) {
        console.error(err);
        alert(err.message || "Assign failed");
    }
};


let permissionChanges = {};
window.togglePermission = function (userId, permission, isChecked) {

    if (!permissionChanges[userId]) {
        permissionChanges[userId] = new Set();
    }

    if (isChecked) {
        permissionChanges[userId].add(permission);
    } else {
        permissionChanges[userId].delete(permission);
    }
}
window.savePermissions = async function (userId) {

    const container = document.getElementById("userContent");
    const inputs = container.querySelectorAll(".permission-item input");

    const perms = [];

    inputs.forEach(input => {
        if (input.checked) {
            const perm = input.dataset.permission;
            if (perm) perms.push(perm);
        }
    });

    await apiRequest(`/api/auth/permissions/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ permissions: perms })
    });

    window.alertUI?.showToast("Permissions updated", "success");

    loadUserPermissions(); // ✅ correct call
};
async function loadUserPermissions() {

    console.log("🔥 Loading users...");

    const users = await safeApi(() => apiRequest("/api/users"), []);
    console.log("✅ Users:", users);

    const list = document.getElementById("userList");

    list.innerHTML = "";

    if (!users || users.length === 0) {
        list.innerHTML = "<p>No users found</p>";
        return;
    }

    users.forEach(user => {

        const div = document.createElement("div");
        div.className = "user-item";

        div.innerHTML = `
            <div class="user-row">

            <div class="user-line">
                <b>${user.name}</b>
                <button onclick="showEditUser('${user._id}')">Edit</button>
            </div>

            <div class="user-line">
                <small>${user.role}</small>
                <button onclick="showUserPermissions('${user._id}')">Permissions</button>
            </div>

        </div>
        `;

        list.appendChild(div);
    });
    showCreateUserForm();
}
function showCreateUserForm() {

    const right = document.getElementById("userContent");
    if (window.userRole === "user") {
        document.getElementById("userContent").innerHTML = "";
        return;
    }
    right.innerHTML = `
    <div class="user-form-card">
        <h3>Create User</h3>

        <div class="form-group">
            <label>Full Name</label>
            <input id="newUserName" placeholder="Enter full name">
        </div>

        <div class="form-group">
        <label>Mobile Number</label>
        <input id="newUserPhone" type="text" placeholder="03XXXXXXXXX">
        </div>

        <div class="form-group">
            <label>Password</label>
            <input id="newUserPassword" type="password" placeholder="Enter password">
        </div>

        <div class="form-group">
            <label>Role</label>
            <select id="newUserRole"></select>
        </div>

        <button class="btn-create-user" onclick="createUser()">
            Create User
        </button>
    </div>
`;

    // 🔥 IMPORTANT: populate role dropdown again
    populateRoleDropdown();
}
function populateRoleDropdown() {

    const roleSelect = document.getElementById("newUserRole");
    if (!roleSelect) return;

    const token = localStorage.getItem("token");

    let role = null;

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        role = payload.role;
    } catch (e) {
        console.error("Role parse error");
    }

    roleSelect.innerHTML = "";

    if (role === "owner") {
        roleSelect.innerHTML = `<option value="admin">Admin</option>`;
    } else if (role === "admin") {
        roleSelect.innerHTML = `<option value="user">User</option>`;
    }
}
async function openExpiredDevices() {
    document.getElementById("expiredModal").classList.remove("hidden");
    try {
        const res = await fetch("/api/devices", {
            headers: {
                Authorization: "Bearer " + localStorage.getItem("token")
            }
        });

        const devices = await res.json();

        const now = new Date();

        const expired = devices.filter(d =>
            new Date(d.expiryDate) < now
        );

        renderExpiredDevices(expired);

    } catch (err) {
        console.error(err);
    }
}
function renderExpiredDevices(devices) {
    const container = document.getElementById("expiredList");

    if (devices.length === 0) {
        container.innerHTML = "<p>No expired devices</p>";
        return;
    }

    container.innerHTML = devices.map(d => `
    <div class="expired-item">

      <span>
        ${d.name} (ID: ${d.traccarId})
      </span>

      <div>
        <button class="btn-renew" onclick="renewDevice('${d._id}')">Renew</button>
        <button class="btn-delete" onclick="deleteDevice('${d._id}')">Remove</button>
      </div>

    </div>
  `).join("");
}
function closeExpiredDevices() {
    document.getElementById("expiredModal").classList.add("hidden");
}
window.renewDevice = async function (deviceId) {
    try {
        await apiRequest(`/api/devices/renew/${deviceId}`, {
            method: "POST"
        });

        alert("Device renewed");
        loadDevices();

    } catch (err) {
        console.error(err);
        alert("Renew failed");
    }
}
window.showUserPermissions = async function (userId) {

    const right = document.getElementById("userContent");
    if (!right) return;

    const user = await apiRequest(`/api/users/${userId}`);

    let html = `<div class="permission-container">
    <h3>${user.name} Permissions</h3>`;

    Object.entries(PERMISSION_GROUPS).forEach(([key, group]) => {
        const allChecked = group.permissions.every(p =>
            user.permissions?.includes(p)
        );
        html += `
                <div class="permission-card">
<div class="permission-header">
    <span>${group.label}</span>

    <label class="switch">
        <input type="checkbox"
${allChecked ? "checked" : ""}
onchange="toggleGroup('${userId}', '${key}', this.checked)">
        <span class="slider"></span>
    </label>
</div>
                <div class="permission-list">
        `;

        group.permissions.forEach(p => {

            if (p === "RENEW_DEVICE" && window.userRole === "admin") {
                return;
            }
            if (
                p === "RENEW_DEVICE" &&
                window.userRole === "owner" &&
                user.role !== "admin"
            ) {
                return;
            }

            const checked = user.permissions?.includes(p) ? "checked" : "";

            html += `
        <label class="permission-item">
        <span>${PERMISSION_LABELS[p]}</span>
        <label class="switch">
            <input type="checkbox"
data-permission="${p}"
${checked}
onchange="togglePermission('${userId}','${p}', this.checked)">
            <span class="slider"></span>
            </label>
        </label>
        `;
        });

        html += `</div></div>`;
    });

    html += `
    <button class="btn-save-permissions" onclick="savePermissions('${userId}')">            💾 Save Permissions
        </button>
    `;

    right.innerHTML = html;
}
window.showEditUser = async function (userId) {

    const right = document.getElementById("userContent");

    // 🔥 FIRST render HTML
    right.innerHTML = `
        <div class="user-form-card">
            <h3>Edit User</h3>

            <div class="form-group">
                <label>Full Name</label>
                <input id="editUserName" placeholder="Update Name">
            </div>

            <div class="form-group">
                <label>Mobile Number</label>
                <input id="editUserPhone" placeholder="03XXXXXXXXX">
            </div>

            <button class="btn-save-user" onclick="updateUser('${userId}')">
                Save Changes
            </button>
        </div>
    `;

    // 🔥 THEN fetch user
    const user = await apiRequest(`/api/users/${userId}`);

    // 🔥 NOW elements exist
    document.getElementById("editUserName").value = user.name || "";
    document.getElementById("editUserPhone").value = user.phoneNumber || "";


    window.originalPhone = (user.phoneNumber || "").trim();
}
window.updateUser = async function (userId) {

    const name = document.getElementById("editUserName").value.trim();
    const phone = document.getElementById("editUserPhone").value
        .trim()
        .replace(/\s+/g, "");
    console.log("Phone raw:", document.getElementById("editUserPhone").value);
    console.log("Phone trimmed:", phone);
    console.log("Length:", phone.length);
    if (!name || !phone) {
        alert("Fill all fields");
        return;
    }
    if (phone !== window.originalPhone) {
        if (!phone.match(/^03\\d{9}$/)) {
            alert("Enter valid mobile number");
            return;
        }
    }
    await apiRequest(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({
            name,
            phoneNumber: phone
        })
    });

    alert("User updated");
    loadUserPermissions();
}
async function selectVehicle(deviceId) {

    const id = String(deviceId);

    setState({ selectedVehicleId: id });

    highlightVehicleCard(id);

    // 🔥 FORCE map focus even in analytics
    focusOnVehicle(id);


    if (getState().activePanel === "analytics") {
        setTimeout(() => focusOnVehicle(id), 100);
    }

    await loadGeofences();
    renderGeofenceList();
}
window.logout = function () {
    localStorage.removeItem("token");
    document.getElementById("loginSection").style.display = "flex";
    document.getElementById("loggedInSection").style.display = "none";
    location.reload();
}

document.addEventListener("DOMContentLoaded", () => {

    if (headerTitle) headerTitle.innerText = "Live Tracking";
    const token = localStorage.getItem("token")
    const loginSection = document.getElementById("loginSection");
    const loggedInSection = document.getElementById("loggedInSection");

    const emailInput = document.getElementById("loginPhone");
    const passwordInput = document.getElementById("loginPassword");

    if (!token) {

        loginSection.style.display = "flex";
        loggedInSection.style.display = "none";

        // ✅ ENTER KEY SUPPORT
        function handleEnter(e) {
            if (e.key === "Enter") {
                handleLogin();
            }
        }

        emailInput?.addEventListener("keypress", handleEnter);
        passwordInput?.addEventListener("keypress", handleEnter);

        // ✅ AUTO FOCUS
        emailInput?.focus();

        return;
    } else {

        loginSection.style.display = "none";
        loggedInSection.style.display = "flex";
    }

    let payload = null;

    try {
        payload = JSON.parse(atob(token.split(".")[1]));

        if (!payload) throw new Error("Invalid token");

    } catch (e) {
        console.error("Token parsing error:", e);

        localStorage.removeItem("token");   // 🔥 ADD THIS
        location.reload();                  // 🔥 ADD THIS
        return;
    }
    window.userRole = payload?.role;
    setState({ userRole: payload?.role });
    if (window.userRole === "user") {
        const usersBtn = document.getElementById("usersMenuBtn");
        if (usersBtn) usersBtn.style.display = "none";
    }
    const container = document.getElementById("expiredBtnContainer");

    if (
        container &&
        (
            window.userRole === "owner" ||
            (window.userRole === "admin" && hasPermission("RENEW_DEVICE"))
        )
    ) {
        container.innerHTML = `
        <button onclick="openExpiredDevices()">
            🔄 Manage Expired
        </button>
    `;
    } else {
        container.innerHTML = ""; // ❌ hide completely
    }
    const userDisplay = document.getElementById("loggedInUser");

    if (userDisplay && payload) {
        const roleLabel = payload.role
            ? payload.role.charAt(0).toUpperCase() + payload.role.slice(1)
            : "";

        userDisplay.innerText = `👤 ${payload.name || "User"} (${roleLabel})`;
    }
    const adminPanel = document.getElementById("adminPanel");
    const userPanel = document.getElementById("userPanel");

    const roleSelect = document.getElementById("newUserRole");

    if (roleSelect) {

        roleSelect.innerHTML = "";

        if (window.userRole === "owner") {
            roleSelect.innerHTML = `<option value="admin">Admin</option>`;
        }
        else if (userRole === "admin") {
            roleSelect.innerHTML = `<option value="user">User</option>`;
        }
        else {
            roleSelect.style.display = "none";
        }

    }

    const startIcon = L.icon({
        iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });

    const endIcon = L.icon({
        iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });


    setTimeout(() => {
        localStorage.removeItem("vehicleStates");
    }, 1000 * 60 * 60 * 24);
    map = initMap().setView([31.2698, 72.3181], 12)
    initPlayback({
        map: map,
        apiRequest: apiRequest,
        startIcon: startIcon,
        endIcon: endIcon,
        onlineIcon: icons.moving

    });

    drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    drawControl = new L.Control.Draw({
        draw: {
            polygon: true,
            rectangle: true,
            circle: true,
            circlemarker: false, // ✅ REMOVE extra circle
            marker: false,
            polyline: false
        },
        edit: false // ✅ disable edit/delete toolbar
    });


    map.on(L.Draw.Event.CREATED, async function (event) {
        if (getState().mode !== "geofence") {
            alert("Switch to Geofence mode first");
            return;
        }
        const selectedVehicleId = getState().selectedVehicleId;
        if (!selectedVehicleId) {
            alert("Please select a vehicle first");
            return;
        }

        const deviceGeofences = geofences.filter(
            f => String(f.deviceId) === String(selectedVehicleId)
        );

        if (deviceGeofences.length >= 2) {
            alert("Maximum 2 geofences allowed for this vehicle");
            return;
        }
        const layer = event.layer;
        drawnItems.addLayer(layer);

        const geojson = layer.toGeoJSON();
        const name = prompt("Enter geofence name:");
        if (!name) return;
        // ✅ FIX: Proper structure
        const payload = {
            name,
            type: geojson.geometry.type, // Polygon / Circle
            geometry: geojson.geometry, // actual shape
            deviceId: String(selectedVehicleId)
        };

        console.log("📤 Sending geofence:", payload);

        await apiRequest("/api/geofence", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        alert("Geofence Saved");
        await loadGeofences();
    });
    document.getElementById("searchInput")?.addEventListener("input", () => {
        scheduleVehicleListRender();
    });

    document.getElementById("statusFilter")?.addEventListener("change", () => {
        scheduleVehicleListRender();
    });


    const startInput = document.getElementById("startTime");
    const endInput = document.getElementById("endTime");

    if (startInput && endInput) {

        startInput.addEventListener("change", () => {
            endInput.showPicker?.(); // 🔥 opens next picker (modern browsers)
        });

        endInput.addEventListener("change", () => {
            setTimeout(() => {
                endInput.blur(); // close picker
            }, 100);
        });
    }



    window.toggleGroup = function (userId, groupKey, isChecked) {

        const group = PERMISSION_GROUPS[groupKey];

        // 🔥 Update permissionChanges
        if (!permissionChanges[userId]) {
            permissionChanges[userId] = new Set();
        }

        group.permissions.forEach(p => {
            if (isChecked) {
                permissionChanges[userId].add(p);
            } else {
                permissionChanges[userId].delete(p);
            }
        });

        // 🔥 ALSO update UI instantly
        group.permissions.forEach(p => {
            const inputs = document.querySelectorAll(`input[data-permission="${p}"]`);
            inputs.forEach(input => input.checked = isChecked);
        });
    };

    window.updateSpeed = async function (deviceId, speed) {
        try {
            await apiRequest(`/api/devices/${deviceId}/speed`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    speedLimit: Number(speed)
                })
            });

            window.alertUI?.showToast("Speed updated", "success");

            loadDevices(); // ✅ refresh UI

        } catch (err) {
            console.error(err);
            alert("Failed to update speed");
        }
    };
    initApp();
});