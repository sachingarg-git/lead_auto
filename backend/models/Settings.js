const { query } = require('../config/database');

const Settings = {
  /** Return all settings as a plain key→value object */
  async getAll() {
    const result = await query('SELECT key_name, val FROM AppSettings');
    return result.recordset.reduce((acc, r) => {
      acc[r.key_name] = r.val;
      return acc;
    }, {});
  },

  /** Save multiple settings at once (upsert) */
  async setMany(map) {
    for (const [key, val] of Object.entries(map)) {
      await query(
        `IF EXISTS (SELECT 1 FROM AppSettings WHERE key_name = @k)
           UPDATE AppSettings SET val = @v, updated_at = GETDATE() WHERE key_name = @k
         ELSE
           INSERT INTO AppSettings (key_name, val) VALUES (@k, @v)`,
        { k: key, v: val !== undefined && val !== null ? String(val) : null }
      );
    }
  },

  /** Get a single value (returns null if missing) */
  async get(key) {
    const result = await query(
      'SELECT val FROM AppSettings WHERE key_name = @k',
      { k: key }
    );
    return result.recordset[0]?.val ?? null;
  },
};

module.exports = Settings;
