import { apiRequest } from "../services/apiService.js";
import { appState } from "../state/appState.js";
import { hasPermission } from "../components/permissions.js";

const getUsers = () => window.cachedUsers || [];
const switchPanel = window.switchPanel;
const alertUI = window.alertUI;
export async function loadDevices() {

    const container = document.getElementById("deviceList");

    try {
        const devices = await apiRequest("/api/devices");
        window.allDevices = devices;
        appState.allDevices = devices;
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

            const canManageDevices =
                appState.userRole === "owner" ||
                hasPermission?.("EDIT_DEVICE");
            const canEditSpeed =
                appState.userRole === "owner" ||
                hasPermission?.("EDIT_SPEED");

            let users = "-";

            if (Array.isArray(d.assignedTo)) {
                users = d.assignedTo.map(u => u.name || "User").join(", ");
            }
            else if (d.assignedTo && typeof d.assignedTo === "object") {
                users = d.assignedTo.name || "User";
            }

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

                <td>${users}</td>

                <td>
                    <div class="action-buttons">

                        ${canManageDevices ? `
                            <button onclick="openAssign('${d._id}')">👤</button>
                        ` : ""}

                        ${canManageDevices && d.assignedTo ? `
                            <button onclick="unassignDevice('${d._id}')">❌</button>
                        ` : ""}

                        ${canManageDevices ? `
                            <button onclick="deleteDevice('${d._id}')">🗑</button>
                        ` : ""}

                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `<p style='color:red'>Failed to load devices</p>`;
    }
}

// ===============================
// DELETE DEVICE
// ===============================
export async function deleteDevice(id) {

    if (!confirm("Delete this device?")) return;

    await apiRequest(`/api/devices/${id}`, {
        method: "DELETE"
    });

    alert("Deleted");
    loadDevices();
}

// ===============================
// FILTER
// ===============================
export function filterDevices() {

    const search = document.getElementById("deviceSearch").value.toLowerCase();
    const rows = document.querySelectorAll("#deviceTableBody tr");

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(search) ? "" : "none";
    });
}

// ===============================
// CREATE DEVICE
// ===============================
export async function submitNewDevice() {

    const name = document.getElementById("deviceNameInput").value.trim();
    const uniqueId = document.getElementById("deviceUniqueInput").value.trim();
    const adminId = document.getElementById("deviceAdminSelect").value;

    const speedInput = document.getElementById("deviceSpeedInput").value;
    const mileageInput = document.getElementById("deviceMileageInput").value;

    if (!name || !uniqueId || !adminId) {
        alert("Fill all required fields");
        return;
    }

    const payload = { name, uniqueId, adminId };

    if (speedInput) payload.speedLimit = Number(speedInput);
    if (mileageInput) payload.fuelEfficiency = Number(mileageInput);

    await apiRequest("/api/devices", {
        method: "POST",
        body: JSON.stringify(payload)
    });

    alert("Device created");
    window.switchPanel("devices");
    loadDevices();
}

// ===============================
// UPDATE SPEED
// ===============================
export async function updateSpeed(deviceId, speed) {

    await apiRequest(`/api/devices/${deviceId}/speed`, {
        method: "PUT",
        body: JSON.stringify({
            speedLimit: Number(speed)
        })
    });

    alertUI?.showToast("Speed updated", "success");
    loadDevices();
}

// ===============================
// ASSIGN / UNASSIGN
// ===============================
let selectedDeviceForAssign = null;

export async function openAssign(deviceId) {

    selectedDeviceForAssign = deviceId;

    const adminSelect = document.getElementById("assignAdminSelect");
    const userSelect = document.getElementById("assignUserSelect");

    // Reset dropdowns
    adminSelect.innerHTML = "<option value=''>-- Select Admin --</option>";
    userSelect.innerHTML = "<option value=''>-- Select User --</option>";

    // Get device
    const device = appState.allDevices?.find(d => d._id === deviceId);

    if (!device) {
        alert("Device not found");
        return;
    }

    // Ensure users are loaded
    if (!appState.cachedUsers || appState.cachedUsers.length === 0) {
        console.log("⚡ Loading users inside assign...");
        appState.cachedUsers = await apiRequest("/api/users") || [];
    }

    const users = appState.cachedUsers;

    console.log("Assign users:", users);

    // Populate dropdowns
    if (appState.userRole === "owner") {

        users
            .filter(u => u.role?.toLowerCase() === "admin")
            .forEach(u => {
                adminSelect.innerHTML += `<option value="${u._id}">${u.name}</option>`;
            });

        users
            .filter(u => u.role?.toLowerCase() === "user")
            .forEach(u => {
                userSelect.innerHTML += `<option value="${u._id}">${u.name}</option>`;
            });

    } else if (appState.userRole === "admin") {

        users
            .filter(u => u.role?.toLowerCase() === "user")
            .forEach(u => {
                userSelect.innerHTML += `<option value="${u._id}">${u.name}</option>`;
            });
    }

    // ✅ PRE-SELECT ADMIN (AFTER options are populated)
    if (device.adminId) {
        adminSelect.value = device.adminId;
    }

    // Open modal (ONLY ONCE, at end)
    document.getElementById("assignModal").style.display = "flex";
}

export async function submitAssign() {

    const adminId = document.getElementById("assignAdminSelect")?.value;
    const userId = document.getElementById("assignUserSelect")?.value;

    const payload = {};

    if (adminId) payload.adminId = adminId;
    if (userId) payload.userId = userId;

    await apiRequest(`/api/devices/${selectedDeviceForAssign}/assign`, {
        method: "POST",
        body: JSON.stringify(payload)
    });

    alert("Assigned successfully");

    document.getElementById("assignModal").style.display = "none";
    loadDevices();
}

export async function unassignDevice(deviceId) {

    if (!confirm("Unassign this device?")) return;

    await apiRequest(`/api/devices/${deviceId}/unassign`, {
        method: "POST"
    });

    alert("Unassigned");
    loadDevices();
}
export function closeAssign() {
    const modal = document.getElementById("assignModal");
    if (modal) {
        modal.style.display = "none";
    }
}