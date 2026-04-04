let deviceMap = {};
let geofenceMap = {};
let dailyChart, geoChart, deviceChart;
const token = localStorage.getItem("token");
const API_BASE = "https://trackia-backend.onrender.com";
import { getMap, drawTrip } from "./modules/mapModule.js";

const map = getMap();
async function loadAnalytics(query = "") {

    const res = await fetch(`${API_BASE}/api/analytics/report?${query}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    if (!res.ok) {
        const err = await res.text();
        console.error("❌ API error:", err);
        return;
    }
    const data = await res.json();

    const totalVisitsEl = document.getElementById("totalVisits");
    const totalTimeEl = document.getElementById("totalTime");
    const tbody = document.querySelector("#sessionTable tbody");

    if (!totalVisitsEl || !totalTimeEl || !tbody) {
        console.warn("⚠️ Analytics UI not ready, skipping render");
        return;
    }

    totalVisitsEl.innerText = data.totalVisits;
    totalTimeEl.innerText = data.totalTimeMinutes;

    tbody.innerHTML = "";

    data.sessions.forEach(s => {
        const row = `
        <tr>
            <td>${deviceMap[s.deviceId] || s.deviceId}</td>
            <td>${geofenceMap[s.geofenceId] || s.geofenceId}</td>
            <td>${new Date(s.enterTime).toLocaleString()}</td>
            <td>${new Date(s.exitTime).toLocaleString()}</td>
            <td>${s.durationMinutes}</td>
        </tr>
    `;
        tbody.innerHTML += row;
    });
}
function openAnalytics() {

    activePanel = "analytics";
    localStorage.setItem("activePanel", activePanel);

    // Hide all panels
    document.querySelectorAll(".vehicle-panel")
        .forEach(p => p.style.display = "none");

    // Show device panel
    document.getElementById("devicePanel").style.display = "block";

    // Hide analytics panel initially
    document.getElementById("analyticsPanel").style.display = "none";
}
async function loadDailyChart(query = "") {

    const res = await fetch(`${API_BASE}/api/analytics/daily?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        const err = await res.text();
        console.error("❌ API error:", err);
        return;
    }
    const data = await res.json();
    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart(document.getElementById("dailyChart"), {
        type: "line",
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: "Time (min)",
                data: data.map(d => d.totalTimeMinutes)
            }]
        }
    });
}

async function loadGeofenceChart(query = "") {

    const res = await fetch(`${API_BASE}/api/analytics/top-geofences?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        const err = await res.text();
        console.error("❌ API error:", err);
        return;
    }
    const data = await res.json();
    if (geoChart) geoChart.destroy();

    geoChart = new Chart(document.getElementById("geofenceChart"), {
        type: "bar",
        data: {
            labels: data.map(d => geofenceMap[d._id] || d._id),
            datasets: [{
                label: "Visits",
                data: data.map(d => d.visits)
            }]
        }
    });
}

async function loadDeviceChart(query = "") {

    const res = await fetch(`${API_BASE}/api/analytics/device-summary?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        const err = await res.text();
        console.error("❌ API error:", err);
        return;
    }
    const data = await res.json();

    if (deviceChart) deviceChart.destroy();

    deviceChart = new Chart(document.getElementById("deviceChart"), {
        type: "bar",
        data: {
            labels: data.map(d => deviceMap[d._id] || d._id),
            datasets: [{
                label: "Activity",
                data: data.map(d => d.totalEvents)
            }]
        }
    });
}
function getFilters() {
    const fromEl = document.getElementById("fromDate");
    const toEl = document.getElementById("toDate");

    const params = new URLSearchParams();

    if (fromEl && fromEl.value) params.append("from", fromEl.value);
    if (toEl && toEl.value) params.append("to", toEl.value);

    return params.toString();
}
async function applyFilters() {

    const query = getFilters();
    document.body.style.opacity = 0.5;

    await loadAnalytics(query);
    if (typeof Chart !== "undefined") {
        await loadDailyChart(query);
        await loadGeofenceChart(query);
        await loadDeviceChart(query);
    } else {
        console.warn("⚠️ Chart.js not loaded yet");
    }
    document.body.style.opacity = 1;
}
async function init() {
    console.log("✅ Analytics module ready");
}
async function fetchTrip() {
    if (!window.selectedDeviceId) {
        alert("Please select a vehicle first");
        return;
    }

    const start = document.getElementById("startTime").value;
    const end = document.getElementById("endTime").value;
    const mileage = document.getElementById("mileage").value;

    if (!start || !end) {
        alert("Select start and end time");
        return;
    }

    const res = await fetch(
        `${API_BASE}/api/analytics/trip/${window.selectedDeviceId}?start=${start}&end=${end}`,
        {
            headers: { Authorization: `Bearer ${token}` }
        }
    );
    if (!res.ok) {
        const err = await res.text();
        console.error("❌ API error:", err);
        return;
    }
    const data = await res.json();

    if (!data.positions || data.positions.length === 0) {
        alert("No trip data found");
        return;
    }

    drawTrip(data.positions);
    showAnalytics(data.stats, mileage);

    closeAnalyticsModal();
}
function showAnalytics(stats, mileage) {
    if (!stats) return;

    // Optional mileage input
    const mileageValue = Number(mileage || 0);

    // Convert speed from knots → km/h (if needed)
    const avgSpeed = stats.avgSpeed ? (stats.avgSpeed * 1.852).toFixed(1) : 0;
    const maxSpeed = stats.maxSpeed ? (stats.maxSpeed * 1.852).toFixed(1) : 0;

    // Distance already in KM (your backend uses Haversine)
    const distance = stats.distance ? stats.distance.toFixed(2) : 0;

    // Fuel estimation (optional logic)
    let fuelUsed = 0;
    if (mileageValue > 0) {
        fuelUsed = (distance / mileageValue).toFixed(2);
    }

    // 🎯 Update UI (make sure these IDs exist in HTML)
    document.getElementById("tripDistance").innerText = distance + " km";
    document.getElementById("tripAvgSpeed").innerText = avgSpeed + " km/h";
    document.getElementById("tripMaxSpeed").innerText = maxSpeed + " km/h";
    document.getElementById("tripStops").innerText = stats.stops || 0;

    if (document.getElementById("tripFuel")) {
        document.getElementById("tripFuel").innerText = fuelUsed + " L";
    }
}
window.fetchTrip = fetchTrip;
init();