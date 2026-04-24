const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findByEmail(email.toLowerCase().trim());
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await User.verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await User.updateLastLogin(user.id);

    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;
    safeUser.permissions = JSON.parse(safeUser.permissions);

    logger.info(`User logged in: ${user.email}`);
    res.json({ token, user: safeUser });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...safeUser } = user;
    if (safeUser.permissions) safeUser.permissions = JSON.parse(safeUser.permissions);
    res.json(safeUser);
  } catch (err) {
    logger.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

module.exports = { login, me };
