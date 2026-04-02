let allowedDevices = {};
let selectedVehicleId = null;
let collapsedDevices = {};
import {
    initSocket,
    onPositions,
    onGeofence,
    onAlert,
    getSocket
} from "./services/socketService.js";

import { apiRequest } from "./services/apiService.js";

import {
    initMap,
    updateMarker,
    getMap,
    icons
} from "./modules/mapModule.js";
import {
    initAlertModule,
    loadInitialAlerts
} from "./modules/alertModule.js";
import { getMarkers } from "./modules/mapModule.js";
import {
    initPlayback,
    startPlayback,
    togglePlayback
} from "./modules/playbackModule.js";


document.addEventListener("DOMContentLoaded", () => {
    initAlertModule();


    let lastPositions = {};
    let geofenceLayers = {};
    const token = localStorage.getItem("token")
    let geofenceBBoxes = {};
    let currentMode = "live";
    let selectedGeofenceId = null;



    if (!token) {
        alert("Please login first");
        window.location.href = "login.html";
        return;
    }

    let payload = null;

    try {
        payload = JSON.parse(atob(token.split(".")[1]));
    } catch (e) {
        alert("Session expired. Please login again.");
        localStorage.removeItem("token");
        window.location.href = "login.html";
    }
    const userRole = payload.role;
    const adminPanel = document.getElementById("adminPanel");
    const userPanel = document.getElementById("userPanel");

    if (adminPanel) adminPanel.style.display = "none";
    if (userPanel) userPanel.style.display = "none";

    // ✅ PANEL CONTROL
    if (userRole === "admin") {
        if (adminPanel) adminPanel.style.display = "block";
    }

    if (userRole === "user") {
        if (userPanel) userPanel.style.display = "block";
    }

    if (userRole === "owner") {
        document.getElementById("adminPanel").style.display = "block";
    }

    // ✅ ROLE DROPDOWN CONTROL


    const roleSelect = document.getElementById("newUserRole");

    if (roleSelect) {

        roleSelect.innerHTML = "";

        if (userRole === "owner") {
            roleSelect.innerHTML = `<option value="admin">Admin</option>`;
        }
        else if (userRole === "admin") {
            roleSelect.innerHTML = `<option value="user">User</option>`;
        }
        else {
            roleSelect.style.display = "none";
        }

    }

    function logout() {
        localStorage.removeItem("token")
        window.location.href = "login.html"
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
    let geofences = []

    setTimeout(() => {
        localStorage.removeItem("vehicleStates");
    }, 1000 * 60 * 60 * 24);
    let map = initMap().setView([31.2698, 72.3181], 12)
    initPlayback({
        map: map,
        apiRequest: apiRequest,
        startIcon: startIcon,
        endIcon: endIcon,
        onlineIcon: icons.moving,
        detectStops: detectStops,
        renderStops: renderStops,
        renderTripSummary: renderTripSummary
    });

    setTimeout(() => {
        try {
            map.removeControl(drawControl);
        } catch (e) { }
    }, 500);

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new L.Control.Draw({
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
        if (currentMode !== "geofence") {
            alert("Switch to Geofence mode first");
            return;
        }
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
            name, // ✅ important
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
        updateVehicleList(Object.values(lastPositions));
    });

    document.getElementById("statusFilter")?.addEventListener("change", () => {
        updateVehicleList(Object.values(lastPositions));
    });
    function openGeofence() {
        currentMode = "geofence";
        document.querySelector(".header h2").innerText = "Geofencing";
        document.querySelectorAll(".vehicle-panel").forEach(p => p.style.display = "none");
        document.getElementById("geofencePanel").style.display = "block";
        map.addControl(drawControl);
    }

    function openLive() {
        currentMode = "live";

        document.querySelector(".header h2").innerText = "Live Tracking";

        document.querySelectorAll(".vehicle-panel").forEach(p => p.style.display = "none");
        document.querySelector(".vehicle-panel").style.display = "block";
        map.removeControl(drawControl); // disable drawing
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
            vehicleDiv.style.fontWeight = "bold";
            vehicleDiv.style.marginTop = "10px";
            vehicleDiv.style.cursor = "pointer"; // 👈 important
            vehicleDiv.style.fontWeight = "bold";
            vehicleDiv.style.marginTop = "10px";
            vehicleDiv.style.cursor = "pointer"; // 👈 important
            vehicleDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>🚗 ${device.name || "Vehicle " + deviceId}</span>
                    <button class="add-geo-btn">+ Add</button>
                </div>
            `;
            vehicleDiv.querySelector(".add-geo-btn").onclick = (e) => {
                e.stopPropagation();
                selectedVehicleId = String(deviceId);
                highlightVehicleCard(selectedVehicleId);
                focusOnVehicle(selectedVehicleId);
                openGeofence();
                window.alertUI.showToast(`Creating geofence for ${device.name}`, "success");
            };
            vehicleDiv.onclick = async () => {
                collapsedDevices[deviceId] = !collapsedDevices[deviceId];
                selectedVehicleId = String(deviceId);

                highlightVehicleCard(selectedVehicleId);
                focusOnVehicle(selectedVehicleId);

                await loadGeofences();
                renderGeofenceList();
            };

            container.appendChild(vehicleDiv);


            if (String(deviceId) === String(selectedVehicleId)) {
                vehicleDiv.style.background = "#e6f0ff";
                vehicleDiv.style.padding = "5px";
                vehicleDiv.style.borderRadius = "5px";
            }
            if (collapsedDevices[deviceId]) {
                return;
            }
            if (deviceGeofences.length === 0) {
                const empty = document.createElement("div");
                empty.style.color = "#888";
                empty.style.fontSize = "12px";
                empty.style.marginBottom = "8px";
                empty.innerText = "No geofences";
                container.appendChild(empty);
                return;
            }

            // 🔥 Render geofences
            deviceGeofences.forEach(f => {

                const div = document.createElement("div");
                div.className = "vehicle-card";

                div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span>📍 ${f.name || "Unnamed"}</span>
                    <button onclick="editGeofenceName('${f._id}')">✏️</button>
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
    async function editGeofenceName(id) {

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
    async function deleteSelectedGeofence() {
        if (!selectedGeofenceId) {
            alert("Select geofence first");
            return;
        }
        if (!confirm("Delete this geofence?")) return;

        await apiRequest(`/api/geofence/${selectedGeofenceId}`, {
            method: "DELETE"
        });

        selectedGeofenceId = null;
        await loadGeofences();
    }
    let socket;
    async function loadInitialPositions() {
        try {
            const positions = await apiRequest("/api/traccar/positions");

            console.log("📦 Initial positions:", positions);

            positions.forEach(pos => {

                const id = String(pos.deviceId);

                const lat = pos.latitude || pos.lat;
                const lng = pos.longitude || pos.lon;

                if (!lat || !lng) return;

                lastPositions[id] = pos;

                // ✅ USE CENTRAL FUNCTION
                updateMarker(id, pos, allowedDevices[id]);
            });

            // ✅ Update sidebar also

        } catch (err) {
            console.error("❌ Initial load error:", err);
        }
        updateVehicleList(Object.values(lastPositions));
    }

    async function initApp() {
        const token = localStorage.getItem("token");
        initSocket(token);
        initAlertModule();
        await loadInitialAlerts();
        await fetchAllowedDevices();
        await loadGeofences();
        await loadInitialPositions();
        // POSITIONS
        onPositions((positions) => {
            console.log("📡 FRONTEND POSITIONS:", positions);
            const filtered = positions.filter(pos =>
                allowedDevices[String(pos.deviceId)]
            );

            filtered.forEach((pos) => {

                const id = String(pos.deviceId);

                const lat = pos.latitude || pos.lat;
                const lng = pos.longitude || pos.lon;

                if (!lat || !lng) return;

                lastPositions[id] = pos;
                updateMarker(id, pos);
                console.log("📍 Updating marker:", id, pos.latitude, pos.longitude);
            });

            updateVehicleList(Object.values(lastPositions));
        });

        // GEOFENCE
        onGeofence(({ geofenceId, type }) => {
            updateGeofenceVisual(geofenceId, type);
        });

    }




    // ROUTE HISTORY
    async function showRoute() {

        const deviceId = document.getElementById("routeDeviceId").value;

        let from = document.getElementById("fromTime").value;
        let to = document.getElementById("toTime").value;

        if (!deviceId || !from || !to) {
            alert("Please fill all fields");
            return;
        }

        from = new Date(from).toISOString();
        to = new Date(to).toISOString();
        const data = await apiRequest(`/api/traccar/route?deviceId=${deviceId}&from=${from}&to=${to}`);
        console.log("Route Data:", data);

        // ❌ If no data → stop here
        if (!data || data.length === 0) {
            document.getElementById("analyticsBox").innerHTML =
                "<p style='color:red'>No trip data found</p>";
            return;
        }

        // DRAW ROUTE
        const points = data.map(p => [p.latitude, p.longitude]);

        if (routeLine) {
            map.removeLayer(routeLine);
        }

        routeLine = L.polyline(points, {
            color: "blue",
            weight: 4
        }).addTo(map);

        map.fitBounds(routeLine.getBounds());

        // 🔥 ANALYTICS
        const distance = calculateDistance(data);
        const duration = calculateDuration(data);
        const avgSpeed = calculateAvgSpeed(distance, duration);

        console.log("Analytics:", distance, duration, avgSpeed); // ✅ DEBUG
        const stops = detectStops(data);
        renderStops(stops);

        renderTripSummary(data, stops);
    }
    // LOAD GEOFENCES
    async function loadGeofences() {

        try {

            let url = "/api/geofence";

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
                    geofenceBBoxes[geofenceId] = turf.bbox({
                        type: "Feature",
                        geometry: f.geometry
                    });
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

    const speedSlider = document.getElementById("speedSlider");
    const speedLabel = document.getElementById("speedLabel");
    speedSlider.addEventListener("input", function () {
        speedLabel.innerText = this.value + "x";
    });
    function renderVehicleDetails(p) {

        const container = document.getElementById("vehicleDetails");

        container.innerHTML = `
    <div style="border:1px solid #ccc;padding:10px;background:#fff;">
        <h4>Vehicle ${p.deviceId}</h4>

        <p><b>Speed:</b> ${Math.round(p.speed * 1.852)} km/h</p>
        <p><b>Latitude:</b> ${p.latitude}</p>
        <p><b>Longitude:</b> ${p.longitude}</p>
        <p><b>Battery:</b> ${p.attributes.batteryLevel || "N/A"}%</p>
        <p><b>Last Update:</b> ${new Date(p.deviceTime).toLocaleString()}</p>

        <hr>

        <div style="margin-top:10px;">
            <button onclick="sendCommand(${p.deviceId}, 'engineStop')" 
                style="background:red;color:white;padding:6px 10px;margin-right:5px;border:none;">
                🔴 Engine OFF
            </button>

            <button onclick="sendCommand(${p.deviceId}, 'engineResume')" 
                style="background:green;color:white;padding:6px 10px;border:none;">
                🟢 Engine ON
            </button>
        </div>
    </div>
`;
    }
    //calculate distance
    function calculateDistance(points) {
        let total = 0;

        for (let i = 1; i < points.length; i++) {
            const lat1 = points[i - 1].lat;
            const lon1 = points[i - 1].lng;
            const lat2 = points[i].lat;
            const lon2 = points[i].lng;

            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;

            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * Math.PI / 180) *
                Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) ** 2;

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            total += R * c;
        }

        return total;
    }
    //detect stop
    function detectStops(data) {
        const stops = [];
        let stopStart = null;

        for (let i = 0; i < data.length; i++) {
            const p = data[i];

            if (p.speed === 0) {
                if (!stopStart) {
                    stopStart = p;
                }
            } else {
                if (stopStart) {
                    const duration = (p.time - stopStart.time) / 1000 / 60;

                    if (duration >= 2) {
                        stops.push({
                            lat: stopStart.lat,
                            lng: stopStart.lng,
                            start: stopStart.time,
                            end: p.time,
                            duration: duration.toFixed(1)
                        });
                    }

                    stopStart = null;
                }
            }
        }

        // ✅ handle last stop
        if (stopStart) {
            const last = data[data.length - 1];
            const duration = (last.time - stopStart.time) / 1000 / 60;

            if (duration >= 2) {
                stops.push({
                    lat: stopStart.lat,
                    lng: stopStart.lng,
                    start: stopStart.time,
                    end: last.time,
                    duration: duration.toFixed(1)
                });
            }
        }

        return stops;
    }
    //render stop function
    function renderStops(stops) {
        stops.forEach(s => {
            const marker = L.circleMarker([s.lat, s.lng], {
                radius: 6,
                color: "red",
                fillColor: "orange",
                fillOpacity: 0.9
            })
                .addTo(map)
                .bindPopup(`
    <b>Stop</b><br>
    Duration: ${s.duration} min<br>
    From: ${s.start.toLocaleTimeString()}<br>
    To: ${s.end.toLocaleTimeString()}
`);

            stopMarkers.push(marker);
        });
    }
    //calculate duration
    function calculateDuration(data) {
        if (data.length < 2) return 0;

        const start = data[0].time;
        const end = data[data.length - 1].time;

        return (end - start) / 1000 / 60;
    }
    //calculate average speed
    function calculateAvgSpeed(distance, durationMinutes) {
        if (durationMinutes === 0) return 0;
        return distance / (durationMinutes / 60); // km/h
    }
    //trip details
    function renderTripSummary(data, stops) {

        // Distance (already your function)
        const distance = calculateDistance(data);

        // Duration
        const durationMin = calculateDuration(data);

        // Avg Speed
        const avgSpeed = calculateAvgSpeed(distance, durationMin);

        // Stops count
        const totalStops = stops.length;

        // Idle time (sum of all stop durations)
        let idleTime = 0;
        stops.forEach(s => {
            idleTime += parseFloat(s.duration);
        });

        // Format duration (HH:MM)
        const hours = Math.floor(durationMin / 60);
        const minutes = Math.round(durationMin % 60);
        const durationFormatted = `${hours}h ${minutes}m`;

        // Update UI
        document.getElementById("sumDistance").innerText = distance.toFixed(2);
        document.getElementById("sumDuration").innerText = durationFormatted;
        document.getElementById("sumSpeed").innerText = avgSpeed.toFixed(1);
        document.getElementById("sumStops").innerText = totalStops;
        document.getElementById("sumIdle").innerText = idleTime.toFixed(1);
    }
    async function fetchAllowedDevices() {
        try {
            const devices = await apiRequest("/api/devices");
            allowedDevices = {};
            console.log("📦 Devices from backend:", devices);
            devices.forEach(device => {
                allowedDevices[device.traccarId] = device;
            });

            console.log("✅ Allowed Devices:", allowedDevices);

        } catch (err) {
            console.error("❌ Error fetching devices:", err);
        }
    }
    // create user function
    async function createUser() {

        const name = document.getElementById("newUserName").value.trim();
        const email = document.getElementById("newUserEmail").value.trim();
        const password = document.getElementById("newUserPassword").value.trim();
        const role = document.getElementById("newUserRole").value;

        if (!name || !email || !password) {
            alert("Fill all fields");
            return;
        }

        try {
            const data = await apiRequest("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({ name, email, password, role })
            });
            alert(data.message || "User created successfully");

            // clear form
            document.getElementById("newUserName").value = "";
            document.getElementById("newUserEmail").value = "";
            document.getElementById("newUserPassword").value = "";

        } catch (err) {
            console.error(err);

            // ✅ show backend error
            alert(err.message || "Server error");
        }
    }
    //command function
    async function sendCommand(deviceId, type) {
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
    function openAnalytics() {
        window.open("/analytics.html", "_blank");
    }
    let selectedPlaybackDevice = null;

    function openPlaybackModal(deviceId) {
        selectedPlaybackDevice = deviceId;

        const modal = document.getElementById("playbackModal");
        const dateInput = document.getElementById("playbackDatePicker");

        // Default today
        const today = new Date().toISOString().split("T")[0];
        dateInput.value = today;

        modal.style.display = "flex";
    }

    function closePlaybackModal() {
        document.getElementById("playbackModal").style.display = "none";
    }

    function confirmPlayback() {
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

        deviceInput.value = selectedPlaybackDevice;
        dateInput.value = date;

        closePlaybackModal();

        startPlayback(selectedPlaybackDevice, date);
    }
    // INITIAL LOAD
    window.showRoute = showRoute;
    window.startPlayback = startPlayback;
    window.logout = logout;
    window.togglePlayback = togglePlayback;
    window.createUser = createUser;
    window.deleteSelectedGeofence = deleteSelectedGeofence;
    window.openGeofence = openGeofence;
    window.openLive = openLive;
    window.editGeofenceName = editGeofenceName;
    window.openAddDeviceModal = openAddDeviceModal;
    window.closeAddDeviceModal = closeAddDeviceModal;
    window.submitNewDevice = submitNewDevice;
    window.setActiveMenu = setActiveMenu;
    window.setActiveMenu = setActiveMenu;
    window.openAlerts = openAlerts;
    window.openDevices = openDevices;
    window.loadGeofences = loadGeofences;
    window.renderGeofenceList = renderGeofenceList;
    window.deleteDevice = deleteDevice;
    window.openPlaybackModal = openPlaybackModal;
    window.closePlaybackModal = closePlaybackModal;
    window.confirmPlayback = confirmPlayback;
    initApp();
    setInterval(() => {
        console.log("🔄 Fallback refresh...");
        const sock = getSocket();

        if (!sock || !sock.connected) {
            console.warn("⚠️ Socket offline, fallback running");
            loadInitialPositions();
        }
    }, 30000);
});
function updateVehicleList(positions) {

    const container = document.getElementById("vehicleList");
    const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
    const statusFilter = document.getElementById("statusFilter")?.value || "all";

    if (!container) return;

    container.innerHTML = "";

    let counts = {
        moving: 0,
        idle: 0,
        stopped: 0,
        offline: 0
    };

    positions.forEach(pos => {

        if (!allowedDevices[String(pos.deviceId)]) return;

        const device = allowedDevices[String(pos.deviceId)];

        const status = device?.status || "offline";
        const speed = Math.round((pos.speed || 0) * 1.852);

        let statusColor = {
            online: "#10b981",
            offline: "#ef4444",
            unknown: "#6b7280"
        }[status] || "#6b7280";

        // ✅ COUNTING
        counts[status]++;

        // 🔍 FILTERS
        if (statusFilter !== "all" && status !== statusFilter) return;

        const name = (device.name || "").toLowerCase();
        if (search && !name.includes(search) && !String(pos.deviceId).includes(search)) return;

        const minutesAgo = Math.floor((new Date() - new Date(pos.deviceTime)) / 60000);

        const div = document.createElement("div");
        div.className = "vehicle-card";
        div.dataset.id = pos.deviceId;

        div.innerHTML = `
            <div class="vehicle-header">
                <div class="vehicle-name">
                🚗 ${device.name || "Vehicle " + pos.deviceId}
                </div>

            <div class="status-badge" style="background:${statusColor}">
            ${status}
            </div>
            </div>

            <div class="vehicle-body" style="display:flex; justify-content:space-between; align-items:center;"><div>
            <div>Speed: <b>${speed} km/h</b></div>
            <div>Last update: ${minutesAgo} min ago</div>
            </div>

            <!-- ▶ Playback inline -->
            <button class="playback-btn" 
            onclick="openPlaybackModal('${pos.deviceId}')"
            style="background:none; border:none; color:##006400; cursor:pointer; font-weight:bold;">
            ▶ Playback  </button>
        `;

        div.onclick = async () => {
            selectedVehicleId = String(pos.deviceId);
            highlightVehicleCard(selectedVehicleId);
            focusOnVehicle(selectedVehicleId);
            await loadGeofences();
            renderGeofenceList();
        };

        container.appendChild(div);
    });

    // ✅ UPDATE STATS UI
    document.getElementById("countMoving").innerText = counts.moving;
    document.getElementById("countIdle").innerText = counts.idle;
    document.getElementById("countStopped").innerText = counts.stopped;
    document.getElementById("countOffline").innerText = counts.offline;

    if (selectedVehicleId) {
        highlightVehicleCard(selectedVehicleId);
    }
}
function isVehicleOnline(deviceTime) {
    return ((new Date() - new Date(deviceTime)) / 60000) <= 5;
}
function getVehicleState(pos) {
    const isOnline = isVehicleOnline(pos.deviceTime);
    const speed = Math.round((pos.speed || 0) * 1.852);

    if (!isOnline) return { state: "offline", speed };
    if (speed > 5) return { state: "moving", speed };
    if (speed > 0) return { state: "idle", speed };
    return { state: "stopped", speed };
}
function highlightVehicleCard(id) {
    document.querySelectorAll(".vehicle-card").forEach(card => {
        card.classList.remove("active");

        if (card.dataset.id === String(id)) {
            card.classList.add("active");

            // auto scroll
            card.scrollIntoView({ block: "center", behavior: "smooth" });
        }
    });
}
function focusOnVehicle(id) {
    const markers = getMarkers();
    const map = getMap(); // ✅ FIX

    const marker = markers[id];
    if (!marker || !map) return;

    const latlng = marker.getLatLng();

    map.setView(latlng, 15, {
        animate: true,
        duration: 0.5
    });

    marker.openPopup?.();
}
function openDevices() {
    document.querySelectorAll(".vehicle-panel").forEach(p => p.style.display = "none");
    document.getElementById("devicePanel").style.display = "block";

    loadDevices();
}
async function loadDevices() {
    const container = document.getElementById("deviceList");

    try {
        const devices = await apiRequest("/api/devices");
        container.innerHTML = `
            <div class="device-header">
                <input type="text" id="deviceSearch" placeholder="Search devices..." oninput="filterDevices()">
            </div>

            <table class="device-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Traccar ID</th>
                        <th>Assigned Users</th>
                        <th>Actions</th>
                    </tr>                   
                </thead>
                <tbody id="deviceTableBody"></tbody>
            </table>
        `;

        const tbody = document.getElementById("deviceTableBody");

        devices.forEach(d => {
            const users = (d.assignedTo || []).map(u => u.name || "User").join(", ");

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${d.name}</td>
                <td>${d.traccarId}</td>
                <td>${users || "-"}</td>
                                   <td>
                        <div class="action-buttons">
                            <button class="icon-btn assign" onclick="openAssign('${d._id}')">👤</button>
                            <button class="icon-btn delete" onclick="deleteDevice('${d._id}')">🗑</button>
                            <button class="icon-btn unassign" onclick="unassignDevice('${d._id}')">❌</button>
                        </div> 
                    </td> 
                `;

            tbody.appendChild(row);
        });

    } catch (err) {
        container.innerHTML = "<p style='color:red'>Failed to load devices</p>";
    }
}
async function unassignDevice(deviceId) {
    const userId = document.getElementById("assignUserSelect").value;

    await apiRequest(`/api/devices/${deviceId}/unassign`, {
        method: "POST",
        body: JSON.stringify({ userId })
    });

    alert("Unassigned");
    loadDevices();
}
function filterDevices() {
    const search = document.getElementById("deviceSearch").value.toLowerCase();
    const rows = document.querySelectorAll("#deviceTableBody tr");

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(search) ? "" : "none";
    });
}
function openAddDeviceModal() {
    document.getElementById("addDeviceModal").style.display = "block";
}

function closeAddDeviceModal() {
    document.getElementById("addDeviceModal").style.display = "none";
}

async function submitNewDevice() {
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

    closeAddDeviceModal();
    loadDevices();
}
async function deleteDevice(id) {
    if (!confirm("Delete this device?")) return;

    await apiRequest(`/api/devices/${id}`, {
        method: "DELETE"
    });

    alert("Deleted");
    loadDevices();
}
let selectedDeviceForAssign = null;

async function openAssign(deviceId) {
    selectedDeviceForAssign = deviceId;

    const users = await apiRequest("/api/users"); // your existing API

    const select = document.getElementById("assignUserSelect");
    select.innerHTML = "";

    users.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u._id;
        opt.textContent = u.name;
        select.appendChild(opt);
    });

    document.getElementById("assignModal").style.display = "block";
}

function closeAssign() {
    document.getElementById("assignModal").style.display = "none";
}

async function submitAssign() {
    const userId = document.getElementById("assignUserSelect").value;

    await apiRequest(`/api/devices/${selectedDeviceForAssign}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId })
    });

    alert("Assigned");

    closeAssign();
    loadDevices();
}
function setActiveMenu(element) {
    document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("active"));
    element.classList.add("active");
}

function openAlerts() {

    document.querySelectorAll(".vehicle-panel")
        .forEach(p => p.style.display = "none");

    document.getElementById("alertPanel").style.display = "block";

    loadInitialAlerts();
}