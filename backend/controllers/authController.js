const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

/** Generate full session token */
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/** Generate short-lived temp token while waiting for PIN */
function generateTempToken(userId) {
  return jwt.sign({ userId, pinPending: true }, process.env.JWT_SECRET, {
    expiresIn: '15m', // 15 minutes to enter PIN (extended from 5m)
  });
}

/** Verify temp token and return userId */
function decodeTempToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.pinPending) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

/** Build safe user object (no hashes) */
function safeUser(user) {
  const { password_hash, green_pin, ...safe } = user;
  if (safe.permissions && typeof safe.permissions === 'string') {
    safe.permissions = JSON.parse(safe.permissions);
  }
  return safe;
}

// ── Step 1: email + password ──────────────────────────────────
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

    // ── 2FA: if PIN is enabled, return temp token instead ────
    if (user.pin_enabled) {
      const temp_token = generateTempToken(user.id);
      logger.info(`2FA PIN required for: ${user.email}`);
      return res.json({
        requires_pin: true,
        temp_token,
        user_name: user.name, // so UI can greet user by name
      });
    }

    // ── No PIN: normal login ────────────────────────────────
    await User.updateLastLogin(user.id);
    const token = generateToken(user.id);
    logger.info(`User logged in: ${user.email}`);
    res.json({ token, user: safeUser(user) });

  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

// ── Step 2: verify Green PIN ──────────────────────────────────
async function verifyPin(req, res) {
  try {
    const { temp_token, pin } = req.body;
    if (!temp_token || !pin) {
      return res.status(400).json({ error: 'temp_token and pin are required' });
    }

    const userId = decodeTempToken(temp_token);
    if (!userId) {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    const valid = await User.verifyPin(userId, String(pin).trim());
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect Green PIN' });
    }

    const user = await User.findById(userId);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account not found or inactive' });
    }

    await User.updateLastLogin(userId);
    const token = generateToken(userId);

    logger.info(`2FA verified and logged in: ${user.email}`);
    res.json({ token, user: safeUser(user) });

  } catch (err) {
    logger.error('verifyPin error:', err);
    res.status(500).json({ error: 'PIN verification failed' });
  }
}

// ── Profile ──────────────────────────────────────────────────
async function me(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(safeUser(user));
  } catch (err) {
    logger.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

module.exports = { login, verifyPin, me };
