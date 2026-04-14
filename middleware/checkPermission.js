module.exports = function (requiredPermission) {
  return (req, res, next) => {

    const user = req.user;

    // ✅ OWNER → FULL ACCESS
    if (user.role === "owner") {
      return next();
    }

    // ❌ ADMIN + USER must follow permissions
    if (!user.permissions || !user.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        error: "Permission denied"
      });
    }

    next();
  };
};