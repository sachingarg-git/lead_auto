/**
 * PostgreSQL connection pool (migrated from MSSQL).
 * Provides the same query(sql, params) API as before —
 * auto-converts @paramName placeholders to $1, $2, ...
 * so all model files work without changes to param style.
 */
const { Pool } = require('pg');
const logger   = require('./logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error:', err.message);
});

/**
 * Convert MSSQL-style @paramName placeholders to PostgreSQL $N positional params.
 * Handles repeated params — same @name always maps to the same $N.
 */
function convertParams(sqlText, params = {}) {
  const paramMap = {};
  const values   = [];

  const text = sqlText.replace(/@(\w+)/g, (_, name) => {
    if (!(name in params)) return `@${name}`;           // leave unknown refs as-is
    if (!(name in paramMap)) {
      values.push(params[name] ?? null);
      paramMap[name] = values.length;
    }
    return `$${paramMap[name]}`;
  });

  return { text, values };
}

/**
 * Main query function — drop-in replacement for the mssql version.
 * Returns { recordset: rows[] } to keep all callers unchanged.
 */
async function query(sqlText, params = {}) {
  const { text, values } = convertParams(sqlText, params);
  try {
    const result = await pool.query(text, values);
    return { recordset: result.rows };
  } catch (err) {
    logger.error('DB query error:', err.message);
    logger.error('SQL:', text);
    throw err;
  }
}

/** Return the pool (used by server.js startup check) */
async function getPool() {
  const client = await pool.connect();
  client.release();
  return pool;
}

async function closePool() {
  await pool.end();
  logger.info('PostgreSQL pool closed');
}

// Export sql as empty object for backward compat (was mssql type helper)
const sql = {};

module.exports = { query, getPool, closePool, sql };
