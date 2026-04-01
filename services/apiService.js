const BASE_URL = "https://trackia-backend.onrender.com";

export async function apiRequest(path, options = {}) {

    const token = localStorage.getItem("token");

    try {
        const res = await fetch(BASE_URL + path, {
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": "Bearer " + token }),
                ...(options.headers || {})
            },
            ...options
        });

        const text = await res.text();

        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            throw new Error("Invalid JSON response");
        }

        if (!res.ok) {
            throw new Error(data.message || "API Error");
        }

        return data;

    } catch (err) {
        console.error("❌ API ERROR:", err.message);
        throw err;
    }
}