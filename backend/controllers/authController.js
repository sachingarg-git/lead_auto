const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { query } = require('../config/database');
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

// ── Self-service: Change own password ────────────────────────
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    // Fetch password_hash (not included in findById for safety)
    const row = await query(
      'SELECT password_hash FROM "Users" WHERE id = @id',
      { id: req.user.id }
    ).then(r => r.recordset[0]);

    if (!row) return res.status(404).json({ error: 'User not found' });

    const valid = await User.verifyPassword(currentPassword, row.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    await User.resetPassword(req.user.id, newPassword);
    logger.info(`[auth] Password changed for user ${req.user.id}`);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    logger.error('changePassword error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

// ── Self-service: Set / change own Green PIN ─────────────────
async function changePinSelf(req, res) {
  try {
    const { currentPin, newPin, confirmPin } = req.body;
    if (!newPin || !confirmPin) {
      return res.status(400).json({ error: 'New PIN and confirmation are required' });
    }
    if (!/^\d{6}$/.test(String(newPin))) {
      return res.status(400).json({ error: 'PIN must be exactly 6 digits (numbers only)' });
    }
    if (String(newPin) !== String(confirmPin)) {
      return res.status(400).json({ error: 'PINs do not match' });
    }

    // Check current PIN state
    const row = await query(
      'SELECT pin_enabled, green_pin FROM "Users" WHERE id = @id',
      { id: req.user.id }
    ).then(r => r.recordset[0]);

    if (!row) return res.status(404).json({ error: 'User not found' });

    // If PIN is already set, verify current PIN before allowing change
    if (row.pin_enabled && row.green_pin) {
      if (!currentPin) {
        return res.status(400).json({ error: 'Enter your current PIN to change it' });
      }
      const valid = await User.verifyPin(req.user.id, String(currentPin).trim());
      if (!valid) return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    await User.setPin(req.user.id, String(newPin));
    logger.info(`[auth] PIN set/changed for user ${req.user.id}`);
    res.json({ success: true, message: 'PIN updated. 2FA is now active on your account.' });
  } catch (err) {
    logger.error('changePinSelf error:', err);
    res.status(500).json({ error: 'Failed to update PIN' });
  }
}

// ── Self-service: Remove own PIN ──────────────────────────────
async function removePinSelf(req, res) {
  try {
    const { currentPin } = req.body;
    if (!currentPin) return res.status(400).json({ error: 'Current PIN is required' });

    const valid = await User.verifyPin(req.user.id, String(currentPin).trim());
    if (!valid) return res.status(401).json({ error: 'Current PIN is incorrect' });

    await User.removePin(req.user.id);
    logger.info(`[auth] PIN removed for user ${req.user.id}`);
    res.json({ success: true, message: 'PIN removed. 2FA is now disabled.' });
  } catch (err) {
    logger.error('removePinSelf error:', err);
    res.status(500).json({ error: 'Failed to remove PIN' });
  }
}

module.exports = { login, verifyPin, me, changePassword, changePinSelf, removePinSelf };
