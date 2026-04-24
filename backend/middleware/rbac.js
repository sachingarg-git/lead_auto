/**
 * RBAC middleware factory.
 * Usage: router.get('/route', authenticate, authorize('leads:write'), handler)
 *
 * Permissions stored as JSON array in Roles table.
 * '*' grants all permissions (Admin).
 */
function authorize(...requiredPermissions) {
  return (req, res, next) => {
    const userPerms = req.user?.permissions || [];

    // Wildcard = Admin
    if (userPerms.includes('*')) return next();

    const hasAll = requiredPermissions.every(perm => userPerms.includes(perm));
    if (!hasAll) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
      });
    }
    next();
  };
}

/**
 * Restrict to Admin role only.
 */
function adminOnly(req, res, next) {
  if (req.user?.role_name !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authorize, adminOnly };
