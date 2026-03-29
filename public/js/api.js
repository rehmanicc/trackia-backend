const BASE_URL = "https://trackia-backend.onrender.com";

function getToken() {
  return localStorage.getItem("token");
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  const res = await fetch(BASE_URL + endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: "Bearer " + token
    }
  });

  // 🔥 HANDLE TOKEN FIRST
  if (res.status === 401) {
    alert("Session expired. Please login again.");
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return;
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ API Error:", text);
    throw new Error(text);
  }

  return res.json();
}