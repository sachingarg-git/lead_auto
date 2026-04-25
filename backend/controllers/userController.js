const User = require('../models/User');
const { query } = require('../config/database');
const logger = require('../config/logger');
const crypto = require('crypto');

async function listUsers(req, res) {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    logger.error('listUsers error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password, role_id } = req.body;
    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ error: 'name, email, password and role_id are required' });
    }

    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = await User.create({ name, email, password, role_id, created_by: req.user.id });
    logger.info(`New user created: ${email} by ${req.user.email}`);
    res.status(201).json(user);
  } catch (err) {
    logger.error('createUser error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

async function updateUser(req, res) {
  try {
    const updated = await User.update(parseInt(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    logger.error('updateUser error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

async function toggleUserActive(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.setActive(id, !user.is_active);
    res.json({ message: `User ${user.is_active ? 'deactivated' : 'activated'}` });
  } catch (err) {
    logger.error('toggleUserActive error:', err);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
}

async function listRoles(req, res) {
  try {
    const result = await query('SELECT id, name FROM Roles ORDER BY id');
    res.json(result.recordset);
  } catch (err) {
    logger.error('listRoles error:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
}

// ── Admin: Reset Password ─────────────────────────────────────
async function resetPassword(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate a secure random password: "Wz" + 6 random chars + "!" + 2 digits
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    const digits = Math.floor(10 + Math.random() * 90);
    const newPassword = `Wz${rand}!${digits}`;

    await User.resetPassword(id, newPassword);
    logger.info(`Password reset for user ${id} by admin ${req.user.email}`);

    // Return the plain password ONCE — admin must share it with the user
    res.json({ new_password: newPassword, message: 'Password reset successfully. Share this password with the user.' });
  } catch (err) {
    logger.error('resetPassword error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
}

// ── Admin: Generate Green PIN ─────────────────────────────────
async function generatePin(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate 6-digit PIN
    const pin = String(Math.floor(100000 + Math.random() * 900000));

    await User.setPin(id, pin);
    logger.info(`Green PIN generated for user ${id} by admin ${req.user.email}`);

    // Return PIN once — admin shares with user
    res.json({ pin, message: 'Green PIN set. Share this 6-digit PIN with the user. It will not be shown again.' });
  } catch (err) {
    logger.error('generatePin error:', err);
    res.status(500).json({ error: 'Failed to generate PIN' });
  }
}

// ── Admin: Remove Green PIN ───────────────────────────────────
async function removePin(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.removePin(id);
    logger.info(`Green PIN removed for user ${id} by admin ${req.user.email}`);
    res.json({ message: '2FA PIN removed. User can now log in with password only.' });
  } catch (err) {
    logger.error('removePin error:', err);
    res.status(500).json({ error: 'Failed to remove PIN' });
  }
}

module.exports = {
  listUsers, createUser, updateUser, toggleUserActive, listRoles,
  resetPassword, generatePin, removePin,
};
