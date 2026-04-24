const { query } = require('../config/database');

const FollowUp = {
  async create({ lead_id, status, note, next_followup_date, created_by }) {
    const result = await query(
      `INSERT INTO FollowUps (lead_id, status, note, next_followup_date, created_by)
       OUTPUT INSERTED.*
       VALUES (@lead_id, @status, @note, @next_followup_date, @created_by)`,
      {
        lead_id,
        status,
        note: note || null,
        next_followup_date: next_followup_date || null,
        created_by: created_by || null,
      }
    );
    return result.recordset[0];
  },

  async findByLeadId(lead_id) {
    const result = await query(
      `SELECT f.*, u.name AS created_by_name
       FROM FollowUps f
       LEFT JOIN Users u ON f.created_by = u.id
       WHERE f.lead_id = @lead_id
       ORDER BY f.created_at DESC`,
      { lead_id }
    );
    return result.recordset;
  },
};

module.exports = FollowUp;
