/**
 * External Database Sync Service
 *
 * Supports both MSSQL and PostgreSQL external databases.
 * DB type is stored in config.db_type = "mssql" | "postgres"
 * Defaults to "mssql" for backward compatibility.
 *
 * Config shape (stored as JSON in LeadSources.config):
 * {
 *   "db_type":     "postgres",           // "mssql" | "postgres"
 *   "server":      "72.61.170.243",
 *   "port":        9095,
 *   "database":    "LandingWizoneAi",
 *   "user":        "postgres",
 *   "password":    "xxx",
 *   "table":       "Leads",
 *   "id_column":   "id",
 *   "date_column": "created_at",
 *   "encrypt":     false                 // MSSQL only
 * }
 *
 * column_map shape:  { "SourceColumn": "our_field", ... }
 */

const sql   = require('mssql');
const { Pool: PgPool } = require('pg');
const cron  = require('node-cron');
const { query: localQuery } = require('../config/database');
const Lead  = require('../models/Lead');
const { triggerLeadAutomation } = require('../controllers/leadController');
const logger = require('../config/logger');

/* ── Connection pool caches ─────────────────────────────────── */
const mssqlPools = {};   // sourceId → mssql pool
const pgPools    = {};   // sourceId → pg.Pool

/* ── MSSQL connection ───────────────────────────────────────── */
async function getMssqlPool(sourceId, config) {
  if (mssqlPools[sourceId]) return mssqlPools[sourceId];

  const pool = await sql.connect({
    server:   config.server,
    port:     parseInt(config.port) || 1433,
    database: config.database,
    user:     config.user,
    password: config.password,
    options: {
      encrypt:                config.encrypt === true,
      trustServerCertificate: true,
    },
    connectionTimeout: 15000,
    requestTimeout:    30000,
  });

  mssqlPools[sourceId] = pool;
  return pool;
}

/* ── PostgreSQL connection ──────────────────────────────────── */
function getPgPool(sourceId, config) {
  if (pgPools[sourceId]) return pgPools[sourceId];

  const pool = new PgPool({
    host:               config.server,
    port:               parseInt(config.port) || 5432,
    database:           config.database,
    user:               config.user,
    password:           config.password,
    ssl:                config.encrypt ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis:  30000,
    max:                3,
  });

  // Log connection errors (pool emits them)
  pool.on('error', (err) => {
    logger.error(`PG pool error (source ${sourceId}):`, err.message);
    // Remove from cache so next call recreates it
    delete pgPools[sourceId];
  });

  pgPools[sourceId] = pool;
  return pool;
}

/* ── Invalidate cached pool (called after config edit) ─────── */
function invalidatePool(sourceId) {
  if (mssqlPools[sourceId]) {
    mssqlPools[sourceId].close?.().catch(() => {});
    delete mssqlPools[sourceId];
  }
  if (pgPools[sourceId]) {
    pgPools[sourceId].end?.().catch(() => {});
    delete pgPools[sourceId];
  }
}

/* ── Query helper for PostgreSQL ────────────────────────────── */
async function pgQuery(pool, sql, values = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, values);
    return res.rows;
  } finally {
    client.release();
  }
}

/* ── Map source row → our lead fields ───────────────────────── */
function mapRow(row, columnMap, sourceName) {
  const mapped = {};

  for (const [srcCol, destField] of Object.entries(columnMap)) {
    // Column names may be case-sensitive in Postgres — try exact then lowercase
    const val = row[srcCol] ?? row[srcCol.toLowerCase()] ?? null;
    if (val !== null && val !== undefined) {
      mapped[destField] = String(val).trim();
    }
  }

  // ── Auto-combine split date + time columns ─────────────────
  // Common pattern: source has "preferred_date" + "preferred_time" separately
  // We merge them into preferred_slot if not already set by column_map
  if (!mapped.preferred_slot) {
    const dateVal = row['preferred_date'] ?? row['booking_date'] ?? row['slot_date'] ?? null;
    const timeVal = row['preferred_time'] ?? row['booking_time'] ?? row['slot_time'] ?? null;
    if (dateVal || timeVal) {
      const parts = [dateVal, timeVal].filter(Boolean).map(v => String(v).trim());
      mapped.preferred_slot = parts.join(' ');
    }
  }

  mapped.source      = sourceName;
  mapped.status      = mapped.status || 'New';
  mapped.client_type = mapped.preferred_slot ? 'Type1' : 'Type2';

  if (mapped.preferred_slot) {
    const parsed = new Date(mapped.preferred_slot);
    if (!isNaN(parsed.getTime())) mapped.meeting_datetime = parsed;
  }

  return mapped;
}

/* ── Test connection (called from route for "Test" button) ──── */
async function testConnection(config) {
  const dbType = config.db_type || 'mssql';
  const table  = config.table || 'Leads';

  if (dbType === 'postgres') {
    const pool = new PgPool({
      host:     config.server,
      port:     parseInt(config.port) || 5432,
      database: config.database,
      user:     config.user,
      password: config.password,
      ssl:      config.encrypt ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000,
    });
    try {
      const client = await pool.connect();
      const res = await client.query(
        `SELECT COUNT(*) AS cnt FROM "${table}"`
      );
      client.release();
      await pool.end();
      return { ok: true, rowCount: parseInt(res.rows[0].cnt), dbType: 'postgres' };
    } catch (err) {
      await pool.end().catch(() => {});
      throw err;
    }
  } else {
    // MSSQL
    const pool = await sql.connect({
      server: config.server, port: parseInt(config.port) || 1433,
      database: config.database, user: config.user, password: config.password,
      options: { encrypt: config.encrypt === true, trustServerCertificate: true },
      connectionTimeout: 8000,
    });
    try {
      const res = await pool.request().query(
        `SELECT COUNT(*) AS cnt FROM [${table}]`
      );
      await pool.close();
      return { ok: true, rowCount: res.recordset[0].cnt, dbType: 'mssql' };
    } catch (err) {
      await pool.close().catch(() => {});
      throw err;
    }
  }
}

/* ── Main sync function ─────────────────────────────────────── */
async function syncExternalSource(source) {
  const { config, column_map, name, id: sourceId, last_sync_id } = source;

  if (!config?.server || !config?.database || !config?.table) {
    logger.warn(`Source "${name}": incomplete config — skipping`);
    return { error: 'Incomplete config (server, database, table required)' };
  }

  const dbType  = config.db_type || 'mssql';
  const idCol   = config.id_column   || 'id';
  const table   = config.table;
  const lastId  = last_sync_id ? parseInt(last_sync_id) : 0;

  logger.info(`Syncing "${name}" [${dbType}] — ${config.database}.${table}, last_id=${lastId}`);

  let rows = [];

  /* ── Fetch rows ─────────────────────────────────────────── */
  try {
    if (dbType === 'postgres') {
      const pool = getPgPool(sourceId, config);
      const sqlText = lastId > 0
        ? `SELECT * FROM "${table}" WHERE "${idCol}" > $1 ORDER BY "${idCol}" ASC LIMIT 200`
        : `SELECT * FROM "${table}" ORDER BY "${idCol}" ASC LIMIT 200`;
      rows = await pgQuery(pool, sqlText, lastId > 0 ? [lastId] : []);

    } else {
      // MSSQL
      const pool = await getMssqlPool(sourceId, config);
      const req  = pool.request();
      let whereClause = '';
      if (lastId > 0) {
        req.input('last_id', lastId);
        whereClause = `WHERE [${idCol}] > @last_id`;
      }
      const result = await req.query(
        `SELECT TOP 200 * FROM [${table}] ${whereClause} ORDER BY [${idCol}] ASC`
      );
      rows = result.recordset;
    }
  } catch (err) {
    logger.error(`Source "${name}" [${dbType}]: fetch failed — ${err.message}`);
    // Invalidate pool so next attempt reconnects fresh
    invalidatePool(sourceId);
    return { error: err.message };
  }

  if (!rows.length) {
    logger.info(`Source "${name}": no new rows since id=${lastId}`);
    // Still update last_synced timestamp
    await localQuery(
      `UPDATE LeadSources SET last_synced = GETDATE() WHERE id = @id`,
      { id: sourceId }
    );
    return { imported: 0 };
  }

  logger.info(`Source "${name}": found ${rows.length} rows to process`);

  let imported      = 0;
  let lastSyncedId  = last_sync_id;

  for (const row of rows) {
    try {
      const leadData = mapRow(row, column_map || {}, name);

      if (!leadData.full_name) {
        logger.warn(`Source "${name}": row skipped — no full_name (mapped from column_map)`);
        lastSyncedId = row[idCol] ?? row[idCol.toLowerCase()];
        continue;
      }

      // Dedup by phone + source (within last 30 days)
      if (leadData.phone) {
        const existing = await localQuery(
          `SELECT id FROM Leads WHERE phone = @phone AND source = @source
           AND created_at >= DATEADD(DAY, -30, GETDATE())`,
          { phone: leadData.phone, source: name }
        );
        if (existing.recordset.length) {
          lastSyncedId = row[idCol] ?? row[idCol.toLowerCase()];
          continue;
        }
      }

      const lead = await Lead.create(leadData);
      await triggerLeadAutomation(lead);
      imported++;
      lastSyncedId = row[idCol] ?? row[idCol.toLowerCase()];

    } catch (err) {
      logger.error(`Source "${name}": row import error — ${err.message}`);
    }
  }

  // Update sync stats
  await localQuery(
    `UPDATE LeadSources SET
       last_synced  = GETDATE(),
       sync_count   = sync_count + @count,
       last_sync_id = @last_id
     WHERE id = @id`,
    { id: sourceId, count: imported, last_id: String(lastSyncedId ?? '') }
  );

  logger.info(`Source "${name}": imported ${imported} / ${rows.length} leads`);
  return { imported, total: rows.length };
}

/* ── Cron: runs every 5 minutes for all active external_db ─── */
function startExternalSyncScheduler() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await localQuery(
        `SELECT * FROM LeadSources WHERE source_type = 'external_db' AND is_active = 1`
      );

      for (const sourceRow of result.recordset) {
        const source = {
          ...sourceRow,
          config:     sourceRow.config     ? JSON.parse(sourceRow.config)     : {},
          column_map: sourceRow.column_map ? JSON.parse(sourceRow.column_map) : {},
        };
        await syncExternalSource(source).catch(e =>
          logger.error(`Auto-sync "${source.name}":`, e.message)
        );
      }
    } catch (err) {
      logger.error('External sync scheduler error:', err.message);
    }
  });

  logger.info('External DB sync scheduler started (every 5 minutes)');
}

/* ── Fetch columns + one sample row from an external table ──── */
async function fetchColumns(config) {
  const dbType = config.db_type || 'mssql';
  const table  = config.table;
  if (!table) throw new Error('Table name is required');

  if (dbType === 'postgres') {
    const pool = new PgPool({
      host: config.server, port: parseInt(config.port) || 5432,
      database: config.database, user: config.user, password: config.password,
      ssl: config.encrypt ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect().catch(async (err) => {
      await pool.end().catch(() => {});
      throw err;
    });
    try {
      const colRes = await client.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'
         ORDER BY ordinal_position`,
        [table]
      );
      if (!colRes.rows.length) throw new Error(`Table "${table}" not found or has no columns`);
      const sampleRes = await client.query(`SELECT * FROM "${table}" ORDER BY 1 DESC LIMIT 1`);
      return { columns: colRes.rows, sample: sampleRes.rows[0] || null, dbType: 'postgres' };
    } finally {
      client.release();
      await pool.end().catch(() => {});
    }
  } else {
    const pool = await sql.connect({
      server: config.server, port: parseInt(config.port) || 1433,
      database: config.database, user: config.user, password: config.password,
      options: { encrypt: config.encrypt === true, trustServerCertificate: true },
      connectionTimeout: 10000,
    }).catch(err => { throw err; });
    try {
      const colRes = await pool.request().query(
        `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME = '${table.replace(/'/g, '')}'
         ORDER BY ORDINAL_POSITION`
      );
      if (!colRes.recordset.length) throw new Error(`Table "${table}" not found or has no columns`);
      const sampleRes = await pool.request().query(`SELECT TOP 1 * FROM [${table}] ORDER BY 1 DESC`);
      return { columns: colRes.recordset, sample: sampleRes.recordset[0] || null, dbType: 'mssql' };
    } finally {
      await pool.close().catch(() => {});
    }
  }
}

module.exports = { syncExternalSource, startExternalSyncScheduler, testConnection, fetchColumns, invalidatePool };
