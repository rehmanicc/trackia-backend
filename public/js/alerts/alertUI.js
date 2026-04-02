function renderAlerts(alerts = []) {

    const container = document.getElementById("alertList");
    if (!container) return;

    container.innerHTML = "";

    alerts.forEach(a => {

        const div = document.createElement("div");

        div.style.borderBottom = "1px solid #ddd";
        div.style.padding = "6px";
        div.style.marginBottom = "3px";

        if (a.type.includes("ENTER")) {
            div.style.background = "#d4edda";
        }
        else if (a.type.includes("EXIT")) {
            div.style.background = "#f8d7da";
        }
        else if (a.type.includes("ENGINE_ON")) {
            div.style.background = "#d1ecf1";
        }
        else if (a.type.includes("ENGINE_OFF")) {
            div.style.background = "#fff3cd";
        }

        div.innerHTML = `
            ${a.message}<br>
            <small>${new Date(a.timestamp || Date.now()).toLocaleTimeString()}</small>
        `;

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