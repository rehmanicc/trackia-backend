import { apiRequest } from "../services/apiService.js";
import { appState } from "../state/appState.js";
const PERMISSION_GROUPS = {
    DEVICES: {
        label: "🚗 Devices",
        permissions: [
            "EDIT_DEVICE",
            "DELETE_DEVICE",
            "ASSIGN_DEVICE",
            "SEND_COMMAND",
            "ENGINE_CONTROL"
        ]
    },
    GEOFENCE: {
        label: "📍 Geofencing",
        permissions: [
            "GEOFENCE_VIEW",
            "GEOFENCE_CREATE",
            "GEOFENCE_EDIT",
            "GEOFENCE_DELETE"
        ]
    },
    SYSTEM: {
        label: "⚙️ System",
        permissions: [
            "EDIT_SPEED",
            "EDIT_FUEL",
            "RENEW_DEVICE"
        ]
    }
};

// ===============================
// HUMAN READABLE LABELS
// ===============================
const PERMISSION_LABELS = {
    EDIT_DEVICE: "Edit Devices",
    DELETE_DEVICE: "Delete Devices",
    ASSIGN_DEVICE: "Assign Devices",
    SEND_COMMAND: "Send Commands",
    RENEW_DEVICE: "Renew Devices",
    ENGINE_CONTROL: "Engine Control (ON/OFF)",

    EDIT_SPEED: "Edit Speed Limit",
    EDIT_FUEL: "Edit Fuel Settings",

    GEOFENCE_VIEW: "View Geofences",
    GEOFENCE_CREATE: "Create Geofence",
    GEOFENCE_EDIT: "Edit Geofence",
    GEOFENCE_DELETE: "Delete Geofence"
};

// local state (module scoped)
let permissionChanges = {};
let originalPhone = "";
export async function loadUserPermissions() {

    let users = appState.cachedUsers;

    if (!users || users.length === 0) {
        users = await apiRequest("/api/users");
        appState.cachedUsers = users;
    }
    const list = document.getElementById("userList");

    list.innerHTML = "";

    users.forEach(user => {

        const div = document.createElement("div");

        const roleClass =
            user.role === "owner" ? "user-owner" :
                user.role === "admin" ? "user-admin" :
                    "user-normal";

        const isOwner = appState.userRole === "owner";
        const isAdmin = appState.userRole === "admin";

        const canDelete =
            isOwner ||
            (isAdmin && user.role === "user");

        div.className = `user-card ${roleClass}`;

        div.innerHTML = `
            <div class="user-card-header">
                <div>
                    <div class="user-name">${user.name}</div>
                    <div class="user-role">${user.role}</div>
                </div>

                <div class="user-actions">

                    <button onclick="showEditUser('${user._id}')">✏️</button>
                    <button onclick="showUserPermissions('${user._id}')">🔐</button>

                    ${canDelete ? `
                        <button onclick="deleteUser('${user._id}')">🗑</button>
                    ` : ""}

                </div>
            </div>
        `;

        list.appendChild(div);
    });

    showCreateUserForm();
}

export function showCreateUserForm() {
    const right = document.getElementById("userContent");

    if (appState.userRole === "user") {
        right.innerHTML = "";
        return;
    }

    right.innerHTML = `
    <div class="user-form-card">
        <h3>Create User</h3>

        <div class="form-group">
            <label>Name</label>
            <input id="newUserName" placeholder="Name">
        </div>

        <div class="form-group">
            <label>Phone</label>
            <input id="newUserPhone" placeholder="03XXXXXXXXX">
        </div>

        <div class="form-group">
            <label>Password</label>
            <input id="newUserPassword" type="password">
        </div>

        <div class="form-group">
            <label>Role</label>
            <select id="newUserRole"></select>
        </div>

        <button class="btn-primary" onclick="createUser()">
            ➕ Create User
        </button>
    </div>
`;

    populateRoleDropdown();
}

export async function deleteUser(userId) {

    if (!confirm("Delete this user?")) return;

    await apiRequest(`/api/users/${userId}`, {
        method: "DELETE"
    });

    alert("Deleted");
    loadUserPermissions();
}
export async function showUserPermissions(userId) {

    const right = document.getElementById("userContent");
    if (!right) return;

    const user = await apiRequest(`/api/users/${userId}`);

    let html = `<div class="permission-container">
        <h3>${user.name} Permissions</h3>`;

    Object.entries(PERMISSION_GROUPS).forEach(([key, group]) => {

        const allChecked = group.permissions.every(p =>
            user.permissions?.includes(p)
        );

        html += `
            <div class="permission-card">
                <div class="permission-header">
                    <span>${group.label}</span>

                    <label class="switch">
                        <input type="checkbox"
                            ${allChecked ? "checked" : ""}
                            onchange="toggleGroup('${userId}', '${key}', this.checked)">
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="permission-list">
        `;

        // ✅ SINGLE LOOP (CORRECT)
        group.permissions.forEach(p => {

            // ✅ ADMIN RESTRICTIONS
            if (appState.userRole === "admin") {
                if (
                    p === "EDIT_DEVICE" ||
                    p === "DELETE_DEVICE" ||
                    p === "ASSIGN_DEVICE" ||
                    p === "RENEW_DEVICE"
                ) {
                    return;
                }
            }

            const checked = user.permissions?.includes(p) ? "checked" : "";

            html += `
                <label class="permission-item">
                    <span>${PERMISSION_LABELS[p]}</span>
                    <label class="switch">
                        <input type="checkbox"
                            data-permission="${p}"
                            ${checked}
                            onchange="togglePermission('${userId}','${p}', this.checked)">
                        <span class="slider"></span>
                    </label>
                </label>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += `
        <button class="btn-save-permissions" onclick="savePermissions('${userId}')">
            💾 Save Permissions
        </button>
    </div>
    `;

    right.innerHTML = html;
}
export async function showEditUser(userId) {

    const right = document.getElementById("userContent");

    // 🔥 FIRST render HTML
    right.innerHTML = `
        <div class="user-form-card">
            <h3>Edit User</h3>

            <div class="form-group">
                <label>Full Name</label>
                <input id="editUserName" placeholder="Update Name">
            </div>

            <div class="form-group">
                <label>Mobile Number</label>
                <input id="editUserPhone" placeholder="03XXXXXXXXX">
            </div>

            <button class="btn-save-user" onclick="updateUser('${userId}')">
                Save Changes
            </button>
        </div>
    `;

    // 🔥 THEN fetch user
    const user = await apiRequest(`/api/users/${userId}`);

    // 🔥 NOW elements exist
    document.getElementById("editUserName").value = user.name || "";
    document.getElementById("editUserPhone").value = user.phoneNumber || "";
    originalPhone = user.phoneNumber;
}
export async function updateUser(userId) {

    const name = document.getElementById("editUserName").value.trim();
    const phone = document.getElementById("editUserPhone").value
        .trim()
        .replace(/\s+/g, "");
    console.log("Phone raw:", document.getElementById("editUserPhone").value);
    console.log("Phone trimmed:", phone);
    console.log("Length:", phone.length);
    if (!name || !phone) {
        alert("Fill all fields");
        return;
    }
    if (phone !== originalPhone) {
        if (!phone.match(/^03\\d{9}$/)) {
            alert("Enter valid mobile number");
            return;
        }
    }
    await apiRequest(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({
            name,
            phoneNumber: phone
        })
    });

    alert("User updated");
    loadUserPermissions();
}
export function toggleGroup(userId, groupKey, isChecked) {

    const group = PERMISSION_GROUPS[groupKey];

    // 🔥 Update permissionChanges
    if (!permissionChanges[userId]) {
        permissionChanges[userId] = new Set();
    }

    group.permissions.forEach(p => {
        if (isChecked) {
            permissionChanges[userId].add(p);
        } else {
            permissionChanges[userId].delete(p);
        }
    });

    // 🔥 ALSO update UI instantly
    group.permissions.forEach(p => {
        const inputs = document.querySelectorAll(`input[data-permission="${p}"]`);
        inputs.forEach(input => input.checked = isChecked);
    });
};
export function togglePermission(userId, permission, isChecked) {

    if (!permissionChanges[userId]) {
        permissionChanges[userId] = new Set();
    }

    if (isChecked) {
        permissionChanges[userId].add(permission);
    } else {
        permissionChanges[userId].delete(permission);
    }
}
export async function savePermissions(userId) {

    const container = document.getElementById("userContent");
    const inputs = container.querySelectorAll(".permission-item input");

    const perms = [];

    inputs.forEach(input => {
        if (input.checked) {
            const perm = input.dataset.permission;
            if (perm) perms.push(perm);
        }
    });

    await apiRequest(`/api/auth/permissions/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ permissions: perms })
    });

    const alertUI = window.alertUI;
    alertUI?.showToast("Permissions updated", "success");

    loadUserPermissions(); // ✅ correct call
};

export function populateRoleDropdown() {

    const roleSelect = document.getElementById("newUserRole");
    if (!roleSelect) return;

    roleSelect.innerHTML = "";

    const currentRole = appState.userRole;
    // 👑 OWNER → Admin + User
    if (currentRole === "owner") {

        const adminOption = document.createElement("option");
        adminOption.value = "admin";
        adminOption.textContent = "Admin";
        roleSelect.appendChild(adminOption);

        const userOption = document.createElement("option");
        userOption.value = "user";
        userOption.textContent = "User";
        roleSelect.appendChild(userOption);
    }

    // 🏢 ADMIN → Only User
    else if (currentRole === "admin") {

        const userOption = document.createElement("option");
        userOption.value = "user";
        userOption.textContent = "User";
        roleSelect.appendChild(userOption);
    }
}