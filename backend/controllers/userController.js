const User = require('../models/User');
const { query } = require('../config/database');
const logger = require('../config/logger');

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

module.exports = { listUsers, createUser, updateUser, toggleUserActive, listRoles };
