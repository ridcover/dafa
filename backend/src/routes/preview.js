const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { UPLOADS_BASE } = require('../config/multer');
const { sanitizePathSegment } = require('../utils/fileNaming');

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg'
};

/**
 * GET /api/preview/:id
 * Endpoint streaming/preview berkas secara inline
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [archives] = await pool.query('SELECT * FROM archives WHERE id = ?', [id]);
    if (archives.length === 0) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    const item = archives[0];
    if (item.isFolder) {
      return res.status(400).json({ success: false, message: 'Folder tidak dapat di-preview.' });
    }

    const cleanTapel = sanitizePathSegment(item.tapel);
    let filePath = path.join(UPLOADS_BASE, cleanTapel);

    if (item.parent_path) {
      const rel = item.parent_path.replace(/\\/g, '/').split('/').filter(Boolean).join(path.sep);
      filePath = path.join(filePath, rel, item.stored_name);
    } else {
      filePath = path.join(filePath, item.stored_name);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Berkas fisik tidak ditemukan di server.' });
    }

    const ext = path.extname(item.original_name || item.name).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Set header preview inline
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(item.original_name || item.name)}"`);

    // Stream file
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

  } catch (err) {
    console.error(`[Preview File Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal memuat preview berkas.' });
  }
});

module.exports = router;
