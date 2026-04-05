import { onAlert } from "/js/services/socketService.js";
import { apiRequest } from "/js/services/apiService.js";

let alertList = [];

export function initAlertModule() {
    loadAlertsFromStorage();
    loadInitialAlerts();

    onAlert((alert) => {

        console.log("🚨 ALERT RECEIVED:", alert);
        const exists = alertList.find(a =>
            a.deviceId === alert.deviceId &&
            a.type === alert.type &&
            new Date(a.timestamp).getTime() === new Date(alert.timestamp).getTime()
        );

        if (exists) return;
        alert.read = false;
        alertList.unshift(alert);
        saveAlertsToStorage();
        window.alertUI.renderAlerts(alertList);
        window.alertUI.showToast(alert.message, "error");
    });
}
window.markAlertRead = function (timestamp) {

    alertList = alertList.map(a => {
        if (String(a.timestamp) === String(timestamp)) {
            a.read = true;
        }
        return a;
    });

    saveAlertsToStorage();

    window.alertUI.renderAlerts(alertList);
};
window.clearReadAlerts = function () {

    alertList = alertList.filter(a => !a.read);
    saveAlertsToStorage();

    window.alertUI.renderAlerts(alertList);
};
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
export async function loadInitialAlerts() {

    try {
        const data = await apiRequest("/api/alerts");

        const existing = alertList;

        alertList = data.map(a => {
            const found = existing.find(e =>
                e.deviceId === a.deviceId &&
                new Date(e.timestamp).getTime() === new Date(a.timestamp).getTime()
            );

            return {
                ...a,
                read: found?.read === true
            };
        });

        window.alertUI.renderAlerts(alertList);

    } catch (err) {
        console.error("❌ Failed to load alerts", err);
    }
}