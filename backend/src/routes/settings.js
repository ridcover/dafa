const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { generateSNPStructure } = require('../utils/folderGenerator');
const { logActivity } = require('../utils/auditLogger');
const { checkAndSyncAcademicYear, getNextTransitionInfo, getCalculatedAcademicYear } = require('../utils/academicYearAuto');

/**
 * GET /api/settings/tahun-akademik
 * Mengambil daftar tahun akademik dan tahun yang sedang aktif serta info kebijakan 01 Juli
 */
router.get('/tahun-akademik', authenticateToken, async (req, res) => {
  try {
    // Sinkronkan otomatis jika ada tahun ajaran baru
    await checkAndSyncAcademicYear();

    const [years] = await pool.query('SELECT * FROM tahun_akademik ORDER BY id DESC');
    const [settings] = await pool.query('SELECT active_tahun_pelajaran FROM global_settings WHERE id = 1');

    const activeTapel = settings.length > 0 ? settings[0].active_tahun_pelajaran : '2026/2027';

    return res.json({
      success: true,
      years: years.map(y => y.ta),
      activeTahun: activeTapel,
      currentCalculatedTapel: getCalculatedAcademicYear(),
      transitionInfo: getNextTransitionInfo()
    });
  } catch (err) {
    console.error(`[Get Settings Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal memuat pengaturan tahun akademik.' });
  }
});

/**
 * POST /api/settings/tahun-akademik
 * Menambah tahun akademik baru (Admin only)
 */
router.post('/tahun-akademik', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ta } = req.body;

    if (!ta || !ta.trim()) {
      return res.status(400).json({ success: false, message: 'Tahun akademik tidak boleh kosong (contoh: 2026/2027).' });
    }

    const cleanTa = ta.trim();

    // Cek duplikasi
    const [existing] = await pool.query('SELECT id FROM tahun_akademik WHERE ta = ?', [cleanTa]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `Tahun akademik '${cleanTa}' sudah ada.` });
    }

    await pool.query('INSERT INTO tahun_akademik (ta) VALUES (?)', [cleanTa]);

    // Otomatis buat struktur folder SNP untuk tahun ini
    await generateSNPStructure(cleanTa);

    await logActivity(req, 'ADD_TAHUN_AKADEMIK', `Menambahkan tahun akademik baru '${cleanTa}' dan membuat struktur 8 SNP.`);

    return res.status(201).json({
      success: true,
      message: `Tahun akademik '${cleanTa}' berhasil ditambahkan dan struktur folder SNP telah dibuat.`
    });
  } catch (err) {
    console.error(`[Add Tahun Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal menambah tahun akademik.' });
  }
});

/**
 * PUT /api/settings/active-tahun
 * Mengubah tahun pelajaran aktif & memastikan struktur 8 SNP ter-generate (Admin only)
 */
router.put('/active-tahun', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { active_tahun_pelajaran } = req.body;

    if (!active_tahun_pelajaran || !active_tahun_pelajaran.trim()) {
      return res.status(400).json({ success: false, message: 'Tahun pelajaran aktif wajib dipilih.' });
    }

    const newTapel = active_tahun_pelajaran.trim();

    // Update settings
    await pool.query(
      'INSERT INTO global_settings (id, active_tahun_pelajaran) VALUES (1, ?) ON DUPLICATE KEY UPDATE active_tahun_pelajaran = ?',
      [newTapel, newTapel]
    );

    // Otomatis buat struktur folder SNP jika belum ada
    await generateSNPStructure(newTapel);

    await logActivity(req, 'SET_ACTIVE_YEAR', `Mengaktifkan Tahun Pelajaran '${newTapel}'.`);

    return res.json({
      success: true,
      message: `Tahun Pelajaran '${newTapel}' berhasil diaktifkan. Struktur 8 SNP telah siap.`,
      activeTahun: newTapel
    });
  } catch (err) {
    console.error(`[Set Active Tahun Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal mengaktifkan tahun pelajaran.' });
  }
});

/**
 * POST /api/settings/generate-snp
 * Inisialisasi ulang struktur 8 SNP secara manual untuk tahun tertentu (Admin only)
 */
router.post('/generate-snp', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { tapel } = req.body;
    if (!tapel) {
      return res.status(400).json({ success: false, message: 'Tahun pelajaran wajib ditentukan.' });
    }

    await generateSNPStructure(tapel);

    await logActivity(req, 'GENERATE_SNP', `Melakukan inisialisasi struktur folder 8 SNP untuk tahun '${tapel}'.`);

    return res.json({
      success: true,
      message: `Struktur 8 SNP untuk tahun '${tapel}' berhasil disinkronkan.`
    });
  } catch (err) {
    console.error(`[Generate SNP Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal men-generate folder SNP.' });
  }
});

module.exports = router;
