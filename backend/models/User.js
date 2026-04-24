const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const User = {
  async create({ name, email, password, role_id, created_by }) {
    const password_hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO Users (name, email, password_hash, role_id, created_by)
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role_id, INSERTED.is_active, INSERTED.created_at
       VALUES (@name, @email, @password_hash, @role_id, @created_by)`,
      { name, email, password_hash, role_id, created_by: created_by || null }
    );
    return result.recordset[0];
  },

  async findByEmail(email) {
    const result = await query(
      `SELECT u.*, r.name AS role_name, r.permissions
       FROM Users u JOIN Roles r ON u.role_id = r.id
       WHERE u.email = @email`,
      { email }
    );
    return result.recordset[0] || null;
  },

  async findById(id) {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role_id, u.is_active, u.avatar_url, u.last_login, u.created_at,
              r.name AS role_name, r.permissions
       FROM Users u JOIN Roles r ON u.role_id = r.id
       WHERE u.id = @id`,
      { id }
    );
    return result.recordset[0] || null;
  },

  async findAll() {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role_id, u.is_active, u.avatar_url, u.last_login, u.created_at,
              r.name AS role_name
       FROM Users u JOIN Roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );
    return result.recordset;
  },

  async updateLastLogin(id) {
    await query('UPDATE Users SET last_login = GETDATE() WHERE id = @id', { id });
  },

  async verifyPassword(plainText, hash) {
    return bcrypt.compare(plainText, hash);
  },

  async setActive(id, is_active) {
    await query('UPDATE Users SET is_active = @is_active WHERE id = @id', { id, is_active });
  },

  async update(id, data) {
    const allowed = ['name', 'email', 'role_id', 'avatar_url'];
    const updates = Object.fromEntries(
      Object.entries(data).filter(([k]) => allowed.includes(k))
    );
    if (!Object.keys(updates).length) return null;
    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    const result = await query(
      `UPDATE Users SET ${fields} OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role_id, INSERTED.is_active WHERE id = @id`,
      { ...updates, id }
    );
    return result.recordset[0];
  },
};

module.exports = User;
