import { apiRequest } from "../services/apiService.js";

// ===============================
// OPEN MODAL + LOAD DATA
// ===============================
export async function openExpiredDevices() {

    document.getElementById("expiredModal")?.classList.remove("hidden");

    try {
        const devices = await apiRequest("/api/devices");

        const now = new Date();

        const expired = devices.filter(d =>
            d.expiryDate && new Date(d.expiryDate) < now
        );

        renderExpiredDevices(expired);

    } catch (err) {
        console.error(err);
        alert("Failed to load expired devices");
    }
}

// ===============================
// RENDER
// ===============================
function renderExpiredDevices(devices) {

    const container = document.getElementById("expiredList");

    if (!container) return;

    if (!devices.length) {
        container.innerHTML = "<p>No expired devices</p>";
        return;
    }

    container.innerHTML = devices.map(d => `

        <div class="user-card expired-card">

            <div class="user-card-header">
                <div>
                    <div class="user-name">${d.name}</div>
                    <div class="user-role">
                        Expired: ${new Date(d.expiryDate).toLocaleDateString()}
                    </div>
                </div>

                <div class="user-actions">

                    <button class="btn-icon"
                        onclick="renewDevice('${d._id}')"
                        title="Renew">
                        🔄
                    </button>

                    <button class="btn-icon btn-delete"
                        onclick="deleteDevice('${d._id}')"
                        title="Delete">
                        🗑
                    </button>

                </div>
            </div>

        </div>

    `).join("");
}

// ===============================
// CLOSE MODAL
// ===============================
export function closeExpiredDevices() {
    document.getElementById("expiredModal")?.classList.add("hidden");
}

// ===============================
// RENEW DEVICE
// ===============================
export async function renewDevice(deviceId) {

    if (!confirm("Renew this device?")) return;

    try {
        await apiRequest(`/api/devices/renew/${deviceId}`, {
            method: "POST"
        });

        alert("Device renewed");

        // 🔄 reload list
        openExpiredDevices();

    } catch (err) {
        console.error(err);
        alert("Renew failed");
    }
}