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

let drawControl;
let collapsedDevices = Object.create(null);
let selectedGeofenceId = null;
const lastRenderedData = new Map();
const vehicleCardMap = new Map();
const vehicleRefsMap = new Map();
// ===============================
// PERMISSION GROUPS (v2.4)
// ===============================

const DOM = {
    vehicleList: document.getElementById("vehicleList"),
    countMoving: document.getElementById("countMoving"),
    countIdle: document.getElementById("countIdle"),
    countStopped: document.getElementById("countStopped"),
    countOffline: document.getElementById("countOffline")
};
import { appState } from "./state/appState.js";
import { computeStatus, computeAllStatuses } from "./state/statusEngine.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js";
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
import { loadAuditLogs } from "./modules/auditModule.js";
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
import {
    loadUserPermissions,
    showCreateUserForm,
    deleteUser,
    showUserPermissions,
    showEditUser,
    updateUser,
    savePermissions,
    togglePermission,
    toggleGroup
} from "./modules/userModule.js";
import {
    loadDevices,
    deleteDevice,
    filterDevices,
    submitNewDevice,
    updateSpeed,
    openAssign,
    submitAssign,
    unassignDevice,
    closeAssign
} from "./modules/deviceModule.js";
import {
    openExpiredDevices,
    closeExpiredDevices,
    renewDevice
} from "./modules/expiredModule.js";
window.deleteUser = deleteUser;
window.loadUserPermissions = loadUserPermissions;
window.showCreateUserForm = showCreateUserForm;
window.showUserPermissions = showUserPermissions;
window.showEditUser = showEditUser;
window.updateUser = updateUser;
window.savePermissions = savePermissions;
window.togglePermission = togglePermission;
window.toggleGroup = toggleGroup;
window.loadDevices = loadDevices;
window.deleteDevice = deleteDevice;
window.filterDevices = filterDevices;
window.submitNewDevice = submitNewDevice;
window.updateSpeed = updateSpeed;
window.openAssign = openAssign;
window.submitAssign = submitAssign;
window.unassignDevice = unassignDevice;
window.closeAssign = closeAssign;
window.openExpiredDevices = openExpiredDevices;
window.closeExpiredDevices = closeExpiredDevices;
window.renewDevice = renewDevice;
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
    if (!hasPermission("SEND_COMMAND")) {
        alert("No permission to send command");
        return;
    }
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
        let devices = [];

        try {
            devices = await apiRequest("/api/devices") || [];
        } catch (err) {
            console.error("❌ Error fetching devices:", err);
        } allowedDevices = {};
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
        if (appState.userRole !== "admin" && appState.userRole !== "owner") {
            console.warn("⛔ Skipping users cache (no permission)");
            appState.cachedUsers = [];
            return;
        }
        appState.cachedUsers = await apiRequest("/api/users") || [];
    } catch (err) {
        console.error("❌ Failed to load users", err);
        appState.cachedUsers = [];
    }
}
async function initApp() {
    const token = localStorage.getItem("token");
    initSocket(token);
    initAlertModule();

    await loadUsersCache();
    await loadInitialAlerts();
    await fetchAllowedDevices();
    await loadGeofences();
    await loadInitialPositions();
    await loadCurrentUserPermissions();
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
        window.geofences = fences;
        window.geofences = geofences;
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

    Object.values(allowedDevices).forEach(device => {

        const id = String(device.traccarId);
        const pos = lastPositions[id];
        const status = computeStatus(pos);


        // 🔍 FILTERS
        if (statusFilter !== "all" && status !== statusFilter) return;

        const name = (device.name || "").toLowerCase();
        if (search && !name.includes(search) && !id.includes(search)) return;

        visibleIds.add(id);

        let card = vehicleCardMap.get(id);
        const state = getState();
        const isAnalytics = state.activePanel === "analytics";

        const prevPanel = card?.dataset.panel;
        const currentPanel = state.activePanel;

        if (card && prevPanel !== currentPanel) {
            card.remove();
            vehicleCardMap.delete(id);
            vehicleRefsMap.delete(id);
            lastRenderedData.delete(id);
            card = null;
        }

        const statusClass = {
            moving: "status-online",
            idle: "status-idle",
            stopped: "status-stopped",
            offline: "status-offline"
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

        const prev = lastRenderedData.get(id);

        const newData =
            (pos?.speedKmh || 0) + "|" +
            status + "|" +
            (pos?.deviceTime || "");

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

    const { counts } = computeAllStatuses(lastPositions);

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

            if (appState.userRole === "user") {
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
            loadAdminsForDevice();
            break;
        case "audit":
            document.getElementById("auditPanel").classList.add("active");
            headerTitle.innerText = "Audit Logs";
            loadAuditLogs();
            break;
    }
    setState({ activePanel: panel });

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
    scheduleVehicleListRender();
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

    appState.userRole = payload?.role;
    setState({ userRole: payload?.role });
    if (appState.userRole === "user") {
        const usersBtn = document.getElementById("usersMenuBtn");
        if (usersBtn) usersBtn.style.display = "none";
    }
    const container = document.getElementById("expiredBtnContainer");

    if (
        container &&
        (
            appState.userRole === "owner" ||
            (appState.userRole === "admin" && hasPermission("RENEW_DEVICE"))
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


    initApp();
    getFCMToken();
});
async function loadAdminsForDevice() {
    try {
        const users = await apiRequest("/api/users");

        const dropdown = document.getElementById("deviceAdminSelect");
        if (!dropdown) return;

        // ✅ 👉 ADD THIS HERE
        if (appState.userRole !== "owner") {
            dropdown.parentElement.style.display = "none";
            return; // stop further execution
        }

        dropdown.innerHTML = `<option value="">-- Select Admin --</option>`;

        users
            .filter(u => u.role === "admin")
            .forEach(admin => {
                const opt = document.createElement("option");
                opt.value = admin._id;
                opt.textContent = admin.name;
                dropdown.appendChild(opt);
            });

    } catch (err) {
        console.error("Failed to load admins", err);
    }
}
async function loadCurrentUserPermissions() {
    try {
        const user = await apiRequest("/api/users/me"); // create this route if not exists
        appState.userPermissions = user.permissions || [];
    } catch (err) {
        console.error("Failed to load permissions", err);
    }
}

const firebaseConfig = {
  apiKey: "AIzaSyARTNHa7_oa28ZM5qfOuxa55bvwzEWZpNc",
  authDomain: "trackiatech.firebaseapp.com",
  projectId: "trackiatech",
  messagingSenderId: "592029796394",
  appId: "1:592029796394:web:81218f9d0fba816f66db53"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

async function getFCMToken() {
  try {
    console.log("🚀 Requesting permission...");

    const permission = await Notification.requestPermission();
    console.log("🔐 Permission:", permission);

    const token = await getToken(messaging, {
      vapidKey: "BPNeA64Sqaemp9nqRqosx7JP4UN7YVIfBqjIzuS0I_yTwwyJ6am7lcZa1Hnd7exLNk3syDaNlqKr74CsFjkV11Y"
    });

    console.log("🔥 FCM TOKEN:", token);

    // ✅ ADD THIS PART (IMPORTANT)
    if (token) {
      await fetch("https://trackia-backend.onrender.com/api/users/save-fcm-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({ token })
      });

      console.log("✅ Token saved to backend");
    }

  } catch (err) {
    console.error("❌ Token error:", err);
  }
}
