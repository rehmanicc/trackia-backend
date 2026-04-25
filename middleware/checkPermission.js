const PERMISSIONS = require("../config/permissions");

module.exports = function (requiredPermission) {
  return (req, res, next) => {

    const user = req.user;

    // 👑 OWNER → FULL ACCESS
    if (user.role === "owner") {
      return next();
    }

    // 🧑‍💼 ADMIN DEFAULT POWERS
    const adminDefaults = [
      PERMISSIONS.CREATE_USER,
      PERMISSIONS.EDIT_USER,
      PERMISSIONS.DELETE_USER,
      PERMISSIONS.CREATE_DEVICE,
      PERMISSIONS.EDIT_DEVICE,
      PERMISSIONS.DELETE_DEVICE,
      PERMISSIONS.GEOFENCE_CREATE,
      PERMISSIONS.GEOFENCE_EDIT,
      PERMISSIONS.GEOFENCE_DELETE,
      PERMISSIONS.SEND_COMMAND,
    ];

    if (user.role === "admin") {
      if (
        adminDefaults.includes(requiredPermission) ||
        user.permissions?.includes(requiredPermission)
      ) {
        return next();
      }

      return res.status(403).json({ error: "Permission denied" });
    }

    // 👤 USER → STRICT PERMISSION
    if (user.permissions?.includes(requiredPermission)) {
      return next();
    }

    return res.status(403).json({ error: "Permission denied" });
  };
};