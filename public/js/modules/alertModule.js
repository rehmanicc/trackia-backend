import { onAlert } from "/js/services/socketService.js";
import { apiRequest } from "/js/services/apiService.js";

let alertList = [];
let clearedTimestamps = new Set();

export function initAlertModule() {
    loadAlertsFromStorage();
    loadCleared();
    loadInitialAlerts();
    onAlert((alert) => {

        console.log("🚨 ALERT RECEIVED:", alert);
        const key = `${alert.deviceId}_${alert.type}_${alert.timestamp}`;

        if (alertList.some(a =>
            `${a.deviceId}_${a.type}_${a.timestamp}` === key
        )) {
            return;
        }
        alert.read = false;
        alertList.unshift(alert);
        saveAlertsToStorage();
        if (window.alertUI?.renderAlerts) {
            window.alertUI.renderAlerts(alertList);
        }
        const type = alert.priority === "high" ? "error" : "success";
        if (window.alertUI?.showToast) {
            window.alertUI.showToast(alert.message, type);
        }
    });
}
window.markAlertRead = function (timestamp) {

    alertList = alertList.map(a => {
        if (String(a.timestamp) === String(timestamp)) {
            a.read = !a.read;
        }
        return a;
    });

    saveAlertsToStorage();

    if (window.alertUI?.renderAlerts) {
    window.alertUI.renderAlerts(alertList);
}
};
window.clearReadAlerts = function () {

    alertList.forEach(a => {
        if (a.read === true) {
            clearedTimestamps.add(String(a.timestamp));
        }
    });
    alertList = alertList.filter(a => !a.read);
    saveAlertsToStorage();
    saveCleared();
    if (window.alertUI?.renderAlerts) {
    window.alertUI.renderAlerts(alertList);
}
};
function saveCleared() {
    localStorage.setItem("clearedAlerts", JSON.stringify([...clearedTimestamps]));
}

function loadCleared() {
    const data = localStorage.getItem("clearedAlerts");
    if (data) {
        clearedTimestamps = new Set(JSON.parse(data));
    }
}
function saveAlertsToStorage() {
    localStorage.setItem("alerts", JSON.stringify(alertList));
}

function loadAlertsFromStorage() {
    const data = localStorage.getItem("alerts");

    if (data) {
        const parsed = JSON.parse(data);
        alertList = parsed.map(a => ({
            ...a,
            read: a.read === true
        }));
    }
}
window.filterAlerts = function (type) {

    let filtered = [...alertList];

    if (type === "high") {
        filtered = filtered.filter(a => a.priority === "high");
    }

    if (type === "unread") {
        filtered = filtered.filter(a => a.read === false);
    }

    if (window.alertUI?.renderAlerts) {
    window.alertUI.renderAlerts(filtered);
}
};
window.clearAllAlerts = function () {
    if (!confirm("Clear all alerts?")) return;

    alertList = [];
    clearedTimestamps.clear();

    localStorage.removeItem("alerts");
    localStorage.removeItem("clearedAlerts");

    if (window.alertUI?.renderAlerts) {
    window.alertUI.renderAlerts([]);
}
};
export async function loadInitialAlerts() {

    try {
        const data = await apiRequest("/api/alerts");

        const existing = alertList;

        alertList = data
            .filter(a => !clearedTimestamps.has(String(a.timestamp))) // ✅ ADD THIS
            .map(a => {
                const found = existing.find(e =>
                    e.deviceId === a.deviceId &&
                    new Date(e.timestamp).getTime() === new Date(a.timestamp).getTime()
                );

                return {
                    ...a,
                    read: found?.read === true
                };
            });

        if (window.alertUI?.renderAlerts) {
    window.alertUI.renderAlerts(alertList);
}

    } catch (err) {
        console.error("❌ Failed to load alerts", err);
    }
}