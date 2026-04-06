function renderAlerts(alerts = []) {

    const container = document.getElementById("alertList");
    if (!container) return;

    container.innerHTML = "";

    alerts.forEach(a => {

        const div = document.createElement("div");

        div.className = "alert-card";

        if (a.type.includes("ENTER")) {
            div.classList.add("alert-enter");
        }
        else if (a.type.includes("EXIT")) {
            div.classList.add("alert-exit");
        }
        else if (a.type.includes("ENGINE_ON")) {
            div.classList.add("alert-engine-on");
        }
        else if (a.type.includes("ENGINE_OFF")) {
            div.classList.add("alert-engine-off");
        }
        else if (a.type.includes("OVERSPEED")) {
            div.classList.add("alert-overspeed");
        }

        div.classList.add(a.read === true ? "read" : "unread");

        div.innerHTML = `
            ${a.message}<br>
            <small>${new Date(a.timestamp).toLocaleTimeString()}</small>
        `;
        div.onclick = () => markAlertRead(a.timestamp);

        container.appendChild(div);
    });
}

function showToast(message, type = "success") {
    let container = document.getElementById("toastContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;
    toast.style.marginTop = "10px";

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

window.alertUI = {
    renderAlerts,
    showToast
};