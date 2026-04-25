/**
 * Lead Sources Management
 * Supports 3 source types:
 *   - meta         : Facebook/Instagram Lead Ads webhook
 *   - landing_page : Public API key based POST endpoint (centralized table)
 *   - external_db  : Poll an external PostgreSQL/MSSQL table every 5 minutes
 */
const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { adminOnly } = require('../middleware/rbac');
const { syncExternalSource, testConnection, fetchColumns, invalidatePool } = require('../services/externalDbSync');
const logger = require('../config/logger');

// ── Public (auth-only) — just names, for filter dropdowns ────
//    Placed BEFORE adminOnly so Sales/Support can also use it
router.get('/names', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, source_type FROM LeadSources WHERE is_active = 1 ORDER BY name ASC`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch source names' });
  }
});

router.use(authenticate, adminOnly);

// ── List all sources ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM Leads l WHERE l.source = s.name) AS lead_count
      FROM LeadSources s ORDER BY s.created_at DESC
    `);
    // Safe JSON parse — ignore corrupt DB values
    const safeJson = (str) => { try { return str ? JSON.parse(str) : null; } catch { return null; } };
    const sources = result.recordset.map(s => ({
      ...s,
      config:     safeJson(s.config),
      column_map: safeJson(s.column_map),
    }));
    res.json(sources);
  } catch (err) {
    logger.error('list sources error:', err);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

// ── Create a new source ───────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, source_type, config, column_map } = req.body;

    if (!name || !source_type) {
      return res.status(400).json({ error: 'name and source_type required' });
    }

    const validTypes = ['meta', 'landing_page', 'external_db'];
    if (!validTypes.includes(source_type)) {
      return res.status(400).json({ error: 'source_type must be: meta | landing_page | external_db' });
    }

    // Generate API key for landing_page sources
    const api_key = source_type === 'landing_page' ? `wz_${uuidv4().replace(/-/g, '')}` : null;

    const result = await query(
      `INSERT INTO LeadSources (name, source_type, api_key, config, column_map)
       OUTPUT INSERTED.*
       VALUES (@name, @source_type, @api_key, @config, @column_map)`,
      {
        name,
        source_type,
        api_key,
        config: config ? JSON.stringify(config) : null,
        column_map: column_map ? JSON.stringify(column_map) : null,
      }
    );

    const source = result.recordset[0];
    res.status(201).json({
      ...source,
      config: source.config ? JSON.parse(source.config) : null,
      column_map: source.column_map ? JSON.parse(source.column_map) : null,
    });
  } catch (err) {
    logger.error('create source error:', err);
    res.status(500).json({ error: 'Failed to create source' });
  }
});

// ── Get a single source (for edit prefill) ───────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM LeadSources WHERE id = @id',
      { id: parseInt(req.params.id) }
    );
    if (!result.recordset[0]) return res.status(404).json({ error: 'Source not found' });
    const s = result.recordset[0];
    res.json({
      ...s,
      config:     s.config     ? JSON.parse(s.config)     : null,
      column_map: s.column_map ? JSON.parse(s.column_map) : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch source' });
  }
});

// ── Update a source ───────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { name, config, column_map, is_active } = req.body;

    // For external_db: if the new config omits the password (user didn't re-enter it),
    // fetch the stored password and merge it in — never lose credentials silently
    let finalConfig = config;
    if (config && !config.password) {
      const existing = await query(
        'SELECT config FROM LeadSources WHERE id = @id',
        { id: parseInt(req.params.id) }
      );
      const storedCfg = existing.recordset[0]?.config
        ? JSON.parse(existing.recordset[0].config)
        : {};
      if (storedCfg.password) {
        finalConfig = { ...config, password: storedCfg.password };
      }
    }

    await query(
      `UPDATE LeadSources SET
         name = ISNULL(@name, name),
         config = ISNULL(@config, config),
         column_map = ISNULL(@column_map, column_map),
         is_active = ISNULL(@is_active, is_active)
       WHERE id = @id`,
      {
        id: parseInt(req.params.id),
        name: name || null,
        config: finalConfig ? JSON.stringify(finalConfig) : null,
        column_map: column_map ? JSON.stringify(column_map) : null,
        is_active: is_active !== undefined ? (is_active ? 1 : 0) : null,
      }
    );
    // Invalidate cached DB pool so next sync reconnects with new config
    invalidatePool(parseInt(req.params.id));
    res.json({ message: 'Source updated' });
  } catch (err) {
    logger.error('update source error:', err);
    res.status(500).json({ error: 'Failed to update source' });
  }
});

// ── Fetch columns from an external DB (no saved source needed) ─
router.post('/fetch-columns', async (req, res) => {
  try {
    let { config } = req.body;
    if (!config) return res.status(400).json({ error: 'config object required' });

    // When editing an existing source the frontend sends password='__keep__'
    // Resolve it to the actual stored password so the connection works
    if (config.password === '__keep__' && config.source_id) {
      const srcResult = await query(
        'SELECT config FROM LeadSources WHERE id = @id',
        { id: parseInt(config.source_id) }
      );
      const stored = srcResult.recordset[0];
      if (stored?.config) {
        const storedCfg = JSON.parse(stored.config);
        config = { ...config, password: storedCfg.password || '' };
      }
    }

    const result = await fetchColumns(config);
    res.json(result);
  } catch (err) {
    logger.error('fetch-columns error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── Test connection for an external_db source ────────────────
router.post('/:id/test', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM LeadSources WHERE id = @id AND source_type = @type',
      { id: parseInt(req.params.id), type: 'external_db' }
    );
    const source = result.recordset[0];
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const config = source.config ? JSON.parse(source.config) : {};
    const testResult = await testConnection(config);
    res.json(testResult);
  } catch (err) {
    logger.error('test connection error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ── Manually trigger a sync for an external_db source ────────
router.post('/:id/sync', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM LeadSources WHERE id = @id AND source_type = @type',
      { id: parseInt(req.params.id), type: 'external_db' }
    );
    const source = result.recordset[0];
    if (!source) return res.status(404).json({ error: 'External DB source not found' });

    source.config     = source.config     ? JSON.parse(source.config)     : {};
    source.column_map = source.column_map ? JSON.parse(source.column_map) : {};

    // Respond immediately, run sync in background
    res.json({ message: 'Sync started' });
    syncExternalSource(source)
      .then(r => logger.info(`Manual sync done: ${JSON.stringify(r)}`))
      .catch(e => logger.error('Manual sync error:', e.message));
  } catch (err) {
    logger.error('sync trigger error:', err);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

// ── Regenerate API key for landing_page source ────────────────
router.post('/:id/regenerate-key', async (req, res) => {
  try {
    const new_key = `wz_${uuidv4().replace(/-/g, '')}`;
    await query(
      `UPDATE LeadSources SET api_key = @key WHERE id = @id AND source_type = 'landing_page'`,
      { key: new_key, id: parseInt(req.params.id) }
    );
    res.json({ api_key: new_key });
  } catch (err) {
    res.status(500).json({ error: 'Failed to regenerate key' });
  }
});

// ── Delete a source ───────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM LeadSources WHERE id = @id', { id: parseInt(req.params.id) });
    res.json({ message: 'Source deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete source' });
  }
});

module.exports = router;
