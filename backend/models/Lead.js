const { sql, query } = require('../config/database');

const Lead = {
  async create(data) {
    const result = await query(
      `INSERT INTO "Leads" (full_name, email, phone, whatsapp_number, telegram_chat_id,
         source, meta_lead_id, ad_id, ad_name, campaign_id, campaign_name, form_data,
         client_type, meeting_datetime, meeting_link, status, assigned_to, notes, tags,
         company, industry, preferred_slot, slot_date, slot_time, api_key_used)
       VALUES (@full_name, @email, @phone, @whatsapp_number, @telegram_chat_id,
         @source, @meta_lead_id, @ad_id, @ad_name, @campaign_id, @campaign_name, @form_data,
         @client_type, @meeting_datetime, @meeting_link, @status, @assigned_to, @notes, @tags,
         @company, @industry, @preferred_slot, @slot_date, @slot_time, @api_key_used)
       RETURNING *`,
      {
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp_number: data.whatsapp_number || data.phone || null,
        telegram_chat_id: data.telegram_chat_id || null,
        source: data.source || 'Meta',
        meta_lead_id: data.meta_lead_id || null,
        ad_id: data.ad_id || null,
        ad_name: data.ad_name || null,
        campaign_id: data.campaign_id || null,
        campaign_name: data.campaign_name || null,
        form_data: data.form_data ? JSON.stringify(data.form_data) : null,
        client_type: data.client_type || 'Type2',
        meeting_datetime: data.meeting_datetime || null,
        meeting_link: data.meeting_link || null,
        status: data.status || 'New',
        assigned_to: data.assigned_to || null,
        notes: data.notes || null,
        tags: data.tags || null,
        company: data.company || null,
        industry: data.industry || null,
        preferred_slot: data.preferred_slot || null,
        slot_date: data.slot_date || null,
        slot_time: data.slot_time || null,
        api_key_used: data.api_key_used || null,
      }
    );
    return result.recordset[0];
  },

  async findById(id) {
    const result = await query(
      `SELECT l.*, u.name AS assigned_to_name, u.email AS assigned_to_email
       FROM "Leads" l
       LEFT JOIN "Users" u ON l.assigned_to = u.id
       WHERE l.id = @id`,
      { id }
    );
    return result.recordset[0] || null;
  },

  async findByMetaLeadId(metaLeadId) {
    const result = await query(
      'SELECT * FROM "Leads" WHERE meta_lead_id = @meta_lead_id',
      { meta_lead_id: metaLeadId }
    );
    return result.recordset[0] || null;
  },

  async findAll({ status, source, assigned_to, client_type, search, followup_date, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const params = { offset, limit };

    let fromClause = `
      FROM "Leads" l
      LEFT JOIN "Users" u ON l.assigned_to = u.id
      LEFT JOIN (
        SELECT lead_id, COUNT(*) AS followup_count
        FROM "FollowUps"
        GROUP BY lead_id
      ) fc ON fc.lead_id = l.id
    `;

    if (followup_date === 'today' || followup_date === 'week') {
      fromClause += `
        INNER JOIN (
          SELECT lead_id, next_followup_date,
                 ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY created_at DESC) AS rn
          FROM "FollowUps"
          WHERE next_followup_date IS NOT NULL
        ) lf ON lf.lead_id = l.id AND lf.rn = 1
      `;
    }

    let where = 'WHERE 1=1';
    if (status)      { where += ' AND l.status = @status';           params.status = status; }
    if (source)      { where += ' AND l.source = @source';           params.source = source; }
    if (client_type) { where += ' AND l.client_type = @client_type'; params.client_type = client_type; }
    if (assigned_to) { where += ' AND l.assigned_to = @assigned_to'; params.assigned_to = assigned_to; }
    if (search) {
      where += ` AND (l.full_name ILIKE @search OR l.email ILIKE @search OR l.phone ILIKE @search)`;
      params.search = `%${search}%`;
    }
    if (followup_date === 'today') {
      where += ` AND lf.next_followup_date = CURRENT_DATE`;
    } else if (followup_date === 'week') {
      where += ` AND lf.next_followup_date >= DATE_TRUNC('week', NOW())::date
                 AND lf.next_followup_date <  (DATE_TRUNC('week', NOW()) + INTERVAL '7 days')::date`;
    }

    const countRes = await query(`SELECT COUNT(*) AS total ${fromClause} ${where}`, params);
    const total = parseInt(countRes.recordset[0].total, 10);

    const result = await query(
      `SELECT l.*, u.name AS assigned_to_name,
              COALESCE(fc.followup_count, 0) AS followup_count
       ${fromClause}
       ${where}
       ORDER BY l.created_at DESC
       LIMIT @limit OFFSET @offset`,
      params
    );
    return { leads: result.recordset, total, page, limit, pages: Math.ceil(total / limit) };
  },

  async updateStatus(id, newStatus, changedBy, note) {
    const lead = await Lead.findById(id);
    if (!lead) return null;

    await query(
      'UPDATE "Leads" SET status = @status WHERE id = @id',
      { status: newStatus, id }
    );

    await query(
      `INSERT INTO "LeadStatusHistory" (lead_id, old_status, new_status, changed_by, note)
       VALUES (@lead_id, @old_status, @new_status, @changed_by, @note)`,
      { lead_id: id, old_status: lead.status, new_status: newStatus, changed_by: changedBy, note: note || null }
    );

    return await Lead.findById(id);
  },

  /**
   * Generic field update — returns the updated lead via a follow-up SELECT.
   */
  async update(id, data) {
    if (!Object.keys(data).length) return await Lead.findById(id);

    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');

    await query(
      `UPDATE "Leads" SET ${fields} WHERE id = @id`,
      { ...data, id }
    );

    return await Lead.findById(id);
  },

  // ── Activity log ──────────────────────────────────────────

  async logActivity({ lead_id, action_type, field_name, old_value, new_value, note, created_by, actor_name }) {
    await query(
      `INSERT INTO "LeadActivityLog" (lead_id, action_type, field_name, old_value, new_value, note, created_by, actor_name)
       VALUES (@lead_id, @action_type, @field_name, @old_value, @new_value, @note, @created_by, @actor_name)`,
      {
        lead_id,
        action_type: action_type || 'edit',
        field_name:  field_name  || null,
        old_value:   old_value   != null ? String(old_value) : null,
        new_value:   new_value   != null ? String(new_value) : null,
        note:        note        || null,
        created_by:  created_by  || null,
        actor_name:  actor_name  || null,
      }
    );
  },

  async getActivity(lead_id) {
    const result = await query(
      `SELECT a.*, u.name AS actor_name_db
       FROM "LeadActivityLog" a
       LEFT JOIN "Users" u ON a.created_by = u.id
       WHERE a.lead_id = @lead_id
       ORDER BY a.created_at DESC`,
      { lead_id }
    );
    return result.recordset.map(r => ({
      ...r,
      actor_name: r.actor_name_db || r.actor_name || 'System',
    }));
  },

  async getStats() {
    const result = await query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='New'       THEN 1 ELSE 0 END) AS new_leads,
        SUM(CASE WHEN status='FollowUp'  THEN 1 ELSE 0 END) AS follow_up,
        SUM(CASE WHEN status='DemoGiven' THEN 1 ELSE 0 END) AS demo_given,
        SUM(CASE WHEN status='Converted' THEN 1 ELSE 0 END) AS converted,
        SUM(CASE WHEN status='Lost'      THEN 1 ELSE 0 END) AS lost,
        SUM(CASE WHEN status='Nurture'   THEN 1 ELSE 0 END) AS nurture,
        SUM(CASE WHEN client_type='Type1' THEN 1 ELSE 0 END) AS meeting_booked,
        SUM(CASE WHEN client_type='Type2' THEN 1 ELSE 0 END) AS no_meeting
      FROM "Leads"
    `);

    const fuResult = await query(`
      WITH LatestFU AS (
        SELECT lead_id, next_followup_date,
               ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY created_at DESC) AS rn
        FROM "FollowUps"
        WHERE next_followup_date IS NOT NULL
      )
      SELECT
        SUM(CASE WHEN next_followup_date = CURRENT_DATE THEN 1 ELSE 0 END) AS today_followups,
        SUM(CASE WHEN next_followup_date >= DATE_TRUNC('week', NOW())::date
                  AND next_followup_date <  (DATE_TRUNC('week', NOW()) + INTERVAL '7 days')::date
                 THEN 1 ELSE 0 END) AS week_followups
      FROM LatestFU WHERE rn = 1
    `);

    return {
      ...result.recordset[0],
      today_followups: parseInt(fuResult.recordset[0]?.today_followups, 10) || 0,
      week_followups:  parseInt(fuResult.recordset[0]?.week_followups,  10) || 0,
    };
  },

  async getConversionByUser() {
    const result = await query(`
      SELECT u.name AS agent_name, u.id AS user_id,
        COUNT(l.id) AS total_leads,
        SUM(CASE WHEN l.status='Converted' THEN 1 ELSE 0 END) AS converted,
        SUM(CASE WHEN l.status='Lost' THEN 1 ELSE 0 END) AS lost
      FROM "Users" u
      LEFT JOIN "Leads" l ON l.assigned_to = u.id
      WHERE u.is_active = true
      GROUP BY u.id, u.name
      ORDER BY converted DESC
    `);
    return result.recordset;
  },
};

module.exports = Lead;
