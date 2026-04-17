import { apiRequest } from "../services/apiService.js";
import { appState } from "../state/appState.js";
import { hasPermission } from "../components/permissions.js";

const getUsers = () => window.cachedUsers || [];
const switchPanel = window.switchPanel;
const alertUI = window.alertUI;
function createDeviceControlCard(device) {

    const root = document.createElement("div");
    root.className = "vehicle-card";

    let expanded = false;

    // 🔹 HEADER
    const header = document.createElement("div");
    header.className = "vehicle-header";

    const name = document.createElement("div");
    name.innerText = "📦 " + device.name;

    const expandIcon = document.createElement("span");
    expandIcon.innerText = "▼";

    header.appendChild(name);
    header.appendChild(expandIcon);

    // 🔹 BODY
    const body = document.createElement("div");
    body.className = "vehicle-body";
    body.style.display = "none";

    header.onclick = () => {
        expanded = !expanded;
        body.style.display = expanded ? "block" : "none";
        expandIcon.innerText = expanded ? "▲" : "▼";
    };

    // ===============================
    // 🔥 GEOFENCE DROPDOWN
    // ===============================
    const select = document.createElement("select");
    select.className = "";
    select.innerHTML = `<option value="">-Select Geofence for Call-</option>`;

    const deviceGeofences = window.geofences?.filter(
        g => String(g.deviceId) === String(device._id)
    ) || [];

    deviceGeofences.forEach(g => {
        const option = document.createElement("option");
        option.value = g._id;
        option.textContent = g.name;
        select.appendChild(option);
    });

    if (device.callGeofenceId) {
        select.value = device.callGeofenceId;
    }

    const geoRow = document.createElement("div");
    geoRow.className = "geo-row";
    geoRow.appendChild(select);

    const callInput = document.createElement("input");
    callInput.className = "input";
    callInput.value = device.callReceiverNumber || "";
    const role = appState.userRole;

    const isOwner = role === "owner";
    const isAdmin = role === "admin";
    const isUser = role === "user";

    // 🔒 Lock logic
    if (isUser && !device.allowUserToChangeCallReceiver) {
        callInput.disabled = true;
        callInput.title = "Permission denied by admin";
    }
    if (callInput.disabled) {
        callInput.style.background = "#eee";
        callInput.style.cursor = "not-allowed";
        callInput.style.opacity = "0.7";
    }
    callInput.placeholder = "Call Receiver Number";

    const callWrapInput = document.createElement("div");
    callWrapInput.className = "inline-group";
    callWrapInput.innerHTML = `<label>
        Call Number ${callInput.disabled ? "🔒" : ""}
    </label>`;
    callWrapInput.appendChild(callInput);
    const callPermRow = document.createElement("div");
    callPermRow.className = "control-row";
    callPermRow.style.display = "flex";
    callPermRow.style.justifyContent = "space-between";
    callPermRow.style.alignItems = "center";
    const callPermLabel = document.createElement("div");
    callPermLabel.innerText = "Allow Call Receiver Change";

    const callPermToggle = document.createElement("label");
    callPermToggle.className = "switch";

    callPermToggle.innerHTML = `
    <input type="checkbox">
    <span class="slider"></span>
`;

    const callPermCheckbox = callPermToggle.querySelector("input");
    callPermCheckbox.checked = device.allowUserToChangeCallReceiver || false;

    // ===============================
    // 🔥 CALL TOGGLE
    // ===============================
    const toggleLabel = document.createElement("label");
    toggleLabel.innerHTML = `<input type="checkbox"> Enable Call`;

    const callToggle = toggleLabel.querySelector("input");
    callToggle.checked = device.callEnabled ?? true;

    // ===============================
    // 🔥 ENGINE BUTTON
    // ===============================
    const engineBtn = document.createElement("button");
    engineBtn.className = "btn btn-success";

    let engineState = device.engineOn ?? false;
    engineBtn.innerText = engineState ? "🟢 ON" : "🔴 OFF";

    if (!device.traccarId) {
        engineBtn.disabled = true;
        engineBtn.innerText = "⚠️ No Tracker";
    }

    engineBtn.onclick = async () => {

        // ✅ STEP 1 — Permission check
        if (!hasPermission("ENGINE_CONTROL")) {
            alert("No permission for engine control");
            return;
        }

        // ✅ STEP 2 — Engine ON restriction (Owner/Admin control)
        if (!device.engineAllowed && !engineState) {
            alert("Engine ON is restricted by Admin/Owner");
            return;
        }

        // ✅ STEP 3 — HARD LOCK (NEW — REQUIRED)
        if (device.engineLockedBy && !engineState) {
            alert(`Engine locked by ${device.engineLockedBy}`);
            return;
        }

        // ✅ STEP 4 — Tracker check
        if (!device.traccarId) {
            alert("Device not linked to tracker");
            return;
        }

        engineBtn.disabled = true;

        const command = engineState ? "engineStop" : "engineResume";

        try {
            await apiRequest(`/api/commands/send`, {
                method: "POST",
                body: JSON.stringify({
                    deviceId: device.traccarId,
                    command
                })
            });

            engineState = !engineState;
            engineBtn.innerText = engineState ? "🟢 ON" : "🔴 OFF";

        } catch (err) {
            console.error(err);
            alert("Engine command failed");
        }

        engineBtn.disabled = false;
    };

    // ===============================
    // 🔥 SPEED + FUEL INPUTS
    // ===============================
    const speedInput = document.createElement("input");
    speedInput.className = "input";
    speedInput.value = device.speedLimit ?? "";

    speedInput.placeholder = "Default from backend";

    const fuelInput = document.createElement("input");
    fuelInput.className = "input";
    fuelInput.value = device.fuelEfficiency ?? "";

    fuelInput.placeholder = "Default from backend";

    // Row: Speed + Fuel
    const inputRow = document.createElement("div");
    inputRow.className = "input-row";

    const speedWrap = document.createElement("div");
    speedWrap.className = "inline-group";
    speedWrap.innerHTML = `<label>Speed Limit</label>`;
    if (!device.allowSpeedEdit) {
        speedInput.disabled = true;
    }
    speedWrap.appendChild(speedInput);

    const fuelWrap = document.createElement("div");
    fuelWrap.className = "inline-group";
    fuelWrap.innerHTML = `<label>Fuel Efficiency</label>`;
    if (!device.allowFuelEdit) {
        fuelInput.disabled = true;
    }
    fuelWrap.appendChild(fuelInput);

    inputRow.appendChild(speedWrap);
    inputRow.appendChild(fuelWrap);
    const saveBtn = document.createElement("button");
    saveBtn.innerText = "💾 Save";
    saveBtn.className = "btn-save";
    // ===============================
    // 🔥 CALL + ENGINE ROW
    // ===============================
    const controlRow = document.createElement("div");
    controlRow.className = "control-row";

    const callWrap = document.createElement("div");
    callWrap.className = "inline-group";
    callWrap.appendChild(toggleLabel);

    const engineWrap = document.createElement("div");
    engineWrap.className = "inline-group";
    engineWrap.appendChild(engineBtn);
    engineWrap.style.display = "flex";
    engineWrap.style.alignItems = "center";
    engineWrap.style.justifyContent = "space-between";

    controlRow.appendChild(callWrap);
    controlRow.appendChild(engineWrap);
    controlRow.appendChild(saveBtn);
    // 🔥 ACTION BUTTONS
    const actionLeft = document.createElement("div");
    actionLeft.className = "action-left";

    // Assign
    const assignBtn = document.createElement("button");
    assignBtn.innerText = "👤Assign";
    assignBtn.className = "btn btn-primary";
    if (!hasPermission("ASSIGN_DEVICE")) {
        assignBtn.style.display = "none";
    }
    assignBtn.onclick = () => {
        openAssign(device._id);
    };

    // Unassign
    const unassignBtn = document.createElement("button");
    unassignBtn.innerText = "Unassign";
    unassignBtn.className = "btn btn-warning";
    if (!hasPermission("EDIT_DEVICE")) {
        unassignBtn.style.display = "none";
    }
    unassignBtn.onclick = () => {
        unassignDevice(device._id);
    };

    // Delete
    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "Delete";
    deleteBtn.className = "btn btn-danger";
    if (!hasPermission("DELETE_DEVICE")) {
        deleteBtn.style.display = "none";
    }
    deleteBtn.onclick = () => {
        deleteDevice(device._id);
    };

    actionLeft.appendChild(assignBtn);
    actionLeft.appendChild(unassignBtn);
    actionLeft.appendChild(deleteBtn);
    // ===============================
    // 🔥 SAVE BUTTON (BOTTOM)
    // ===============================

    // ===============================
    // 🔥 ROW 4 — ACTION BUTTONS
    // ===============================
    const actionRow = document.createElement("div");
    actionRow.className = "action-row";

    actionRow.appendChild(assignBtn);
    actionRow.appendChild(unassignBtn);
    actionRow.appendChild(deleteBtn);


    // ===============================
    // 🔥 SAVE ALL SETTINGS
    // ===============================
    saveBtn.onclick = async () => {
        if (
            appState.userRole === "user" &&
            !device.allowUserToChangeCallReceiver
        ) {
            alert("You are not allowed to change call receiver");
            return;
        }
        if (callInput.value && !callInput.value.match(/^03\d{9}$/)) {
            alert("Invalid call number");
            return;
        }
        try {

            await Promise.all([

                // Call + Geofence
                apiRequest(`/api/devices/${device._id}/call-settings`, {
                    method: "POST",
                    body: JSON.stringify({
                        callEnabled: callToggle.checked,
                        callGeofenceId: select.value
                    })
                }),
                //call number

                apiRequest(`/api/devices/${device._id}/call-receiver`, {
                    method: "PUT",
                    body: JSON.stringify({
                        callReceiverNumber: callInput.value
                    })
                }),
                // Speed
                apiRequest(`/api/devices/${device._id}/speed`, {
                    method: "PUT",
                    body: JSON.stringify({
                        speedLimit: Number(speedInput.value)
                    })
                }),
                ...(appState.userRole !== "user" ? [
                    apiRequest(`/api/devices/${device._id}/call-permission`, {
                        method: "PUT",
                        body: JSON.stringify({
                            allow: callPermCheckbox.checked
                        })
                    })
                ] : []),
                // Fuel
                apiRequest(`/api/devices/${device._id}/fuel`, {
                    method: "PUT",
                    body: JSON.stringify({
                        fuelEfficiency: Number(fuelInput.value)
                    })
                })

            ]);

            alertUI?.showToast("All settings saved", "success");

        } catch (err) {
            console.error(err);
            alert("Failed to save");
        }
    };

    // ===============================
    // 🔥 FINAL APPEND ORDER
    // ===============================
    body.appendChild(geoRow);
    body.appendChild(callWrapInput);
    // ===============================
    // 🔥 CALL RECEIVER PERMISSION
    // ===============================


    // Hide for user
    if (appState.userRole === "user") {
        callPermRow.style.display = "none";
    }

    callPermRow.appendChild(callPermLabel);
    callPermRow.appendChild(callPermToggle);

    body.appendChild(callPermRow);
    body.appendChild(inputRow);
    body.appendChild(controlRow);
    body.appendChild(actionRow);

    root.appendChild(header);
    root.appendChild(body);

    return root;
}
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
    <div id="deviceCardList"></div>
`;

        const list = document.getElementById("deviceCardList");
        devices.forEach(device => {
            const card = createDeviceControlCard(device);
            list.appendChild(card);
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
    const cards = document.querySelectorAll("#deviceCardList .vehicle-card");

    cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(search) ? "" : "none";
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

    const deviceSimNumber = document.getElementById("deviceSimInput").value.trim();
    const callReceiverNumber = document.getElementById("deviceCallReceiverInput").value.trim();

    if (!deviceSimNumber) {
        alert("Device SIM number is required");
        return;
    }

    if (callReceiverNumber && !callReceiverNumber.match(/^03\d{9}$/)) {
        alert("Invalid call receiver number");
        return;
    }

    const payload = {
        name,
        uniqueId,
        adminId,
        deviceSimNumber
    };

    if (callReceiverNumber) {
        payload.callReceiverNumber = callReceiverNumber;
    }

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
    const adminBlock = document.getElementById("adminAssignBlock");

    if (appState.userRole === "admin") {
        adminBlock.style.display = "none";
    } else {
        adminBlock.style.display = "block";
    }
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
    const users = appState.cachedUsers || [];
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
    if (userId) {
        payload.userId = userId;
    }
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