const { pool } = require('../config/db');

/**
 * Mencatat log aktivitas pengguna ke tabel audit_logs
 * @param {Object} req Express request object
 * @param {string} action Nama aksi (misal: 'UPLOAD_FILE', 'DOWNLOAD_FILE', 'DELETE_FILE', 'RENAME_ARCHIVE', 'LOGIN', dll.)
 * @param {string|Object} details Keterangan detail aktivitas
 * @param {number|null} customUserId ID User opsional (jika bukan dari req.user)
 * @param {string|null} customUsername Username opsional
 */
async function logActivity(req, action, details, customUserId = null, customUsername = null) {
  try {
    const userId = customUserId || (req.user ? req.user.id : null);
    const username = customUsername || (req.user ? req.user.username : 'system');
    
    // Format details jika object
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');

    // Ekstrak IP address
    const ipAddress = (
      req.headers['x-forwarded-for'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      '127.0.0.1'
    ).toString().replace('::ffff:', '');

    await pool.query(
      'INSERT INTO audit_logs (user_id, username, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId, username, action, detailsStr, ipAddress]
    );
  } catch (err) {
    console.error(`[AuditLogger Error] Gagal mencatat log aktivitas:`, err.message);
  }
}

module.exports = {
  logActivity
};
