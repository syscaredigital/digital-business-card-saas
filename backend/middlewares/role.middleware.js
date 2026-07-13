module.exports = function authorize(...allowedRoles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to access this resource" });
    }
    next();
  };
};
