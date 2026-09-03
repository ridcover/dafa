const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { pool } = require('../config/db');
const { upload, UPLOADS_BASE } = require('../config/multer');
const { authenticateToken, checkLockedYear } = require('../middleware/auth');
const { sanitizePathSegment, JABATAN_LABELS } = require('../utils/fileNaming');
const { logActivity } = require('../utils/auditLogger');
const { normalizeJabatanKey } = require('../utils/folderGenerator');

/**
 * Helper: Ambil tahun pelajaran aktif
 */
async function getActiveTapel() {
  const [settings] = await pool.query('SELECT active_tahun_pelajaran FROM global_settings WHERE id = 1');
  return settings.length > 0 ? settings[0].active_tahun_pelajaran : '2026/2027';
}

/**
 * GET /api/archives
 * Mengambil daftar arsip dan folder berdasarkan tapel, parent_path, search
 * Catatan: Seluruh pengguna terautentikasi dapat melihat & mengunduh berkas di seluruh folder (Read-Only lintas jabatan)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const activeTapel = await getActiveTapel();
    const tapel = req.query.tapel || activeTapel;
    const parentPath = req.query.parent_path !== undefined ? req.query.parent_path : '';
    const search = req.query.search ? req.query.search.trim() : '';
    const jabatanFilter = req.query.jabatan ? normalizeJabatanKey(req.query.jabatan) : '';

    const isLocked = tapel !== activeTapel;

    let query = '';
    let params = [];

    // Mode Pencarian Global (Search)
    if (search) {
      query = `
        SELECT a.*, u.nama as uploader_nama, u.username as uploader_username
        FROM archives a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.tapel = ? AND (a.name LIKE ? OR a.original_name LIKE ? OR a.stored_name LIKE ?)
      `;
      params = [tapel, `%${search}%`, `%${search}%`, `%${search}%`];

      if (jabatanFilter) {
        query += ` AND (a.jabatan = ? OR a.parent_path = ? OR a.parent_path LIKE ?)`;
        params.push(jabatanFilter, jabatanFilter, `${jabatanFilter}/%`);
      }

      query += ` ORDER BY a.isFolder DESC, a.created_at DESC`;

    } else {
      // Mode Eksplorasi Direktori (Seluruh folder dapat diakses secara publik/read-only oleh semua staf yang login)
      query = `
        SELECT a.*, u.nama as uploader_nama, u.username as uploader_username
        FROM archives a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.tapel = ? AND a.parent_path = ?
      `;
      params = [tapel, parentPath];

      if (jabatanFilter && parentPath === '') {
        query += ` AND a.jabatan = ?`;
        params.push(jabatanFilter);
      }

      query += ` ORDER BY a.isFolder DESC, a.name ASC`;
    }

    const [rows] = await pool.query(query, params);

    return res.json({
      success: true,
      data: rows,
      isLocked: isLocked,
      activeTapel: activeTapel,
      currentTapel: tapel,
      parentPath: parentPath
    });

  } catch (err) {
    console.error(`[Get Archives Error]`, err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat daftar arsip.'
    });
  }
});

/**
 * GET /api/archives/stats
 * Statistik dashboard (Total File, Total Folder, Total Size, Distribusi Jabatan)
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const activeTapel = await getActiveTapel();
    const tapel = req.query.tapel || activeTapel;

    // Total file & folder
    const [counts] = await pool.query(
      `SELECT 
        COUNT(CASE WHEN isFolder = 0 THEN 1 END) as totalFiles,
        COUNT(CASE WHEN isFolder = 1 THEN 1 END) as totalFolders,
        COALESCE(SUM(size), 0) as totalBytes
       FROM archives WHERE tapel = ?`,
      [tapel]
    );

    // Statistik per Jabatan
    const [jabatanStats] = await pool.query(
      `SELECT jabatan, 
              COUNT(CASE WHEN isFolder = 0 THEN 1 END) as fileCount,
              COALESCE(SUM(size), 0) as totalBytes
       FROM archives 
       WHERE tapel = ?
       GROUP BY jabatan`,
      [tapel]
    );

    // 5 Berkas Terbaru
    const [recentFiles] = await pool.query(
      `SELECT a.*, u.nama as uploader_nama 
       FROM archives a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.tapel = ? AND a.isFolder = 0
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [tapel]
    );

    return res.json({
      success: true,
      stats: {
        tapel: tapel,
        activeTapel: activeTapel,
        totalFiles: counts[0].totalFiles || 0,
        totalFolders: counts[0].totalFolders || 0,
        totalBytes: counts[0].totalBytes || 0,
        jabatanDistribution: jabatanStats,
        recentFiles: recentFiles
      }
    });

  } catch (err) {
    console.error(`[Stats Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik.' });
  }
});

/**
 * POST /api/archives/upload
 * Upload berkas baru dengan format auto-naming
 */
router.post('/upload', authenticateToken, checkLockedYear, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada berkas yang diunggah.' });
    }

    const { tapel, jabatan, parent_path } = req.body;
    const activeTapel = await getActiveTapel();
    const currentTapel = tapel || activeTapel;
    const parentPath = parent_path || '';
    const targetJabatan = normalizeJabatanKey(jabatan || (parentPath ? parentPath.split('/')[0] : 'guru'));

    // Cek otorisasi jabatan jika bukan admin
    if (!req.user.isAdmin && !req.user.access[targetJabatan]) {
      // Hapus file yang terlanjur tersimpan di disk jika tidak diizinkan
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: `Akses ditolak: Anda tidak memiliki wewenang mengunggah ke jabatan '${targetJabatan}'.`
      });
    }

    const storedName = req.file.autoStoredName || req.file.filename;
    const originalName = req.file.decodedOriginalName || req.file.originalname;
    const fileSize = req.file.size;

    // Simpan metadata ke tabel archives
    const [result] = await pool.query(
      `INSERT INTO archives (name, stored_name, original_name, isFolder, size, tapel, jabatan, parent_path, user_id)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [storedName, storedName, originalName, fileSize, currentTapel, targetJabatan, parentPath, req.user.id]
    );

    // Catat ke audit log
    await logActivity(
      req,
      'UPLOAD_FILE',
      `Mengunggah berkas '${storedName}' (${(fileSize / 1024).toFixed(1)} KB) ke [${currentTapel}] ${parentPath || targetJabatan}`
    );

    return res.status(201).json({
      success: true,
      message: 'Berkas berhasil diunggah.',
      archive: {
        id: result.insertId,
        name: storedName,
        stored_name: storedName,
        original_name: originalName,
        size: fileSize,
        tapel: currentTapel,
        jabatan: targetJabatan,
        parent_path: parentPath,
        user_id: req.user.id,
        uploader_nama: req.user.nama
      }
    });

  } catch (err) {
    console.error(`[Upload Archive Error]`, err);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(500).json({
      success: false,
      message: 'Gagal mengunggah berkas: ' + err.message
    });
  }
});

/**
 * POST /api/archives/folder
 * Membuat folder baru
 */
router.post('/folder', authenticateToken, checkLockedYear, async (req, res) => {
  try {
    const { name, tapel, jabatan, parent_path } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama folder tidak boleh kosong.' });
    }

    const folderName = name.trim().replace(/[\/\\:*?"<>|]/g, '');
    const activeTapel = await getActiveTapel();
    const currentTapel = tapel || activeTapel;
    const parentPath = parent_path || '';
    const targetJabatan = normalizeJabatanKey(jabatan || (parentPath ? parentPath.split('/')[0] : 'guru'));

    // Cek otorisasi jabatan jika bukan admin
    if (!req.user.isAdmin && !req.user.access[targetJabatan]) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak: Anda tidak memiliki wewenang membuat folder pada jabatan '${targetJabatan}'.`
      });
    }

    // Cek apakah folder sudah ada di DB
    const [existing] = await pool.query(
      'SELECT id FROM archives WHERE tapel = ? AND parent_path = ? AND name = ? AND isFolder = 1',
      [currentTapel, parentPath, folderName]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Folder dengan nama tersebut sudah ada.' });
    }

    // Buat direktori fisik
    const cleanTapel = sanitizePathSegment(currentTapel);
    let targetDiskPath = path.join(UPLOADS_BASE, cleanTapel);
    if (parentPath) {
      const rel = parentPath.replace(/\\/g, '/').split('/').filter(Boolean).join(path.sep);
      targetDiskPath = path.join(targetDiskPath, rel, folderName);
    } else {
      targetDiskPath = path.join(targetDiskPath, sanitizePathSegment(targetJabatan), folderName);
    }

    if (!fs.existsSync(targetDiskPath)) {
      fs.mkdirSync(targetDiskPath, { recursive: true });
    }

    // Simpan ke DB
    const [result] = await pool.query(
      `INSERT INTO archives (name, stored_name, original_name, isFolder, size, tapel, jabatan, parent_path, user_id)
       VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?)`,
      [folderName, folderName, folderName, currentTapel, targetJabatan, parentPath, req.user.id]
    );

    // Audit log
    await logActivity(
      req,
      'CREATE_FOLDER',
      `Membuat folder baru '${folderName}' di [${currentTapel}] ${parentPath || targetJabatan}`
    );

    return res.status(201).json({
      success: true,
      message: 'Folder baru berhasil dibuat.',
      archive: {
        id: result.insertId,
        name: folderName,
        stored_name: folderName,
        original_name: folderName,
        isFolder: 1,
        size: 0,
        tapel: currentTapel,
        jabatan: targetJabatan,
        parent_path: parentPath,
        user_id: req.user.id,
        uploader_nama: req.user.nama
      }
    });

  } catch (err) {
    console.error(`[Create Folder Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal membuat folder.' });
  }
});

/**
 * PUT /api/archives/:id/rename
 * Mengubah nama file atau folder
 */
router.put('/:id/rename', authenticateToken, checkLockedYear, async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ success: false, message: 'Nama baru wajib diisi.' });
    }

    const cleanNewName = newName.trim().replace(/[\/\\:*?"<>|]/g, '');

    // Cari arsip di DB
    const [archives] = await pool.query('SELECT * FROM archives WHERE id = ?', [id]);
    if (archives.length === 0) {
      return res.status(404).json({ success: false, message: 'Arsip tidak ditemukan.' });
    }

    const item = archives[0];

    // Cek penguncian tahun
    const activeTapel = await getActiveTapel();
    if (item.tapel !== activeTapel) {
      return res.status(403).json({
        success: false,
        message: `Arsip Tahun Pelajaran '${item.tapel}' telah dikunci (Read-Only).`
      });
    }

    // Cek otorisasi
    const normalizedJabatan = normalizeJabatanKey(item.jabatan);
    if (!req.user.isAdmin && !req.user.access[normalizedJabatan]) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const cleanTapel = sanitizePathSegment(item.tapel);
    const basePath = path.join(UPLOADS_BASE, cleanTapel);

    // Hitung path lama dan baru di disk
    let oldDiskPath, newDiskPath;
    if (item.parent_path) {
      const rel = item.parent_path.replace(/\\/g, '/').split('/').filter(Boolean).join(path.sep);
      oldDiskPath = path.join(basePath, rel, item.stored_name);
      newDiskPath = path.join(basePath, rel, cleanNewName);
    } else {
      oldDiskPath = path.join(basePath, item.stored_name);
      newDiskPath = path.join(basePath, cleanNewName);
    }

    // Rename di filesystem jika ada
    if (fs.existsSync(oldDiskPath)) {
      fs.renameSync(oldDiskPath, newDiskPath);
    }

    // Update di DB
    await pool.query(
      'UPDATE archives SET name = ?, stored_name = ?, original_name = ?, updated_at = NOW() WHERE id = ?',
      [cleanNewName, cleanNewName, cleanNewName, id]
    );

    // Jika yang di-rename adalah folder, update juga parent_path semua sub-item
    if (item.isFolder) {
      const oldPathPrefix = item.parent_path ? `${item.parent_path}/${item.name}` : item.name;
      const newPathPrefix = item.parent_path ? `${item.parent_path}/${cleanNewName}` : cleanNewName;

      await pool.query(
        `UPDATE archives 
         SET parent_path = CONCAT(?, SUBSTRING(parent_path, ?))
         WHERE tapel = ? AND (parent_path = ? OR parent_path LIKE ?)`,
        [newPathPrefix, oldPathPrefix.length + 1, item.tapel, oldPathPrefix, `${oldPathPrefix}/%`]
      );
    }

    await logActivity(
      req,
      'RENAME_ARCHIVE',
      `Mengubah nama ${item.isFolder ? 'folder' : 'berkas'} dari '${item.name}' menjadi '${cleanNewName}'`
    );

    return res.json({
      success: true,
      message: 'Nama berhasil diubah.',
      item: { ...item, name: cleanNewName, stored_name: cleanNewName }
    });

  } catch (err) {
    console.error(`[Rename Archive Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah nama arsip.' });
  }
});

/**
 * DELETE /api/archives/:id
 * Menghapus file atau folder beserta seluruh isinya
 */
router.delete('/:id', authenticateToken, checkLockedYear, async (req, res) => {
  try {
    const { id } = req.params;

    const [archives] = await pool.query('SELECT * FROM archives WHERE id = ?', [id]);
    if (archives.length === 0) {
      return res.status(404).json({ success: false, message: 'Arsip tidak ditemukan.' });
    }

    const item = archives[0];

    // Cek penguncian tahun
    const activeTapel = await getActiveTapel();
    if (item.tapel !== activeTapel) {
      return res.status(403).json({
        success: false,
        message: `Arsip Tahun Pelajaran '${item.tapel}' telah dikunci (Read-Only).`
      });
    }

    // Cek hak akses
    const normalizedJabatan = normalizeJabatanKey(item.jabatan);
    if (!req.user.isAdmin && !req.user.access[normalizedJabatan]) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const cleanTapel = sanitizePathSegment(item.tapel);
    const basePath = path.join(UPLOADS_BASE, cleanTapel);

    // Tentukan path disk
    let diskPath;
    if (item.parent_path) {
      const rel = item.parent_path.replace(/\\/g, '/').split('/').filter(Boolean).join(path.sep);
      diskPath = path.join(basePath, rel, item.stored_name);
    } else {
      diskPath = path.join(basePath, item.stored_name);
    }

    // Hapus fisik
    if (fs.existsSync(diskPath)) {
      if (item.isFolder) {
        fs.rmSync(diskPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(diskPath);
      }
    }

    // Hapus dari DB
    if (item.isFolder) {
      const folderPathPrefix = item.parent_path ? `${item.parent_path}/${item.name}` : item.name;
      // Hapus semua anak di bawah folder ini
      await pool.query(
        `DELETE FROM archives WHERE tapel = ? AND (parent_path = ? OR parent_path LIKE ?)`,
        [item.tapel, folderPathPrefix, `${folderPathPrefix}/%`]
      );
    }

    await pool.query('DELETE FROM archives WHERE id = ?', [id]);

    await logActivity(
      req,
      'DELETE_ARCHIVE',
      `Menghapus ${item.isFolder ? 'folder' : 'berkas'} '${item.name}' dari [${item.tapel}] ${item.parent_path || item.jabatan}`
    );

    return res.json({
      success: true,
      message: `${item.isFolder ? 'Folder' : 'Berkas'} berhasil dihapus.`
    });

  } catch (err) {
    console.error(`[Delete Archive Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus arsip.' });
  }
});

/**
 * GET /api/archives/:id/download
 * Download file tunggal
 */
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [archives] = await pool.query('SELECT * FROM archives WHERE id = ?', [id]);
    if (archives.length === 0) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    const item = archives[0];
    if (item.isFolder) {
      return res.status(400).json({ success: false, message: 'Gunakan fitur Download ZIP untuk mengunduh folder.' });
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
      return res.status(404).json({ success: false, message: 'File fisik tidak ditemukan pada server.' });
    }

    // Catat log aktivitas download
    await logActivity(req, 'DOWNLOAD_FILE', `Mengunduh berkas '${item.stored_name || item.original_name}' (ID: ${item.id})`);

    const downloadFileName = item.stored_name || item.name || item.original_name;
    return res.download(filePath, downloadFileName);

  } catch (err) {
    console.error(`[Download File Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal mengunduh berkas.' });
  }
});

/**
 * GET /api/archives/download-zip
 * Mengunduh seluruh folder dalam format ZIP menggunakan archiver
 */
router.get('/download-zip', authenticateToken, async (req, res) => {
  try {
    const activeTapel = await getActiveTapel();
    const tapel = req.query.tapel || activeTapel;
    const parentPath = req.query.parent_path || '';
    const folderName = req.query.name || 'Arsip';

    const cleanTapel = sanitizePathSegment(tapel);
    let sourceDiskPath = path.join(UPLOADS_BASE, cleanTapel);

    if (parentPath) {
      const rel = parentPath.replace(/\\/g, '/').split('/').filter(Boolean).join(path.sep);
      sourceDiskPath = path.join(sourceDiskPath, rel);
    }

    if (!fs.existsSync(sourceDiskPath)) {
      return res.status(404).json({ success: false, message: 'Folder fisik tidak ditemukan di server.' });
    }

    const zipFileName = `${folderName}_${cleanTapel}.zip`.replace(/[\/\\:*?"<>|]/g, '_');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

    const archive = archiver('zip', {
      zlib: { level: 9 } // Kompresi maksimum
    });

    archive.on('error', function (err) {
      console.error(`[Archiver Error]`, err);
      if (!res.headersSent) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    archive.pipe(res);

    // Tambahkan seluruh isi folder ke archive
    archive.directory(sourceDiskPath, false);

    await archive.finalize();

    // Catat audit log
    await logActivity(req, 'DOWNLOAD_ZIP', `Mengunduh folder ZIP '${folderName}' dari [${tapel}] ${parentPath}`);

  } catch (err) {
    console.error(`[Download ZIP Error]`, err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Gagal membuat file ZIP.' });
    }
  }
});

module.exports = router;
