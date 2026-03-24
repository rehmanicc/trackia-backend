document.addEventListener("DOMContentLoaded", () => {
    // all your JS code here

    let playbackData = [];
    let playbackMarker;
    let playInterval;
    let isPlaying = false;
    let playbackIndex = 0;
    let playbackPoints = [];
    let playbackInterval;
    let playbackTimer;
    let selectedVehicleId = null;
    let autoFollow = true;
    let playbackSpeed = 2; // default speed
    let startMarker = null;
    let endMarker = null;
    let routeLine = null;
    let stopMarkers = [];
    let lastAlertTime = {};
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
    if (payload.role !== "admin") {
        document.getElementById("adminPanel").style.display = "none"
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
    let vehicleStates = {}

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

        const layer = event.layer
        drawnItems.addLayer(layer)

        const geojson = layer.toGeoJSON()

        await apiFetch("/api/geofence", {
            method: "POST",
            body: JSON.stringify(geojson)
        })

        alert("Geofence Saved")

    })

    const socket = io("https://trackia-backend.onrender.com")

    socket.on("positions", (positions) => {

        positions.forEach((pos) => {

            const id = pos.deviceId;
            const lat = pos.latitude;
            const lng = pos.longitude;
            const course = pos.course || 0;

            const lastUpdate = new Date(pos.deviceTime);
            const now = new Date();
            const diffMinutes = (now - lastUpdate) / 60000;

            const isOnline = diffMinutes <= 5;
            const icon = isOnline ? onlineIcon : offlineIcon;

            if (markers[id]) {

                const current = markers[id].getLatLng();

                // Smooth animation
                const steps = 20;
                let i = 0;

                const deltaLat = (lat - current.lat) / steps;
                const deltaLng = (lng - current.lng) / steps;

                const deltaAngle =
                    ((course - (markers[id].options.rotationAngle || 0) + 540) % 360) - 180;

                const stepAngle = deltaAngle / steps;

                const move = setInterval(() => {
                    i++;

                    markers[id].setLatLng([
                        current.lat + deltaLat * i,
                        current.lng + deltaLng * i
                    ]);

                    markers[id].setRotationAngle(
                        (markers[id].options.rotationAngle || 0) + stepAngle * i
                    );

                    markers[id].setIcon(icon);

                    if (i >= steps) clearInterval(move);

                }, 100);

            } else {

                markers[id] = L.marker([lat, lng], {
                    icon: icon,
                    rotationAngle: course,
                    rotationOrigin: 'center center'
                })
                    .addTo(map)
                    .bindPopup(
                        "Vehicle " + id +
                        "<br>Speed: " + Math.round(pos.speed * 1.852) + " km/h"
                    );
            }

            if (selectedVehicleId === id) {
                renderVehicleDetails(pos);
            }

        });

    });
    function enableFollow() {
        autoFollow = true;
    }
    // ADD DEVICE
    async function addDevice() {

        const name = document.getElementById("vehicleName").value
        const imei = document.getElementById("vehicleUniqueId").value

        await apiFetch("/api/traccar/devices", {
            method: "POST",
            body: JSON.stringify({ name, uniqueId: imei })
        })

        alert("Vehicle Added")

    }


    // LOAD VEHICLES SIDEBAR
    async function loadVehicles() {
  const res = await fetch("/api/traccar/positions");
  const positions = await res.json();

  if (!Array.isArray(positions)) {
    console.error("Invalid positions:", positions);
    return;
  }

  positions.forEach(pos => {
    const { deviceId, latitude, longitude } = pos;

    if (markers[deviceId]) {
      // ✅ Move existing marker smoothly
      markers[deviceId].setLatLng([latitude, longitude]);
    } else {
      // ✅ Create new marker
      const marker = L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup(`Device: ${deviceId}`);

      markers[deviceId] = marker;
    }
  });
}


    // LOAD POSITIONS
    async function loadPositions() {

        const response = await apiFetch("/api/traccar/positions")
        if (!response) return;
        const positions = await response.json()

        positions.forEach(pos => {

            const id = pos.deviceId
            const lat = pos.latitude
            const lng = pos.longitude

            checkGeofences(id, lat, lng)

            const lastUpdate = new Date(pos.deviceTime)
            const now = new Date()
            const diffMinutes = (now - lastUpdate) / 60000

            const isOnline = diffMinutes <= 5

            if (markers[id]) {

                markers[id].setLatLng([lat, lng])

                // ✅ UPDATE ICON HERE
                markers[id].setIcon(
                    isOnline ? onlineIcon : offlineIcon
                )

            } else {

                markers[id] = L.marker([lat, lng], {
                    icon: isOnline ? onlineIcon : offlineIcon
                })
                    .addTo(map)
                    .bindPopup(
                        "Vehicle " + id +
                        "<br>Speed: " + Math.round(pos.speed * 1.852) + " km/h"
                    )

            }

        })

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

        const res = await apiFetch("/api/geofence")
        if (!res) return;
        const fences = await res.json()

        geofences = fences

        fences.forEach(f => {

            const layer = L.geoJSON(f)

            layer.eachLayer(l => {
                drawnItems.addLayer(l)
            })

        })

    }


    // CHECK GEOFENCE ENTRY/EXIT
    function checkGeofences(deviceId, lat, lng) {

        const point = turf.point([lng, lat]);

        geofences.forEach((f, index) => {

            const inside = turf.booleanPointInPolygon(point, f);
            const key = deviceId + "_" + index;

            // ✅ Initialize state
            if (!(key in vehicleStates)) {
                vehicleStates[key] = inside;
                return;
            }

            const previousState = vehicleStates[key];

            // ✅ ENTER event (only once)
            if (!previousState && inside) {
                addAlert(`Vehicle ${deviceId} ENTERED ${f.name || "geofence"}`);
                L.geoJSON(f, {
                    style: { color: "green", weight: 3 }
                }).addTo(map);
                map.panTo([lat, lng]);
            }

            // ✅ EXIT event (only once)
            if (previousState && !inside) {
                addAlert(`Vehicle ${deviceId} exited ${f.name || "zone"}`);

                L.geoJSON(f, {
                    style: { color: "red", weight: 3 }
                }).addTo(map);
                map.panTo([lat, lng]);
            }

            // ✅ Update state
            vehicleStates[key] = inside;

        });
    }

    // ALERT SYSTEM
    function addAlert(message) {

        const now = Date.now();

        // ⛔ Prevent spam (3 sec cooldown per message)
        if (lastAlertTime[message] && (now - lastAlertTime[message] < 3000)) {
            return;
        }

        lastAlertTime[message] = now;

        alerts.unshift({
            message: message,
            time: new Date()
        });

        if (alerts.length > 20) {
            alerts.pop();
        }

        renderAlerts();
    }


    function renderAlerts() {

        const container = document.getElementById("alertList")
        container.innerHTML = ""

        alerts.forEach(a => {

            const div = document.createElement("div")

            div.style.border = "1px solid #ddd"
            div.style.padding = "6px"
            div.style.marginBottom = "5px"
            if (a.message.includes("entered")) {
                div.style.background = "#d4edda"; // green
            } else {
                div.style.background = "#f8d7da"; // red
            }

            div.innerHTML = `
<b>${a.message}</b><br>
<small>${a.time.toLocaleTimeString()}</small>
`

            container.appendChild(div)

        })

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
    loadPositions()
    loadVehicles()
    loadGeofences()


    setInterval(loadVehicles, 5000)
    window.showRoute = showRoute;
    window.addDevice = addDevice;
    window.startPlayback = startPlayback;
    window.logout = logout;
    window.togglePlayback = togglePlayback;
});
