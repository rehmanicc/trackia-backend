let playbackData = [];
let playbackMarker;
let isPlaying = false;
let playbackIndex = 0;
let playbackPoints = [];
let autoFollow = true;
let startMarker = null;
let endMarker = null;
let routeLine = null;
let stopMarkers = [];
let isPlaybackMode = false;
let map;
let apiRequest;
let smoothAnimationId = null;
let startTime = null;

let startIcon, endIcon, onlineIcon;
let detectStops, renderStops, renderTripSummary;

export function initPlayback(deps) {
    map = deps.map;
    apiRequest = deps.apiRequest;

    startIcon = deps.startIcon;
    endIcon = deps.endIcon;
    onlineIcon = deps.onlineIcon;

    detectStops = deps.detectStops;
    renderStops = deps.renderStops;
    renderTripSummary = deps.renderTripSummary;
}
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
export function togglePlayback() {

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
export async function startPlayback(deviceId, date) {
    isPlaybackMode = true;
    clearPlayback();
    document.getElementById("playbackControl").style.display = "block";
    document.getElementById("playToggleBtn").style.display = "flex";

    if (!deviceId || !date) {
        alert("Please select device and date");
        return;
    }

    // ✅ 2. Create API range
    const from = date + "T00:00:00Z";
    const to = date + "T23:59:59Z";

    const data = await apiRequest(`/api/traccar/route?deviceId=${deviceId}&from=${from}&to=${to}`);
    if (!data) return;

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
    slider.oninput = function () {
        playbackIndex = Math.floor(this.value);

        const point = playbackData[playbackIndex];
        if (!point) return;

        playbackMarker.setLatLng([point.lat, point.lng]);

        const timeLabel = document.getElementById("timeLabel");
        timeLabel.innerText = new Date(point.time).toLocaleTimeString();
    };
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
    startAutoPlayback();
}

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