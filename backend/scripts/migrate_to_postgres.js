/**
 * MSSQL → PostgreSQL Data Migration Script
 * ==========================================
 * - READ-ONLY from MSSQL (zero impact on existing data)
 * - Creates all tables in PostgreSQL
 * - Copies all rows
 * - Resets PostgreSQL sequences to max(id)
 *
 * Run: node backend/scripts/migrate_to_postgres.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const sql   = require('mssql');
const { Pool } = require('pg');
const fs    = require('fs');
const path  = require('path');

// ── Source: MSSQL (READ-ONLY) ─────────────────────────────────
const MSSQL_CONFIG = {
  server:   process.env.DB_SERVER,
  port:     parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options:  { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 30000,
  requestTimeout:    60000,
};

// ── Target: PostgreSQL ────────────────────────────────────────
const PG_URL = process.env.DATABASE_URL;
const pg = new Pool({ connectionString: PG_URL, ssl: false, max: 5 });

// ── Tables to migrate (order matters for FK constraints) ──────
const TABLES = [
  'Roles',
  'Users',
  'LeadSources',
  'Leads',
  'FollowUps',
  'LeadStatusHistory',
  'Reminders',
  'WebhookEvents',
  'CommunicationLogs',
  'AppSettings',
  'LeadActivityLog',
];

// ── MSSQL TIME column → 'HH:MM:SS' string ────────────────────
function convertTimeValue(val) {
  if (!val) return null;
  if (val instanceof Date) {
    const h = String(val.getUTCHours()).padStart(2, '0');
    const m = String(val.getUTCMinutes()).padStart(2, '0');
    const s = String(val.getUTCSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  return String(val).substring(0, 8);
}

// ── Convert a single row value for PostgreSQL ─────────────────
function convertValue(val, colName, dataType) {
  if (val === null || val === undefined) return null;
  // TIME columns
  if (dataType === 'time' || colName === 'slot_time') {
    return convertTimeValue(val);
  }
  // BIT → boolean
  if (dataType === 'bit') {
    if (typeof val === 'boolean') return val;
    return val === 1 || val === '1' || val === true;
  }
  // Everything else: pass as-is (pg handles Date, string, number)
  return val;
}

async function getMssqlColumns(mssqlPool, tableName) {
  try {
    const result = await mssqlPool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `);
    return result.recordset;
  } catch {
    return [];
  }
}

async function tableExistsInMssql(mssqlPool, tableName) {
  try {
    const result = await mssqlPool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = '${tableName}' AND TABLE_TYPE = 'BASE TABLE'
    `);
    return result.recordset.length > 0;
  } catch {
    return false;
  }
}

async function migrateTable(mssqlPool, tableName) {
  console.log(`\n📦 Migrating: ${tableName}`);

  // Check if table exists in MSSQL
  const exists = await tableExistsInMssql(mssqlPool, tableName);
  if (!exists) {
    console.log(`  ⚠️  Table ${tableName} not found in MSSQL — skipping`);
    return 0;
  }

  // Get column metadata
  const columns = await getMssqlColumns(mssqlPool, tableName);
  if (!columns.length) {
    console.log(`  ⚠️  No columns found — skipping`);
    return 0;
  }

  const colNames  = columns.map(c => c.COLUMN_NAME);
  const colTypes  = {};
  columns.forEach(c => { colTypes[c.COLUMN_NAME] = c.DATA_TYPE.toLowerCase(); });

  // Read all rows from MSSQL (read-only)
  let rows;
  try {
    const result = await mssqlPool.request().query(`SELECT * FROM [${tableName}] ORDER BY id ASC`);
    rows = result.recordset;
  } catch (err) {
    // Table might not have 'id' — try without ORDER BY
    try {
      const result = await mssqlPool.request().query(`SELECT * FROM [${tableName}]`);
      rows = result.recordset;
    } catch (err2) {
      console.log(`  ❌ Read failed: ${err2.message}`);
      return 0;
    }
  }

  console.log(`  📊 Found ${rows.length} rows`);
  if (!rows.length) return 0;

  // Insert into PostgreSQL in batches
  const pgClient = await pg.connect();
  let inserted = 0;

  try {
    await pgClient.query('BEGIN');

    // Temporarily disable FK checks by deferring constraints
    await pgClient.query('SET CONSTRAINTS ALL DEFERRED');

    for (const row of rows) {
      // Convert values
      const values = colNames.map(col => convertValue(row[col], col, colTypes[col]));

      // Build INSERT with positional params
      const colList  = colNames.map(c => `"${c}"`).join(', ');
      const valList  = colNames.map((_, i) => `$${i + 1}`).join(', ');

      try {
        await pgClient.query(
          `INSERT INTO "${tableName}" (${colList}) VALUES (${valList}) ON CONFLICT (id) DO NOTHING`,
          values
        );
        inserted++;
      } catch (err) {
        console.log(`  ⚠️  Row insert failed (id=${row.id}): ${err.message.substring(0, 120)}`);
      }
    }

    await pgClient.query('COMMIT');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.log(`  ❌ Transaction failed: ${err.message}`);
  } finally {
    pgClient.release();
  }

  // Reset PostgreSQL SERIAL sequence to max(id)
  try {
    await pg.query(
      `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'),
                     COALESCE(MAX(id), 0) + 1, false)
       FROM "${tableName}"`
    );
    console.log(`  ✅ ${inserted}/${rows.length} rows migrated — sequence reset`);
  } catch {
    console.log(`  ✅ ${inserted}/${rows.length} rows migrated`);
  }

  return inserted;
}

async function main() {
  console.log('════════════════════════════════════════════════');
  console.log('  Wizone LMS — MSSQL → PostgreSQL Migration');
  console.log('════════════════════════════════════════════════');
  console.log(`\n📡 Source (MSSQL): ${MSSQL_CONFIG.server}:${MSSQL_CONFIG.port}/${MSSQL_CONFIG.database}`);
  console.log(`📡 Target (PG):    ${PG_URL?.replace(/:([^:@]+)@/, ':***@')}\n`);

  // ── Connect to MSSQL ─────────────────────────────────────────
  let mssqlPool;
  try {
    mssqlPool = await sql.connect(MSSQL_CONFIG);
    console.log('✅ Connected to MSSQL (read-only)');
  } catch (err) {
    console.error('❌ MSSQL connection failed:', err.message);
    process.exit(1);
  }

  // ── Test PostgreSQL connection ────────────────────────────────
  try {
    await pg.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL');
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    await mssqlPool.close();
    process.exit(1);
  }

  // ── Create PostgreSQL schema ──────────────────────────────────
  console.log('\n📝 Creating PostgreSQL schema...');
  const schemaSQL = fs.readFileSync(
    path.join(__dirname, 'postgres_schema.sql'),
    'utf8'
  );
  try {
    await pg.query(schemaSQL);
    console.log('✅ Schema created');
  } catch (err) {
    console.error('❌ Schema creation failed:', err.message);
    await mssqlPool.close();
    process.exit(1);
  }

  // ── Migrate each table ────────────────────────────────────────
  console.log('\n🚀 Starting data migration...');
  let totalRows = 0;

  for (const table of TABLES) {
    const count = await migrateTable(mssqlPool, table);
    totalRows += count;
  }

  // ── Done ──────────────────────────────────────────────────────
  await mssqlPool.close();
  await pg.end();

  console.log('\n════════════════════════════════════════════════');
  console.log(`  ✅ Migration complete — ${totalRows} total rows migrated`);
  console.log('  ⚠️  MSSQL was accessed READ-ONLY — zero impact');
  console.log('════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
