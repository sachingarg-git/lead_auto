const { query } = require('../config/database');

const Settings = {
  /** Return all settings as a plain key→value object */
  async getAll() {
    const result = await query('SELECT key_name, val FROM "AppSettings"');
    return result.recordset.reduce((acc, r) => {
      acc[r.key_name] = r.val;
      return acc;
    }, {});
  },

  /** Save multiple settings at once (upsert via ON CONFLICT) */
  async setMany(map) {
    for (const [key, val] of Object.entries(map)) {
      await query(
        `INSERT INTO "AppSettings" (key_name, val, updated_at)
         VALUES (@k, @v, NOW())
         ON CONFLICT (key_name) DO UPDATE
           SET val = EXCLUDED.val, updated_at = NOW()`,
        { k: key, v: val !== undefined && val !== null ? String(val) : null }
      );
    }
  },

  /** Get a single value (returns null if missing) */
  async get(key) {
    const result = await query(
      'SELECT val FROM "AppSettings" WHERE key_name = @k',
      { k: key }
    );
    return result.recordset[0]?.val ?? null;
  },
};

module.exports = Settings;
