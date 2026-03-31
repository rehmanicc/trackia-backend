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

 const text = await res.text();

try {
  return JSON.parse(text);
} catch (e) {
  console.error("❌ Non-JSON response:", text);
  throw new Error("Server returned invalid response");
}
}