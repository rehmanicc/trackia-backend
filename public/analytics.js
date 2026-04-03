let deviceMap = {};
let geofenceMap = {};
let dailyChart, geoChart, deviceChart;
const API_BASE = "https://your-backend.onrender.com";
import { getMap } from "./modules/mapModule.js";

const map = getMap();
async function loadAnalytics(query = "") {

    const res = await fetch(`${API_BASE}/api/analytics/report?${query}`);
    const data = await res.json();

    document.getElementById("totalVisits").innerText = data.totalVisits;
    document.getElementById("totalTime").innerText = data.totalTimeMinutes;
    const tbody = document.querySelector("#sessionTable tbody");
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

    const res = await fetch(`${API_BASE}/api/analytics/daily?${query}`);
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

    const res = await fetch(`${API_BASE}/api/analytics/top-geofences?${query}`);
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
async function loadDevices(query = "") {

    const res = await fetch("${API_BASE}/api/traccar/devices");
    const devices = await res.json();

    const select = document.getElementById("deviceSelect");

    devices.forEach(d => {

        const option = document.createElement("option"); // ✅ FIRST create

        const id = d.traccarId;
        const name = d.name || d.uniqueId;

        deviceMap[id] = name;

        option.value = id;
        option.text = name;

        select.appendChild(option);
    });
}
async function loadGeofences(query = "") {

    const res = await fetch("${API_BASE}/api/geofence");
    const geofences = await res.json();

    const select = document.getElementById("geofenceSelect");

    geofences.forEach(g => {
        const option = document.createElement("option");
        geofenceMap[g._id] = g.name;
        option.value = g._id;
        option.text = g.name;
        select.appendChild(option);
    });
}
async function loadDeviceChart(query = "") {

    const res = await fetch(`${API_BASE}/api/analytics/device-summary?${query}`);
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

    const from = document.getElementById("fromDate").value;
    const to = document.getElementById("toDate").value;
    const deviceId = document.getElementById("deviceSelect").value;
    const geofenceId = document.getElementById("geofenceSelect").value;

    const params = new URLSearchParams();

    if (from) params.append("from", from);
    if (to) params.append("to", to);
    if (deviceId && deviceId !== "null" && deviceId !== "") {
        params.append("deviceId", deviceId);
    } if (geofenceId) params.append("geofenceId", geofenceId);

    return params.toString();
}
async function applyFilters() {

    const query = getFilters();
    document.body.style.opacity = 0.5;

    await loadAnalytics(query);
    await loadDailyChart(query);
    await loadGeofenceChart(query);
    await loadDeviceChart(query);
    document.body.style.opacity = 1;
}
async function init() {
    await loadDevices();
    await loadGeofences();
    await applyFilters();
}
async function fetchTrip() {

    const start = document.getElementById("startTime").value;
    const end = document.getElementById("endTime").value;
    const mileage = document.getElementById("mileage").value;

    if (!start || !end) {
        alert("Select start and end time");
        return;
    }

    const res = await fetch(`/api/analytics/trip/${selectedDeviceId}?start=${start}&end=${end}`);
    const data = await res.json();

    if (!data.positions || data.positions.length === 0) {
        alert("No trip data found");
        return;
    }

    drawTrip(data.positions);
    showAnalytics(data.stats, mileage);

    closeAnalyticsModal();
}

init();