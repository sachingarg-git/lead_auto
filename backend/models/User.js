const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const User = {
  async create({ name, email, password, role_id }) {
    const password_hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO "Users" (name, email, password_hash, role_id)
       VALUES (@name, @email, @password_hash, @role_id)
       RETURNING id, name, email, role_id, is_active, created_at`,
      { name, email, password_hash, role_id }
    );
    return result.recordset[0];
  },

  async findByEmail(email) {
    const result = await query(
      `SELECT u.*, r.name AS role_name, r.permissions
       FROM "Users" u JOIN "Roles" r ON u.role_id = r.id
       WHERE u.email = @email`,
      { email }
    );
    return result.recordset[0] || null;
  },

  async findById(id) {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role_id, u.is_active, u.avatar_url, u.last_login, u.created_at,
              u.pin_enabled,
              r.name AS role_name, r.permissions
       FROM "Users" u JOIN "Roles" r ON u.role_id = r.id
       WHERE u.id = @id`,
      { id }
    );
    return result.recordset[0] || null;
  },

  async findAll() {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role_id, u.is_active, u.avatar_url, u.last_login, u.created_at,
              u.pin_enabled,
              r.name AS role_name
       FROM "Users" u JOIN "Roles" r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );
    return result.recordset;
  },

  async updateLastLogin(id) {
    await query('UPDATE "Users" SET last_login = NOW() WHERE id = @id', { id });
  },

  async verifyPassword(plainText, hash) {
    return bcrypt.compare(plainText, hash);
  },

  async setActive(id, is_active) {
    await query('UPDATE "Users" SET is_active = @is_active WHERE id = @id', { id, is_active });
  },

  async update(id, data) {
    const allowed = ['name', 'email', 'role_id', 'avatar_url'];
    const updates = Object.fromEntries(
      Object.entries(data).filter(([k]) => allowed.includes(k))
    );
    if (!Object.keys(updates).length) return null;
    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    const result = await query(
      `UPDATE "Users" SET ${fields} WHERE id = @id RETURNING id, name, email, role_id, is_active`,
      { ...updates, id }
    );
    return result.recordset[0];
  },

  // ── 2FA Green PIN ──────────────────────────────────────────

  /** Hash and store a new PIN, enable 2FA for user */
  async setPin(id, plainPin) {
    const pin_hash = await bcrypt.hash(String(plainPin), 12);
    await query(
      'UPDATE "Users" SET green_pin = @pin_hash, pin_enabled = true WHERE id = @id',
      { id, pin_hash }
    );
  },

  /** Compare plain PIN against stored hash */
  async verifyPin(id, plainPin) {
    const result = await query(
      'SELECT green_pin FROM "Users" WHERE id = @id AND pin_enabled = true',
      { id }
    );
    const row = result.recordset[0];
    if (!row || !row.green_pin) return false;
    return bcrypt.compare(String(plainPin), row.green_pin);
  },

  /** Remove PIN, disable 2FA for user */
  async removePin(id) {
    await query(
      'UPDATE "Users" SET green_pin = NULL, pin_enabled = false WHERE id = @id',
      { id }
    );
  },

  /** Reset a user's password (admin action) */
  async resetPassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, 12);
    await query(
      'UPDATE "Users" SET password_hash = @password_hash WHERE id = @id',
      { id, password_hash }
    );
  },
};

module.exports = User;
