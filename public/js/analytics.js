let dailyChart, geoChart, deviceChart;

import { drawTrip } from "./modules/mapModule.js";
import { apiRequest } from "./services/apiService.js";
import { getState } from "./state/uiState.js";
import { toKmh } from "./modules/mapModule.js";
async function loadAnalytics(query = "") {

    let data;
    try {
        data = await apiRequest(`/api/analytics/report?${query}`);
    } catch (err) {
        console.error("❌ API error:", err.message);
        return;
    }

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

    const fragment = document.createDocumentFragment();

    data.sessions.forEach(s => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
        <td>${deviceMap[s.deviceId] || s.deviceId}</td>
        <td>${geofenceMap[s.geofenceId] || s.geofenceId}</td>
        <td>${new Date(s.enterTime).toLocaleString()}</td>
        <td>${new Date(s.exitTime).toLocaleString()}</td>
        <td>${s.durationMinutes}</td>
    `;

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}
async function loadDailyChart(query = "") {

    let data;
    try {
        data = await apiRequest(`/api/analytics/daily?${query}`);
    } catch (err) {
        console.error("❌ API error:", err.message);
        return;
    }
    if (dailyChart) {
        dailyChart.data.labels = data.map(d => d.date);
        dailyChart.data.datasets[0].data = data.map(d => d.totalTimeMinutes);
        dailyChart.update();
        return;
    }
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

    let data;
    try {
        data = await apiRequest(`/api/analytics/top-geofences?${query}`);
    } catch (err) {
        console.error("❌ API error:", err.message);
        return;
    }
    if (geoChart) {
        geoChart.data.labels = data.map(d => geofenceMap[d._id] || d._id);
        geoChart.data.datasets[0].data = data.map(d => d.visits);
        geoChart.update();
        return;
    }
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

    let data;
    try {
        data = await apiRequest(`/api/analytics/device-summary?${query}`);
    } catch (err) {
        console.error("❌ API error:", err.message);
        return;
    }

    if (deviceChart) {
        deviceChart.data.labels = data.map(d => deviceMap[d._id] || d._id);
        deviceChart.data.datasets[0].data = data.map(d => d.totalEvents);
        deviceChart.update();
        return;
    }

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
async function fetchTrip() {


    const deviceId = getState().selectedVehicleId;

    if (!deviceId) {
        alert("Please select a vehicle first");
        return;
    }

    const start = document.getElementById("startTime").value;
    const end = document.getElementById("endTime").value;


    if (!start || !end) {
        alert("Select start and end time");
        return;
    }

    let data;
    try {
        data = await apiRequest(
            `/api/analytics/trip/${deviceId}?start=${start}&end=${end}`
        );
    } catch (err) {
        console.error("❌ API error:", err.message);
        return;
    }

    if (!data.positions || data.positions.length === 0) {
        alert("No trip data found");
        return;
    }

    drawTrip(data.positions);
    showAnalytics(data.stats);

    closeAnalyticsModal();
}
function showAnalytics(stats) {
    if (!stats) return;

    // Convert speed from knots → km/h (if needed)
    const avgSpeed = stats.avgSpeedKmh ?? (stats.avgSpeed ? toKmh(stats.avgSpeed) : 0);
    const maxSpeed = stats.maxSpeedKmh ?? (stats.maxSpeed ? toKmh(stats.maxSpeed) : 0);
    // Distance already in KM (your backend uses Haversine)
    const distance = stats.distance ? stats.distance.toFixed(2) : 0;

    // Fuel estimation (optional logic)
    const fuelUsed = stats.fuelUsed
        ? stats.fuelUsed.toFixed(2)
        : 0;

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