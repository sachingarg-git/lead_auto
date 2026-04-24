const sql = require('mssql');
const logger = require('./logger');

const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || 'lead_management',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    enableArithAbort: true,
  },
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool = null;

async function getPool() {
  if (pool && pool.connected) return pool;
  try {
    pool = await sql.connect(dbConfig);
    logger.info('MSSQL connection pool established');
    return pool;
  } catch (err) {
    logger.error('MSSQL connection failed:', err.message);
    throw err;
  }
}

async function query(queryString, params = {}) {
  const p = await getPool();
  const request = p.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  return request.query(queryString);
}

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    logger.info('MSSQL pool closed');
  }
}

module.exports = { sql, getPool, query, closePool };
