let allowedDevices = {};
document.addEventListener("DOMContentLoaded", () => {
    // all your JS code here

    let playbackData = [];
    let playbackMarker;
    let isPlaying = false;
    let playbackIndex = 0;
    let playbackPoints = [];
    let selectedVehicleId = null;
    let autoFollow = true;
    let startMarker = null;
    let endMarker = null;
    let routeLine = null;
    let stopMarkers = [];
    let lastAlertTime = {};
    let isPlaybackMode = false;
    let lastPositions = {};
    const token = localStorage.getItem("token")



    if (!token) {
        alert("Please login first")
        window.location.href = "login.html"
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
    // Hide both panels first
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("userPanel").style.display = "none";

    // ✅ PANEL CONTROL
    if (userRole === "admin") {
        document.getElementById("adminPanel").style.display = "block";
    }

    if (userRole === "user") {
        document.getElementById("userPanel").style.display = "block";
    }

    if (userRole === "owner") {
        document.getElementById("adminPanel").style.display = "block";
    }

    // ✅ ROLE DROPDOWN CONTROL
    const roleSelect = document.getElementById("newUserRole");

    roleSelect.innerHTML = "";

    if (userRole === "owner") {
        // 👑 Owner → ONLY admin
        roleSelect.innerHTML = `
        <option value="admin">Admin</option>
    `;
    }

    else if (userRole === "admin") {
        // 👨‍💼 Admin → ONLY user
        roleSelect.innerHTML = `
        <option value="user">User</option>
    `;
    }

    else {
        roleSelect.style.display = "none";
    }
    function logout() {
        localStorage.removeItem("token")
        window.location.href = "login.html"
    }

    const vehicleIcon = L.icon({
        iconUrl: "icons/car.png",
        iconSize: [40, 40],
        iconAnchor: [16, 16]
    })
    const onlineIcon = L.icon({
        iconUrl: "/icons/carg.png",
        iconSize: [40, 40],
        iconAnchor: [16, 16]
    })

    const offlineIcon = L.icon({
        iconUrl: "/icons/carr.png",
        iconSize: [40, 40],
        iconAnchor: [16, 16]
    })
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
    let markers = {}
    let geofences = []
    let alerts = []
    let vehicleStates = JSON.parse(localStorage.getItem("vehicleStates") || "{}");
    setTimeout(() => {
        localStorage.removeItem("vehicleStates");
    }, 1000 * 60 * 60 * 24);
    const map = L.map("map", {
        rotate: true,
        touchRotate: true,
        bearing: 0
    }).setView([31.2698, 72.3181], 12)
    map.on("dragstart", function () {
        autoFollow = false;
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
    }).addTo(map)

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems },
        draw: {
            polygon: true,
            rectangle: true,
            circle: true,
            marker: false,
            polyline: false
        }
    })

    map.addControl(drawControl)

    map.on(L.Draw.Event.CREATED, async function (event) {
        if (geofences.length >= 3) {
            alert("Maximum 3 geofences allowed");
            return;
        }
        const layer = event.layer
        drawnItems.addLayer(layer)

        const geojson = layer.toGeoJSON()

        await apiFetch("/api/geofence", {
            method: "POST",
            body: JSON.stringify(geojson)
        })
        await loadGeofences();
        alert("Geofence Saved")

    })

    let socket;
    async function loadInitialPositions() {
        try {
            const positions = await apiFetch("/api/traccar/positions");

            console.log("📦 Initial positions:", positions);

            positions.forEach(pos => {

                const id = String(pos.deviceId);

                if (!allowedDevices[id]) return;

                const lat = pos.latitude || pos.lat;
                const lng = pos.longitude || pos.lon;

                if (!lat || !lng) return;

                // ✅ SAVE
                lastPositions[id] = pos;

                const isOnline = isVehicleOnline(pos.deviceTime);
                const icon = isOnline ? onlineIcon : offlineIcon;

                // ✅ CREATE MARKER (FIRST TIME)
                markers[id] = L.marker([lat, lng], {
                    icon: icon
                }).addTo(map);
            });

            // ✅ Update sidebar also
            updateVehicleList(Object.values(lastPositions));

        } catch (err) {
            console.error("❌ Initial load error:", err);
        }
    }

    async function initApp() {

        await fetchAllowedDevices();

        // ✅ LOAD INITIAL POSITIONS FIRST
        await loadInitialPositions();

        // ✅ THEN CONNECT SOCKET
        socket = io("https://trackia-backend.onrender.com", {
            auth: {
                token: localStorage.getItem("token")
            }
        });
        socket.on("connect", () => {
            console.log("✅ Socket connected:", socket.id);
        });

        socket.on("positions", (positions) => {

            if (isPlaybackMode) return;

            console.log("🔥 Positions:", positions);
            console.log("🔥 AllowedDevices:", allowedDevices);

            console.log("🔑 Allowed keys:", Object.keys(allowedDevices));

            positions.forEach(p => {
                console.log("📡 Position deviceId:", p.deviceId);
            });

            const filteredPositions = positions.filter(pos =>
                allowedDevices[String(pos.deviceId)]
            );

            console.log("✅ Filtered:", filteredPositions);

            // ✅ MOVE THIS INSIDE
            updateVehicleList(Object.values(lastPositions));
            filteredPositions.forEach((pos) => {

                const id = String(pos.deviceId);

                if (!allowedDevices[id]) {
                    console.log("❌ Not allowed:", id);
                    return;
                }

                const lat = pos.latitude || pos.lat;
                const lng = pos.longitude || pos.lon;

                if (!lat || !lng) {
                    console.log("❌ Invalid coords:", pos);
                    return;
                }

                console.log("FINAL CHECK:", id, allowedDevices[id], lat, lng);

                checkGeofences(id, lat, lng);

                // ✅ SAVE LAST POSITION
                lastPositions[id] = pos;

                const isOnline = isVehicleOnline(pos.deviceTime);
                const icon = isOnline ? onlineIcon : offlineIcon;

                if (!markers[id]) {
                    console.log("✅ Creating marker:", id);

                    markers[id] = L.marker([lat, lng], {
                        icon: icon
                    }).addTo(map);

                } else {
                    console.log("🔄 Updating marker:", id);

                    markers[id].setLatLng([lat, lng]);
                    markers[id].setIcon(icon); // 🔥 VERY IMPORTANT (missing before)
                }

            });
            Object.keys(allowedDevices).forEach(id => {

                if (lastPositions[id]) {

                    const pos = lastPositions[id];

                    const lat = pos.latitude || pos.lat;
                    const lng = pos.longitude || pos.lon;

                    const isOnline = isVehicleOnline(pos.deviceTime);
                    const icon = isOnline ? onlineIcon : offlineIcon;

                    if (!markers[id]) {
                        console.log("🆕 Creating offline marker:", id);

                        markers[id] = L.marker([lat, lng], {
                            icon: icon
                        }).addTo(map);

                    } else {
                        console.log("🔴 Updating offline marker:", id);

                        markers[id].setIcon(icon); // 🔥 THIS IS KEY
                    }
                }
            });
            loadGeofences();
        });
    }
        // ADD DEVICE
        async function addDevice() {

            // ✅ Role check
            if (userRole !== "admin") {
                alert("Only admin can add devices");
                return;
            }

            const name = document.getElementById("vehicleName").value.trim();
            const imei = document.getElementById("vehicleUniqueId").value.trim();

            // ✅ Validation
            if (!name || !imei) {
                alert("Please fill all fields");
                return;
            }

            try {
                const res = await apiFetch("/api/traccar/devices", {
                    method: "POST",
                    body: JSON.stringify({
                        name,
                        uniqueId: imei
                    })
                });

                alert("Vehicle Added");

                // ✅ Clear inputs
                document.getElementById("vehicleName").value = "";
                document.getElementById("vehicleUniqueId").value = "";

            } catch (err) {
                console.error(err);
                alert("Failed to add vehicle");
            }
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

            const res = await apiFetch(`/api/traccar/route?deviceId=${deviceId}&from=${from}&to=${to}`)
            if (!res) return;
            const data = await res.json();

            console.log("Route Data:", data); // ✅ DEBUG

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

            renderAnalytics(distance, duration, avgSpeed);
        }
        // LOAD GEOFENCES
        async function loadGeofences() {

            try {
                const fences = await apiFetch("/api/geofence");

                if (!fences) return;

                geofences = fences;

                fences.forEach(f => {

                    const layer = L.geoJSON(f);

                    layer.eachLayer(l => {
                        drawnItems.addLayer(l);
                    });

                });

            } catch (err) {
                console.error("❌ Error loading geofences:", err);
            }
        }


        // CHECK GEOFENCE ENTRY/EXIT
        function checkGeofences(deviceId, lat, lng) {

            const point = turf.point([lng, lat]);

            geofences.forEach((f, index) => {

                // 🔥 STEP 1: FAST FILTER (BOUNDING BOX)
                const bbox = turf.bbox(f);

                const [minLng, minLat, maxLng, maxLat] = bbox;

                if (
                    lng < minLng || lng > maxLng ||
                    lat < minLat || lat > maxLat
                ) {
                    return; // skip expensive check
                }

                // 🔥 STEP 2: PRECISE CHECK
                const inside = turf.booleanPointInPolygon(point, f);

                const key = deviceId + "_" + index;

                // 🔥 STEP 3: INITIAL STATE
                if (!(key in vehicleStates)) {
                    vehicleStates[key] = inside;
                    return;
                }

                const previousState = vehicleStates[key];

                // 🔥 STEP 4: ENTER EVENT
                if (!previousState && inside) {
                    addAlert(deviceId, index, "enter",
                        `Vehicle ${deviceId} ENTERED ${f.name || "geofence"}`
                    );
                }

                // 🔥 STEP 5: EXIT EVENT
                if (previousState && !inside) {
                    addAlert(deviceId, index, "exit",
                        `Vehicle ${deviceId} EXITED ${f.name || "zone"}`
                    );
                }

                // 🔥 STEP 6: UPDATE STATE
                vehicleStates[key] = inside;
            });

            // 🔥 STEP 7: SAVE STATE (IMPORTANT)
            localStorage.setItem("vehicleStates", JSON.stringify(vehicleStates));
        }

        function addAlert(deviceId, geofenceId, type, message) {
            if (!allowedDevices[deviceId]) return;
            deviceId = String(deviceId);
            geofenceId = String(geofenceId);
            type = type.toLowerCase().trim();

            const key = `${deviceId}_${geofenceId}_${type}`;
            const now = Date.now();

            console.log("ALERT KEY:", key);

            // ✅ 1. HARD DUPLICATE CHECK (latest alert)
            const last = alerts[0];
            if (
                last &&
                last.deviceId == deviceId &&
                last.geofenceId == geofenceId &&
                last.type === type
            ) {
                console.log("BLOCKED (same as last alert)");
                return;
            }

            // ✅ 2. TIME-BASED BLOCK
            if (lastAlertTime[key] && (now - lastAlertTime[key] < 5000)) {
                console.log("BLOCKED (cooldown)");
                return;
            }

            lastAlertTime[key] = now;

            alerts.unshift({
                deviceId,
                geofenceId,
                type,
                message,
                time: new Date()
            });

            if (alerts.length > 50) alerts.pop();

            renderAlerts();
        }

        function renderAlerts() {

            const container = document.getElementById("alertList");
            container.innerHTML = "";

            // 🔹 Get filter values
            const typeFilter = document.getElementById("alertTypeFilter")?.value || "all";
            const search = document.getElementById("vehicleSearch")?.value || "";

            // 🔹 APPLY FILTERS
            let filteredAlerts = alerts;

            // Filter by type
            if (typeFilter !== "all") {
                filteredAlerts = filteredAlerts.filter(a => a.type === typeFilter);
            }

            // Search by vehicle ID
            if (search) {
                filteredAlerts = filteredAlerts.filter(a =>
                    a.deviceId.toString().includes(search)
                );
            }

            // 🔹 GROUP BY VEHICLE
            const grouped = {};

            filteredAlerts.forEach(a => {
                if (!grouped[a.deviceId]) {
                    grouped[a.deviceId] = [];
                }
                grouped[a.deviceId].push(a);
            });

            // 🔹 RENDER GROUPS
            Object.keys(grouped).forEach(deviceId => {

                // 🚗 Vehicle header
                const header = document.createElement("div");
                header.style.background = "#eee";
                header.style.padding = "6px";
                header.style.fontWeight = "bold";
                header.style.borderBottom = "1px solid #ccc";

                header.innerHTML = `🚗 Vehicle ${deviceId}`;
                container.appendChild(header);

                // 🔹 Alerts under this vehicle
                grouped[deviceId].forEach(a => {

                    const div = document.createElement("div");

                    div.style.borderBottom = "1px solid #ddd";
                    div.style.padding = "6px";
                    div.style.marginBottom = "3px";

                    // ✅ Use TYPE (not message)
                    if (a.type === "enter") {
                        div.style.background = "#d4edda"; // green
                    } else {
                        div.style.background = "#f8d7da"; // red
                    }

                    div.innerHTML = `
                ${a.message}<br>
                <small>${a.time.toLocaleTimeString()}</small>
            `;

                    container.appendChild(div);
                });

            });
        }
        //playback
        let smoothAnimationId = null; // store requestAnimationFrame ID
        let startTime = null;
        function startAutoPlayback() {
            if (isPlaying) return;
            if (!playbackData || playbackData.length < 2 || !playbackMarker) return;

            isPlaying = true;
            const btn = document.getElementById("playToggleBtn");
            btn.innerText = "⏸";

            const slider = document.getElementById("timeSlider");
            const speedSlider = document.getElementById("speedSlider"); // speed slider

            // Duration per segment in ms (base)
            const baseSegmentDuration = 500;
            let startPoint = playbackData[playbackIndex];
            let endPoint = playbackData[playbackIndex + 1];

            let progress = 0; // 0 → 1

            function animate(timestamp) {
                if (!startTime) startTime = timestamp;

                const deltaTime = timestamp - startTime;
                startTime = timestamp;

                const speed = parseFloat(speedSlider.value) || 1;

                // 🔥 Smooth real-time speed control
                progress += (deltaTime / baseSegmentDuration) * speed;
                const t = Math.min(progress, 1);

                // Interpolate position
                const lat = startPoint.lat + (endPoint.lat - startPoint.lat) * t;
                const lng = startPoint.lng + (endPoint.lng - startPoint.lng) * t;

                // Smooth rotation
                const deltaAngle = ((endPoint.course - startPoint.course + 540) % 360) - 180;
                const angle = startPoint.course + deltaAngle * t;

                playbackMarker.setLatLng([lat, lng]);
                playbackMarker.setRotationAngle(angle);
                if (autoFollow) {
                    map.setBearing(angle);
                }
                //section for Auto Follow map
                if (autoFollow) {
                    const mapSize = map.getSize();

                    // Move center slightly UP so marker appears lower
                    const offsetY = mapSize.y * 0.25; // 25% from center

                    const targetPoint = map.project([lat, lng], map.getZoom())
                        .subtract([0, offsetY]);

                    const targetLatLng = map.unproject(targetPoint, map.getZoom());

                    map.panTo(targetLatLng, {
                        animate: true,
                        duration: 0.25
                    });
                }
                // Time label
                const timeLabel = document.getElementById("timeLabel");
                const currentTime = new Date(startPoint.time.getTime() + t * (endPoint.time - startPoint.time));
                timeLabel.innerText = currentTime.toLocaleTimeString();

                // Slider sync
                slider.value = playbackIndex + t;

                if (t < 1) {
                    smoothAnimationId = requestAnimationFrame(animate);
                } else {
                    // Next segment
                    playbackIndex++;

                    if (playbackIndex >= playbackData.length - 1) {
                        stopAutoPlayback();
                        return;
                    }

                    startPoint = playbackData[playbackIndex];
                    endPoint = playbackData[playbackIndex + 1];

                    progress = 0; // 🔥 reset progress (IMPORTANT)
                    smoothAnimationId = requestAnimationFrame(animate);
                }
            }

            smoothAnimationId = requestAnimationFrame(animate);
        }
        function stopAutoPlayback() {
            const btn = document.getElementById("playToggleBtn");
            btn.innerText = "▶";
            if (smoothAnimationId) cancelAnimationFrame(smoothAnimationId);
            smoothAnimationId = null;
            isPlaying = false;
        }
        //toggle playback button
        function togglePlayback() {

            const btn = document.getElementById("playToggleBtn");

            if (isPlaying) {
                stopAutoPlayback();
                btn.innerText = "▶";
            } else {
                startAutoPlayback();
                btn.innerText = "⏸";
            }
            console.log("TOGGLE CLICKED");
        }
        //play back
        async function startPlayback() {
            isPlaybackMode = true;
            clearPlayback();
            document.getElementById("playbackControl").style.display = "block";
            document.getElementById("playToggleBtn").style.display = "flex";

            // ✅ 1. Get inputs FIRST
            const deviceId = document.getElementById("playbackDeviceId").value;
            const date = document.getElementById("playbackDate").value;

            if (!deviceId || !date) {
                alert("Please select device and date");
                return;
            }

            // ✅ 2. Create API range
            const from = date + "T00:00:00Z";
            const to = date + "T23:59:59Z";

            const url = `${BASE_URL}/api/traccar/route?deviceId=${deviceId}&from=${from}&to=${to}`;
            // ✅ 3. Fetch data
            const res = await apiFetch(`/api/traccar/route?deviceId=${deviceId}&from=${from}&to=${to}`)
            if (!res) return;
            const data = await res.json();

            if (!data || data.length < 2) {
                alert("Not enough data for playback");
                return;
            }

            // ✅ 4. FILTER SAME DAY (CORRECT PLACE)
            playbackData = data.map(p => ({
                lat: p.latitude,
                lng: p.longitude,
                time: new Date(p.deviceTime),
                course: p.course || 0,
                speed: p.speed || 0
            }))
                .filter(p => {
                    const d = p.time.getFullYear() + "-" +
                        String(p.time.getMonth() + 1).padStart(2, '0') + "-" +
                        String(p.time.getDate()).padStart(2, '0');
                    return d === date;
                });

            // ✅ 5. SAFETY CHECK (RIGHT AFTER FILTER)
            if (!playbackData || playbackData.length < 2) {
                const stops = detectStops(playbackData);
                renderStops(stops);
                renderTripSummary(playbackData, stops);
                alert("No valid data for selected date");
                return;
            }

            // ✅ 6. Continue normally
            playbackPoints = playbackData.map(p => [p.lat, p.lng]);
            // 🟢 Start marker
            startMarker = L.marker(playbackPoints[0], {
                icon: startIcon
            })
                .addTo(map)
                .bindPopup("Start Point");

            // 🔴 End marker
            endMarker = L.marker(playbackPoints[playbackPoints.length - 1], {
                icon: endIcon
            })
                .addTo(map)
                .bindPopup("End Point");
            routeLine = L.polyline(playbackPoints, {
                color: "green",
                weight: 4
            }).addTo(map);

            playbackIndex = 0;

            // ✅ Slider setup
            const slider = document.getElementById("timeSlider");
            slider.max = playbackData.length - 1;
            slider.value = 0;

            // ✅ Remove old marker
            if (playbackMarker) {
                map.removeLayer(playbackMarker);
            }
            if (startMarker) {
                map.removeLayer(startMarker);
            }

            if (endMarker) {
                map.removeLayer(endMarker);
            }

            // ✅ Create marker
            playbackMarker = L.marker(playbackPoints[0], {
                icon: onlineIcon,
                rotationAngle: playbackData[0].course,
                rotationOrigin: 'center center'
            }).addTo(map);

            // ✅ Move map
            map.setView(playbackPoints[0], 15);
        }
        //clear function
        function clearPlayback() {
            isPlaybackMode = false;
            if (isPlaying) stopAutoPlayback();
            // Remove route
            if (routeLine) {
                map.removeLayer(routeLine);
                routeLine = null;
            }

            // Remove playback marker
            if (playbackMarker) {
                map.removeLayer(playbackMarker);
                playbackMarker = null;
            }

            // Remove start marker
            if (startMarker) {
                map.removeLayer(startMarker);
                startMarker = null;
            }

            // Remove end marker
            if (endMarker) {
                map.removeLayer(endMarker);
                endMarker = null;
            }

            // Remove stop markers
            stopMarkers.forEach(m => map.removeLayer(m));
            stopMarkers = [];

            // Reset playback
            playbackIndex = 0;
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
        // Put this INSIDE your DOMContentLoaded function, at the end
        const slider = document.getElementById("timeSlider");

        slider.addEventListener("input", function () {

            // Stop smooth playback temporarily if dragging
            if (isPlaying) stopAutoPlayback();
            startTime = null;
            // Get playback index from slider
            const value = parseFloat(this.value);
            playbackIndex = Math.floor(value); // segment index
            const t = value - playbackIndex;   // progress within segment

            // Get points
            const startPoint = playbackData[playbackIndex];
            const endPoint = playbackData[playbackIndex + 1] || startPoint;

            if (!startPoint || !playbackMarker) return;

            // Interpolate position & rotation
            const lat = startPoint.lat + (endPoint.lat - startPoint.lat) * t;
            const lng = startPoint.lng + (endPoint.lng - startPoint.lng) * t;

            const deltaAngle = ((endPoint.course - startPoint.course + 540) % 360) - 180;
            const angle = startPoint.course + deltaAngle * t;

            playbackMarker.setLatLng([lat, lng]);
            playbackMarker.setRotationAngle(angle);

            // Update time label
            const currentTime = new Date(startPoint.time.getTime() + t * (endPoint.time - startPoint.time));
            document.getElementById("timeLabel").innerText = currentTime.toLocaleTimeString();
        });
        async function fetchAllowedDevices() {
            try {
                const devices = await apiFetch("/api/traccar/devices");

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
                const data = await apiFetch("/api/auth/register", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + localStorage.getItem("token")
                    },
                    body: JSON.stringify({ name, email, password, role })
                });

                // ✅ success (apiFetch only returns if success)
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
            const res = await apiFetch("/api/traccar/command", {
                method: "POST",
                body: JSON.stringify({ deviceId, type })
            });

            if (!res) return;

            const data = await res.json();

            alert("Command sent: " + type);
            console.log("Command response:", data);
        }
        // INITIAL LOAD
        window.showRoute = showRoute;
        window.addDevice = addDevice;
        window.startPlayback = startPlayback;
        window.logout = logout;
        window.togglePlayback = togglePlayback;
        window.addAlert = addAlert;
        window.createUser = createUser;
        initApp();
    });
function updateVehicleList(positions) {
    const container = document.getElementById("vehicleList");
    if (!container) return;

    container.innerHTML = "";

    positions.forEach(pos => {

        if (!allowedDevices[String(pos.deviceId)]) return;
        const isOnline = isVehicleOnline(pos.deviceTime);

        const div = document.createElement("div");
        div.style.borderBottom = "1px solid #ccc";
        div.style.padding = "6px";

        div.innerHTML = `
            <b>Vehicle ${pos.deviceId}</b><br>
            Status: ${isOnline ? "🟢 Online" : "🔴 Offline"}<br>
            Speed: ${Math.round((pos.speed || 0) * 1.852)} km/h
        `;

        container.appendChild(div);
    });
}
function isVehicleOnline(deviceTime) {
    return ((new Date() - new Date(deviceTime)) / 60000) <= 5;
}

