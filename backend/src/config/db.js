const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Muat .env dari backend/.env atau dari root project .env
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const dbName = process.env.DB_NAME || process.env.DB_DATABASE || 'db_dafa_archive';
const dbUser = process.env.DB_USER || process.env.DB_USERNAME || 'root';
const dbPass = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.DB_PASS || '');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: dbUser,
  password: dbPass,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test connection on startup and ensure columns exist
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] Terhubung ke MySQL database '${dbName}' sebagai user '${dbUser}' dengan sukses.`);

    // Auto-migration: pastikan seluruh 7 kolom jabatan ada di tabel client_access
    try {
      const [tables] = await connection.query(`SHOW TABLES LIKE 'client_access'`);
      if (tables.length > 0) {
        const [columns] = await connection.query(`SHOW COLUMNS FROM client_access`);
        const existingCols = columns.map(c => c.Field);
        const requiredCols = ['kepsek', 'waka_kurikulum', 'waka_kesiswaan', 'waka_sarpras', 'bendahara', 'tu', 'guru'];
        for (const col of requiredCols) {
          if (!existingCols.includes(col)) {
            console.log(`[Database Auto-Migration] Menambahkan kolom '${col}' ke tabel client_access...`);
            await connection.query(`ALTER TABLE client_access ADD COLUMN \`${col}\` TINYINT(1) DEFAULT 0`);
          }
        }
      }
    } catch (migErr) {
      console.warn(`[Database Auto-Migration Warning]`, migErr.message);
    }

    connection.release();
    return true;
  } catch (err) {
    console.error(`[Database Error] Gagal terhubung ke MySQL:`, err.message);
    return false;
  }
}

module.exports = {
  pool,
  testConnection
};
