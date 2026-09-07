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
const { normalizeJabatanKey, SNP_STRUCTURE } = require('../utils/folderGenerator');

const ALL_SNP_FOLDER_NAMES = [
  'Standar Pengelolaan (P)',
  'Standar Isi (SI)',
  'Standar Proses (SP)',
  'Standar Lulusan (SKL)',
  'Standar Sarpras (SAP)',
  'Standar Pembiayaan (PB)',
  'Standar PTK',
  'Standar Penilaian (PN)'
];

/**
 * Memeriksa apakah suatu item arsip adalah Folder Utama SNP yang terotomatisasi
 * (Level 0 root jabatan seperti 'kepsek', 'waka_kurikulum', atau Level 1 subfolder SNP standar)
 */
function isAutomatedMainFolder(item) {
  if (!item || (!item.isFolder && item.isFolder !== 1)) return false;
  // Level 0: Folder root jabatan (parent_path kosong atau null)
  if (!item.parent_path || item.parent_path.trim() === '') return true;

  const cleanParent = item.parent_path.replace(/\\/g, '/').trim();
  // Level 1: Subfolder terotomatisasi yang terdaftar di SNP_STRUCTURE
  const isSnpSubfolder = SNP_STRUCTURE.some(s => 
    s.jabatan === item.jabatan && 
    cleanParent === s.jabatan && 
    s.folders.includes(item.name)
  );
  if (isSnpSubfolder) return true;

  // Level 1 umum: tepat di bawah root jabatan tanpa slash bersarang dan bernama standar SNP
  if (!cleanParent.includes('/') && ALL_SNP_FOLDER_NAMES.includes(item.name)) {
    return true;
  }

  return false;
}

/**
 * Helper: Ambil tahun pelajaran aktif
 */
async function getActiveTapel() {
  try {
    const [settings] = await pool.query('SELECT active_tahun_pelajaran FROM global_settings WHERE id = 1');
    return settings.length > 0 ? settings[0].active_tahun_pelajaran : '2026/2027';
  } catch (err) {
    return '2026/2027';
  }
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

    const enrichedRows = rows.map(r => ({
      ...r,
      isMainFolder: Boolean(isAutomatedMainFolder(r))
    }));

    return res.json({
      success: true,
      data: enrichedRows,
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

    let totalFiles = 0;
    let totalFolders = 0;
    let totalBytes = 0;
    let jabatanStats = [];
    let recentFiles = [];

    // Total file & folder
    try {
      const [counts] = await pool.query(
        `SELECT 
          COUNT(CASE WHEN isFolder = 0 THEN 1 END) as totalFiles,
          COUNT(CASE WHEN isFolder = 1 THEN 1 END) as totalFolders,
          COALESCE(SUM(size), 0) as totalBytes
         FROM archives WHERE tapel = ?`,
        [tapel]
      );
      if (counts && counts.length > 0) {
        totalFiles = Number(counts[0].totalFiles) || 0;
        totalFolders = Number(counts[0].totalFolders) || 0;
        totalBytes = Number(counts[0].totalBytes) || 0;
      }
    } catch (cErr) {
      console.error(`[Stats Count Error]`, cErr.message);
    }

    // Statistik per Jabatan
    try {
      const [jStats] = await pool.query(
        `SELECT jabatan, 
                COUNT(CASE WHEN isFolder = 0 THEN 1 END) as fileCount,
                COALESCE(SUM(size), 0) as totalBytes
         FROM archives 
         WHERE tapel = ?
         GROUP BY jabatan`,
        [tapel]
      );
      jabatanStats = jStats || [];
    } catch (jErr) {
      console.error(`[Stats Jabatan Error]`, jErr.message);
    }

    // 5 Berkas Terbaru
    try {
      const [rFiles] = await pool.query(
        `SELECT a.*, u.nama as uploader_nama 
         FROM archives a
         LEFT JOIN users u ON a.user_id = u.id
         WHERE a.tapel = ? AND a.isFolder = 0
         ORDER BY a.created_at DESC
         LIMIT 5`,
        [tapel]
      );
      recentFiles = rFiles || [];
    } catch (rErr) {
      console.error(`[Stats Recent Error]`, rErr.message);
    }

    return res.json({
      success: true,
      stats: {
        tapel: tapel,
        activeTapel: activeTapel,
        totalFiles,
        totalFolders,
        totalBytes,
        jabatanDistribution: jabatanStats,
        recentFiles
      }
    });

  } catch (err) {
    console.error(`[Stats General Error]`, err);
    return res.json({
      success: true,
      stats: {
        tapel: req.query.tapel || '2026/2027',
        activeTapel: '2026/2027',
        totalFiles: 0,
        totalFolders: 0,
        totalBytes: 0,
        jabatanDistribution: [],
        recentFiles: []
      }
    });
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

    // Aktor non-admin tidak boleh meletakkan berkas di luar folder SNP yang telah ditentukan
    if (!req.user.isAdmin) {
      if (!parentPath || !parentPath.includes('/')) {
        if (fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return res.status(403).json({
          success: false,
          message: 'Akses ditolak: Berkas wajib diunggah ke dalam sub-folder standar SNP yang telah disediakan, bukan di luar folder.'
        });
      }
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
 * Membuat folder baru (Admin Only)
 */
router.post('/folder', authenticateToken, checkLockedYear, async (req, res) => {
  try {
    // Hanya Administrator yang boleh membuat folder baru
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Hanya Administrator yang berwenang membuat folder baru.'
      });
    }

    const { name, tapel, jabatan, parent_path } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama folder tidak boleh kosong.' });
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

    // Cek penguncian tahun (hanya berlaku untuk non-admin)
    const activeTapel = await getActiveTapel();
    if (!req.user.isAdmin && item.tapel !== activeTapel) {
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

    // Cegah pengubahan nama folder utama otomatis SNP oleh non-admin
    if (!req.user.isAdmin && isAutomatedMainFolder(item)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Folder utama standar SNP yang terotomatisasi dilindungi dan tidak dapat diubah namanya oleh non-admin.'
      });
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

    // Cek penguncian tahun (hanya berlaku untuk non-admin)
    const activeTapel = await getActiveTapel();
    if (!req.user.isAdmin && item.tapel !== activeTapel) {
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

    // Cegah penghapusan folder utama otomatis SNP oleh non-admin
    if (!req.user.isAdmin && isAutomatedMainFolder(item)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Folder utama standar SNP yang terotomatisasi dilindungi dan tidak dapat dihapus oleh non-admin.'
      });
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

/**
 * POST /api/archives/bulk-delete
 * Menghapus banyak berkas / folder sekaligus
 */
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar ID arsip yang akan dihapus wajib disertakan.' });
    }

    const activeTapel = await getActiveTapel();
    const [archives] = await pool.query('SELECT * FROM archives WHERE id IN (?)', [ids]);

    if (archives.length === 0) {
      return res.status(404).json({ success: false, message: 'Tidak ada arsip yang ditemukan.' });
    }

    let deletedCount = 0;
    const deletedNames = [];

    for (const item of archives) {
      // Validasi hak akses
      const normalizedJabatan = normalizeJabatanKey(item.jabatan);
      const hasPermission = req.user.isAdmin || (req.user.access && req.user.access[normalizedJabatan]);
      const isYearAllowed = req.user.isAdmin || item.tapel === activeTapel;

      if (!hasPermission || !isYearAllowed) {
        continue; // Lewati item yang tidak berizin
      }

      // Non-admin tidak boleh menghapus folder utama otomatis SNP
      if (!req.user.isAdmin && isAutomatedMainFolder(item)) {
        continue;
      }

      const cleanTapel = sanitizePathSegment(item.tapel);
      const basePath = path.join(UPLOADS_BASE, cleanTapel);
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
        await pool.query(
          `DELETE FROM archives WHERE tapel = ? AND (parent_path = ? OR parent_path LIKE ?)`,
          [item.tapel, folderPathPrefix, `${folderPathPrefix}/%`]
        );
      }

      await pool.query('DELETE FROM archives WHERE id = ?', [item.id]);
      deletedCount++;
      deletedNames.push(item.name);
    }

    if (deletedCount > 0) {
      await logActivity(
        req,
        'BULK_DELETE_ARCHIVE',
        `Menghapus ${deletedCount} arsip massal: ${deletedNames.slice(0, 5).join(', ')}${deletedNames.length > 5 ? '...' : ''}`
      );
    }

    if (deletedCount === 0 && archives.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Seluruh berkas/folder yang dipilih dilindungi atau berada di luar izin Anda.'
      });
    }

    return res.json({
      success: true,
      message: `Berhasil menghapus ${deletedCount} arsip terpilih.`,
      deletedCount
    });

  } catch (err) {
    console.error(`[Bulk Delete Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal melakukan penghapusan massal.' });
  }
});

/**
 * POST /api/archives/bulk-download
 * Mengunduh beberapa berkas & folder yang dipilih dalam satu file ZIP
 */
router.post('/bulk-download', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Pilih minimal satu berkas/folder untuk diunduh.' });
    }

    const [archives] = await pool.query('SELECT * FROM archives WHERE id IN (?)', [ids]);
    if (archives.length === 0) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="DAF_Arsip_Terpilih_${Date.now()}.zip"`);

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('error', function (err) {
      console.error(`[Bulk Archiver Error]`, err);
      if (!res.headersSent) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    archive.pipe(res);

    for (const item of archives) {
      const cleanTapel = sanitizePathSegment(item.tapel);
      const basePath = path.join(UPLOADS_BASE, cleanTapel);
      let diskPath;

      if (item.parent_path) {
        const rel = item.parent_path.replace(/\\/g, '/').split('/').filter(Boolean).join(path.sep);
        diskPath = path.join(basePath, rel, item.stored_name);
      } else {
        diskPath = path.join(basePath, item.stored_name);
      }

      if (fs.existsSync(diskPath)) {
        if (item.isFolder) {
          archive.directory(diskPath, item.name);
        } else {
          archive.file(diskPath, { name: item.name || item.stored_name });
        }
      }
    }

    await archive.finalize();

    await logActivity(req, 'BULK_DOWNLOAD_ZIP', `Mengunduh ${archives.length} berkas/folder terpilih sebagai ZIP.`);

  } catch (err) {
    console.error(`[Bulk Download Error]`, err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Gagal membuat file ZIP download massal.' });
    }
  }
});

module.exports = router;
