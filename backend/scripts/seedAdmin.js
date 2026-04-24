/**
 * Run: node scripts/seedAdmin.js
 * Creates the first Admin user in the database.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { query, closePool } = require('../config/database');

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@wizone.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const name = process.env.ADMIN_NAME || 'Wizone Admin';

  const hash = await bcrypt.hash(password, 12);

  try {
    // Get Admin role id
    const roleRes = await query("SELECT id FROM Roles WHERE name = 'Admin'");
    if (!roleRes.recordset.length) {
      console.error('Admin role not found. Run schema.sql first.');
      process.exit(1);
    }
    const roleId = roleRes.recordset[0].id;

    // Check if user already exists
    const existing = await query('SELECT id FROM Users WHERE email = @email', { email });
    if (existing.recordset.length) {
      console.log(`Admin user ${email} already exists.`);
      await closePool();
      return;
    }

    await query(
      `INSERT INTO Users (name, email, password_hash, role_id)
       VALUES (@name, @email, @password_hash, @role_id)`,
      { name, email, password_hash: hash, role_id: roleId }
    );

    console.log(`✅ Admin user created: ${email} / ${password}`);
    console.log('⚠️  Change this password immediately after first login!');
  } finally {
    await closePool();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
