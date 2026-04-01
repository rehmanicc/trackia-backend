function renderAlerts() {

    const container = document.getElementById("alertList");
    container.innerHTML = "";

    // 🔹 Get filter values
    const typeFilter = document.getElementById("alertTypeFilter")?.value || "all";
    const search = document.getElementById("vehicleSearch")?.value || "";

    // 🔹 APPLY FILTERS
    const allAlerts = window.alertManager?.getAlerts() || [];
    let filteredAlerts = allAlerts;        // Filter by type
    if (typeFilter !== "all") {
        filteredAlerts = filteredAlerts.filter(a => a.type === typeFilter);
    }

    // Search by vehicle ID
    if (search) {
        filteredAlerts = filteredAlerts.filter(a =>
            a.deviceId.toString().includes(search)
        );
    }

    // 🔹 GROUP BY VEHICLE
    const grouped = {};

    filteredAlerts.forEach(a => {
        if (!grouped[a.deviceId]) {
            grouped[a.deviceId] = [];
        }
        grouped[a.deviceId].push(a);
    });

    // 🔹 RENDER GROUPS
    Object.keys(grouped).forEach(deviceId => {

        // 🚗 Vehicle header
        const header = document.createElement("div");
        header.style.background = "#eee";
        header.style.padding = "6px";
        header.style.fontWeight = "bold";
        header.style.borderBottom = "1px solid #ccc";

        header.innerHTML = `🚗 Vehicle ${deviceId}`;
        container.appendChild(header);

        // 🔹 Alerts under this vehicle
        grouped[deviceId].forEach(a => {

            const div = document.createElement("div");

            div.style.borderBottom = "1px solid #ddd";
            div.style.padding = "6px";
            div.style.marginBottom = "3px";

            if (a.type.includes("enter")) {
                div.style.background = "#d4edda"; // green
            }
            else if (a.type.includes("exit")) {
                div.style.background = "#f8d7da"; // red
            }
            else if (a.type.includes("engine_on")) {
                div.style.background = "#d1ecf1"; // blue
            }
            else if (a.type.includes("engine_off")) {
                div.style.background = "#fff3cd"; // yellow
            }

            div.innerHTML = `
                ${a.message}<br>
                <small>${a.time.toLocaleTimeString()}</small>
            `;

            container.appendChild(div);
        });

    });
}
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
window.alertUI = {
    renderAlerts,
    showToast
};