module.exports = function (requiredPermission) {
  return (req, res, next) => {

    const user = req.user;

    // ✅ Owner bypass (super admin)
    if (user.role === "owner") {
      return next();
    }

    // ✅ Admin fallback (temporary compatibility)
    if (user.role === "admin") {
      return next();
    }

    // ✅ Check permission
    if (!user.permissions || !user.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        error: "Permission denied"
      });
    }

    next();
  };
};