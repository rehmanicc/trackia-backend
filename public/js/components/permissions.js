export function getUserPermissions() {
  const token = localStorage.getItem("token");
  if (!token) return [];

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.permissions || [];
  } catch {
    return [];
  }
}

export function hasPermission(permission) {
  if (window.userRole === "owner") return true;

  const perms = getUserPermissions();
  return perms.includes(permission);
}