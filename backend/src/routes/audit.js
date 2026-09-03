const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/audit
 * Mengambil daftar riwayat audit log (Admin only)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const search = req.query.search ? req.query.search.trim() : '';
    const action = req.query.action ? req.query.action.trim() : '';

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (username LIKE ? OR details LIKE ? OR ip_address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }

    // Hitung total logs
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Ambil data logs
    const query = `
      SELECT * FROM audit_logs 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [logs] = await pool.query(query, [...params, limit, offset]);

    return res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error(`[Get Audit Logs Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal memuat audit log.' });
  }
});

/**
 * GET /api/audit/export
 * Export seluruh log audit ke file CSV (Admin only)
 */
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [logs] = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs_daf_archive.csv"');

    // Header CSV
    let csv = 'ID,Waktu,Username,Aksi,Keterangan,IP Address\n';

    for (const l of logs) {
      const time = new Date(l.created_at).toISOString();
      const user = `"${(l.username || '').replace(/"/g, '""')}"`;
      const action = `"${(l.action || '').replace(/"/g, '""')}"`;
      const details = `"${(l.details || '').replace(/"/g, '""')}"`;
      const ip = `"${(l.ip_address || '').replace(/"/g, '""')}"`;
      csv += `${l.id},${time},${user},${action},${details},${ip}\n`;
    }

    return res.send(csv);
  } catch (err) {
    console.error(`[Export Audit Logs Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal mengekspor audit log.' });
  }
});

/**
 * DELETE /api/audit/clear
 * Mengosongkan audit log (Admin only)
 */
router.delete('/clear', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE audit_logs');
    return res.json({ success: true, message: 'Riwayat audit log berhasil dibersihkan.' });
  } catch (err) {
    console.error(`[Clear Audit Logs Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal membersihkan audit log.' });
  }
});

module.exports = router;

