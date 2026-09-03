const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'db_dafa_archive',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test connection on startup
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] Terhubung ke MySQL database '${process.env.DB_NAME || 'db_dafa_archive'}' dengan sukses.`);
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
