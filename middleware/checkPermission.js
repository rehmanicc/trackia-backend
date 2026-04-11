module.exports = function (requiredPermission) {
  return (req, res, next) => {

    const user = req.user;

    // ✅ Owner = full access
    if (user.role === "owner") {
      return next();
    }

    // ✅ Everyone else must have permission
    if (!user.permissions || !user.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        error: "Permission denied"
      });
    }

    next();
  };
};