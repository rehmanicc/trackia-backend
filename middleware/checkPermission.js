const PERMISSIONS = require("../config/permissions");

module.exports = function (requiredPermission) {
  return (req, res, next) => {
    const user = req.user;

    // 👑 OWNER → FULL ACCESS
    if (user.role === "owner") return next();

    // 🔐 STRICT PERMISSION
    if (user.permissions?.includes(requiredPermission)) {
      return next();
    }

    return res.status(403).json({ error: "Permission denied" });
  };
};