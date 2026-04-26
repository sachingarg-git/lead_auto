const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB (catches deactivated accounts)
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role_id, u.is_active, r.name AS role_name, r.permissions
       FROM "Users" u JOIN "Roles" r ON u.role_id = r.id
       WHERE u.id = @id`,
      { id: decoded.userId }
    );

    if (!result.recordset.length || !result.recordset[0].is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated' });
    }

    const user = result.recordset[0];
    user.permissions = JSON.parse(user.permissions);
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticate };
